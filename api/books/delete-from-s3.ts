import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteFile } from '../../lib/s3';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Delete book from S3
 * POST /api/books/delete-from-s3
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

    // Delete from S3
    await deleteFile(s3Key);

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully'
    });

  } catch (error: any) {
    console.error('S3 delete error:', error);
    return res.status(500).json({ 
      error: 'Delete failed',
      message: error.message 
    });
  }
}

