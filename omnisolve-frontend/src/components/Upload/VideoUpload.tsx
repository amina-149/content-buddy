import React, { useState } from 'react'
import { Download, Link as LinkIcon, Loader2, PlayCircle, Video, Music } from 'lucide-react'

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

export const VideoUpload: React.FC = () => {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return

    setIsLoading(true)
    setError(null)
    setVideoInfo(null)

    try {
      const response = await fetch(`/api/extract?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch video details')
      }

      // Filter to sensible formats (has video or audio, valid URL)
      const validFormats = data.formats.filter((f: Format) => f.url && (f.has_video || f.has_audio))
      
      setVideoInfo({
        ...data,
        formats: validFormats
      })
    } catch (err: any) {
      setError(err.message || 'Error parsing the video link. Make sure it is valid and public.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-4xl mx-auto animate-slideUp">
      
      {/* Hero Section */}
      <div className="text-center mb-12 mt-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-secondary">
          Download Videos <span className="text-primary">Instantly</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          Paste a link from YouTube, Instagram, TikTok, Facebook or Twitter to download the video in high quality mp4.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6 border border-gray-100 max-w-3xl mx-auto relative z-10">
        <form onSubmit={handleFetch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <LinkIcon className="text-gray-400" size={20} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="Paste your video link here"
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url}
            className="px-8 py-4 bg-green-500 text-white font-bold text-lg rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Processing...
              </>
            ) : (
              <>
                <Download size={24} />
                Download
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-sm">{error}</span>
          </div>
        )}
      </div>

      {/* Results Section */}
      {videoInfo && (
        <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-fadeIn max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row">
            
            {/* Thumbnail */}
            <div className="md:w-2/5 relative bg-gray-900 group">
              <img 
                src={videoInfo.thumbnail} 
                alt={videoInfo.title} 
                className="w-full h-full object-cover min-h-[200px]"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <PlayCircle size={48} className="text-white" />
              </div>
              {videoInfo.duration && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded">
                  {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>

            {/* Info & Download Links */}
            <div className="p-6 md:w-3/5 flex flex-col">
              <h2 className="text-xl font-bold text-gray-800 line-clamp-2 mb-4">
                {videoInfo.title}
              </h2>

              <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-2 custom-scrollbar">
                {videoInfo.formats.map((format, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 border border-gray-100 hover:border-green-200 rounded-xl transition group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${format.has_video ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {format.has_video ? <Video size={18} /> : <Music size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800">
                          {format.resolution || 'Audio'} <span className="uppercase text-xs font-semibold text-gray-500 ml-1">.{format.ext}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {format.has_video && !format.has_audio ? 'No Audio • ' : ''}
                          {formatFileSize(format.filesize)}
                        </p>
                      </div>
                    </div>
                    
                    <a
                      href={format.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white text-green-600 border border-green-200 font-bold text-sm rounded-lg hover:bg-green-500 hover:text-white hover:border-green-500 transition shadow-sm"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Info */}
      {!videoInfo && !isLoading && (
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Download size={32} />
            </div>
            <h3 className="font-bold text-lg mb-2">Fast & Free</h3>
            <p className="text-gray-500 text-sm">Download your favorite videos instantly with no limitations or hidden fees.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2">High Quality</h3>
            <p className="text-gray-500 text-sm">Extracts the highest possible resolution available for the source video automatically.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LinkIcon size={32} />
            </div>
            <h3 className="font-bold text-lg mb-2">Multiple Platforms</h3>
            <p className="text-gray-500 text-sm">Supported on YouTube, Instagram, TikTok, Facebook, Twitter and many more.</p>
          </div>
        </div>
      )}
    </div>
  )
}
