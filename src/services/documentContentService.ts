/**
 * Document Content Service
 * 
 * Handles storage and retrieval of parsed document text.
 * Integrates with embedding generation and automatic graph creation.
 */

import { supabase } from '../../lib/supabase';
import { embeddingService } from '../../lib/embeddingService';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface DocumentContent {
  id?: string;
  book_id: string;
  user_id: string;
  content: string;
  chunk_index: number;
  chunk_count: number;
  extraction_method: 'pdfjs' | 'manual' | 'ocr';
  word_count?: number;
  character_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentContentStats {
  total_documents: number;
  total_chunks: number;
  total_words: number;
  total_characters: number;
  avg_words_per_doc: number;
  documents_with_content: number;
}

export interface SearchResult {
  book_id: string;
  title: string;
  file_name: string;
  content_snippet: string;
  rank: number;
}

class DocumentContentService {
  private readonly CHUNK_SIZE = 10000; // Characters per chunk
  private readonly MAX_EMBEDDING_LENGTH = 8000; // Max chars for embedding

  /**
   * Store document content with automatic chunking
   */
  async storeDocumentContent(
    bookId: string,
    userId: string,
    content: string,
    extractionMethod: 'pdfjs' | 'manual' | 'ocr' = 'pdfjs'
  ): Promise<{ success: boolean; chunks: number }> {
    try {
      const context = { bookId, userId, extractionMethod };
      logger.info('Storing document content', context, {
        contentLength: content.length,
        method: extractionMethod
      });

      // Calculate statistics
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const characterCount = content.length;

      // Chunk the content if necessary
      const chunks = this.chunkContent(content);
      logger.info('Content chunked', context, { chunkCount: chunks.length });

      // Store each chunk
      const chunkRecords: Omit<DocumentContent, 'id'>[] = chunks.map((chunk, index) => ({
        book_id: bookId,
        user_id: userId,
        content: chunk,
        chunk_index: index,
        chunk_count: chunks.length,
        extraction_method: extractionMethod,
        word_count: Math.round(wordCount / chunks.length),
        character_count: chunk.length
      }));

      // Delete existing content for this book (in case of re-upload)
      const { error: deleteError } = await supabase
        .from('document_content')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', userId);

      if (deleteError) {
        logger.warn('Failed to delete existing content', context, deleteError);
      }

      // Insert new content
      const { error: insertError } = await supabase
        .from('document_content')
        .insert(chunkRecords);

      if (insertError) {
        throw errorHandler.createError(
          `Failed to store document content: ${insertError.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context, error: insertError.message }
        );
      }

      logger.info('Document content stored successfully', context, {
        chunks: chunks.length,
        totalWords: wordCount,
        totalChars: characterCount
      });

      // Generate embedding and description (async, don't block)
      this.generateEmbeddingAndDescription(bookId, userId, content).catch(error => {
        logger.error('Failed to generate embedding', context, error);
      });

      return { success: true, chunks: chunks.length };
    } catch (error) {
      logger.error('Error storing document content', { bookId, userId }, error as Error);
      throw error;
    }
  }

  /**
   * Chunk content into manageable pieces
   */
  private chunkContent(content: string): string[] {
    if (content.length <= this.CHUNK_SIZE) {
      return [content];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by paragraphs to avoid breaking mid-sentence
    const paragraphs = content.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.CHUNK_SIZE) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single paragraph is too large, split by sentences
        if (paragraph.length > this.CHUNK_SIZE) {
          const sentences = paragraph.split(/[.!?]+\s+/);
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > this.CHUNK_SIZE) {
              if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
              }
            }
            currentChunk += sentence + '. ';
          }
        } else {
          currentChunk = paragraph + '\n\n';
        }
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate embedding and AI description for the document
   * This triggers automatic relationship generation via database trigger
   */
  private async generateEmbeddingAndDescription(
    bookId: string,
    userId: string,
    content: string
  ): Promise<void> {
    try {
      const context = { bookId, userId };
      logger.info('Generating embedding and description', context);

      // Truncate content for embedding (use first N chars as summary)
      const summaryText = content.substring(0, this.MAX_EMBEDDING_LENGTH);

      // Generate embedding
      const embedding = await embeddingService.embed(summaryText);
      const embeddingVector = embeddingService.formatForPgVector(embedding);

      // Check if description already exists (now checking user_books columns)
      const { data: existing, error: checkError } = await supabase
        .from('user_books')
        .select('id, description_embedding')
        .eq('id', bookId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing && existing.description_embedding) {
        // Update existing description in user_books
        const { error: updateError } = await supabase
          .from('user_books')
          .update({
            description_embedding: embeddingVector,
            last_auto_generated_at: new Date().toISOString()
          })
          .eq('id', bookId);

        if (updateError) {
          throw updateError;
        }

        logger.info('Updated document description embedding', context);
      } else {
        // Update user_books with embedding (book must exist)
        const { error: updateError } = await supabase
          .from('user_books')
          .update({
            description_embedding: embeddingVector,
            ai_description: 'Auto-generated embedding', // Placeholder or actual description if available
            last_auto_generated_at: new Date().toISOString()
          })
          .eq('id', bookId);

        if (updateError) {
          throw updateError;
        }

        logger.info('Created document description with embedding', context);
      }

      // The database trigger will automatically generate relationships
      logger.info('Embedding stored, automatic relationship generation triggered', context);

    } catch (error) {
      logger.error('Error generating embedding and description', { bookId, userId }, error as Error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get full document content (all chunks concatenated)
   */
  async getFullContent(bookId: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_full_document_content', { book_uuid: bookId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get document content: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          { bookId, userId, error: error.message }
        );
      }

      return data || null;
    } catch (error) {
      logger.error('Error getting full document content', { bookId, userId }, error as Error);
      throw error;
    }
  }

  /**
   * Get content summary (first 5000 chars)
   */
  async getContentSummary(bookId: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_document_content_summary', { book_uuid: bookId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get content summary: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          { bookId, userId, error: error.message }
        );
      }

      return data || null;
    } catch (error) {
      logger.error('Error getting content summary', { bookId, userId }, error as Error);
      throw error;
    }
  }

  /**
   * Search document content using full-text search
   */
  async searchContent(
    userId: string,
    searchQuery: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabase
        .rpc('search_document_content', {
          search_query: searchQuery,
          limit_count: limit
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to search content: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          { userId, searchQuery, error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error searching content', { userId, searchQuery }, error as Error);
      throw error;
    }
  }

  /**
   * Get content statistics for a user
   */
  async getStats(userId: string): Promise<DocumentContentStats | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_document_content_stats', { user_uuid: userId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get content stats: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.LOW,
          { userId, error: error.message }
        );
      }

      return data?.[0] || null;
    } catch (error) {
      logger.error('Error getting content stats', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Regenerate all document relationships for a user
   * Useful for backfilling or after changing similarity threshold
   */
  async regenerateAllRelationships(
    userId: string,
    similarityThreshold: number = 0.60
  ): Promise<{ totalBooks: number; totalRelationships: number }> {
    try {
      const context = { userId, similarityThreshold };
      logger.info('Regenerating all document relationships', context);

      const { data, error } = await supabase
        .rpc('regenerate_all_document_relationships', {
          similarity_threshold: similarityThreshold
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to regenerate relationships: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          { context, error: error.message }
        );
      }

      const results = data || [];
      const totalBooks = results.length;
      const totalRelationships = results.reduce((sum: number, r: any) => sum + (r.relationships_created || 0), 0);

      logger.info('Relationships regenerated', context, {
        totalBooks,
        totalRelationships
      });

      return { totalBooks, totalRelationships };
    } catch (error) {
      logger.error('Error regenerating relationships', { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Check if document has stored content
   */
  async hasContent(bookId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('document_content')
        .select('id')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        logger.warn('Error checking for content', { bookId, userId }, error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      logger.error('Error checking for content', { bookId, userId }, error as Error);
      return false;
    }
  }
}

export const documentContentService = new DocumentContentService();

