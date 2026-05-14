import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT || 3000,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_key_here_generate_32_random_characters',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID || 'your_youtube_client_id',
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET || 'your_youtube_client_secret',
  YOUTUBE_CALLBACK_URL: process.env.YOUTUBE_CALLBACK_URL || 'http://localhost:3000/auth/youtube/callback',
  INSTAGRAM_CLIENT_ID: process.env.INSTAGRAM_CLIENT_ID || 'your_instagram_client_id',
  INSTAGRAM_CLIENT_SECRET: process.env.INSTAGRAM_CLIENT_SECRET || 'your_instagram_client_secret',
  INSTAGRAM_CALLBACK_URL: process.env.INSTAGRAM_CALLBACK_URL || 'http://localhost:3000/auth/instagram/callback',
  TIKTOK_CLIENT_ID: process.env.TIKTOK_CLIENT_ID || 'your_tiktok_client_id',
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET || 'your_tiktok_client_secret',
  TIKTOK_CALLBACK_URL: process.env.TIKTOK_CALLBACK_URL || 'http://localhost:3000/auth/tiktok/callback',
  CAPTION_WORKER_ENABLED: process.env.CAPTION_WORKER_ENABLED === 'true',
  RENDER_WORKER_ENABLED: process.env.RENDER_WORKER_ENABLED === 'true',
  PUBLISH_WORKER_ENABLED: process.env.PUBLISH_WORKER_ENABLED === 'true',
};
