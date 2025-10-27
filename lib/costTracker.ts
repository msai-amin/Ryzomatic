import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CostMetrics {
  totalTokensUsed: number;
  totalCost: number;
  cacheHits: number;
  cacheMisses: number;
  averageContextSize: number;
  memoryBasedQueries: number;
  simpleHistoryQueries: number;
}

export interface CostSavings {
  tokensSaved: number;
  costSaved: number;
  cacheHitRate: number;
  improvementPercentage: number;
}

export class CostTracker {
  /**
   * Track API usage for a query
   */
  async trackUsage(params: {
    userId: string;
    model: string;
    tokensUsed: number;
    usedMemoryContext: boolean;
    contextSize: number;
    fromCache?: boolean;
  }): Promise<void> {
    try {
      const { userId, model, tokensUsed, usedMemoryContext, contextSize, fromCache } = params;
      
      // Estimate cost (Gemini is free, but we track for analytics)
      const cost = this.estimateCost(model, tokensUsed);
      
      await supabase.from('usage_records').insert({
        user_id: userId,
        action_type: 'ai_query',
        credits_used: 1,
        metadata: {
          model,
          tokensUsed,
          usedMemoryContext,
          contextSize,
          fromCache: fromCache || false,
          cost,
        },
      });
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  }

  /**
   * Estimate cost for different models
   */
  private estimateCost(model: string, tokens: number): number {
    const costPer1000Tokens: Record<string, number> = {
      'gemini-2.5-flash-lite': 0, // Free
      'gemini-2.5-pro': 0.000125, // $0.125 per 1M tokens
      'gpt-4o-mini': 0.00015, // $0.15 per 1M tokens
      'gpt-4': 0.03, // $30 per 1M tokens
    };

    const rate = costPer1000Tokens[model] || 0;
    return (tokens / 1000) * rate;
  }

  /**
   * Get cost metrics for a user
   */
  async getCostMetrics(userId: string, days: number = 7): Promise<CostMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: records } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (!records || records.length === 0) {
      return {
        totalTokensUsed: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageContextSize: 0,
        memoryBasedQueries: 0,
        simpleHistoryQueries: 0,
      };
    }

    let totalTokensUsed = 0;
    let totalCost = 0;
    let cacheHits = 0;
    let cacheMisses = 0;
    let totalContextSize = 0;
    let memoryQueries = 0;
    let simpleQueries = 0;

    for (const record of records) {
      const metadata = record.metadata || {};
      const tokens = metadata.tokensUsed || 0;
      const cost = metadata.cost || 0;
      const usedMemory = metadata.usedMemoryContext || false;
      const fromCache = metadata.fromCache || false;
      const contextSize = metadata.contextSize || 0;

      totalTokensUsed += tokens;
      totalCost += cost;
      totalContextSize += contextSize;
      
      if (fromCache) {
        cacheHits++;
      } else {
        cacheMisses++;
      }

      if (usedMemory) {
        memoryQueries++;
      } else {
        simpleQueries++;
      }
    }

    return {
      totalTokensUsed,
      totalCost,
      cacheHits,
      cacheMisses,
      averageContextSize: totalContextSize / records.length,
      memoryBasedQueries: memoryQueries,
      simpleHistoryQueries: simpleQueries,
    };
  }

  /**
   * Calculate cost savings from memory system
   */
  async getCostSavings(userId: string): Promise<CostSavings> {
    const metrics = await this.getCostMetrics(userId, 30);

    // Compare memory-based queries vs simple history
    // Memory queries should use smaller, more focused context
    const estimatedTokensWithoutMemory = metrics.simpleHistoryQueries * 8000; // 8K avg
    const actualTokensUsed = metrics.totalTokensUsed;
    const tokensSaved = Math.max(0, estimatedTokensWithoutMemory - actualTokensUsed);
    
    const totalQueries = metrics.cacheHits + metrics.cacheMisses;
    const cacheHitRate = totalQueries > 0 ? (metrics.cacheHits / totalQueries) * 100 : 0;

    // Estimate cost savings (using average rate)
    const costSaved = (tokensSaved / 1000) * 0.00015; // $0.15 per 1K tokens

    // Calculate improvement percentage
    const improvementPercentage = actualTokensUsed > 0 
      ? ((tokensSaved / estimatedTokensWithoutMemory) * 100) 
      : 0;

    return {
      tokensSaved,
      costSaved,
      cacheHitRate,
      improvementPercentage,
    };
  }

  /**
   * Get cache performance metrics
   */
  async getCachePerformance(userId: string): Promise<{
    hitRate: number;
    totalRequests: number;
    cacheSize: number;
    averageResponseTime: number;
  }> {
    const { data: cacheEntries } = await supabase
      .from('action_cache')
      .select('hit_count')
      .eq('user_id', userId);

    const totalHits = cacheEntries?.reduce((sum, entry) => sum + (entry.hit_count || 0), 0) || 0;
    const cacheSize = cacheEntries?.length || 0;
    const totalRequests = totalHits + (cacheSize * 10); // Estimate based on hits

    return {
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      totalRequests,
      cacheSize,
      averageResponseTime: 0, // Would track in production
    };
  }
}

export const costTracker = new CostTracker();

