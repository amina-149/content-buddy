import React, { useState } from 'react'
import { useVideoStore } from '@/stores/videoStore'
import { LoadingSpinner } from '../Common/LoadingSpinner'
import { Video as VideoIcon, Download, Edit3, Check } from 'lucide-react'

export const CaptionReview: React.FC = () => {
  const videos = useVideoStore((state) => state.videos)
  const selectedVideo = useVideoStore((state) => state.selectedVideo)
  const selectVideo = useVideoStore((state) => state.selectVideo)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState('')

  const videosWithCaptions = videos.filter((v) => v.captions && v.captions.length > 0)

  const handleDownloadCaption = (caption: any) => {
    const blob = new Blob([caption.srtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caption-${caption.language}.srt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleEditCaption = (captionId: string, content: string) => {
    setEditingCaption(captionId)
    setEditedContent(content)
  }

  const handleSaveCaption = () => {
    setEditingCaption(null)
    setEditedContent('')
  }

  return (
    <div className="max-w-4xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Review Captions</h1>
      <p className="text-gray-500 mb-8">Review and edit AI-generated captions</p>

      {videosWithCaptions.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
          <VideoIcon size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No captions yet</h3>
          <p className="text-gray-500">Upload a video first — captions will appear here once generated.</p>
        </div>
      )}

      {videosWithCaptions.length > 0 && (
        <div className="space-y-4">
          {videosWithCaptions.map((video) => (
            <div
              key={video.id}
              onClick={() => selectVideo(video)}
              className={`p-6 rounded-xl border-2 cursor-pointer transition ${
                selectedVideo?.id === video.id
                  ? 'border-primary bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{video.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{video.captions.length} caption(s) · {video.status}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  video.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  video.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {video.status}
                </span>
              </div>

              {selectedVideo?.id === video.id && video.captions && (
                <div className="mt-6 space-y-4">
                  {video.captions.map((caption) => (
                    <div key={caption.id} className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{caption.language}</span>
                          {caption.accuracy && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              {caption.accuracy}% accuracy
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingCaption === caption.id ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSaveCaption() }}
                              className="flex items-center gap-1 text-green-600 hover:text-green-700 text-sm"
                            >
                              <Check size={14} /> Save
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditCaption(caption.id, caption.srtContent) }}
                              className="flex items-center gap-1 text-gray-500 hover:text-primary text-sm"
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadCaption(caption) }}
                            className="flex items-center gap-1 text-primary hover:text-blue-600 text-sm"
                          >
                            <Download size={14} /> Download SRT
                          </button>
                        </div>
                      </div>
                      {editingCaption === caption.id ? (
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg min-h-[120px] outline-none focus:ring-2 focus:ring-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap break-words font-mono text-gray-700 bg-white p-3 rounded border border-gray-100">
                          {caption.srtContent}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
