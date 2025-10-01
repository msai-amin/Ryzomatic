import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smart-reader-documents';

export interface UploadParams {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Upload a file to S3
 */
export async function uploadFile(params: UploadParams): Promise<{ key: string; url: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
    ServerSideEncryption: 'AES256',
  });

  await s3Client.send(command);

  return {
    key: params.key,
    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.key}`,
  };
}

/**
 * Get a signed URL for downloading a file
 */
export async function getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a signed URL for uploading a file (client-side upload)
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Download a file from S3
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;

  if (!stream) {
    throw new Error('No file content found');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Generate S3 key for a user's document
 */
export function generateDocumentKey(userId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `documents/${userId}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

