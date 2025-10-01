import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health check endpoint
 * GET /api/health
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'smart-reader-serverless',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      gemini: !!process.env.GEMINI_API_KEY,
      supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      s3: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY,
      pinecone: !!process.env.PINECONE_API_KEY,
    },
  };

  return res.status(200).json(health);
}

