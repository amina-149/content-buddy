/**
 * uploader-bridge.js
 * Spawns Python uploaders as child processes and pipes JSON results back.
 * Called from pipeline-server routes after video processing is complete.
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADERS_DIR = path.join(__dirname)
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python3')

/**
 * Run a Python uploader script and collect its JSON output.
 * The scripts emit JSON lines as progress, with the FINAL line being the result.
 *
 * @param {string} scriptName - e.g. 'youtube_upload.py'
 * @param {string[]} args     - CLI args array
 * @param {(progress: object) => void} onProgress - called for intermediate status lines
 * @returns {Promise<object>} final result JSON
 */
function runUploader(scriptName, args, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(UPLOADERS_DIR, scriptName);

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Uploader script not found: ${scriptPath}`));
    }

    const proc = spawn(PYTHON_BIN, [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let lastLine = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          lastLine = line;

          // If it has 'status' it's a progress event, not the final result
          if (parsed.status) {
            onProgress(parsed);
          }
        } catch {
          // Non-JSON output — treat as log
          onProgress({ status: 'log', message: line })
        }
      }
    })

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (lastLine) {
        try {
          const result = JSON.parse(lastLine);
          resolve(result);
        } catch {
          resolve({ error: `Non-JSON final output: ${lastLine}`, stderr })
        }
      } else {
        resolve({
          error: stderr || `Process exited with code ${code} and no output`,
          code
        })
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ${PYTHON_BIN}: ${err.message}. Is Python installed?`))
    })
  })
}


/**
 * Upload to YouTube via Playwright browser automation
 */
async function uploadToYouTube({ videoPath, title, description, cookiePath, isShorts = false, onProgress }) {
  const args = [
    '--video', videoPath,
    '--title', title,
    '--description', description || '',
    '--cookies', cookiePath,
  ];

  if (isShorts) args.push('--shorts');

  return runUploader('youtube_upload.py', args, onProgress)
}


/**
 * Upload to Instagram as Reel via instagrapi
 */
async function uploadToInstagram({ videoPath, caption, username, password, sessionPath, onProgress }) {
  const args = [
    '--video', videoPath,
    '--caption', caption,
    '--username', username,
    '--password', password,
  ];

  if (sessionPath) {
    args.push('--session', sessionPath);
  }

  return runUploader('instagram_upload.py', args, onProgress)
}


/**
 * Upload to TikTok via tiktok-uploader (falls back to Playwright)
 */
async function uploadToTikTok({ videoPath, title, cookiePath, schedule, onProgress }) {
  const args = [
    '--video', videoPath,
    '--title', title,
    '--cookies', cookiePath,
  ];

  if (schedule) {
    args.push('--schedule', schedule);
  }

  return runUploader('tiktok_upload.py', args, onProgress)
}


/**
 * Upload to all specified platforms in sequence.
 * Returns array of per-platform results.
 */
async function uploadToAll({
  videoPath,
  shortsPath,       // vertical 1080×1920 version
  title,
  description,
  caption,
  platforms,        // ['youtube', 'instagram', 'tiktok']
  credentials,      // { youtube: { cookiePath }, instagram: { username, password }, tiktok: { cookiePath } }
  onProgress = () => {},
}) {
  const results = []

  for (const platform of platforms) {
    const creds = credentials[platform];

    if (!creds) {
      results.push({ platform, error: 'No credentials configured' })
      continue
    }

    onProgress({ platform, status: 'starting' })

    let result;
    try {
      switch (platform) {
        case 'youtube':
          result = await uploadToYouTube({
            videoPath: shortsPath || videoPath,  // Prefer Shorts crop for YouTube
            title,
            description,
            cookiePath: creds.cookiePath,
            isShorts: !!shortsPath,
            onProgress: (p) => onProgress({ ...p, platform }),
          });
          break

        case 'instagram':
          result = await uploadToInstagram({
            videoPath: shortsPath || videoPath,
            caption: caption || title,
            username: creds.username,
            password: creds.password,
            sessionPath: creds.sessionPath,
            onProgress: (p) => onProgress({ ...p, platform }),
          });
          break

        case 'tiktok':
          result = await uploadToTikTok({
            videoPath: shortsPath || videoPath,
            title: caption || title,
            cookiePath: creds.cookiePath,
            onProgress: (p) => onProgress({ ...p, platform }),
          });
          break

        default:
          result = { error: `Unknown platform: ${platform}` }
      }
    } catch (err) {
      result = { error: err.message, platform }
    }

    results.push({ platform, ...result })
    onProgress({ platform, status: result.success ? 'done' : 'failed', result })
  }

  return results
}

export {
  uploadToYouTube,
  uploadToInstagram,
  uploadToTikTok,
  uploadToAll,
}
