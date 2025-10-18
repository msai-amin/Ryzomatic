/**
 * Health Check API Endpoint
 * Provides system health status and monitoring information
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const startTime = Date.now();
    
    // Basic health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: process.env.VERCEL_REGION || 'unknown',
      responseTime: Date.now() - startTime
    };

    // Add environment-specific information
    const envInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };

    // Check critical environment variables
    const envChecks = {
      supabaseUrl: !!process.env.VITE_SUPABASE_URL,
      supabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
      openaiKey: !!process.env.VITE_OPENAI_API_KEY,
      geminiKey: !!process.env.VITE_GEMINI_API_KEY,
      googleCloudTtsKey: !!process.env.VITE_GOOGLE_CLOUD_TTS_API_KEY
    };

    // Determine overall health status
    const criticalEnvVars = ['supabaseUrl', 'supabaseKey'];
    const hasCriticalEnvVars = criticalEnvVars.every(key => envChecks[key as keyof typeof envChecks]);
    
    if (!hasCriticalEnvVars) {
      healthStatus.status = 'degraded';
    }

    const response = {
      ...healthStatus,
      environment: envInfo,
      configuration: envChecks,
      checks: {
        api: 'pass',
        database: envChecks.supabaseUrl && envChecks.supabaseKey ? 'pass' : 'fail',
        ai: envChecks.openaiKey || envChecks.geminiKey ? 'pass' : 'warn',
        tts: envChecks.googleCloudTtsKey ? 'pass' : 'warn'
      }
    };

    // Set appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    console.error('Health check error:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - Date.now()
    });
  }
}