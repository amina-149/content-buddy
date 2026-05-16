import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { createRequire } from 'module'
import { createJob, getJob, assertYouTubeUrl, listJobs } from './jobStore.mjs'
import { ENABLE_YOUTUBE_DATA_API_UPLOAD, PIPELINE_ROOT } from './config.mjs'
import { uploadToYouTube } from './youtubeUpload.mjs'

export const pipelineRouter = express.Router()
const require = createRequire(import.meta.url)
const { uploadToAll } = require('../uploaders/uploader-bridge.js')

function resolvePipelinePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null
  return path.isAbsolute(inputPath) ? inputPath : path.join(PIPELINE_ROOT, inputPath)
}

pipelineRouter.get('/jobs', (_req, res) => {
  res.json({ jobs: listJobs() })
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
  const useFile = req.body?.useOriginal ? job.videoFile : job.captionedFile
  if (!useFile) return res.status(400).json({ error: 'No video file for publish.' })

  const targets = req.body?.targets || {}
  const platforms = Array.isArray(req.body?.platforms)
    ? req.body.platforms.filter((p) => ['youtube', 'instagram', 'tiktok'].includes(p))
    : []
  const results = {}
  const filePath = path.join(job.dir, useFile)
  const shortsPath = job.shortsFile ? path.join(job.dir, job.shortsFile) : null

  try {
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
      return res.json({ ok: true, autonomous: true, results: uploadResults })
    }

    if (
      ENABLE_YOUTUBE_DATA_API_UPLOAD &&
      targets.youtube?.accessToken
    ) {
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

    res.json({ ok: true, autonomous: true, results })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e), results })
  }
})
