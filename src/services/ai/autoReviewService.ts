import { supabase } from '../../lib/supabase';
import { geminiService } from '../../lib/gemini';
import { AUTO_REVIEW_SYSTEM_PROMPT } from './autoReviewPrompt';
import { logger } from '../logger';

export class AutoReviewService {
  /**
   * Generates an AI review for a specific document
   */
  async generateAutoReview(documentId: string, userId: string): Promise<string> {
    try {
      logger.info('Starting Auto Review generation', { documentId, userId });

      // 1. Fetch document content
      const content = await this.fetchDocumentContent(documentId, userId);
      
      if (!content) {
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
      // Try fetching from user_books table first
      const { data: book, error } = await supabase
        .from('user_books')
        .select('page_texts, content, text_content')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Failed to fetch document from DB', { documentId }, error);
        return null;
      }

      // Priority 1: page_texts (Array of strings) - Best quality
      if (book.page_texts && Array.isArray(book.page_texts) && book.page_texts.length > 0) {
        return book.page_texts.join('\n\n');
      }

      // Priority 2: content (String) - Often from RAG processing
      if (book.content && book.content.length > 0) {
        return book.content;
      }

      // Priority 3: text_content (String) - Legacy/Simple field
      if (book.text_content && book.text_content.length > 0) {
        return book.text_content;
      }

      return null;
    } catch (error) {
      logger.error('Error in fetchDocumentContent', { documentId }, error as Error);
      return null;
    }
  }
}

export const autoReviewService = new AutoReviewService();

