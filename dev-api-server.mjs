import { execFile } from 'child_process'
import http from 'http'
import { URL } from 'url'

const PORT = 3001
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const parsedUrl = new URL(req.url || '', `http://localhost:${PORT}`)

  if (parsedUrl.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'extract-api' })
    return
  }

  if (parsedUrl.pathname !== '/api/extract') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const videoUrl = parsedUrl.searchParams.get('url')
  if (!videoUrl) {
    sendJson(res, 400, { error: 'URL parameter is required' })
    return
  }

  console.log(`[API] Extracting info for: ${videoUrl}`)

  const args = ['-m', 'yt_dlp', '-j', '--no-download', '--no-warnings', '--no-playlist', videoUrl]

  execFile(
    PYTHON,
    args,
    { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        const hint =
          stderr?.includes('No module named') || stderr?.includes('yt_dlp')
            ? ' Install: pip install -U yt-dlp'
            : ''
        console.error('[API] yt-dlp error:', stderr || err.message)
        sendJson(res, 500, {
          error: `Failed to extract video info: ${(stderr || err.message).slice(0, 500)}${hint}`,
        })
        return
      }

      try {
        const info = JSON.parse(stdout)
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

        sendJson(res, 200, {
          title: info.title || 'Untitled',
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
          duration: info.duration || 0,
          formats,
        })
      } catch (parseErr) {
        console.error('[API] JSON parse error:', parseErr.message)
        sendJson(res, 500, { error: 'Failed to parse yt-dlp output' })
      }
    }
  )
})

server.listen(PORT, () => {
  console.log(`\n  Content Buddy extract API: http://localhost:${PORT}`)
  console.log(`  GET /api/extract?url=VIDEO_URL  (python: ${PYTHON})\n`)
})
