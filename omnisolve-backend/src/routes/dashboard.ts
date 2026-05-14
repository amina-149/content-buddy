import express from 'express';
import { getDatabaseClient } from '@/config/database';
import { auth } from '@/middleware/auth';

const router = express.Router();

// Get dashboard analytics
router.get('/analytics', auth, async (req, res, next) => {
  try {
    const db = getDatabaseClient();

    const [
      totalVideos,
      completedVideos,
      totalViews,
      avgEngagement
    ] = await Promise.all([
      db.video.count({ where: { userId: req.userId } }),
      db.video.count({ where: { userId: req.userId, status: 'COMPLETED' } }),
      db.publishingHistory.aggregate({
        where: { video: { userId: req.userId } },
        _sum: { viewCount: true }
      }),
      db.publishingHistory.aggregate({
        where: { video: { userId: req.userId } },
        _avg: { engagementRate: true }
      })
    ]);

    res.json({
      totalVideos,
      completedVideos,
      totalViews: totalViews._sum.viewCount || 0,
      avgEngagement: avgEngagement._avg.engagementRate || 0
    });
  } catch (error) {
    next(error);
  }
});

export default router;
