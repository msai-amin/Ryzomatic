import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client inline
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smart-reader-documents';

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

    // Generate presigned URL for upload (valid for 5 minutes)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

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
