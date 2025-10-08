import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fileExists } from '../../lib/s3';

/**
 * Check if book exists in S3
 * POST /api/books/check-exists
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

    // Verify ownership
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exists = await fileExists(s3Key);

    return res.status(200).json({ exists });

  } catch (error: any) {
    console.error('S3 check exists error:', error);
    return res.status(500).json({ 
      error: 'Check failed',
      message: error.message 
    });
  }
}

