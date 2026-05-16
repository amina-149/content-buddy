import fs from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import {
  DATA_ROOT,
  ALLOWED_HOSTS,
  PYTHON_CMD,
  TRANSCRIBE_SCRIPT,
  PIPELINE_ROOT,
} from './config.mjs'
import { runCommand, runYtDlp, ffmpegBin } from './spawnUtil.mjs'

/** @typedef {'queued' | 'downloading' | 'downloaded' | 'captioning' | 'completed' | 'failed'} JobState */

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {string} url
 * @property {JobState} state
 * @property {string} [error]
 * @property {string} dir
 * @property {string} [videoFile]
 * @property {string} [vttFile]
 * @property {string} [srtFile]
 * @property {string} [captionedFile]
 * @property {string} [title]
 * @property {number} createdAt
 * @property {string} [captionSource]
 */

const jobs = new Map()

export function assertYouTubeUrl(urlString) {
  let u
  try {
    u = new URL(urlString)
  } catch {
    throw new Error('Invalid URL')
  }
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error('Only YouTube URLs are allowed (including Shorts).')
  }
}

export function getJob(id) {
  return jobs.get(id)
}

export function listJobs() {
  return [...jobs.values()].map((j) => ({
    id: j.id,
    state: j.state,
    title: j.title,
    createdAt: j.createdAt,
    error: j.error,
    captionSource: j.captionSource,
  }))
}

/**
 * @param {string} url
 */
export async function createJob(url) {
  assertYouTubeUrl(url)
  const id = uuid()
  const dir = path.join(DATA_ROOT, id)
  await fs.mkdir(dir, { recursive: true })

  /** @type {Job} */
  const job = {
    id,
    url,
    state: 'queued',
    dir,
    createdAt: Date.now(),
  }
  jobs.set(id, job)
  runPipeline(job).catch((e) => {
    job.state = 'failed'
    job.error = e instanceof Error ? e.message : String(e)
  })
  return job
}

/**
 * @param {Job} job
 */
async function runPipeline(job) {
  job.state = 'downloading'

  await runYtDlp(
    [
      '-f',
      'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b',
      '--merge-output-format',
      'mp4',
      '--no-playlist',
      '-o',
      'source.%(ext)s',
      job.url,
    ],
    { cwd: job.dir }
  )

  const files = await fs.readdir(job.dir)
  const video = files.find((f) => f.startsWith('source.') && !f.endsWith('.part'))
  if (!video) throw new Error('Download finished but no video file found.')
  job.videoFile = video
  job.state = 'downloaded'

  try {
    const r = await runYtDlp(['--print', '%(title)s', '--skip-download', job.url], { cwd: job.dir })
    job.title = r.stdout.trim() || 'Video'
  } catch {
    job.title = 'Video'
  }

  job.state = 'captioning'

  await runYtDlp(
    [
      '--write-auto-sub',
      '--write-sub',
      '--sub-langs',
      'en.*',
      '--skip-download',
      '-o',
      'subs',
      job.url,
    ],
    { cwd: job.dir }
  ).catch(() => {})

  const afterSubs = await fs.readdir(job.dir)
  const vtt = afterSubs.find((f) => f.endsWith('.vtt'))
  const srtPath = path.join(job.dir, 'captions.srt')

  if (vtt) {
    job.vttFile = vtt
    await runCommand(ffmpegBin(), ['-y', '-i', vtt, srtPath], { cwd: job.dir })
    job.srtFile = 'captions.srt'
    job.captionSource = 'youtube_auto_subs'
  } else {
    const videoAbs = path.join(job.dir, job.videoFile)
    const localOk = await tryLocalWhisper(videoAbs, srtPath)
    if (localOk) {
      job.srtFile = 'captions.srt'
      job.captionSource = 'faster_whisper_local'
    } else {
      await fs.writeFile(
        srtPath,
        [
          '1',
          '00:00:00,000 --> 00:00:05,000',
          'No English auto-captions from YouTube for this video.',
          '',
          '2',
          '00:00:05,000 --> 00:00:10,000',
          'Install local STT: pip install faster-whisper',
          '',
          '3',
          '00:00:10,000 --> 00:00:15,000',
          'Then run npm run doctor — pipeline will transcribe offline on your machine.',
          '',
        ].join('\n'),
        'utf8'
      )
      job.srtFile = 'captions.srt'
      job.captionSource = 'placeholder'
    }
  }

  const outName = 'captioned.mp4'
  const srtForFfmpeg = path
    .join(job.dir, job.srtFile)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")

  await runCommand(
    ffmpegBin(),
    [
      '-y',
      '-i',
      job.videoFile,
      '-vf',
      `subtitles='${srtForFfmpeg}'`,
      '-c:a',
      'copy',
      outName,
    ],
    { cwd: job.dir }
  )
  job.captionedFile = outName
  job.state = 'completed'
}

/**
 * @param {string} videoAbs
 * @param {string} srtOutAbs
 */
async function tryLocalWhisper(videoAbs, srtOutAbs) {
  try {
    await runCommand(
      PYTHON_CMD,
      [TRANSCRIBE_SCRIPT, videoAbs, srtOutAbs],
      { cwd: PIPELINE_ROOT, env: process.env }
    )
    const st = await fs.stat(srtOutAbs)
    return st.size > 20
  } catch {
    return false
  }
}
