import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import { PORT, DATA_ROOT } from './src/config.mjs'
import { pipelineRouter } from './src/routes.mjs'

await fs.mkdir(DATA_ROOT, { recursive: true })

const app = express()
app.use(
  cors({
    origin: [/localhost:\d+$/],
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({ service: 'content-buddy-pipeline', ok: true })
})

app.use('/api/pipeline', pipelineRouter)

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err?.message || 'Server error' })
})

app.listen(PORT, () => {
  console.log(`Content Buddy pipeline listening on http://localhost:${PORT}`)
  console.log(`Job data directory: ${DATA_ROOT}`)
  console.log('Requires yt-dlp and ffmpeg on PATH (optional: pip install faster-whisper).')
})
