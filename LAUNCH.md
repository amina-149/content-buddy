# Content Buddy — launch guide

## Setup Status
1. **Backend Configuration**: Created `omnisolve-backend` with Prisma models, workers for rendering, captioning, and publishing, setup Express server, and integrated Redis + RabbitMQ/Bull. All configurations, environments, routes, and services were built successfully.
2. **Frontend Configuration**: Vite + React + TypeScript app at the repository root under `src/` (Upload, Review, Distribution, Monitoring, and Analytics areas). Extend screens and components there.
3. **Docker**: Set up `docker-compose.yml` for database and cache layers for Phase 3.

## Next steps to complete launch:
1. Run `docker-compose up -d` in the root folder to start Redis and Postgres databases.
2. At the repository root, run `npm install` and `npm run dev` for the UI (`src/`).
3. Fill out the mock functions like `captionWorker.ts` with your preferred whisper inference mechanism.
4. Set up the actual keys for TikTok, Instagram, and YouTube in your backend `.env` file before testing platform integrations.
5. In `omnisolve-backend`, start the development server using `npm run dev`!
