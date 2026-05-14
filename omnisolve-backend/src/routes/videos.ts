import express from 'express';
import { getDatabaseClient } from '@/config/database';
import { getRedisClient } from '@/config/redis';
import { auth } from '@/middleware/auth';
import { getCaptionQueue } from '@/workers/captionWorker';
import { getRenderQueue } from '@/workers/renderWorker';
import { logger } from '@/utils/logger';
import axios from 'axios';
import fs from 'fs/promises';

const router = express.Router();

// List user videos
router.get('/', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();
    const videos = await db.video.findMany({
      where: { userId: req.userId },
      include: { captions: true, renderedVideos: true }
    });
    res.json(videos);
  } catch (error) {
    next(error);
  }
});

// Upload video
router.post('/upload', auth, async (req, res, next) => {
  try {
    const { title, description, sourceUrl, sourceType } = req.body;
    const db = getDatabaseClient();

    const video = await db.video.create({
      data: {
        userId: req.userId!,
        title,
        description,
        sourceUrl,
        sourceType,
        status: 'PENDING'
      }
    });

    // Queue caption job
    const captionQueue = getCaptionQueue();
    await captionQueue.add({
      userId: req.userId,
      videoId: video.id,
      videoPath: sourceUrl,
      language: 'ENGLISH',
      whisperModel: 'base'
    });

    res.json(video);
  } catch (error) {
    next(error);
  }
});

// Get video detail
router.get('/:videoId', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();
    const video = await db.video.findUnique({
      where: { id: req.params.videoId },
      include: {
        captions: true,
        renderedVideos: true,
        publishingHistory: true
      }
    });

    if (!video || video.userId !== req.userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    next(error);
  }
});

// Delete video
router.delete('/:videoId', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();
    const video = await db.video.findUnique({
      where: { id: req.params.videoId }
    });

    if (!video || video.userId !== req.userId) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await db.video.delete({ where: { id: req.params.videoId } });
    res.json({ message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
