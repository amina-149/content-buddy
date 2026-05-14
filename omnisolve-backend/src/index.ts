import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import http from 'http';
import { logger } from '@/utils/logger';
import { getDatabaseClient, initializeDatabase } from '@/config/database';
import { getRedisClient, testRedisConnection } from '@/config/redis';
import { config } from '@/config/env';

// Import routes
import authRouter from '@/routes/auth';
import videosRouter from '@/routes/videos';
import jobsRouter from '@/routes/jobs';
import dashboardRouter from '@/routes/dashboard';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/auth', authRouter);
app.use('/videos', videosRouter);
app.use('/jobs', jobsRouter);
app.use('/dashboard', dashboardRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  ws.on('message', async (message: string) => {
    try {
      const { videoId } = JSON.parse(message);
      const db = getDatabaseClient();

      // Send initial job status
      const jobs = await Promise.all([
        db.captionJob.findFirst({ where: { videoId }, orderBy: { createdAt: 'desc' } }),
        db.renderJob.findFirst({ where: { videoId }, orderBy: { createdAt: 'desc' } }),
        db.publishJob.findFirst({ where: { videoId }, orderBy: { createdAt: 'desc' } })
      ]);

      ws.send(JSON.stringify({
        type: 'status',
        data: {
          caption: jobs[0],
          render: jobs[1],
          publish: jobs[2]
        }
      }));
    } catch (e) {
      logger.error('WebSocket parsing error', e);
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Initialize and start
async function main() {
  try {
    // Test database
    const db = getDatabaseClient();
    await initializeDatabase();
    logger.info('Database initialized');

    // Test Redis
    const redis = getRedisClient();
    await testRedisConnection();
    logger.info('Redis initialized');

    // Start workers if enabled
    if (config.CAPTION_WORKER_ENABLED) {
      await import('@/workers/captionWorker').then(m => m.getCaptionQueue());
      logger.info('Caption worker started');
    }

    if (config.RENDER_WORKER_ENABLED) {
      await import('@/workers/renderWorker').then(m => m.getRenderQueue());
      logger.info('Render worker started');
    }

    if (config.PUBLISH_WORKER_ENABLED) {
      await import('@/workers/publishWorker').then(m => m.getPublishQueue());
      logger.info('Publish worker started');
    }

    // Start server
    server.listen(config.PORT, () => {
      logger.info(`🚀 Server running on port ${config.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

main();
