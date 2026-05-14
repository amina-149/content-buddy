import { Queue, Worker } from 'bull';
import { getRedisClient } from '@/config/redis';
import { getDatabaseClient } from '@/config/database';
import axios, { AxiosError } from 'axios';
import { logger } from '@/utils/logger';
import { credentialService } from '@/services/credentialService';
import fs from 'fs/promises';

interface PublishJobData {
  userId: string;
  videoId: string;
  renderedVideoId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
}

let publishQueue: Queue<PublishJobData>;

export function getPublishQueue(): Queue<PublishJobData> {
  if (!publishQueue) {
    const redisClient = getRedisClient();
    // @ts-ignore
    publishQueue = new Queue('publish', {
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

    publishQueue.process(processPublish);
    
    publishQueue.on('completed', (job) => {
      logger.info(`Publish job ${job.id} completed`);
    });

    publishQueue.on('failed', (job, err) => {
      logger.error(`Publish job ${job.id} failed:`, err);
    });
  }

  return publishQueue;
}

async function processPublish(job: any) {
  const { userId, videoId, renderedVideoId, platform } = job.data as PublishJobData;
  const db = getDatabaseClient();

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(`User ${userId} not found`);

    const renderedVideo = await db.renderedVideo.findUnique({
      where: { id: renderedVideoId },
      include: { video: true, caption: true }
    });
    if (!renderedVideo) throw new Error(`Rendered video ${renderedVideoId} not found`);

    const credential = await db.platformCredential.findUnique({
      where: { userId_platform: { userId, platform } }
    });
    if (!credential || !credential.isActive) {
      throw new Error(`No active credential for ${platform}`);
    }

    const decryptedToken = credentialService.decryptOAuthToken(credential.accessToken);
    let result;

    switch (platform) {
      case 'YOUTUBE':
        result = await publishToYouTube(renderedVideo, decryptedToken, job);
        break;
      case 'INSTAGRAM':
        result = await publishToInstagram(renderedVideo, decryptedToken, job);
        break;
      case 'TIKTOK':
        result = await publishToTikTok(renderedVideo, decryptedToken, job);
        break;
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    const publishRecord = await db.publishingHistory.create({
      data: {
        videoId,
        renderedVideoId,
        platform,
        platformVideoId: result.videoId,
        platformUrl: result.url
      }
    });

    await db.publishJob.update({
      where: { id: job.id as string },
      data: {
        status: 'COMPLETED',
        progress: 100
      }
    });

    logger.info(`Published to ${platform}: ${result.url}`);
    return publishRecord;
  } catch (error) {
    const isRetryable = isRetryableError(error);
    
    if (!isRetryable) {
      await db.publishJob.update({
        where: { id: job.id as string },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }

    await db.publishJob.update({
      where: { id: job.id as string },
      data: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: { increment: 1 },
        nextRetryAt: new Date(Date.now() + 30000)
      }
    });

    throw error;
  }
}

async function publishToYouTube(renderedVideo: any, accessToken: string, job: any) {
  const videoFile = await fs.readFile(renderedVideo.filePath);
  
  const uploadResponse = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status,processingDetails',
    {
      snippet: {
        title: renderedVideo.video.title,
        description: renderedVideo.video.description || '',
        tags: ['OmniSolve'],
        categoryId: '22'
      },
      status: {
        privacyStatus: 'unlisted'
      },
      processingDetails: {
        processingProgress: {
          partsProcessed: 0,
          partsTotal: 1
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const sessionUri = uploadResponse.headers.location;

  const uploadResult = await axios.put(sessionUri as string, videoFile, {
    headers: {
      'Content-Type': 'video/mp4'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(((progressEvent.loaded || 0) * 100) / (progressEvent.total || 1));
      job.progress(Math.min(percentCompleted, 99));
    }
  });

  const videoId = uploadResult.data.id;
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

async function publishToInstagram(renderedVideo: any, accessToken: string, job: any) {
  const videoBuffer = await fs.readFile(renderedVideo.filePath);
  
  // Create media container
  const containerResponse = await axios.post(
    `https://graph.instagram.com/v18.0/me/media`,
    {
      media_type: 'REELS',
      video_url: `file://${renderedVideo.filePath}`,
      caption: renderedVideo.video.title
    },
    {
      params: { access_token: accessToken }
    }
  );

  const containerId = containerResponse.data.id;

  // Publish container
  const publishResponse = await axios.post(
    `https://graph.instagram.com/v18.0/me/media_publish`,
    { creation_id: containerId },
    {
      params: { access_token: accessToken }
    }
  );

  job.progress(100);

  return {
    videoId: publishResponse.data.id,
    url: `https://instagram.com/p/${publishResponse.data.id}`
  };
}

async function publishToTikTok(renderedVideo: any, accessToken: string, job: any) {
  const videoBuffer = await fs.readFile(renderedVideo.filePath);

  // Initialize upload
  const initResponse = await axios.post(
    'https://open.tiktokapis.com/v1/video/upload/init/',
    {
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoBuffer.length
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const uploadUrl = initResponse.data.data.upload_url;
  const videoId = initResponse.data.data.video_id;

  // Upload video
  await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4'
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(((progressEvent.loaded || 0) * 100) / (progressEvent.total || 1));
      job.progress(Math.min(percentCompleted, 99));
    }
  });

  // Publish video
  await axios.post(
    'https://open.tiktokapis.com/v1/video/publish/',
    {
      source_info: {
        source: 'FILE_UPLOAD',
        video_id: videoId
      },
      post_info: {
        title: renderedVideo.video.title,
        privacy_level: 'PUBLIC_TO_EVERYONE'
      }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  job.progress(100);

  return {
    videoId,
    url: `https://tiktok.com/@yourprofile/video/${videoId}`
  };
}

function isRetryableError(error: any): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return (status !== undefined && status >= 500) || status === 408 || error.code === 'ECONNABORTED';
  }
  return true;
}

export async function addPublishJob(data: PublishJobData) {
  const queue = getPublishQueue();
  return queue.add(data, {
    jobId: `${data.videoId}-${data.platform}`
  });
}
