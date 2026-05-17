import React, { useEffect, useRef, useState } from 'react'
import { Download, Copy, Link as LinkIcon, Loader2, PlayCircle, Video, Music, Cpu, Film } from 'lucide-react'
import {
  startPipeline,
  getPipelineStatus,
  downloadOriginalUrl,
  downloadCaptionedUrl,
  publishAutonomous,
  type PipelineStatus,
} from '@/services/pipelineService'
import { readJsonResponse, proxyHelp } from '@/utils/httpJson'

interface Format {
  format_id: string
  ext: string
  resolution: string
  filesize: number | null
  url: string
  vcodec: string
  acodec: string
  has_video: boolean
  has_audio: boolean
}

interface VideoInfo {
  title: string
  thumbnail: string
  duration: number
  formats: Format[]
}

type TabMode = 'autonomous' | 'legacy'

export const VideoUpload: React.FC = () => {
  const [mode, setMode] = useState<TabMode>('autonomous')
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<PipelineStatus | null>(null)
  const [publishNote, setPublishNote] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await getPipelineStatus(jobId)
        setJobStatus(s)
        if (s.state === 'completed' || s.state === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
      }
    }, 1200)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobId])

  const handleAutonomousStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setIsLoading(true)
    setError(null)
    setJobId(null)
    setJobStatus(null)
    setPublishNote(null)
    try {
      const { jobId: id } = await startPipeline(url.trim())
      setJobId(id)
      setJobStatus(await getPipelineStatus(id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pipeline failed to start')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLegacyFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setIsLoading(true)
    setError(null)
    setVideoInfo(null)
    try {
      const response = await fetch(`/pipeline/extract?url=${encodeURIComponent(url.trim())}`)
      const data = await readJsonResponse(response)
      if (!response.ok || data.error) {
        throw new Error(String(data.error || `Extract failed (${response.status})`) + proxyHelp(response.status, 'pipeline'))
      }
      const formats = ((data.formats as Format[]) || []).filter((f) => f.url && (f.has_video || f.has_audio))
      setVideoInfo({
        title: String(data.title || ''),
        thumbnail: String(data.thumbnail || ''),
        duration: Number(data.duration || 0),
        formats,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or blocked link.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePublishInfo = async () => {
    if (!jobId) return
    setPublishNote(null)
    try {
      const data = await publishAutonomous(jobId, false)
      setPublishNote(JSON.stringify(data.results, null, 2))
    } catch (err: unknown) {
      setPublishNote(err instanceof Error ? err.message : 'Publish info failed')
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedUrl(value)
      setTimeout(() => setCopiedUrl(null), 1200)
    } catch {
      setCopiedUrl(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-slideUp">
      <div className="text-center mb-6 mt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-secondary">
          Content Buddy - <span className="text-primary">Autonomous pipeline</span>
        </h1>
        <p className="text-gray-500 max-w-3xl mx-auto text-sm md:text-base">
          YouTube / Shorts → download locally → captions from yt-dlp auto-subs or local faster-whisper → burned MP4.
          No paid STT API required.
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-5 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setMode('autonomous')
            setError(null)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${mode === 'autonomous' ? 'bg-primary text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <span className="inline-flex items-center gap-2"><Cpu size={16} /> YouTube autonomous</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('legacy')
            setError(null)
            setJobId(null)
            setJobStatus(null)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${mode === 'legacy' ? 'bg-primary text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <span className="inline-flex items-center gap-2"><Film size={16} /> Link preview (yt-dlp)</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-xl p-3 md:p-5 border border-gray-100">
        <form onSubmit={mode === 'autonomous' ? handleAutonomousStart : handleLegacyFetch}>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="text-gray-400" size={18} />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder={mode === 'autonomous' ? 'https://www.youtube.com/shorts/... or watch?v=...' : 'Paste YouTube link for format preview'}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !url}
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0"
            >
              {isLoading ? <><Loader2 className="animate-spin" size={18} /> {mode === 'autonomous' ? 'Starting...' : 'Fetching...'}</> : mode === 'autonomous' ? <><Cpu size={18} /> Run pipeline</> : <><Download size={18} /> Preview formats</>}
            </button>
          </div>
        </form>

        {error && <div className="mt-3 p-2.5 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">{error}</div>}

        {mode === 'autonomous' && jobStatus && (
          <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{jobStatus.title || 'Processing'}</p>
                <p className="text-xs text-gray-500">
                  Job {jobStatus.id.slice(0, 8)}... · {jobStatus.state}
                  {jobStatus.captionSource ? ` · captions: ${jobStatus.captionSource}` : ''}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${jobStatus.state === 'completed' ? 'bg-green-100 text-green-800' : jobStatus.state === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                {jobStatus.state}
              </span>
            </div>

            {jobStatus.error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{jobStatus.error}</p>}

            {jobStatus.state !== 'failed' && jobStatus.files.original && (
              <a href={downloadOriginalUrl(jobId!)} download className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Download size={16} /> Save original video
              </a>
            )}

            {jobStatus.state === 'completed' && jobId && (
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <a href={downloadCaptionedUrl(jobId)} download className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                  <Download size={16} /> Save captioned MP4
                </a>
                <a href={`/pipeline/${encodeURIComponent(jobId)}/captions.srt`} download={`${(jobStatus.title || 'captions').slice(0, 40)}.srt`} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
                  Download .srt
                </a>
                <button type="button" onClick={handlePublishInfo} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-blue-50">
                  Publish info
                </button>
              </div>
            )}

            {publishNote && (
              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto max-h-48">{publishNote}</pre>
            )}
          </div>
        )}
      </div>

      {mode === 'legacy' && videoInfo && (
        <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
            <div className="relative bg-gray-900 group">
              <img src={videoInfo.thumbnail} alt={videoInfo.title} className="w-full h-full object-cover min-h-[220px]" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <PlayCircle size={42} className="text-white" />
              </div>
            </div>
            <div className="p-4 md:p-5 flex flex-col min-w-0">
              <h2 className="text-xl font-bold text-gray-800 line-clamp-2 mb-3">{videoInfo.title}</h2>
              <div className="flex-1 overflow-y-auto max-h-[430px] pr-1 space-y-2">
                {videoInfo.formats.map((format, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 items-center p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${format.has_video ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {format.has_video ? <Video size={16} /> : <Music size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {format.resolution || 'Audio'} <span className="uppercase text-xs text-gray-500">.{format.ext}</span>
                        </p>
                        <p className="text-xs text-gray-500">{formatFileSize(format.filesize)}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <a href={format.url} target="_blank" rel="noopener noreferrer" download className="px-2.5 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-md">
                        Download
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(format.url)}
                        className="px-2.5 py-1.5 bg-white text-gray-700 border border-gray-300 text-xs font-semibold rounded-md inline-flex items-center gap-1"
                      >
                        <Copy size={12} /> {copiedUrl === format.url ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
