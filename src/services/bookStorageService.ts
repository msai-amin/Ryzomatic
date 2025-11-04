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
   * Pattern for AWS S3: books/{userId}/{bookId}.pdf
   * Pattern for Supabase Storage: {userId}/{bookId}.pdf (bucket name is separate)
   */
  private generateBookKey(userId: string, bookId: string, fileType: 'pdf' | 'text', includeBookPrefix: boolean = false): string {
    const extension = fileType === 'pdf' ? 'pdf' : 'txt';
    const path = `${userId}/${bookId}.${extension}`;
    return includeBookPrefix ? `books/${path}` : path;
  }

  /**
   * Upload book file to Supabase Storage
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
      // Generate key WITHOUT 'books/' prefix for Supabase Storage
      const supabaseKey = this.generateBookKey(metadata.userId, metadata.bookId, metadata.fileType, false);
      // Generate key WITH 'books/' prefix for AWS S3 API
      const s3Key = this.generateBookKey(metadata.userId, metadata.bookId, metadata.fileType, true);

      logger.info('Uploading to Supabase Storage', context, {
        supabaseKey,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType
      });

      // Import supabase dynamically
      const { supabase } = await import('../../lib/supabase');

      // Upload to Supabase Storage
      const bucketName = 'books';
      
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(supabaseKey, file, {
          contentType: file.type || (metadata.fileType === 'pdf' ? 'application/pdf' : 'text/plain'),
          upsert: true // Overwrite if exists
        });

      if (error) {
        logger.warn('Supabase Storage upload failed, trying API fallback', context, undefined, { error: error.message });
        
        // Fallback to API endpoint if Supabase Storage fails (uses full s3Key with 'books/' prefix)
        try {
          logger.info('Attempting API fallback for upload', context, {
            s3Key,
            userId: metadata.userId
          });

          const urlResponse = await fetch('/api/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'GET_UPLOAD_URL',
              s3Key, // Use full path for AWS S3
              contentType: file.type || 'application/pdf',
              userId: metadata.userId
            })
          });

          if (!urlResponse.ok) {
            const errorText = await urlResponse.text();
            logger.error('API fallback failed', context, new Error(`HTTP ${urlResponse.status}: ${errorText}`));
            throw new Error(`API fallback failed: HTTP ${urlResponse.status} ${urlResponse.statusText}. ${errorText}`);
          }

          const responseData = await urlResponse.json();
          if (!responseData.uploadUrl) {
            logger.error('API response missing uploadUrl', context, undefined, { responseData });
            throw new Error('API response missing uploadUrl');
          }

          const { uploadUrl } = responseData;
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/pdf',
            },
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
          }
        } catch (apiError) {
          throw new Error(`Both Supabase Storage and API failed: ${error.message}`);
        }
      }

      const url = this.getBookUrl(s3Key);

      logger.info('Book uploaded successfully', context, {
        s3Key,
        supabaseKey,
        url
      });

      // Return s3Key with 'books/' prefix for database storage
      return {
        s3Key,
        url
      };

    } catch (error) {
      logger.error('Failed to upload book', context, error as Error);
      throw errorHandler.createError(
        `Failed to upload book: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.STORAGE,
        ErrorSeverity.HIGH,
        context
      );
    }
  }

  /**
   * Download book from S3 via Supabase Storage
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
      logger.info('Downloading book from Supabase Storage', context);

      // Import supabase dynamically to avoid circular dependencies
      const { supabase } = await import('../../lib/supabase');

      // Download file from Supabase Storage
      // Supabase Storage bucket name (should match upload)
      const bucketName = 'books';
      
      // Remove 'books/' prefix from s3Key if present (Supabase Storage doesn't need it)
      const supabaseKey = s3Key.startsWith('books/') ? s3Key.substring(6) : s3Key;
      
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .download(supabaseKey);

      if (error) {
        logger.warn('Supabase Storage download failed, trying API fallback', context, undefined, { error: error.message });
        
        // Fallback to API endpoint if Supabase Storage fails
        try {
          const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              operation: 'GET_DOWNLOAD_URL',
              s3Key, 
              userId 
            })
          });

          if (!response.ok) {
            throw new Error('API fallback failed');
          }

          const { signedUrl } = await response.json();
          const fileResponse = await fetch(signedUrl);
          
          if (!fileResponse.ok) {
            throw new Error('Failed to download from signed URL');
          }

          return await fileResponse.arrayBuffer();
        } catch (apiError) {
          throw new Error(`Both Supabase Storage and API failed: ${error.message}`);
        }
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();

      logger.info('Book downloaded successfully', context, {
        size: arrayBuffer.byteLength
      });

      return arrayBuffer;

    } catch (error) {
      logger.error('Failed to download book', context, error as Error);
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

      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: 'DELETE',
          s3Key, 
          userId 
        })
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
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: 'CHECK_EXISTS',
          s3Key, 
          userId 
        })
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
    const response = await fetch('/api/books', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        operation: 'GET_DOWNLOAD_URL',
        s3Key, 
        userId, 
        expiresIn 
      })
    });

    const { signedUrl } = await response.json();
    return signedUrl;
  }
}

// Export singleton instance
export const bookStorageService = BookStorageService.getInstance();

