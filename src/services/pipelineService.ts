/** Autonomous pipeline (no paid STT keys). Vite proxies `/pipeline` → pipeline-server `/api/pipeline`. */

import { proxyHelp, readJsonResponse } from '@/utils/httpJson'

const base = () => '/pipeline'

export type PipelineJobState =
  | 'queued'
  | 'downloading'
  | 'downloaded'
  | 'captioning'
  | 'completed'
  | 'failed'

export interface PipelineStatus {
  id: string
  state: PipelineJobState
  title?: string
  error?: string
  captionSource?: string
  files: {
    original: string | null
    captioned: string | null
    subtitles: string | null
  }
}

export async function startPipeline(url: string): Promise<{ jobId: string; state: string }> {
  const res = await fetch(`${base()}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  let data: Record<string, unknown> = {}
  try {
    data = await readJsonResponse(res)
  } catch (e) {
    throw new Error(
      (e instanceof Error ? e.message : String(e)) + proxyHelp(res.status, 'pipeline')
    )
  }
  if (!res.ok) {
    const msg = (data.error as string) || `Pipeline start failed (${res.status})`
    throw new Error(msg + proxyHelp(res.status, 'pipeline'))
  }
  return data as unknown as { jobId: string; state: string }
}

export async function getPipelineStatus(jobId: string): Promise<PipelineStatus> {
  const res = await fetch(`${base()}/${encodeURIComponent(jobId)}/status`)
  let data: Record<string, unknown> = {}
  try {
    data = await readJsonResponse(res)
  } catch (e) {
    throw new Error(
      (e instanceof Error ? e.message : String(e)) + proxyHelp(res.status, 'pipeline')
    )
  }
  if (!res.ok) throw new Error(String(data.error || 'Status failed') + proxyHelp(res.status, 'pipeline'))
  return data as unknown as PipelineStatus
}

export function downloadOriginalUrl(jobId: string) {
  return `${base()}/${encodeURIComponent(jobId)}/download/original`
}

export function downloadCaptionedUrl(jobId: string) {
  return `${base()}/${encodeURIComponent(jobId)}/download/captioned`
}

export async function publishAutonomous(jobId: string, useOriginal = false) {
  const res = await fetch(`${base()}/${encodeURIComponent(jobId)}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useOriginal, targets: {} }),
  })
  return readJsonResponse(res)
}

export interface PipelineJobSummary {
  id: string
  state: PipelineJobState
  title?: string
  createdAt?: number
  error?: string
  captionSource?: string
}

export interface PublishSchedule {
  id: string
  jobId: string
  scheduledFor: string
  status: 'scheduled' | 'running' | 'completed' | 'failed'
  createdAt: string
  error: string | null
  lastRunAt: string | null
}

export async function listPipelineJobs(): Promise<
  PipelineJobSummary[]
> {
  const res = await fetch(`${base()}/jobs`)
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(String(data.error || `Jobs failed (${res.status})`) + proxyHelp(res.status, 'pipeline'))
  }
  return (data.jobs as PipelineJobSummary[]) || []
}

export async function listSchedules(): Promise<PublishSchedule[]> {
  const res = await fetch(`${base()}/schedules`)
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(String(data.error || `Schedules failed (${res.status})`) + proxyHelp(res.status, 'pipeline'))
  }
  return (data.schedules as PublishSchedule[]) || []
}

export async function schedulePublish(
  jobId: string,
  scheduledFor: string,
  platforms: Array<'youtube' | 'instagram' | 'tiktok'>
) {
  const res = await fetch(`${base()}/${encodeURIComponent(jobId)}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduledFor,
      publishRequest: {
        platforms,
      },
    }),
  })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(String(data.error || `Schedule failed (${res.status})`) + proxyHelp(res.status, 'pipeline'))
  }
  return data
}

export async function cancelSchedule(scheduleId: string) {
  const res = await fetch(`${base()}/schedules/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(String(data.error || `Cancel failed (${res.status})`) + proxyHelp(res.status, 'pipeline'))
  }
  return data
}

export async function runScheduleNow(scheduleId: string) {
  const res = await fetch(`${base()}/schedules/${encodeURIComponent(scheduleId)}/run-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(String(data.error || `Run-now failed (${res.status})`) + proxyHelp(res.status, 'pipeline'))
  }
  return data
}
