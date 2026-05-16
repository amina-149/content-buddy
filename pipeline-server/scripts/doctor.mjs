#!/usr/bin/env node
/**
 * Preflight: ffmpeg, yt-dlp, Python + optional faster-whisper (no API keys).
 */
import { spawnSync } from 'child_process'
import { runCommand, runYtDlp, resolveYtDlp, ffmpegBin } from '../src/spawnUtil.mjs'

function ok(name, pass, detail = '') {
  const s = pass ? 'OK' : 'FAIL'
  console.log(`[${s}] ${name}${detail ? ` — ${detail}` : ''}`)
  return pass
}

async function main() {
  let failed = false

  try {
    const r = await runCommand(ffmpegBin(), ['-version'], {})
    failed |= !ok('ffmpeg', r.stdout.includes('ffmpeg version'), ffmpegBin())
  } catch (e) {
    failed |= !ok('ffmpeg', false, String(e))
  }

  try {
    const { cmd, prefix } = resolveYtDlp()
    const r = await runYtDlp(['--version'], {})
    const label = prefix.length ? `${cmd} ${prefix.join(' ')}` : cmd
    const verOk = /20\d{2}\./.test(r.stdout) || r.stdout.includes('yt-dlp')
    failed |= !ok('yt-dlp', verOk, label)
  } catch (e) {
    failed |= !ok('yt-dlp', false, String(e))
  }

  const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  const pr = spawnSync(py, ['-c', 'import sys; print(sys.version)'], { encoding: 'utf8' })
  failed |= !ok('python', pr.status === 0, pr.stdout?.split('\n')[0]?.trim() || py)

  const fw = spawnSync(py, ['-c', 'import faster_whisper; print("ok")'], { encoding: 'utf8' })
  ok(
    'faster-whisper (optional)',
    fw.status === 0,
    fw.status === 0 ? 'local STT fallback when YT has no auto-subs' : 'pip install faster-whisper for offline captions'
  )

  console.log('')
  if (failed) {
    console.error('Doctor: required checks failed. Fix items above before running the pipeline.')
    process.exit(1)
  }
  console.log('Doctor: required tooling looks good. (faster-whisper optional for offline STT.)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
