import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDownloadUrl } from '../../lib/s3';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get signed URL for downloading book from S3
 * POST /api/books/download-from-s3
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { s3Key, userId } = req.body;

    if (!s3Key || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify ownership by checking if book belongs to user
    // Extract bookId from s3Key (format: books/{userId}/{bookId}.pdf)
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get signed URL (valid for 1 hour)
    const signedUrl = await getDownloadUrl(s3Key, 3600);

    return res.status(200).json({
      success: true,
      signedUrl
    });

  } catch (error: any) {
    console.error('S3 download error:', error);
    return res.status(500).json({ 
      error: 'Download failed',
      message: error.message 
    });
  }
}

