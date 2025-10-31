/**
 * Health check endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown' as string,
      environment: 'unknown' as string,
    },
  };

  try {
    // Check database connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    health.checks.database = error ? 'unhealthy' : 'healthy';

    // Check environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AWS_REGION',
      'AWS_S3_BUCKET',
    ];
    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    health.checks.environment = missingVars.length > 0 ? 'unhealthy' : 'healthy';

    // Set overall status
    const allHealthy = Object.values(health.checks).every((check) => check === 'healthy');
    health.status = allHealthy ? 'healthy' : 'degraded';

    // Return appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = 'unhealthy';
    res.status(503).json(health);
  }
}

