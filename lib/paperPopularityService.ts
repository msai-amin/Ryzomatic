import { createClient } from '@supabase/supabase-js';
import { openAlexPopularPaperService, OpenAlexPaper } from './openAlexPopularPaperService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PaperPopularity {
  openalex_id: string;
  title: string;
  popularity_score: number;
  signals: {
    global_citations: number;
    recent_citations: number;
    user_interactions: number;
    recommendation_frequency: number;
    user_feedback_score: number;
  };
  discovery_method: 'most_cited' | 'trending' | 'user_interacted' | 'frequently_recommended' | 'topic_based' | 'hybrid';
}

export interface UserPaperStats {
  view_count: number;
  click_count: number;
  save_count: number;
  recommendation_count: number;
  positive_feedback_ratio: number;
}

export class PaperPopularityService {
  /**
   * Calculate popularity score combining multiple signals
   */
  calculatePopularityScore(
    paper: OpenAlexPaper,
    userStats?: UserPaperStats | null
  ): PaperPopularity {
    const signals = {
      global_citations: paper.cited_by_count || 0,
      recent_citations: paper.recent_cited_by_count || 0,
      user_interactions: (userStats?.view_count || 0) + 
                        (userStats?.click_count || 0) * 2 + 
                        (userStats?.save_count || 0) * 5,
      recommendation_frequency: userStats?.recommendation_count || 0,
      user_feedback_score: userStats?.positive_feedback_ratio || 0,
    };

    // Weighted scoring
    const weights = {
      global_citations: 0.3,      // 30% - Global importance
      recent_citations: 0.25,      // 25% - Current relevance
      user_interactions: 0.25,    // 25% - User engagement
      recommendation_frequency: 0.15, // 15% - System usage
      user_feedback_score: 0.05,  // 5% - Quality signal
    };

    // Normalize each signal to 0-100 scale
    const normalized = {
      global_citations: Math.min(100, Math.log10(signals.global_citations + 1) * 20),
      recent_citations: Math.min(100, Math.log10(signals.recent_citations + 1) * 25),
      user_interactions: Math.min(100, signals.user_interactions * 2),
      recommendation_frequency: Math.min(100, signals.recommendation_frequency * 5),
      user_feedback_score: signals.user_feedback_score * 100,
    };

    // Calculate weighted average
    let popularity_score = 0;
    Object.keys(weights).forEach(key => {
      popularity_score += normalized[key as keyof typeof normalized] * 
                         weights[key as keyof typeof weights];
    });

    return {
      openalex_id: paper.id,
      title: paper.title,
      popularity_score,
      signals,
      discovery_method: 'hybrid',
    };
  }

  /**
   * Get user statistics for a paper from database
   */
  async getUserPaperStats(openalexId: string): Promise<UserPaperStats | null> {
    try {
      const { data, error } = await supabase
        .from('paper_recommendations')
        .select('view_count, click_count, save_count, user_feedback')
        .eq('openalex_id', openalexId);

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          view_count: 0,
          click_count: 0,
          save_count: 0,
          recommendation_count: 0,
          positive_feedback_ratio: 0,
        };
      }

      const stats = {
        view_count: data.reduce((sum, r) => sum + (r.view_count || 0), 0),
        click_count: data.reduce((sum, r) => sum + (r.click_count || 0), 0),
        save_count: data.reduce((sum, r) => sum + (r.save_count || 0), 0),
        recommendation_count: data.length,
        positive_feedback_ratio: this.calculateFeedbackRatio(data),
      };

      return stats;
    } catch (error) {
      console.error(`Error getting user stats for paper ${openalexId}:`, error);
      return null;
    }
  }

  /**
   * Calculate positive feedback ratio from user feedback
   */
  private calculateFeedbackRatio(recommendations: Array<{ user_feedback?: string | null }>): number {
    if (recommendations.length === 0) return 0;

    const feedbackCounts = {
      relevant: 0,
      not_relevant: 0,
      saved: 0,
      total: 0,
    };

    recommendations.forEach(rec => {
      if (rec.user_feedback) {
        feedbackCounts.total++;
        if (rec.user_feedback === 'relevant' || rec.user_feedback === 'saved') {
          feedbackCounts.relevant++;
        } else if (rec.user_feedback === 'not_relevant') {
          feedbackCounts.not_relevant++;
        }
      }
    });

    if (feedbackCounts.total === 0) return 0;
    return feedbackCounts.relevant / feedbackCounts.total;
  }

  /**
   * Identify popular papers for pre-computation
   * Combines multiple sources: globally cited, trending, user-interacted, frequently recommended
   */
  async identifyPopularPapers(
    totalLimit: number = 50000,
    email?: string
  ): Promise<PaperPopularity[]> {
    console.log(`Identifying ${totalLimit} popular papers for pre-computation...`);

    const candidates = new Map<string, PaperPopularity>();

    // 1. Get globally most cited papers (40% of candidates = 20K)
    console.log('Fetching globally most cited papers (40%)...');
    const globalPapers = await openAlexPopularPaperService.fetchMostCitedPapers(
      Math.floor(totalLimit * 0.4),
      100, // Min 100 citations
      email
    );
    
    for (const paper of globalPapers) {
      const userStats = await this.getUserPaperStats(paper.id);
      const popularity = this.calculatePopularityScore(paper, userStats);
      popularity.discovery_method = 'most_cited';
      candidates.set(paper.id, popularity);
    }
    console.log(`Added ${globalPapers.length} globally cited papers`);

    // 2. Get trending recent papers (30% of candidates = 15K)
    console.log('Fetching trending papers (30%)...');
    const trendingPapers = await openAlexPopularPaperService.fetchTrendingPapers(
      Math.floor(totalLimit * 0.3),
      5, // Last 5 years
      50, // Min 50 citations
      email
    );
    
    for (const paper of trendingPapers) {
      const existing = candidates.get(paper.id);
      if (existing) {
        // Boost score if already in candidates
        existing.popularity_score *= 1.2;
        if (existing.discovery_method === 'most_cited') {
          existing.discovery_method = 'hybrid';
        }
      } else {
        const userStats = await this.getUserPaperStats(paper.id);
        const popularity = this.calculatePopularityScore(paper, userStats);
        popularity.discovery_method = 'trending';
        candidates.set(paper.id, popularity);
      }
    }
    console.log(`Added ${trendingPapers.length} trending papers`);

    // 3. Get papers from user interactions (20% of candidates = 10K)
    console.log('Fetching user-interacted papers (20%)...');
    const userInteractedPapers = await this.getUserInteractedPapers(
      Math.floor(totalLimit * 0.2)
    );
    
    for (const paperData of userInteractedPapers) {
      const paper = await openAlexPopularPaperService.fetchPaperById(paperData.openalex_id, email);
      if (paper) {
        const existing = candidates.get(paper.id);
        if (existing) {
          existing.popularity_score *= 1.3; // Higher boost for user interaction
          if (existing.discovery_method !== 'hybrid') {
            existing.discovery_method = 'user_interacted';
          }
        } else {
          const userStats = {
            view_count: paperData.view_count,
            click_count: paperData.click_count,
            save_count: paperData.save_count,
            recommendation_count: paperData.recommendation_count,
            positive_feedback_ratio: paperData.positive_feedback_ratio,
          };
          const popularity = this.calculatePopularityScore(paper, userStats);
          popularity.discovery_method = 'user_interacted';
          candidates.set(paper.id, popularity);
        }
      }
    }
    console.log(`Added ${userInteractedPapers.length} user-interacted papers`);

    // 4. Get frequently recommended papers (10% of candidates = 5K)
    console.log('Fetching frequently recommended papers (10%)...');
    const frequentlyRecommended = await this.getFrequentlyRecommendedPapers(
      Math.floor(totalLimit * 0.1)
    );
    
    for (const paperData of frequentlyRecommended) {
      const paper = await openAlexPopularPaperService.fetchPaperById(paperData.openalex_id, email);
      if (paper) {
        const existing = candidates.get(paper.id);
        if (existing) {
          existing.popularity_score *= 1.1;
          if (existing.discovery_method === 'most_cited' || existing.discovery_method === 'trending') {
            existing.discovery_method = 'frequently_recommended';
          }
        } else {
          const userStats = {
            view_count: 0,
            click_count: 0,
            save_count: 0,
            recommendation_count: paperData.count,
            positive_feedback_ratio: 0,
          };
          const popularity = this.calculatePopularityScore(paper, userStats);
          popularity.discovery_method = 'frequently_recommended';
          candidates.set(paper.id, popularity);
        }
      }
    }
    console.log(`Added ${frequentlyRecommended.length} frequently recommended papers`);

    // Sort by popularity score and return top N
    const sorted = Array.from(candidates.values())
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, totalLimit);

    console.log(`Identified ${sorted.length} popular papers (target: ${totalLimit})`);
    return sorted;
  }

  /**
   * Get papers with user interactions from database
   */
  private async getUserInteractedPapers(limit: number): Promise<Array<{
    openalex_id: string;
    view_count: number;
    click_count: number;
    save_count: number;
    recommendation_count: number;
    positive_feedback_ratio: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('paper_recommendations')
        .select('openalex_id, view_count, click_count, save_count, user_feedback')
        .or('view_count.gt.0,click_count.gt.0,save_count.gt.0')
        .limit(limit * 2); // Get more to aggregate

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by openalex_id
      const aggregated = new Map<string, {
        openalex_id: string;
        view_count: number;
        click_count: number;
        save_count: number;
        recommendation_count: number;
        feedbacks: string[];
      }>();

      data.forEach(rec => {
        const existing = aggregated.get(rec.openalex_id);
        if (existing) {
          existing.view_count += rec.view_count || 0;
          existing.click_count += rec.click_count || 0;
          existing.save_count += rec.save_count || 0;
          existing.recommendation_count++;
          if (rec.user_feedback) {
            existing.feedbacks.push(rec.user_feedback);
          }
        } else {
          aggregated.set(rec.openalex_id, {
            openalex_id: rec.openalex_id,
            view_count: rec.view_count || 0,
            click_count: rec.click_count || 0,
            save_count: rec.save_count || 0,
            recommendation_count: 1,
            feedbacks: rec.user_feedback ? [rec.user_feedback] : [],
          });
        }
      });

      // Calculate feedback ratio and sort by total interactions
      const result = Array.from(aggregated.values())
        .map(item => {
          const positive = item.feedbacks.filter(f => f === 'relevant' || f === 'saved').length;
          const total = item.feedbacks.length;
          return {
            openalex_id: item.openalex_id,
            view_count: item.view_count,
            click_count: item.click_count,
            save_count: item.save_count,
            recommendation_count: item.recommendation_count,
            positive_feedback_ratio: total > 0 ? positive / total : 0,
            total_interactions: item.view_count + item.click_count + item.save_count,
          };
        })
        .sort((a, b) => b.total_interactions - a.total_interactions)
        .slice(0, limit)
        .map(({ total_interactions, ...rest }) => rest);

      return result;
    } catch (error) {
      console.error('Error getting user-interacted papers:', error);
      return [];
    }
  }

  /**
   * Get frequently recommended papers from database
   */
  private async getFrequentlyRecommendedPapers(limit: number): Promise<Array<{
    openalex_id: string;
    count: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('paper_recommendations')
        .select('openalex_id')
        .limit(limit * 10); // Get more to count

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Count by openalex_id
      const counts = new Map<string, number>();
      data.forEach(rec => {
        counts.set(rec.openalex_id, (counts.get(rec.openalex_id) || 0) + 1);
      });

      // Sort by count and return top N
      return Array.from(counts.entries())
        .map(([openalex_id, count]) => ({ openalex_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting frequently recommended papers:', error);
      return [];
    }
  }

  /**
   * Store popular papers in database
   */
  async storePopularPapers(popularPapers: PaperPopularity[]): Promise<void> {
    try {
      const inserts = popularPapers.map(pp => ({
        openalex_id: pp.openalex_id,
        title: pp.title,
        popularity_score: pp.popularity_score,
        global_citations: pp.signals.global_citations,
        recent_citations: pp.signals.recent_citations,
        user_interactions: pp.signals.user_interactions,
        recommendation_frequency: pp.signals.recommendation_frequency,
        user_feedback_score: pp.signals.user_feedback_score,
        discovery_method: pp.discovery_method,
        precomputed: false,
        last_updated: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('popular_papers')
        .upsert(inserts, {
          onConflict: 'openalex_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;
      console.log(`Stored ${inserts.length} popular papers in database`);
    } catch (error) {
      console.error('Error storing popular papers:', error);
      throw error;
    }
  }
}

export const paperPopularityService = new PaperPopularityService();

