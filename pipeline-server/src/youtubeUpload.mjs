import fs from 'fs/promises'

/**
 * Optional YouTube Data API resumable upload (only when ENABLE_YOUTUBE_DATA_API_UPLOAD=true + OAuth token).
 * @param {string} filePath
 * @param {string} accessToken
 * @param {{ title?: string, description?: string, privacyStatus?: string }} meta
 */
export async function uploadToYouTube(filePath, accessToken, meta) {
  const stat = await fs.stat(filePath)
  const size = stat.size
  const title = (meta.title || 'Upload from Content Buddy').slice(0, 100)
  const description = meta.description || ''
  const privacyStatus = meta.privacyStatus || 'private'

  const metadata = {
    snippet: { title, description, categoryId: '22' },
    status: { privacyStatus, selfDeclaredMadeForKids: false },
  }

  const init = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!init.ok) {
    const t = await init.text()
    throw new Error(`YouTube init upload failed: ${init.status} ${t.slice(0, 800)}`)
  }

  const location = init.headers.get('location')
  if (!location) throw new Error('YouTube did not return resumable upload URL.')

  const body = await fs.readFile(filePath)
  const put = await fetch(location, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
    },
    body,
  })

  if (!put.ok) {
    const t = await put.text()
    throw new Error(`YouTube upload failed: ${put.status} ${t.slice(0, 800)}`)
  }

  const json = await put.json()
  return {
    videoId: json.id,
    url: `https://www.youtube.com/watch?v=${json.id}`,
  }
}
