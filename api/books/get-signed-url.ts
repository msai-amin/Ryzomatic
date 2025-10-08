import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDownloadUrl } from '../../lib/s3.js';

/**
 * Get signed URL for book (for streaming/progressive loading)
 * POST /api/books/get-signed-url
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { s3Key, userId, expiresIn = 3600 } = req.body;

    if (!s3Key || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify ownership
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const signedUrl = await getDownloadUrl(s3Key, expiresIn);

    return res.status(200).json({
      success: true,
      signedUrl,
      expiresIn
    });

  } catch (error: any) {
    console.error('S3 signed URL error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate signed URL',
      message: error.message 
    });
  }
}

