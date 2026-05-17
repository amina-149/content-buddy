# Content Buddy

YouTube/Shorts link -> local download -> local captions -> FFmpeg burn-in -> optional scheduled autopost.

Default path is API-cost-free:
- download with `yt-dlp`
- captions from YouTube auto-subs or local `faster-whisper`
- publish using local browser/session automation scripts (no official platform Data APIs required)

## Prerequisites

- Node 18+
- Python 3 (`py` works on Windows)
- `yt-dlp`
- `ffmpeg`
- Optional: `faster-whisper` for offline STT fallback

## Quick start

```bash
npm install
npm install --prefix pipeline-server
npm run doctor --prefix pipeline-server
npm run dev:all
```

Open `http://localhost:3000`.

## Dev commands

```bash
# UI
npm run dev

# Single backend for extract + pipeline + scheduling
npm run dev:pipeline

# Convenience (both)
npm run dev:all
```

## Current product scope

- Video Downloader tab:
  - Link preview (`/pipeline/extract`)
  - Autonomous pipeline run (`/pipeline/start`)
  - Download original/captioned outputs
- Review Captions tab:
  - reads generated `.srt` from completed jobs
- Distribution tab:
  - create scheduled autopost tasks
  - run-now / cancel schedule
- Job Monitor tab:
  - live job states from pipeline backend
- Analytics tab:
  - real counts from pipeline jobs (no fake demo metrics)

## Notes

- Scheduler is local and in-memory (while pipeline server process is running).
- Autopost depends on local cookies/sessions and uploader scripts under `pipeline-server/uploaders/`.
- Use only content you have rights to process and repost.
