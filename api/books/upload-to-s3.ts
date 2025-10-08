import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadFile } from '../../lib/s3';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Upload book to S3
 * POST /api/books/upload-to-s3
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      s3Key,
      fileData,
      contentType,
      metadata
    } = req.body;

    if (!s3Key || !fileData || !metadata) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert array back to Buffer
    const buffer = Buffer.from(fileData);

    // Upload to S3
    const result = await uploadFile({
      key: s3Key,
      body: buffer,
      contentType: contentType || 'application/pdf',
      metadata: {
        userId: metadata.userId,
        bookId: metadata.bookId,
        title: metadata.title,
        fileName: metadata.fileName,
      }
    });

    return res.status(200).json({
      success: true,
      s3Key: result.key,
      url: result.url
    });

  } catch (error: any) {
    console.error('S3 upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
}

