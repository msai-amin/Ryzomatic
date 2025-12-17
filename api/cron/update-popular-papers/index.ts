/**
 * Cron Job: Update Popular Papers
 * Scheduled to run weekly to refresh popular papers list and pre-compute embeddings
 * 
 * Vercel Cron Configuration (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-popular-papers",
 *     "schedule": "0 2 * * 0"  // Every Sunday at 2 AM
 *   }]
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { paperEmbeddingMaintenanceService } from '../../../lib/paperEmbeddingMaintenanceService.js';

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it for security
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow GET for manual triggers and POST for cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const action = (req.query.action || req.body?.action) as string || 'full';
    const email = req.query.email || req.body?.email;

    console.log(`Cron job triggered: ${action}`);

    let results: any = {};

    switch (action) {
      case 'update-popular':
        results = {
          popularUpdate: await paperEmbeddingMaintenanceService.updatePopularPapersList(
            parseInt(req.query.limit as string) || 50000,
            email
          ),
        };
        break;

      case 'refresh-trending':
        results = {
          trendingRefresh: await paperEmbeddingMaintenanceService.refreshTrendingPapers(
            parseInt(req.query.limit as string) || 5000,
            5,
            email
          ),
        };
        break;

      case 'cleanup':
        results = {
          cleanup: await paperEmbeddingMaintenanceService.cleanupOldEmbeddings(
            parseInt(req.query.days as string) || 90
          ),
        };
        break;

      case 'full':
      default:
        results = await paperEmbeddingMaintenanceService.runFullMaintenance({
          updatePopular: req.query.updatePopular !== 'false',
          refreshTrending: req.query.refreshTrending !== 'false',
          cleanupOld: req.query.cleanupOld === 'true',
          popularLimit: parseInt(req.query.popularLimit as string) || 50000,
          trendingLimit: parseInt(req.query.trendingLimit as string) || 5000,
          cleanupDays: parseInt(req.query.cleanupDays as string) || 90,
          email,
        });
        break;
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      action,
      results,
    });
  } catch (error: any) {
    console.error('Error in cron job:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

