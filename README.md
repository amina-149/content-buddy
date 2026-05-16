# Content Buddy

YouTube / Shorts → **download on your PC** → **captions** (YouTube auto-subs or local **faster-whisper**) → **burn with FFmpeg** → optional **publish** guidance (no paid STT keys by default).

| Approach | This repo uses | Paid API? |
| --- | --- | --- |
| Fetch video | **yt-dlp** (CLI) | No |
| Captions when YT has auto-subs | **yt-dlp** + **FFmpeg** (VTT→SRT) | No |
| Captions when no subs | **faster-whisper** locally (`pip install faster-whisper`) | No |
| Burn-in | **FFmpeg** `subtitles=` filter | No |
| Upload YouTube | Default: **manual** or your own **Playwright/cookie** scripts. Optional: YouTube Data API if you set `ENABLE_YOUTUBE_DATA_API_UPLOAD=true` and pass an OAuth access token. | Only if you opt in |
| Upload Instagram / TikTok | Not in-process; use **instagrapi** / **tiktok-uploader** / **Playwright** (documented patterns). | No |

**Not in this repo (you asked about roadmap):** Next.js migration, Upstash queues, AWS Lambda, WebSocket fan-out to Vercel — the current UI is **Vite + React**; the autonomous worker is **`pipeline-server/`** (Express, no Postgres).

## Prerequisites (your machine)

- **Node 18+**
- **yt-dlp** on PATH (`pip install -U yt-dlp` or release binary)
- **FFmpeg** on PATH
- **Python 3** with `yt_dlp` for the legacy “link preview” tab (`pip install yt-dlp` → `python -m yt_dlp`)
- Optional: `pip install faster-whisper` for offline transcription when YouTube has no English auto-captions

## Run everything (recommended)

```bash
npm install
npm install --prefix pipeline-server
npm run doctor --prefix pipeline-server

# One terminal — UI + extract API + pipeline API
npm run dev:all
```

Then open **http://localhost:3000** → **Upload** → **YouTube autonomous**: paste a Shorts or watch URL, run pipeline, then save original / captioned MP4 and `.srt`.

## Run services separately

```bash
# Terminal 1 — Vite (proxies /pipeline → 3002, /api → 3001)
npm run dev

# Terminal 2 — yt-dlp JSON for “Link preview” tab
npm run dev:api

# Terminal 3 — download + caption + burn (no database)
npm run dev:pipeline
```

## Project structure (honest)

```
├── src/                    # React app (Vite)
├── pipeline-server/      # Autonomous pipeline API (Express, jobs in memory + disk)
├── dev-api-server.mjs     # GET /api/extract — Python yt_dlp JSON for legacy tab
├── omnisolve-backend/     # Optional Prisma/Redis stack for future full OAuth + DB flows
├── api/                   # Vercel Python handler (deploy path)
└── docker-compose.yml     # Postgres/Redis/backend when you want the full stack
```

## Legal note

Only process content you have the rights to use. Downloader + republish workflows can violate platform terms or copyright if misused.

## License

MIT
