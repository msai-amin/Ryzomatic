import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDownloadUrl, deleteFile, fileExists } from '../../lib/s3';

type AccessOperation = 'GET_DOWNLOAD_URL' | 'DELETE' | 'CHECK_EXISTS';

interface AccessRequest {
  operation: AccessOperation;
  s3Key: string;
  userId: string;
  expiresIn?: number;
}

/**
 * Unified Book Access Endpoint - Handles Download, Delete, Check Operations
 * POST /api/books/access
 * 
 * Supports:
 * - GET_DOWNLOAD_URL: Returns signed URL for downloading
 * - DELETE: Deletes file from S3
 * - CHECK_EXISTS: Verifies file existence
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, s3Key, userId, expiresIn = 3600 } = req.body as AccessRequest;

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
      case 'GET_DOWNLOAD_URL':
        return await handleGetDownloadUrl(res, s3Key, expiresIn);

      case 'DELETE':
        return await handleDelete(res, s3Key);

      case 'CHECK_EXISTS':
        return await handleCheckExists(res, s3Key);

      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

  } catch (error: any) {
    console.error('Access API error:', error);
    return res.status(500).json({ 
      error: 'Access operation failed',
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

