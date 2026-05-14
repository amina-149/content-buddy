import express from 'express';
import { getDatabaseClient } from '@/config/database';
import { auth } from '@/middleware/auth';

const router = express.Router();

// Get all jobs for user
router.get('/', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();
    const jobs = await Promise.all([
      db.captionJob.findMany({ where: { userId: req.userId } }),
      db.renderJob.findMany({ where: { userId: req.userId } }),
      db.publishJob.findMany({ where: { userId: req.userId } })
    ]);

    res.json({
      caption: jobs[0],
      render: jobs[1],
      publish: jobs[2]
    });
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/:jobId', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();
    const job = await db.captionJob.findUnique({
      where: { id: req.params.jobId }
    });

    if (!job || job.userId !== req.userId) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

export default router;
