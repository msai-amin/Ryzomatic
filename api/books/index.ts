import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDownloadUrl, deleteFile, fileExists, uploadFile } from '../../lib/s3.js';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smart-reader-documents';

type BookOperation = 
  | 'GET_UPLOAD_URL' 
  | 'DIRECT_UPLOAD' 
  | 'GET_DOWNLOAD_URL' 
  | 'DELETE' 
  | 'CHECK_EXISTS';

interface BookRequest {
  operation: BookOperation;
  s3Key: string;
  userId: string;
  expiresIn?: number;
  contentType?: string;
  fileData?: number[]; // ArrayBuffer sent as array
  metadata?: Record<string, string>;
}

/**
 * Unified Books API Endpoint - Handles All Book Storage and Access Operations
 * POST /api/books
 * 
 * Supports:
 * - GET_UPLOAD_URL: Returns presigned URL for client-side upload
 * - DIRECT_UPLOAD: Server-side upload for small files
 * - GET_DOWNLOAD_URL: Returns signed URL for downloading
 * - DELETE: Deletes file from S3
 * - CHECK_EXISTS: Verifies file existence
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, s3Key, userId, expiresIn = 3600, contentType, fileData, metadata } = req.body as BookRequest;

    console.log('[Books API] Request received:', { operation, s3Key, userId, hasFileData: !!fileData });

    // Validate required fields
    if (!operation || !s3Key || !userId) {
      console.error('[Books API] Missing required fields:', { operation, hasS3Key: !!s3Key, hasUserId: !!userId });
      return res.status(400).json({ error: 'Missing required fields: operation, s3Key, userId' });
    }

    // Verify ownership from s3Key pattern (books/{userId}/{bookId}.pdf)
    const keyParts = s3Key.split('/');
    if (keyParts.length !== 3 || keyParts[0] !== 'books' || keyParts[1] !== userId) {
      console.error('[Books API] Invalid s3Key ownership:', { s3Key, userId, keyParts });
      return res.status(403).json({ error: 'Access denied: Invalid s3Key ownership' });
    }

    // Authenticate user for upload operations (rate limiting requires auth)
    let authenticatedUserId: string | null = null;
    if (operation === 'GET_UPLOAD_URL' || operation === 'DIRECT_UPLOAD') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized - authentication required for upload operations' });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Verify userId matches authenticated user
      if (user.id !== userId) {
        return res.status(403).json({ error: 'Access denied - userId mismatch' });
      }

      authenticatedUserId = user.id;

      // Check rate limit for upload operations
      const rateLimitResult = await checkRateLimit(user.id, 'upload');
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      // Set rate limit headers in response
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          limit: rateLimitResult.limit,
          remaining: 0,
          reset_at: rateLimitResult.resetAt?.toISOString(),
        });
      }
    }

    // Route to appropriate operation
    switch (operation) {
      case 'GET_UPLOAD_URL':
        return await handleGetUploadUrl(res, s3Key, contentType || 'application/pdf');

      case 'DIRECT_UPLOAD':
        return await handleDirectUpload(res, s3Key, contentType || 'application/pdf', fileData, metadata);

      case 'GET_DOWNLOAD_URL':
        return await handleGetDownloadUrl(res, s3Key, expiresIn);

      case 'DELETE':
        return await handleDelete(res, s3Key);

      case 'CHECK_EXISTS':
        return await handleCheckExists(res, s3Key);

      default:
        console.error('[Books API] Unknown operation:', operation);
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

  } catch (error: any) {
    console.error('[Books API] Error:', error);
    return res.status(500).json({ 
      error: 'Book operation failed',
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

/**
 * Generate signed URL for downloading file
 */
async function handleGetDownloadUrl(
  res: VercelResponse,
  s3Key: string,
  expiresIn: number
): Promise<VercelResponse> {
  try {
    const signedUrl = await getDownloadUrl(s3Key, expiresIn);

    return res.status(200).json({
      success: true,
      signedUrl,
      expiresIn
    });

  } catch (error: any) {
    console.error('Get download URL error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate download URL',
      message: error.message 
    });
  }
}

/**
 * Delete file from S3
 */
async function handleDelete(
  res: VercelResponse,
  s3Key: string
): Promise<VercelResponse> {
  try {
    await deleteFile(s3Key);

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({ 
      error: 'Delete failed',
      message: error.message 
    });
  }
}

/**
 * Check if file exists in S3
 */
async function handleCheckExists(
  res: VercelResponse,
  s3Key: string
): Promise<VercelResponse> {
  try {
    const exists = await fileExists(s3Key);

    return res.status(200).json({
      success: true,
      exists
    });

  } catch (error: any) {
    console.error('Check exists error:', error);
    return res.status(500).json({ 
      error: 'Check failed',
      message: error.message 
    });
  }
}

