import React, { useEffect, useMemo, useState } from 'react'
import {
  cancelSchedule,
  listPipelineJobs,
  listSchedules,
  runScheduleNow,
  schedulePublish,
  type PipelineJobSummary,
  type PublishSchedule,
} from '@/services/pipelineService'

const PLATFORM_OPTIONS: Array<{ id: 'youtube' | 'instagram' | 'tiktok'; label: string }> = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
]

function nextBestSlot(now = new Date()) {
  const d = new Date(now)
  const windows = [11, 13, 19, 21]
  for (const hour of windows) {
    const t = new Date(d)
    t.setHours(hour, 15, 0, 0)
    if (t.getTime() > now.getTime()) return t
  }
  const tomorrow = new Date(d)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(11, 15, 0, 0)
  return tomorrow
}

function plusMinutes(base: Date, minutes: number) {
  const d = new Date(base)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}

export const DistributionSetup: React.FC = () => {
  const [jobs, setJobs] = useState<PipelineJobSummary[]>([])
  const [schedules, setSchedules] = useState<PublishSchedule[]>([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [scheduledForLocal, setScheduledForLocal] = useState('')
  const [platforms, setPlatforms] = useState<Array<'youtube' | 'instagram' | 'tiktok'>>(['youtube'])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const [jobData, scheduleData] = await Promise.all([listPipelineJobs(), listSchedules()])
    setJobs(jobData)
    setSchedules(scheduleData)
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const completedJobs = useMemo(() => jobs.filter((j) => j.state === 'completed'), [jobs])

  useEffect(() => {
    if (!selectedJobId && completedJobs.length > 0) setSelectedJobId(completedJobs[0].id)
  }, [completedJobs, selectedJobId])

  const togglePlatform = (id: 'youtube' | 'instagram' | 'tiktok') => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!selectedJobId) return setError('Select a completed job first.')
    if (!scheduledForLocal) return setError('Pick a scheduled date and time.')
    if (platforms.length === 0) return setError('Select at least one platform.')
    setBusy(true)
    try {
      await schedulePublish(selectedJobId, new Date(scheduledForLocal).toISOString(), platforms)
      setMessage('Schedule created.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onAutoBestTime = async () => {
    setError(null)
    setMessage(null)
    if (!selectedJobId) return setError('Select a completed job first.')
    if (platforms.length === 0) return setError('Select at least one platform.')
    setBusy(true)
    try {
      const base = nextBestSlot()
      await schedulePublish(selectedJobId, base.toISOString(), platforms)
      setScheduledForLocal(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}T${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`)
      setMessage(`AI scheduler queued at best slot: ${base.toLocaleString()}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onAutoBatch = async () => {
    setError(null)
    setMessage(null)
    const unscheduled = completedJobs.filter((j) => !schedules.some((s) => s.jobId === j.id && (s.status === 'scheduled' || s.status === 'running')))
    if (unscheduled.length === 0) return setError('No unscheduled completed jobs found.')
    if (platforms.length === 0) return setError('Select at least one platform.')
    setBusy(true)
    try {
      let slot = nextBestSlot()
      for (const job of unscheduled) {
        await schedulePublish(job.id, slot.toISOString(), platforms)
        slot = plusMinutes(slot, 90)
      }
      setMessage(`AI scheduler queued ${unscheduled.length} job(s) on staggered best-time windows.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onRunNow = async (scheduleId: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await runScheduleNow(scheduleId)
      setMessage('Scheduled item executed now.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onCancel = async (scheduleId: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await cancelSchedule(scheduleId)
      setMessage('Schedule cancelled.')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Distribution Scheduler</h1>
      <p className="text-gray-500 mb-6">Queue local autopost tasks with AI best-time scheduling and no paid APIs.</p>

      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 mb-6">
        <form onSubmit={onCreateSchedule} className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Completed Video Job</label>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
              <option value="">Select a completed job</option>
              {completedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title || 'Video'} ({j.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Time</label>
            <input type="datetime-local" className="w-full rounded-lg border border-gray-300 px-3 py-2" value={scheduledForLocal} onChange={(e) => setScheduledForLocal(e.target.value)} />
          </div>

          <button type="submit" disabled={busy} className="rounded-lg bg-primary text-white px-4 py-2 font-semibold hover:bg-blue-600 disabled:opacity-60">
            Queue Manual
          </button>
          <button type="button" disabled={busy} onClick={onAutoBestTime} className="rounded-lg border border-blue-300 text-blue-700 px-4 py-2 font-semibold hover:bg-blue-50 disabled:opacity-60">
            AI Best Time
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const selected = platforms.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
          <button type="button" disabled={busy} onClick={onAutoBatch} className="px-3 py-1.5 rounded-full text-sm border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">
            AI Batch Schedule
          </button>
        </div>

        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
        <h2 className="text-xl font-bold mb-4">Scheduled Tasks</h2>
        {schedules.length === 0 ? (
          <p className="text-gray-500">No schedules yet.</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800">Job {s.jobId.slice(0, 8)} · {s.status}</p>
                    <p className="text-sm text-gray-500">Run at {new Date(s.scheduledFor).toLocaleString()}</p>
                    {s.error && <p className="text-sm text-red-600 mt-1">{s.error}</p>}
                  </div>
                  <div className="flex gap-2">
                    {(s.status === 'scheduled' || s.status === 'failed') && (
                      <button type="button" disabled={busy} onClick={() => onRunNow(s.id)} className="px-3 py-1.5 rounded border border-blue-300 text-blue-700 text-sm">
                        Run now
                      </button>
                    )}
                    {s.status !== 'running' && (
                      <button type="button" disabled={busy} onClick={() => onCancel(s.id)} className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-sm">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
