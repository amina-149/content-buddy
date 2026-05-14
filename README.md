# Content Buddy — Free Online Video Downloader

A fast, free, and modern video downloader web app. Paste a video link from YouTube, Instagram, TikTok, Facebook, or Twitter and download it in multiple quality formats.

**Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp)**

## Features

- **Multi-Platform Support** — Download from YouTube, Instagram, TikTok, Facebook, Twitter, and 1000+ more sites
- **Multiple Quality Options** — Choose between different resolutions (1080p, 720p, 480p, etc.)
- **Audio Extraction** — Download audio-only files when needed
- **No Registration Required** — Just paste the link and download
- **Mobile Friendly** — Fully responsive design

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS v4, Vite |
| API | Python Serverless (Vercel Functions) |
| Video Extraction | yt-dlp |
| Hosting | Vercel |

## Getting Started (Local Development)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be running at `http://localhost:3000`

## Deployment

This project is configured for **one-click Vercel deployment**:

1. Push to GitHub
2. Import repo into Vercel
3. Deploy — no configuration needed

## Project Structure

```
├── api/                  # Vercel Serverless Functions (Python)
│   ├── extract.py        # yt-dlp video extraction endpoint
│   └── requirements.txt  # Python dependencies
├── src/                  # React frontend source
│   ├── components/       # UI components
│   ├── stores/           # Zustand state management
│   ├── services/         # API services
│   └── types/            # TypeScript type definitions
├── omnisolve-backend/    # Node.js backend (future)
├── index.html            # Entry point
├── vite.config.ts        # Vite configuration
└── vercel.json           # Vercel deployment config
```

## License

MIT
