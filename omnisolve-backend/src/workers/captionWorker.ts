import Queue from 'bull';
import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

let captionQueue: Queue.Queue;

export function getCaptionQueue() {
  if (!captionQueue) {
    const redisClient = getRedisClient();
    captionQueue = new Queue('caption', {
      // @ts-ignore
      client: redisClient
    });

    captionQueue.process(async (job: any) => {
      logger.info(`Processing caption job ${job.id}`);
      job.progress(100);
      return { success: true };
    });
  }
  return captionQueue;
}
