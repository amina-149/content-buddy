import React, { useEffect, useMemo, useState } from 'react'
import { getPipelineStatus, listPipelineJobs, type PipelineJobSummary, type PipelineStatus } from '@/services/pipelineService'

export const JobMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<PipelineJobSummary[]>([])
  const [statuses, setStatuses] = useState<Record<string, PipelineStatus>>({})
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const list = await listPipelineJobs()
      setJobs(list)
      const next: Record<string, PipelineStatus> = {}
      await Promise.all(
        list.map(async (j) => {
          try {
            next[j.id] = await getPipelineStatus(j.id)
          } catch {
            // keep best-effort monitor list
          }
        })
      )
      setStatuses(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [])

  const totalJobs = jobs.length
  const completedJobs = useMemo(() => jobs.filter((j) => j.state === 'completed').length, [jobs])
  const runningJobs = totalJobs - completedJobs

  return (
    <div className="max-w-6xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Job Monitor</h1>
      <p className="text-gray-500 mb-8">Live pipeline jobs from local scheduler/backend</p>

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
          <p className="text-3xl font-bold text-blue-600 mt-1">{runningJobs}</p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
          <p className="text-gray-500">No jobs yet — run pipeline from Video Downloader first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const status = statuses[job.id]
            return (
              <div key={job.id} className="bg-white rounded-xl shadow p-4 border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{job.title || 'Video'}</p>
                    <p className="text-xs text-gray-500">Job {job.id}</p>
                    {status?.error && <p className="text-sm text-red-600 mt-1">{status.error}</p>}
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      job.state === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : job.state === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {job.state}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
