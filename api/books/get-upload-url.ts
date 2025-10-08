import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUploadUrl } from '../../lib/s3.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get presigned URL for uploading book directly to S3
 * This bypasses Vercel's 4.5MB body size limit
 * POST /api/books/get-upload-url
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { s3Key, contentType, userId } = req.body;

    if (!s3Key || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify ownership from s3Key
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get presigned URL for upload (valid for 5 minutes)
    const uploadUrl = await getUploadUrl(s3Key, contentType, 300);

    return res.status(200).json({
      success: true,
      uploadUrl,
      s3Key,
      expiresIn: 300
    });

  } catch (error: any) {
    console.error('Get upload URL error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate upload URL',
      message: error.message 
    });
  }
}
