import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { createJob, getJob, assertYouTubeUrl, listJobs } from './jobStore.mjs'
import { ENABLE_YOUTUBE_DATA_API_UPLOAD, PIPELINE_ROOT } from './config.mjs'
import { uploadToYouTube } from './youtubeUpload.mjs'
import { runYtDlp } from './spawnUtil.mjs'
import { uploadToAll } from '../uploaders/uploader-bridge.js'

export const pipelineRouter = express.Router()
const publishSchedules = new Map()

function sendScheduleSnapshot() {
  return [...publishSchedules.values()].sort((a, b) => a.scheduledForMs - b.scheduledForMs)
}

function resolvePipelinePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null
  return path.isAbsolute(inputPath) ? inputPath : path.join(PIPELINE_ROOT, inputPath)
}

async function runAutonomousPublish(job, publishRequest = {}) {
  const useFile = publishRequest?.useOriginal ? job.videoFile : job.captionedFile
  if (!useFile) throw new Error('No video file for publish.')

  const targets = publishRequest?.targets || {}
  const platforms = Array.isArray(publishRequest?.platforms)
    ? publishRequest.platforms.filter((p) => ['youtube', 'instagram', 'tiktok'].includes(p))
    : []
  const results = {}
  const filePath = path.join(job.dir, useFile)
  const shortsPath = job.shortsFile ? path.join(job.dir, job.shortsFile) : null

  if (platforms.length > 0) {
    const uploadResults = await uploadToAll({
      videoPath: filePath,
      shortsPath,
      title: targets.youtube?.title || job.title || 'Video',
      description: targets.youtube?.description || 'Uploaded via Content Buddy',
      caption: targets.tiktok?.title || targets.instagram?.caption || job.title || 'Video',
      platforms,
      credentials: {
        youtube: {
          cookiePath: resolvePipelinePath(process.env.YT_COOKIE_PATH || './cookies/youtube.json'),
        },
        instagram: {
          username: process.env.IG_USERNAME,
          password: process.env.IG_PASSWORD,
          sessionPath: resolvePipelinePath(process.env.IG_SESSION_PATH || './cookies/instagram_session.json'),
        },
        tiktok: {
          cookiePath: resolvePipelinePath(process.env.TT_COOKIE_PATH || './cookies/tiktok.json'),
        },
      },
      onProgress: (_update) => {},
    })
    return { ok: true, autonomous: true, results: uploadResults }
  }

  if (ENABLE_YOUTUBE_DATA_API_UPLOAD && targets.youtube?.accessToken) {
    results.youtube = await uploadToYouTube(filePath, targets.youtube.accessToken, {
      title: targets.youtube.title || job.title,
      description: targets.youtube.description || 'Uploaded via Content Buddy',
      privacyStatus: targets.youtube.privacyStatus || 'private',
    })
  } else {
    results.youtube = {
      mode: 'autonomous',
      skipped: true,
      reason:
        ENABLE_YOUTUBE_DATA_API_UPLOAD
          ? 'Provide targets.youtube.accessToken to use YouTube Data API (optional).'
          : 'YouTube Data API upload disabled by default (no API keys). Use manual upload or browser automation scripts.',
      localFile: filePath,
      captionSource: job.captionSource,
    }
  }

  results.instagram = {
    mode: 'autonomous',
    skipped: true,
    reason:
      'Use instagrapi / Playwright with saved session (no Meta Graph quota). See README alternatives table.',
  }

  results.tiktok = {
    mode: 'autonomous',
    skipped: true,
    reason:
      'Use tiktok-uploader / Playwright with cookies (no TikTok developer API). See README.',
  }

  return { ok: true, autonomous: true, results }
}

async function executeScheduledPublish(scheduleId) {
  const task = publishSchedules.get(scheduleId)
  if (!task) return
  task.status = 'running'
  task.lastRunAt = new Date().toISOString()
  const job = getJob(task.jobId)
  if (!job || job.state !== 'completed') {
    task.status = 'failed'
    task.error = 'Job is missing or not completed'
    return
  }
  try {
    const result = await runAutonomousPublish(job, task.publishRequest)
    task.status = 'completed'
    task.result = result
    task.error = null
  } catch (e) {
    task.status = 'failed'
    task.error = e instanceof Error ? e.message : String(e)
  }
}

setInterval(async () => {
  const now = Date.now()
  for (const [id, task] of publishSchedules.entries()) {
    if (task.status !== 'scheduled') continue
    if (task.scheduledForMs <= now) {
      await executeScheduledPublish(id)
    }
  }
}, 1000)

pipelineRouter.get('/jobs', (_req, res) => {
  res.json({ jobs: listJobs() })
})

pipelineRouter.get('/schedules', (_req, res) => {
  res.json({ schedules: sendScheduleSnapshot() })
})

pipelineRouter.post('/start', async (req, res) => {
  try {
    const url = req.body?.url?.trim()
    if (!url) return res.status(400).json({ error: 'url is required' })
    assertYouTubeUrl(url)
    const job = await createJob(url)
    res.status(202).json({ jobId: job.id, state: job.state })
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

pipelineRouter.get('/extract', async (req, res) => {
  try {
    const videoUrl = String(req.query.url || '').trim()
    if (!videoUrl) return res.status(400).json({ error: 'URL parameter is required' })
    assertYouTubeUrl(videoUrl)

    const infoResult = await runYtDlp(['-j', '--no-download', '--no-warnings', '--no-playlist', videoUrl])
    const info = JSON.parse(infoResult.stdout || '{}')
    const formats = (info.formats || [])
      .filter((f) => f.url && f.protocol && ['https', 'http'].includes(f.protocol))
      .map((f) => ({
        format_id: f.format_id || '',
        ext: f.ext || 'mp4',
        resolution: f.resolution || f.format_note || (f.height ? `${f.height}p` : 'audio'),
        filesize: f.filesize || f.filesize_approx || null,
        url: f.url,
        vcodec: f.vcodec || 'none',
        acodec: f.acodec || 'none',
        has_video: f.vcodec !== 'none' && f.vcodec != null,
        has_audio: f.acodec !== 'none' && f.acodec != null,
      }))
      .sort((a, b) => {
        const scoreA = (a.has_video ? 2 : 0) + (a.has_audio ? 1 : 0)
        const scoreB = (b.has_video ? 2 : 0) + (b.has_audio ? 1 : 0)
        return scoreB - scoreA
      })
    res.json({
      title: info.title || 'Untitled',
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
      duration: info.duration || 0,
      formats,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

pipelineRouter.get('/:jobId/status', (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    id: job.id,
    state: job.state,
    title: job.title,
    error: job.error,
    captionSource: job.captionSource,
    files: {
      original: job.videoFile || null,
      captioned: job.captionedFile || null,
      subtitles: job.srtFile || null,
    },
  })
})

pipelineRouter.get('/:jobId/download/original', async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job?.videoFile) return res.status(404).json({ error: 'Original not ready' })
  const p = path.join(job.dir, job.videoFile)
  res.download(p, job.videoFile, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: err.message })
  })
})

pipelineRouter.get('/:jobId/download/captioned', async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job?.captionedFile) return res.status(404).json({ error: 'Captioned file not ready' })
  const p = path.join(job.dir, job.captionedFile)
  const name = `${(job.title || 'video').replace(/[^\w\-]+/g, '_').slice(0, 80)}_captioned.mp4`
  res.download(p, name, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: err.message })
  })
})

pipelineRouter.get('/:jobId/captions.srt', async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job?.srtFile) return res.status(404).json({ error: 'Subtitles not ready' })
  const p = path.join(job.dir, job.srtFile)
  res.type('text/srt').send(await fs.readFile(p, 'utf8'))
})

/**
 * Default: autonomous / no cloud keys — returns file paths and guidance.
 * Optional: ENABLE_YOUTUBE_DATA_API_UPLOAD=true + OAuth access token → YouTube Data API resumable upload.
 */
pipelineRouter.post('/:jobId/publish', async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.state !== 'completed') {
    return res.status(400).json({ error: 'Pipeline must be completed before publish.' })
  }

  try {
    res.json(await runAutonomousPublish(job, req.body || {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})

pipelineRouter.post('/:jobId/schedule', async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.state !== 'completed') {
    return res.status(400).json({ error: 'Pipeline must be completed before scheduling publish.' })
  }

  const scheduledFor = String(req.body?.scheduledFor || '').trim()
  const when = Date.parse(scheduledFor)
  if (!Number.isFinite(when)) {
    return res.status(400).json({ error: 'scheduledFor must be a valid ISO datetime string' })
  }
  if (when <= Date.now()) {
    return res.status(400).json({ error: 'scheduledFor must be in the future' })
  }

  const id = `${job.id}-${when}`
  publishSchedules.set(id, {
    id,
    jobId: job.id,
    scheduledFor,
    scheduledForMs: when,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    publishRequest: req.body?.publishRequest || {},
    error: null,
    result: null,
    lastRunAt: null,
  })
  res.status(202).json({ ok: true, scheduleId: id, scheduledFor })
})

pipelineRouter.delete('/schedules/:scheduleId', (req, res) => {
  const task = publishSchedules.get(req.params.scheduleId)
  if (!task) return res.status(404).json({ error: 'Schedule not found' })
  if (task.status === 'running') return res.status(409).json({ error: 'Schedule is currently running' })
  publishSchedules.delete(req.params.scheduleId)
  res.json({ ok: true })
})

pipelineRouter.post('/schedules/:scheduleId/run-now', async (req, res) => {
  const task = publishSchedules.get(req.params.scheduleId)
  if (!task) return res.status(404).json({ error: 'Schedule not found' })
  if (task.status === 'running') return res.status(409).json({ error: 'Schedule is already running' })
  task.scheduledForMs = Date.now()
  task.scheduledFor = new Date(task.scheduledForMs).toISOString()
  task.status = 'scheduled'
  try {
    await executeScheduledPublish(req.params.scheduleId)
    res.json({ ok: true, schedule: publishSchedules.get(req.params.scheduleId) })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
})
