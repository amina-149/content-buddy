/** Safe JSON read — avoids "Unexpected end of JSON input" on empty 502/HTML bodies */

export async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  const trimmed = text.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    throw new Error(
      `Server returned non-JSON (HTTP ${res.status}). First bytes: ${trimmed.slice(0, 120)}`
    )
  }
}

export function proxyHelp(status: number, pathPrefix: string): string {
  if (status === 502 || status === 503) {
    if (pathPrefix.includes('pipeline')) {
      return ' Pipeline API is not reachable (port 3002). Run in project root: npm run dev:pipeline — or npm run dev:all'
    }
    return ' Backend is not reachable. For link preview run: npm run dev:api — for autonomous pipeline run: npm run dev:pipeline'
  }
  return ''
}
