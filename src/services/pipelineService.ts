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
