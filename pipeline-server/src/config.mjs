import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const PORT = Number(process.env.PIPELINE_PORT || process.env.PORT || 3002)
export const DATA_ROOT = path.resolve(
  process.env.PIPELINE_DATA_DIR || path.join(__dirname, '..', 'data', 'jobs')
)

/** When true, POST .../publish may call YouTube Data API if user supplies OAuth access token (optional). */
export const ENABLE_YOUTUBE_DATA_API_UPLOAD =
  String(process.env.ENABLE_YOUTUBE_DATA_API_UPLOAD || '').toLowerCase() === 'true'

export const PYTHON_CMD = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')

export const PIPELINE_ROOT = path.resolve(__dirname, '..')
export const TRANSCRIBE_SCRIPT = path.join(PIPELINE_ROOT, 'scripts', 'transcribe_faster_whisper.py')

export const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'www.youtu.be',
])
