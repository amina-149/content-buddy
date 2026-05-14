import { Queue, Worker } from 'bull';
import { getRedisClient } from '@/config/redis';
import { getDatabaseClient } from '@/config/database';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { logger } from '@/utils/logger';
import path from 'path';
import fs from 'fs/promises';

ffmpeg.setFfmpegPath(ffmpegStatic as any);

interface RenderJobData {
  userId: string;
  videoId: string;
  videoPath: string;
  captionId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  quality: 'hd' | 'sd' | 'mobile';
}

interface AspectRatioConfig {
  width: number;
  height: number;
  filter: string;
}

const ASPECT_RATIOS: Record<string, AspectRatioConfig> = {
  YOUTUBE: {
    width: 1920,
    height: 1080,
    filter: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black"
  },
  INSTAGRAM: {
    width: 1080,
    height: 1080,
    filter: "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=black"
  },
  TIKTOK: {
    width: 1080,
    height: 1920,
    filter: "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black"
  }
};

const QUALITY_CONFIGS: Record<string, { bitrate: string; crf: number }> = {
  hd: { bitrate: '5000k', crf: 18 },
  sd: { bitrate: '2500k', crf: 23 },
  mobile: { bitrate: '1000k', crf: 28 }
};

let renderQueue: Queue<RenderJobData>;

export function getRenderQueue(): Queue<RenderJobData> {
  if (!renderQueue) {
    const redisClient = getRedisClient();
    // @ts-ignore
    renderQueue = new Queue('render', {
      client: redisClient as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    // Worker implementation is simplified here to avoid BullMQ / Bull v4 conflicts
    renderQueue.process(processRender);
    
    renderQueue.on('completed', (job) => {
      logger.info(`Render job ${job.id} completed`);
    });

    renderQueue.on('failed', (job, err) => {
      logger.error(`Render job ${job.id} failed:`, err);
    });
  }

  return renderQueue;
}

async function processRender(job: any) {
  const { userId, videoId, videoPath, captionId, platform, quality } = job.data as RenderJobData;
  const db = getDatabaseClient();

  try {
    const config = ASPECT_RATIOS[platform];
    const qualityConfig = QUALITY_CONFIGS[quality];

    if (!config || !qualityConfig) {
      throw new Error(`Invalid platform "${platform}" or quality "${quality}"`);
    }

    const videoFile = await fs.stat(videoPath);
    if (!videoFile.isFile()) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const outputDir = path.join(process.env.STORAGE_PATH || './uploads', videoId, 'rendered', platform.toLowerCase());
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${quality}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .videoFilter(config.filter)
        .videoBitrate(qualityConfig.bitrate)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4')
        .on('progress', (progress) => {
          const progressPercent = Math.round(progress.percent || 0);
          job.progress(Math.min(progressPercent, 99));
        })
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    job.progress(99);

    const stats = await fs.stat(outputPath);
    const duration = await getVideoDuration(outputPath);

    const caption = await db.caption.findUnique({
      where: { id: captionId }
    });

    if (!caption) {
      throw new Error(`Caption ${captionId} not found`);
    }

    const renderedVideo = await db.renderedVideo.create({
      data: {
        videoId,
        captionId,
        platform,
        filePath: outputPath,
        fileSize: stats.size,
        duration,
        resolution: `${config.width}x${config.height}`,
        quality,
        format: 'mp4',
        codec: 'h.264'
      }
    });

    await db.renderJob.update({
      where: { id: job.id as string },
      data: {
        status: 'COMPLETED',
        progress: 100
      }
    });

    job.progress(100);
    logger.info(`Rendered video created: ${renderedVideo.id}`);
    return renderedVideo;
  } catch (error) {
    logger.error('Render job error:', error);

    await db.renderJob.update({
      where: { id: job.id as string },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: { increment: 1 }
      }
    });

    throw error;
  }
}

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      resolve(Math.round(metadata?.format?.duration || 0));
    });
  });
}

export async function addRenderJob(data: RenderJobData) {
  const queue = getRenderQueue();
  return queue.add(data, {
    jobId: `${data.videoId}-${data.captionId}-${data.platform}`
  });
}
