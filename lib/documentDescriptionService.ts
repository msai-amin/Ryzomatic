import { supabase } from './supabase';
import { geminiService } from './gemini';
import { embeddingService } from './embeddingService';

export interface DocumentDescription {
  id?: string;
  book_id: string;
  user_id: string;
  ai_generated_description?: string;
  user_entered_description?: string;
  is_ai_generated?: boolean;
  description_embedding?: string;
  last_auto_generated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class DocumentDescriptionService {
  /**
   * Get document description (user-entered or AI-generated)
   */
  async getDescription(bookId: string, userId: string): Promise<DocumentDescription | null> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return null;
      }

      const { data, error } = await supabase
        .from('document_descriptions')
        .select('*')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error getting document description:', error);
      return null;
    }
  }

  /**
   * Generate AI description for a document
   */
  async generateDescription(bookId: string, userId: string, content?: string): Promise<DocumentDescription | null> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return null;
      }

      // Get document content if not provided
      if (!content) {
        const { data: book } = await supabase
          .from('user_books')
          .select('text_content, title, file_name')
          .eq('id', bookId)
          .eq('user_id', userId)
          .single();

        if (!book) {
          throw new Error('Document not found');
        }

        content = book.text_content || '';
      }

      // Generate description using Gemini
      const documentContent = content || '';
      const prompt = `Generate a comprehensive 2-3 sentence description of this document. Focus on the main topics, purpose, and key points. Be specific and informative.\n\nDocument: ${documentContent.substring(0, 5000)}`;
      
      const aiDescription = await geminiService.chat({
        message: prompt,
        tier: 'free'
      });

      // Generate embedding for the description
      const embedding = await embeddingService.embed(aiDescription);
      const embeddingString = embeddingService.formatForPgVector(embedding);

      // Check if description already exists
      const existing = await this.getDescription(bookId, userId);

      if (existing) {
        // Update existing description
        const { data, error } = await supabase
          .from('document_descriptions')
          .update({
            ai_generated_description: aiDescription,
            description_embedding: embeddingString,
            is_ai_generated: true,
            last_auto_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new description
        const { data, error } = await supabase
          .from('document_descriptions')
          .insert({
            book_id: bookId,
            user_id: userId,
            ai_generated_description: aiDescription,
            description_embedding: embeddingString,
            is_ai_generated: true,
            last_auto_generated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error generating description:', error);
      return null;
    }
  }

  /**
   * Update user-entered description
   */
  async updateDescription(bookId: string, userId: string, userDescription: string): Promise<DocumentDescription | null> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return null;
      }

      const existing = await this.getDescription(bookId, userId);

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('document_descriptions')
          .update({
            user_entered_description: userDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new with user description
        const { data, error } = await supabase
          .from('document_descriptions')
          .insert({
            book_id: bookId,
            user_id: userId,
            user_entered_description: userDescription,
            is_ai_generated: false
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error updating description:', error);
      return null;
    }
  }

  /**
   * Delete document description
   */
  async deleteDescription(bookId: string, userId: string): Promise<boolean> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return false;
      }

      const { error } = await supabase
        .from('document_descriptions')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting description:', error);
      return false;
    }
  }

  /**
   * Get combined description (user-entered or AI-generated)
   */
  async getCombinedDescription(bookId: string, userId: string): Promise<string> {
    const description = await this.getDescription(bookId, userId);
    
    if (!description) {
      return '';
    }

    // Prefer user-entered over AI-generated
    return description.user_entered_description || description.ai_generated_description || '';
  }

  /**
   * Regenerate AI description (useful when document content changes)
   */
  async regenerateDescription(bookId: string, userId: string, content?: string): Promise<DocumentDescription | null> {
    return this.generateDescription(bookId, userId, content);
  }
}

export const documentDescriptionService = new DocumentDescriptionService();

