import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';
import { geminiService } from './gemini';
import { UserAction, validateAction } from './actionSchemas';

// Lazy-load Supabase client to prevent errors when imported on client side
const getSupabaseClient = () => {
  if (typeof window !== 'undefined') {
    return null; // Client-side, don't create server-side client
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl.trim() === '' || supabaseKey.trim() === '') {
    return null;
  }
  
  try {
    return createClient(supabaseUrl.trim(), supabaseKey.trim());
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
};

const supabase = getSupabaseClient();

export interface ActionCacheEntry {
  id?: string;
  user_id: string;
  natural_language: string;
  action_schema: UserAction;
  action_type: string;
  hit_count: number;
  last_used_at: string;
  created_at?: string;
}

export interface ActionCacheResult {
  hit: boolean;
  action?: UserAction;
  confidence?: number;
  fromCache: boolean;
}

export class ActionCacheService {
  /**
   * Get or translate natural language to action
   */
  async getOrTranslate(params: {
    userId: string;
    query: string;
    context?: string;
  }): Promise<ActionCacheResult> {
    const { userId, query, context } = params;

    // First, try to find in cache
    const cachedResult = await this.searchCache(userId, query);
    if (cachedResult.hit) {
      return {
        hit: true,
        action: cachedResult.action,
        confidence: cachedResult.confidence,
        fromCache: true,
      };
    }

    // If not in cache, translate using LLM
    const translatedAction = await this.translateToAction(query, context);
    
    if (!translatedAction || !validateAction(translatedAction)) {
      return {
        hit: false,
        action: undefined,
        fromCache: false,
      };
    }

    // Store in cache
    const queryEmbedding = await embeddingService.embed(query);
    
    const { error } = await supabase
      .from('action_cache')
      .insert({
        user_id: userId,
        natural_language: query,
        action_schema: translatedAction,
        action_type: translatedAction.type,
        embedding: embeddingService.formatForPgVector(queryEmbedding),
      });

    if (error) {
      console.error('Failed to cache action:', error);
    }

    return {
      hit: true,
      action: translatedAction,
      confidence: 0.7, // Default confidence for new translations
      fromCache: false,
    };
  }

  /**
   * Search cache for similar actions
   */
  private async searchCache(
    userId: string,
    query: string,
    threshold: number = 0.85
  ): Promise<ActionCacheResult> {
    try {
      const queryEmbedding = await embeddingService.embed(query);

      // Get cached actions
      const { data: cachedActions, error } = await supabase
        .from('action_cache')
        .select('*')
        .eq('user_id', userId)
        .order('hit_count', { ascending: false })
        .limit(50); // Get top 50 for comparison

      if (error || !cachedActions || cachedActions.length === 0) {
        return { hit: false, fromCache: false };
      }

      // Find most similar action
      let bestMatch: any = null;
      let bestSimilarity = 0;

      for (const cached of cachedActions) {
        if (!cached.embedding) continue;

        const embeddingArray = JSON.parse(cached.embedding);
        const similarity = embeddingService.cosineSimilarity(queryEmbedding, embeddingArray);

        if (similarity > bestSimilarity && similarity >= threshold) {
          bestSimilarity = similarity;
          bestMatch = cached;
        }
      }

      if (!bestMatch) {
        return { hit: false, fromCache: false };
      }

      // Update hit count and last used
      await supabase
        .from('action_cache')
        .update({
          hit_count: (bestMatch.hit_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', bestMatch.id);

      return {
        hit: true,
        action: bestMatch.action_schema as UserAction,
        confidence: bestSimilarity,
        fromCache: true,
      };
    } catch (error) {
      console.error('Error searching action cache:', error);
      return { hit: false, fromCache: false };
    }
  }

  /**
   * Translate natural language to structured action
   */
  private async translateToAction(
    query: string,
    context?: string
  ): Promise<UserAction | null> {
    try {
      const model = geminiService['getModel']('free'); // Access private method
      
      const prompt = `Translate this natural language command into a structured action schema.

User command: "${query}"
${context ? `Context: ${context}` : ''}

Available action types:
1. highlight - Highlight text in document
2. create_note - Create an annotation/note
3. search_concept - Search for a concept
4. export - Export notes/highlights
5. tts_play - Start text-to-speech
6. question - Ask a question
7. navigate - Navigate to page/section

Return ONLY valid JSON matching one of these action schemas. If the command doesn't match any action type, return null.

Example responses:
{"type": "highlight", "text": "this paragraph", "colorId": "yellow", "colorHex": "#FFD700", "pageNumber": 5, "positionData": {"x": 0, "y": 0, "width": 100, "height": 20}}
{"type": "search_concept", "query": "methodology", "scope": "memory"}
{"type": "question", "query": "What is the main argument?", "context": "document"}

Command: "${query}"`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      if (!validateAction(parsed)) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error translating action:', error);
      return null;
    }
  }

  /**
   * Get cache statistics for a user
   */
  async getStats(userId: string): Promise<{
    totalEntries: number;
    totalHits: number;
    topActions: Array<{ type: string; hits: number }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('action_cache')
        .select('action_type, hit_count')
        .eq('user_id', userId);

      if (error || !data) {
        return { totalEntries: 0, totalHits: 0, topActions: [] };
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, entry) => sum + (entry.hit_count || 0), 0);

      // Aggregate by action type
      const actionStats = data.reduce((acc, entry) => {
        const type = entry.action_type || 'unknown';
        acc[type] = (acc[type] || 0) + (entry.hit_count || 0);
        return acc;
      }, {} as Record<string, number>);

      const topActions = Object.entries(actionStats)
        .map(([type, hits]) => ({ type, hits }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10);

      return {
        totalEntries,
        totalHits,
        topActions,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalEntries: 0, totalHits: 0, topActions: [] };
    }
  }

  /**
   * Clear cache entries older than specified days
   */
  async clearOldEntries(userId: string, daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from('action_cache')
        .delete()
        .eq('user_id', userId)
        .lt('last_used_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error clearing old cache entries:', error);
      return 0;
    }
  }
}

export const actionCacheService = new ActionCacheService();

