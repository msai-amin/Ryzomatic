import { supabase } from '../../../lib/supabase';
import { geminiService } from '../../../lib/gemini';
import { AUTO_REVIEW_SYSTEM_PROMPT } from './autoReviewPrompt';
import { logger } from '../logger';

export class AutoReviewService {
  /**
   * Generates an AI review for a specific document
   * @param documentId - The document ID
   * @param userId - The user ID
   * @param fallbackContent - Optional: If DB fetch fails, use this content (from currentDocument.pageTexts)
   */
  async generateAutoReview(documentId: string, userId: string, fallbackContent?: string[]): Promise<string> {
    try {
      logger.info('Starting Auto Review generation', { documentId, userId });

      // 1. Fetch document content
      let content = await this.fetchDocumentContent(documentId, userId);
      
      // Fallback: Use in-memory pageTexts if DB fetch failed
      if (!content && fallbackContent && fallbackContent.length > 0) {
        logger.info('Using fallback content from memory', { documentId, pageCount: fallbackContent.length });
        content = fallbackContent.join('\n\n');
      }
      
      if (!content || content.trim().length === 0) {
        throw new Error('No text content found for this document. Please ensure the document has been processed.');
      }

      // 2. Truncate content if too long (Gemini Flash has ~1M token context, but let's be safe/efficient)
      // Taking first 50k characters (~10-15k tokens) usually covers Intro, Method, Results
      const truncatedContent = content.substring(0, 100000);

      // 3. Call Gemini AI
      const review = await geminiService.generateContent(
        truncatedContent,
        AUTO_REVIEW_SYSTEM_PROMPT
      );

      if (!review) {
        throw new Error('AI failed to generate a review.');
      }

      logger.info('Auto Review generated successfully', { documentId });
      return review;

    } catch (error) {
      logger.error('Auto Review generation failed', { documentId }, error as Error);
      throw error;
    }
  }

  /**
   * Fetches document text content from Supabase
   * Checks 'page_texts', 'content', or 'text_content' columns
   */
  private async fetchDocumentContent(documentId: string, userId: string): Promise<string | null> {
    try {
      logger.info('Fetching document content', { documentId, userId });

      // Try fetching from user_books table first
      const { data: book, error } = await supabase
        .from('user_books')
        .select('content, text_content, title')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Failed to fetch document from DB', { documentId, error: error.message }, error);
        // Don't return null yet - try document_content table
      } else if (book) {
        logger.info('Fetched book record', { documentId, hasContent: !!book.content, hasTextContent: !!book.text_content });

        // Priority 1: content (String) - Often from RAG processing
        if (book.content && book.content.length > 0) {
          logger.info('Using content field', { documentId, length: book.content.length });
          return book.content;
        }

        // Priority 2: text_content (String) - Legacy/Simple field
        if (book.text_content && book.text_content.length > 0) {
          logger.info('Using text_content field', { documentId, length: book.text_content.length });
          return book.text_content;
        }
      }

      // Priority 4: document_content table (chunked content)
      logger.info('Trying document_content table', { documentId });
      const { data: contentChunks, error: chunksError } = await supabase
        .from('document_content')
        .select('content, chunk_index')
        .eq('book_id', documentId)
        .eq('user_id', userId)
        .order('chunk_index', { ascending: true });

      if (chunksError) {
        logger.error('Failed to fetch from document_content', { documentId, error: chunksError.message }, chunksError);
      } else if (contentChunks && contentChunks.length > 0) {
        const joined = contentChunks.map(c => c.content).join('\n');
        logger.info('Using document_content chunks', { documentId, chunkCount: contentChunks.length, totalLength: joined.length });
        return joined;
      }

      logger.warn('No content found in any source', { documentId });
      return null;
    } catch (error) {
      logger.error('Error in fetchDocumentContent', { documentId }, error as Error);
      return null;
    }
  }
}

export const autoReviewService = new AutoReviewService();

