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
   * Now reads from user_books table
   */
  async getDescription(bookId: string, userId: string): Promise<DocumentDescription | null> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return null;
      }

      const { data, error } = await supabase
        .from('user_books')
        .select('id, ai_description, user_description, description_embedding, last_auto_generated_at, created_at, updated_at')
        .eq('id', bookId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      // Map user_books columns to DocumentDescription interface
      return {
        id: data.id,
        book_id: bookId,
        user_id: userId,
        ai_generated_description: data.ai_description,
        user_entered_description: data.user_description,
        is_ai_generated: !!data.ai_description,
        description_embedding: data.description_embedding,
        last_auto_generated_at: data.last_auto_generated_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
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

      // Fetch user's notes and highlights for this document
      const [notesResult, highlightsResult] = await Promise.all([
        supabase
          .from('user_notes')
          .select('content, page_number')
          .eq('book_id', bookId)
          .eq('user_id', userId)
          .limit(10)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_highlights')
          .select('highlighted_text, page_number')
          .eq('book_id', bookId)
          .eq('user_id', userId)
          .eq('is_orphaned', false)
          .limit(10)
          .order('created_at', { ascending: false }),
      ]);

      const notes = notesResult.data || [];
      const highlights = highlightsResult.data || [];

      // Build enhanced prompt with user context
      const documentContent = content || '';
      let prompt = `Generate a comprehensive 2-3 sentence description of this document. Focus on the main topics, purpose, and key points. Be specific and informative.\n\nDocument: ${documentContent.substring(0, 5000)}`;

      // Add user's highlighted sections if available
      if (highlights.length > 0) {
        const highlightedSections = highlights
          .slice(0, 5)
          .map((h, idx) => `"${h.highlighted_text.substring(0, 100)}"`)
          .join(', ');
        prompt += `\n\nUser has highlighted these important sections: ${highlightedSections}`;
      }

      // Add user's notes if available
      if (notes.length > 0) {
        const noteTopics = notes
          .slice(0, 5)
          .map((n, idx) => n.content.substring(0, 100))
          .join('; ');
        prompt += `\n\nUser's notes indicate interest in: ${noteTopics}`;
      }

      prompt += `\n\nGenerate a description that reflects the user's focus areas and the document's main content.`;
      
      const aiDescription = await geminiService.chat({
        message: prompt,
        tier: 'free'
      });

      // Generate embedding for the description
      const embedding = await embeddingService.embed(aiDescription);
      const embeddingString = embeddingService.formatForPgVector(embedding);

      // Update user_books with description and embedding
        const { data, error } = await supabase
        .from('user_books')
          .update({
          ai_description: aiDescription,
            description_embedding: embeddingString,
            last_auto_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        .eq('id', bookId)
        .eq('user_id', userId)
        .select('id, ai_description, user_description, description_embedding, last_auto_generated_at, created_at, updated_at')
          .single();

        if (error) throw error;

      // Map to DocumentDescription interface
      return {
        id: data.id,
            book_id: bookId,
            user_id: userId,
        ai_generated_description: data.ai_description,
        user_entered_description: data.user_description,
            is_ai_generated: true,
        description_embedding: data.description_embedding,
        last_auto_generated_at: data.last_auto_generated_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
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

      // Update user_books with user description
        const { data, error } = await supabase
        .from('user_books')
          .update({
          user_description: userDescription,
            updated_at: new Date().toISOString()
          })
        .eq('id', bookId)
        .eq('user_id', userId)
        .select('id, ai_description, user_description, description_embedding, last_auto_generated_at, created_at, updated_at')
          .single();

        if (error) throw error;

      // Map to DocumentDescription interface
      return {
        id: data.id,
            book_id: bookId,
            user_id: userId,
        ai_generated_description: data.ai_description,
        user_entered_description: data.user_description,
        is_ai_generated: false,
        description_embedding: data.description_embedding,
        last_auto_generated_at: data.last_auto_generated_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      console.error('Error updating description:', error);
      return null;
    }
  }

  /**
   * Delete document description (clears description fields in user_books)
   */
  async deleteDescription(bookId: string, userId: string): Promise<boolean> {
    try {
      if (!supabase) {
        console.error('Supabase not initialized');
        return false;
      }

      // Clear description fields instead of deleting the book
      const { error } = await supabase
        .from('user_books')
        .update({
          ai_description: null,
          user_description: null,
          description_embedding: null,
          last_auto_generated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookId)
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

