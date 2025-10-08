/**
 * Book Storage Service
 * Uses AWS S3 for storing PDF files instead of database
 * This prevents disk I/O issues and improves performance
 */

import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

// S3 configuration - matches api/documents/upload.ts pattern
const S3_BUCKET = import.meta.env.VITE_AWS_S3_BUCKET || 'smart-reader-documents';
const S3_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

export interface BookStorageMetadata {
  userId: string;
  bookId: string;
  title: string;
  fileName: string;
  fileType: 'pdf' | 'text';
  fileSize: number;
  totalPages?: number;
}

export class BookStorageService {
  private static instance: BookStorageService;

  private constructor() {}

  public static getInstance(): BookStorageService {
    if (!BookStorageService.instance) {
      BookStorageService.instance = new BookStorageService();
    }
    return BookStorageService.instance;
  }

  /**
   * Generate S3 key for a book
   * Pattern: books/{userId}/{bookId}.pdf
   */
  private generateBookKey(userId: string, bookId: string, fileType: 'pdf' | 'text'): string {
    const extension = fileType === 'pdf' ? 'pdf' : 'txt';
    return `books/${userId}/${bookId}.${extension}`;
  }

  /**
   * Upload book file to S3 using presigned URL
   * Returns S3 key for storage in database
   */
  async uploadBook(
    file: File | Blob,
    metadata: BookStorageMetadata
  ): Promise<{ s3Key: string; url: string }> {
    const context = {
      component: 'BookStorageService',
      action: 'uploadBook',
      bookId: metadata.bookId,
      userId: metadata.userId
    };

    try {
      const s3Key = this.generateBookKey(metadata.userId, metadata.bookId, metadata.fileType);

      logger.info('Getting presigned upload URL', context, {
        s3Key,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType
      });

      // Step 1: Get presigned URL from API
      const urlResponse = await fetch('/api/books/get-upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          s3Key,
          contentType: file.type || 'application/pdf',
          userId: metadata.userId
        })
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.message || 'Failed to get upload URL');
      }

      const { uploadUrl } = await urlResponse.json();

      logger.info('Got presigned URL, uploading directly to S3', context, {
        s3Key
      });

      // Step 2: Upload directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
      }

      const url = this.getBookUrl(s3Key);

      logger.info('Book uploaded to S3 successfully', context, {
        s3Key,
        url
      });

      return {
        s3Key,
        url
      };

    } catch (error) {
      logger.error('Failed to upload book to S3', context, error as Error);
      throw errorHandler.createError(
        `Failed to upload book: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        context
      );
    }
  }

  /**
   * Download book from S3
   * Returns the file as ArrayBuffer
   */
  async downloadBook(s3Key: string, userId: string): Promise<ArrayBuffer> {
    const context = {
      component: 'BookStorageService',
      action: 'downloadBook',
      s3Key,
      userId
    };

    try {
      logger.info('Downloading book from S3', context);

      // Call API endpoint to get signed URL
      const response = await fetch('/api/books/download-from-s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Key, userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Download failed');
      }

      const { signedUrl } = await response.json();

      // Download file from signed URL
      const fileResponse = await fetch(signedUrl);
      if (!fileResponse.ok) {
        throw new Error('Failed to download from S3');
      }

      const arrayBuffer = await fileResponse.arrayBuffer();

      logger.info('Book downloaded from S3 successfully', context, {
        size: arrayBuffer.byteLength
      });

      return arrayBuffer;

    } catch (error) {
      logger.error('Failed to download book from S3', context, error as Error);
      throw errorHandler.createError(
        `Failed to download book: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        context
      );
    }
  }

  /**
   * Delete book from S3
   */
  async deleteBook(s3Key: string, userId: string): Promise<void> {
    const context = {
      component: 'BookStorageService',
      action: 'deleteBook',
      s3Key,
      userId
    };

    try {
      logger.info('Deleting book from S3', context);

      const response = await fetch('/api/books/delete-from-s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Key, userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }

      logger.info('Book deleted from S3 successfully', context);

    } catch (error) {
      logger.error('Failed to delete book from S3', context, error as Error);
      throw errorHandler.createError(
        `Failed to delete book: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        context
      );
    }
  }

  /**
   * Check if book exists in S3
   */
  async bookExists(s3Key: string, userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/books/check-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3Key, userId })
      });

      const { exists } = await response.json();
      return exists;

    } catch (error) {
      logger.error('Failed to check if book exists', { s3Key }, error as Error);
      return false;
    }
  }

  /**
   * Get S3 URL for a book (public URL, not signed)
   */
  getBookUrl(s3Key: string): string {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
  }

  /**
   * Get signed URL for direct browser download
   * (if needed for streaming or progressive loading)
   */
  async getSignedUrl(s3Key: string, userId: string, expiresIn: number = 3600): Promise<string> {
    const response = await fetch('/api/books/get-signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ s3Key, userId, expiresIn })
    });

    const { signedUrl } = await response.json();
    return signedUrl;
  }
}

// Export singleton instance
export const bookStorageService = BookStorageService.getInstance();

