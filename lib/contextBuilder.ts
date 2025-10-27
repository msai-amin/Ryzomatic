import { memoryService } from './memoryService';
import { embeddingService } from './embeddingService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ContextBuilderResult {
  structuredContext: {
    relevantMemories: Array<{
      text: string;
      type: string;
      metadata?: Record<string, any>;
    }>;
    relevantNotes: Array<{
      id: string;
      content: string;
      pageNumber: number;
    }>;
    relevantHighlights: Array<{
      id: string;
      text: string;
      color: string;
      pageNumber: number;
    }>;
    conversationSummary?: string;
  };
  tokenEstimate: number;
}

export class ContextBuilder {
  /**
   * Build intelligent context for a chat message
   */
  async buildContext(params: {
    userId: string;
    query: string;
    conversationId?: string;
    documentId?: string;
    limit?: number;
  }): Promise<ContextBuilderResult> {
    const { userId, query, conversationId, documentId, limit = 15 } = params;

    // Step 1: Extract entities from user query
    const queryEmbedding = await embeddingService.embed(query);
    
    // Step 2: Search for relevant memories
    const relevantMemories = await memoryService.searchMemories({
      userId,
      query,
      limit: Math.ceil(limit * 0.5), // Use 50% of limit for memories
      documentId,
    });

    // Step 3: Get notes for the document
    const relevantNotes = documentId
      ? await this.getRelevantNotes(userId, documentId, query, Math.ceil(limit * 0.3))
      : [];

    // Step 4: Get highlights for the document
    const relevantHighlights = documentId
      ? await this.getRelevantHighlights(userId, documentId, query, Math.ceil(limit * 0.2))
      : [];

    // Step 5: Build structured context
    const contextText = this.buildContextText({
      memories: relevantMemories,
      notes: relevantNotes,
      highlights: relevantHighlights,
    });

    // Estimate tokens (rough: 1 token ≈ 4 chars)
    const tokenEstimate = Math.ceil(contextText.length / 4);

    return {
      structuredContext: {
        relevantMemories: relevantMemories.map(m => ({
          text: m.entity_text,
          type: m.entity_type,
          metadata: m.entity_metadata,
        })),
        relevantNotes,
        relevantHighlights,
      },
      tokenEstimate,
    };
  }

  /**
   * Get relevant notes based on semantic similarity
   */
  private async getRelevantNotes(
    userId: string,
    documentId: string,
    query: string,
    limit: number
  ): Promise<Array<{ id: string; content: string; pageNumber: number }>> {
    try {
      const { data: notes } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('book_id', documentId)
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Get more for filtering

      if (!notes) return [];

      // Simple text matching (in a production system, you'd compute embeddings)
      const queryLower = query.toLowerCase();
      const relevantNotes = notes
        .filter(note => note.content.toLowerCase().includes(queryLower))
        .map(note => ({
          id: note.id,
          content: note.content,
          pageNumber: note.page_number,
        }))
        .slice(0, limit);

      return relevantNotes;
    } catch (error) {
      console.error('Error getting relevant notes:', error);
      return [];
    }
  }

  /**
   * Get relevant highlights based on semantic similarity
   */
  private async getRelevantHighlights(
    userId: string,
    documentId: string,
    query: string,
    limit: number
  ): Promise<Array<{ id: string; text: string; color: string; pageNumber: number }>> {
    try {
      const { data: highlights } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('user_id', userId)
        .eq('book_id', documentId)
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Get more for filtering

      if (!highlights) return [];

      // Simple text matching
      const queryLower = query.toLowerCase();
      const relevantHighlights = highlights
        .filter(hl => hl.highlighted_text.toLowerCase().includes(queryLower))
        .map(hl => ({
          id: hl.id,
          text: hl.highlighted_text,
          color: hl.color_hex,
          pageNumber: hl.page_number,
        }))
        .slice(0, limit);

      return relevantHighlights;
    } catch (error) {
      console.error('Error getting relevant highlights:', error);
      return [];
    }
  }

  /**
   * Build context text from structured data
   */
  private buildContextText(params: {
    memories: Array<{ entity_text: string; entity_type: string }>;
    notes: Array<{ content: string; pageNumber: number }>;
    highlights: Array<{ text: string; pageNumber: number; color: string }>;
  }): string {
    const { memories, notes, highlights } = params;
    const parts: string[] = [];

    // Add memory context
    if (memories.length > 0) {
      parts.push('## Previous Conversation Memory');
      memories.forEach(mem => {
        parts.push(`- ${mem.entity_type}: ${mem.entity_text}`);
      });
    }

    // Add notes context
    if (notes.length > 0) {
      parts.push('\n## Relevant Notes');
      notes.forEach(note => {
        parts.push(`- Page ${note.pageNumber}: ${note.content.substring(0, 200)}`);
      });
    }

    // Add highlights context
    if (highlights.length > 0) {
      parts.push('\n## Relevant Highlights');
      highlights.forEach(hl => {
        parts.push(`- Page ${hl.pageNumber}: "${hl.text}"`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Get conversation summary from memories
   */
  async getConversationSummary(conversationId: string): Promise<string | null> {
    try {
      const memories = await memoryService.getConversationMemories(conversationId, '');

      if (memories.length === 0) {
        return null;
      }

      // Aggregate insights
      const insights = memories
        .filter(m => m.entity_type === 'insight')
        .map(m => m.entity_text);

      if (insights.length === 0) {
        return 'No insights extracted from this conversation yet.';
      }

      return insights.join('\n');
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return null;
    }
  }

  /**
   * Check if query should use memory context or fallback to simple history
   */
  shouldUseMemoryContext(query: string): boolean {
    // Simple heuristic: memory context is useful for:
    // - Questions about previous conversations
    // - Cross-document queries
    // - Complex analytical queries
    
    const lowercaseQuery = query.toLowerCase();
    const memoryIndicators = [
      'before',
      'previous',
      'earlier',
      'what did',
      'remember',
      'mentioned',
      'discussed',
      'compare',
      'related',
      'similar',
    ];

    return memoryIndicators.some(indicator => lowercaseQuery.includes(indicator));
  }
}

export const contextBuilder = new ContextBuilder();

