import { createClient } from '@supabase/supabase-js';
import { paperPopularityService } from './paperPopularityService';
import { paperEmbeddingService } from './paperEmbeddingService';
import { openAlexPopularPaperService } from './openAlexPopularPaperService';

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

export interface MaintenanceResult {
  success: boolean;
  papersIdentified: number;
  papersPrecomputed: number;
  papersFailed: number;
  message: string;
}

export class PaperEmbeddingMaintenanceService {
  /**
   * Update popular papers list
   * Re-runs popularity scoring and identifies new popular papers
   */
  async updatePopularPapersList(
    limit: number = 50000,
    email?: string
  ): Promise<MaintenanceResult> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: 'Supabase client not available',
      };
    }
    
    try {
      console.log('Starting popular papers list update...');

      // Identify popular papers
      const popularPapers = await paperPopularityService.identifyPopularPapers(limit, email);

      // Store in database
      await paperPopularityService.storePopularPapers(popularPapers);

      // Find papers that need embedding generation
      const { data: papersToPrecompute } = await supabase
        .from('popular_papers')
        .select('openalex_id')
        .eq('precomputed', false)
        .order('popularity_score', { ascending: false })
        .limit(1000); // Process 1000 at a time

      if (!papersToPrecompute || papersToPrecompute.length === 0) {
        return {
          success: true,
          papersIdentified: popularPapers.length,
          papersPrecomputed: 0,
          papersFailed: 0,
          message: `Updated popular papers list: ${popularPapers.length} papers identified, none need pre-computation`,
        };
      }

      // Pre-compute embeddings for new papers
      const paperIds = papersToPrecompute.map(p => p.openalex_id);
      const progress = await paperEmbeddingService.batchPrecompute(paperIds, 100);

      return {
        success: true,
        papersIdentified: popularPapers.length,
        papersPrecomputed: progress.processed,
        papersFailed: progress.failed,
        message: `Updated popular papers list: ${popularPapers.length} identified, ${progress.processed} pre-computed, ${progress.failed} failed`,
      };
    } catch (error: any) {
      console.error('Error updating popular papers list:', error);
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Refresh trending papers list
   * Fetches recent highly cited papers and adds them to popular papers
   */
  async refreshTrendingPapers(
    limit: number = 5000,
    years: number = 5,
    email?: string
  ): Promise<MaintenanceResult> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: 'Supabase client not available',
      };
    }
    
    try {
      console.log(`Refreshing trending papers (last ${years} years, limit: ${limit})...`);

      // Fetch trending papers
      const trendingPapers = await openAlexPopularPaperService.fetchTrendingPapers(
        limit,
        years,
        50, // Min 50 citations
        email
      );

      // Get user stats and calculate popularity scores
      const popularPapers = await Promise.all(
        trendingPapers.map(async (paper) => {
          const userStats = await paperPopularityService.getUserPaperStats(paper.id);
          return paperPopularityService.calculatePopularityScore(paper, userStats);
        })
      );

      // Store in database
      await paperPopularityService.storePopularPapers(popularPapers);

      // Find new papers that need pre-computation
      const { data: newPapers } = await supabase
        .from('popular_papers')
        .select('openalex_id')
        .eq('discovery_method', 'trending')
        .eq('precomputed', false)
        .order('popularity_score', { ascending: false })
        .limit(500);

      if (!newPapers || newPapers.length === 0) {
        return {
          success: true,
          papersIdentified: popularPapers.length,
          papersPrecomputed: 0,
          papersFailed: 0,
          message: `Refreshed trending papers: ${popularPapers.length} identified, all already pre-computed`,
        };
      }

      // Pre-compute embeddings
      const paperIds = newPapers.map(p => p.openalex_id);
      const progress = await paperEmbeddingService.batchPrecompute(paperIds, 100);

      return {
        success: true,
        papersIdentified: popularPapers.length,
        papersPrecomputed: progress.processed,
        papersFailed: progress.failed,
        message: `Refreshed trending papers: ${popularPapers.length} identified, ${progress.processed} pre-computed`,
      };
    } catch (error: any) {
      console.error('Error refreshing trending papers:', error);
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Cleanup old embeddings
   * Remove embeddings for papers not accessed in 90+ days
   */
  async cleanupOldEmbeddings(daysThreshold: number = 90): Promise<MaintenanceResult> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: 'Supabase client not available',
      };
    }
    
    try {
      console.log(`Cleaning up embeddings older than ${daysThreshold} days...`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

      // Find papers not viewed in threshold days
      const { data: oldPapers, error } = await supabase
        .from('paper_recommendations')
        .select('openalex_id, last_viewed_at, precomputed_at')
        .not('embedding', 'is', null)
        .or(`last_viewed_at.is.null,last_viewed_at.lt.${cutoffDate.toISOString()}`)
        .limit(1000); // Process in batches

      if (error) throw error;
      if (!oldPapers || oldPapers.length === 0) {
        return {
          success: true,
          papersIdentified: 0,
          papersPrecomputed: 0,
          papersFailed: 0,
          message: 'No old embeddings to cleanup',
        };
      }

      // Remove embeddings (set to NULL, keep the paper record)
      const openalexIds = oldPapers.map(p => p.openalex_id);
      const { error: updateError } = await supabase
        .from('paper_recommendations')
        .update({
          embedding: null,
          precomputed_at: null,
        })
        .in('openalex_id', openalexIds);

      if (updateError) throw updateError;

      // Update popular_papers table
      await supabase
        .from('popular_papers')
        .update({
          precomputed: false,
          precomputed_at: null,
        })
        .in('openalex_id', openalexIds);

      return {
        success: true,
        papersIdentified: oldPapers.length,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: `Cleaned up ${oldPapers.length} old embeddings`,
      };
    } catch (error: any) {
      console.error('Error cleaning up old embeddings:', error);
      return {
        success: false,
        papersIdentified: 0,
        papersPrecomputed: 0,
        papersFailed: 0,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Run full maintenance cycle
   * Updates popular papers, refreshes trending, and optionally cleans up
   */
  async runFullMaintenance(
    options: {
      updatePopular?: boolean;
      refreshTrending?: boolean;
      cleanupOld?: boolean;
      popularLimit?: number;
      trendingLimit?: number;
      cleanupDays?: number;
      email?: string;
    } = {}
  ): Promise<{
    popularUpdate?: MaintenanceResult;
    trendingRefresh?: MaintenanceResult;
    cleanup?: MaintenanceResult;
  }> {
    const results: any = {};

    try {
      if (options.updatePopular !== false) {
        console.log('Running popular papers update...');
        results.popularUpdate = await this.updatePopularPapersList(
          options.popularLimit || 50000,
          options.email
        );
      }

      if (options.refreshTrending !== false) {
        console.log('Refreshing trending papers...');
        results.trendingRefresh = await this.refreshTrendingPapers(
          options.trendingLimit || 5000,
          5,
          options.email
        );
      }

      if (options.cleanupOld === true) {
        console.log('Cleaning up old embeddings...');
        results.cleanup = await this.cleanupOldEmbeddings(options.cleanupDays || 90);
      }

      return results;
    } catch (error: any) {
      console.error('Error in full maintenance:', error);
      throw error;
    }
  }
}

export const paperEmbeddingMaintenanceService = new PaperEmbeddingMaintenanceService();

