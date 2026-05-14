import React, { useEffect } from 'react'
import { useJobStore } from '@/stores/jobStore'
import { useVideoStore } from '@/stores/videoStore'
import { JobProgress } from './JobProgress'

export const JobMonitor: React.FC = () => {
  const jobs = useJobStore((state) => state.jobs)
  const setJobs = useJobStore((state) => state.setJobs)
  const videos = useVideoStore((state) => state.videos)

  // Generate jobs from videos
  useEffect(() => {
    const captionJobs = videos.map((v) => ({
      id: `cj-${v.id}`,
      userId: v.userId,
      videoId: v.id,
      status: v.status === 'COMPLETED' ? 'COMPLETED' as const : v.status === 'PROCESSING' ? 'PROCESSING' as const : 'PENDING' as const,
      progress: v.status === 'COMPLETED' ? 100 : v.status === 'PROCESSING' ? 65 : 0,
      retryCount: 0,
      maxRetries: 3,
    }))
    const renderJobs = videos.filter((v) => v.status === 'COMPLETED').map((v) => ({
      id: `rj-${v.id}`,
      userId: v.userId,
      videoId: v.id,
      status: 'COMPLETED' as const,
      progress: 100,
      retryCount: 0,
      maxRetries: 3,
    }))
    setJobs({ caption: captionJobs, render: renderJobs, publish: [] })
  }, [videos, setJobs])

  const totalJobs = jobs.caption.length + jobs.render.length + jobs.publish.length
  const completedJobs = [
    ...jobs.caption,
    ...jobs.render,
    ...jobs.publish
  ].filter((j) => j.status === 'COMPLETED').length

  const allJobs = [
    ...jobs.caption.map((j) => ({ ...j, type: 'Caption' })),
    ...jobs.render.map((j) => ({ ...j, type: 'Render' })),
    ...jobs.publish.map((j) => ({ ...j, type: 'Publish' }))
  ]

  return (
    <div className="max-w-6xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Job Monitor</h1>
      <p className="text-gray-500 mb-8">Track processing status in real-time</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">Total Jobs</p>
          <p className="text-3xl font-bold text-primary mt-1">{totalJobs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completedJobs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <p className="text-gray-500 text-sm">In Progress</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{totalJobs - completedJobs}</p>
        </div>
      </div>

      {allJobs.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
          <p className="text-gray-500">No jobs yet — upload a video to start processing.</p>
        </div>
      )}

      {allJobs.length > 0 && (
        <div className="space-y-4">
          {allJobs.map((job) => (
            <JobProgress key={job.id} job={job as any} />
          ))}
        </div>
      )}
    </div>
  )
}
