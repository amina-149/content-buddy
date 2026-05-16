import { spawn, spawnSync } from 'child_process'
import { PYTHON_CMD } from './config.mjs'

/** @type {{ cmd: string, prefix: string[] } | null} */
let ytDlpResolved = null

/**
 * Resolve yt-dlp: standalone on PATH, YT_DLP_PATH, or `python -m yt_dlp` (same as Link preview tab).
 */
export function resolveYtDlp() {
  if (ytDlpResolved) return ytDlpResolved

  const fromEnv = process.env.YT_DLP_PATH?.trim()
  if (fromEnv) {
    ytDlpResolved = { cmd: fromEnv, prefix: [] }
    return ytDlpResolved
  }

  const names = process.platform === 'win32' ? ['yt-dlp.exe', 'yt-dlp'] : ['yt-dlp']
  for (const name of names) {
    const locator = process.platform === 'win32' ? 'where' : 'which'
    const found = spawnSync(locator, [name], { encoding: 'utf8', windowsHide: true })
    if (found.status === 0 && found.stdout?.trim()) {
      const line = found.stdout.trim().split(/\r?\n/)[0].trim()
      ytDlpResolved = { cmd: line.replace(/^"(.*)"$/, '$1'), prefix: [] }
      return ytDlpResolved
    }
  }

  const py = PYTHON_CMD
  const mod = spawnSync(py, ['-m', 'yt_dlp', '--version'], {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  })
  if (mod.status === 0) {
    ytDlpResolved = { cmd: py, prefix: ['-m', 'yt_dlp'] }
    return ytDlpResolved
  }

  throw new Error(
    'yt-dlp not found. Run: pip install -U yt-dlp — or set YT_DLP_PATH to yt-dlp.exe'
  )
}

/** @param {string[]} ytArgs */
export function runYtDlp(ytArgs, opts = {}) {
  const { cmd, prefix } = resolveYtDlp()
  return runCommand(cmd, [...prefix, ...ytArgs], opts)
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, shell?: boolean }} opts
 */
export function runCommand(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: opts.shell ?? false,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      reject(
        new Error(
          `${command} failed to start: ${err.message}. Is it installed and on PATH?`
        )
      )
    })
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else {
        const tail = stderr.slice(-4000) || stdout.slice(-2000)
        reject(new Error(`${command} exited ${code}\n${tail}`))
      }
    })
  })
}

/** @deprecated use resolveYtDlp() */
export function ytDlpBin() {
  return resolveYtDlp().cmd
}

export function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg'
}
