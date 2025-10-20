import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { uploadFile } from '../../lib/s3.js';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smart-reader-documents';

type StorageOperation = 'GET_UPLOAD_URL' | 'DIRECT_UPLOAD';

interface StorageRequest {
  operation: StorageOperation;
  s3Key: string;
  userId: string;
  contentType?: string;
  fileData?: number[]; // ArrayBuffer sent as array
  metadata?: Record<string, string>;
}

/**
 * Unified Book Storage Endpoint - Handles Upload Operations
 * POST /api/books/storage
 * 
 * Supports:
 * - GET_UPLOAD_URL: Returns presigned URL for client-side upload
 * - DIRECT_UPLOAD: Server-side upload for small files
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, s3Key, userId, contentType, fileData, metadata } = req.body as StorageRequest;

    // Validate required fields
    if (!operation || !s3Key || !userId) {
      return res.status(400).json({ error: 'Missing required fields: operation, s3Key, userId' });
    }

    // Verify ownership from s3Key pattern (books/{userId}/{bookId}.pdf)
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      return res.status(403).json({ error: 'Access denied: Invalid s3Key ownership' });
    }

    // Route to appropriate operation
    switch (operation) {
      case 'GET_UPLOAD_URL':
        return await handleGetUploadUrl(res, s3Key, contentType || 'application/pdf');

      case 'DIRECT_UPLOAD':
        return await handleDirectUpload(res, s3Key, contentType || 'application/pdf', fileData, metadata);

      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

  } catch (error: any) {
    console.error('Storage API error:', error);
    return res.status(500).json({ 
      error: 'Storage operation failed',
      message: error.message 
    });
  }
}

/**
 * Generate presigned URL for client-side upload
 */
async function handleGetUploadUrl(
  res: VercelResponse,
  s3Key: string,
  contentType: string
): Promise<VercelResponse> {
  try {
    // Generate presigned URL (valid for 5 minutes)
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

/**
 * Handle direct server-side upload to S3
 */
async function handleDirectUpload(
  res: VercelResponse,
  s3Key: string,
  contentType: string,
  fileData?: number[],
  metadata?: Record<string, string>
): Promise<VercelResponse> {
  try {
    if (!fileData) {
      return res.status(400).json({ error: 'fileData required for DIRECT_UPLOAD' });
    }

    // Convert array back to Buffer
    const buffer = Buffer.from(fileData);

    // Upload to S3
    const result = await uploadFile({
      key: s3Key,
      body: buffer,
      contentType: contentType,
      metadata: metadata
    });

    return res.status(200).json({
      success: true,
      s3Key: result.key,
      url: result.url
    });

  } catch (error: any) {
    console.error('Direct upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
}

