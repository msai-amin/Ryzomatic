import { supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface OpenAlexWork {
  id: string;
  title: string;
  authorships?: Array<{
    author: {
      display_name: string;
      id: string;
      orcid?: string;
    };
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  cited_by_count: number;
  open_access?: {
    is_oa: boolean;
    oa_url?: string;
  };
  doi?: string;
  primary_location?: {
    source?: {
      display_name: string;
    };
  };
  topics?: Array<{
    display_name: string;
    id: string;
    score: number;
  }>;
  related_works?: string[];
}

export interface PaperRecommendation {
  id: string;
  openalex_id: string;
  title: string;
  authors: Array<{ display_name: string; id?: string; orcid?: string }>;
  abstract?: string;
  publication_year?: number;
  cited_by_count: number;
  open_access_url?: string;
  doi?: string;
  venue?: string;
  topics?: Array<{ display_name: string; id: string; score: number }>;
  recommendation_type: 'related_works' | 'cited_by' | 'co_citation' | 'author' | 'venue' | 'semantic' | 'hybrid';
  recommendation_score: number;
  recommendation_reason?: string;
  user_feedback?: 'relevant' | 'not_relevant' | 'saved';
  saved_to_library?: boolean;
  cached_at?: string;
}

export interface RecommendationFilters {
  minYear?: number;
  maxYear?: number;
  minCitations?: number;
  openAccessOnly?: boolean;
  minScore?: number;
  excludeInLibrary?: boolean;
}

class OpenAlexRecommendationService {
  private currentUserId: string | null = null;
  private readonly OPENALEX_BASE_URL = 'https://api.openalex.org';
  private readonly CACHE_DURATION_DAYS = 7; // Cache recommendations for 7 days

  setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
      logger.info('OpenAlexRecommendationService initialized', { userId });
    }
  }

  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'OpenAlexRecommendationService' }
      );
    }
  }

  /**
   * Reconstruct abstract from inverted index
   */
  private reconstructAbstract(invertedIndex?: Record<string, number[]>): string | null {
    if (!invertedIndex) return null;
    
    const words: string[] = [];
    Object.keys(invertedIndex).forEach(word => {
      invertedIndex[word].forEach(position => {
        words[position] = word;
      });
    });
    
    return words.filter(w => w).join(' ');
  }

  /**
   * Format authors array
   */
  private formatAuthors(authorships?: Array<{ author: { display_name: string } }>): Array<{ display_name: string }> {
    if (!authorships || authorships.length === 0) return [];
    return authorships.map(a => ({ display_name: a.author.display_name }));
  }

  /**
   * Fetch works from OpenAlex API
   */
  private async fetchWorks(url: string, email?: string): Promise<{ results: OpenAlexWork[]; meta?: { count: number } }> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      // Add email for polite pool (10x faster requests)
      if (email) {
        url += (url.includes('?') ? '&' : '?') + `mailto=${encodeURIComponent(email)}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error fetching from OpenAlex', { url }, error as Error);
      throw error;
    }
  }

  /**
   * Search for papers by query
   */
  async searchPapers(query: string, limit: number = 20, email?: string): Promise<PaperRecommendation[]> {
    try {
      const url = `${this.OPENALEX_BASE_URL}/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
      const data = await this.fetchWorks(url, email);
      
      return this.transformWorksToRecommendations(data.results, 'semantic');
    } catch (error) {
      logger.error('Error searching papers', { query }, error as Error);
      return [];
    }
  }

  /**
   * Get recommendations based on related works (citation graph)
   */
  async getRelatedWorksRecommendations(
    seedWorkId: string,
    limit: number = 25,
    email?: string
  ): Promise<PaperRecommendation[]> {
    try {
      // First, get the seed work to access related_works
      const seedUrl = `${this.OPENALEX_BASE_URL}/works/${seedWorkId}`;
      const seedData = await this.fetchWorks(seedUrl, email);
      
      if (!seedData.results || seedData.results.length === 0) {
        logger.warn('Seed work not found', { seedWorkId });
        return [];
      }

      const seedWork = seedData.results[0];
      const relatedWorks = seedWork.related_works || [];

      if (relatedWorks.length === 0) {
        logger.info('No related works found for seed paper', { seedWorkId });
        return [];
      }

      // Extract IDs from related_works URLs
      const ids = relatedWorks
        .slice(0, Math.min(limit, 25)) // OpenAlex filter limit
        .map((url: string) => url.split('/').pop());

      if (ids.length === 0) return [];

      // Fetch full details for related works
      const filter = `ids.openalex:${ids.join('|')}`;
      const url = `${this.OPENALEX_BASE_URL}/works?filter=${filter}&per-page=${limit}`;
      const data = await this.fetchWorks(url, email);

      return this.transformWorksToRecommendations(data.results, 'related_works', seedWork);
    } catch (error) {
      logger.error('Error getting related works', { seedWorkId }, error as Error);
      return [];
    }
  }

  /**
   * Get recommendations based on papers that cite the seed paper
   */
  async getCitedByRecommendations(
    seedWorkId: string,
    limit: number = 20,
    email?: string
  ): Promise<PaperRecommendation[]> {
    try {
      const filter = `cites:${seedWorkId}`;
      const url = `${this.OPENALEX_BASE_URL}/works?filter=${filter}&per-page=${limit}&sort=cited_by_count:desc`;
      const data = await this.fetchWorks(url, email);

      return this.transformWorksToRecommendations(data.results, 'cited_by');
    } catch (error) {
      logger.error('Error getting cited by recommendations', { seedWorkId }, error as Error);
      return [];
    }
  }

  /**
   * Transform OpenAlex works to PaperRecommendation format
   * Uses hybrid ranking algorithm combining multiple signals
   */
  private transformWorksToRecommendations(
    works: OpenAlexWork[],
    recommendationType: PaperRecommendation['recommendation_type'],
    seedWork?: OpenAlexWork
  ): PaperRecommendation[] {
    return works.map(work => {
      const abstract = this.reconstructAbstract(work.abstract_inverted_index);
      const authors = this.formatAuthors(work.authorships);
      
      // Hybrid ranking algorithm
      const scores = {
        citationSimilarity: this.calculateCitationScore(work, seedWork),
        citationCount: this.calculateCitationCountScore(work),
        recency: this.calculateRecencyScore(work),
        openAccess: this.calculateOpenAccessScore(work),
        topicOverlap: this.calculateTopicOverlapScore(work, seedWork),
        venueQuality: this.calculateVenueScore(work),
      };

      // Weighted combination (can be tuned)
      const weights = {
        citationSimilarity: 0.3,  // High weight for citation graph relevance
        citationCount: 0.25,       // Important for paper quality signal
        recency: 0.15,             // Recent papers are often more relevant
        openAccess: 0.1,           // Accessibility bonus
        topicOverlap: 0.15,        // Topic matching
        venueQuality: 0.05,        // Venue reputation
      };

      let score = 0;
      Object.keys(weights).forEach(key => {
        score += scores[key as keyof typeof scores] * weights[key as keyof typeof weights];
      });

      // Cap at 100
      score = Math.min(100, Math.max(0, score));

      return {
        id: work.id.split('/').pop() || work.id,
        openalex_id: work.id,
        title: work.title || 'Untitled',
        authors,
        abstract,
        publication_year: work.publication_year,
        cited_by_count: work.cited_by_count || 0,
        open_access_url: work.open_access?.oa_url,
        doi: work.doi,
        venue: work.primary_location?.source?.display_name,
        topics: work.topics,
        recommendation_type: recommendationType,
        recommendation_score: score,
        recommendation_reason: this.getRecommendationReason(recommendationType, seedWork),
      };
    });
  }

  /**
   * Calculate citation graph similarity score (0-100)
   * Higher if paper is directly related in citation graph
   */
  private calculateCitationScore(work: OpenAlexWork, seedWork?: OpenAlexWork): number {
    if (!seedWork) return 50; // Base score if no seed
    
    // If this is a related work, it's highly relevant
    const seedRelatedWorks = seedWork.related_works || [];
    const isRelated = seedRelatedWorks.some((url: string) => 
      url.includes(work.id.split('/').pop() || '')
    );
    
    return isRelated ? 90 : 50;
  }

  /**
   * Calculate citation count score (0-100)
   * Normalized logarithmic scale
   */
  private calculateCitationCountScore(work: OpenAlexWork): number {
    if (!work.cited_by_count || work.cited_by_count === 0) return 20;
    
    // Logarithmic scale: 0 citations = 20, 10 = 50, 100 = 80, 1000+ = 100
    const logScore = Math.log10(work.cited_by_count + 1) * 20;
    return Math.min(100, 20 + logScore);
  }

  /**
   * Calculate recency score (0-100)
   * Recent papers get higher scores
   */
  private calculateRecencyScore(work: OpenAlexWork): number {
    if (!work.publication_year) return 50;
    
    const currentYear = new Date().getFullYear();
    const yearsAgo = currentYear - work.publication_year;
    
    if (yearsAgo <= 1) return 100;      // Very recent
    if (yearsAgo <= 2) return 90;       // Recent
    if (yearsAgo <= 5) return 70;       // Moderately recent
    if (yearsAgo <= 10) return 50;      // Somewhat old
    if (yearsAgo <= 20) return 30;      // Old
    return 20;                           // Very old (but still relevant)
  }

  /**
   * Calculate open access score (0-100)
   */
  private calculateOpenAccessScore(work: OpenAlexWork): number {
    return work.open_access?.is_oa ? 100 : 50;
  }

  /**
   * Calculate topic overlap score (0-100)
   * Based on shared topics with seed work
   */
  private calculateTopicOverlapScore(work: OpenAlexWork, seedWork?: OpenAlexWork): number {
    if (!seedWork?.topics || !work.topics || work.topics.length === 0) return 50;
    
    const seedTopicIds = new Set(seedWork.topics.map(t => t.id));
    const workTopicIds = new Set(work.topics.map(t => t.id));
    
    // Count overlapping topics
    let overlap = 0;
    workTopicIds.forEach(id => {
      if (seedTopicIds.has(id)) overlap++;
    });
    
    // Score based on overlap ratio
    const overlapRatio = overlap / Math.max(seedTopicIds.size, workTopicIds.size);
    return Math.min(100, 50 + overlapRatio * 50);
  }

  /**
   * Calculate venue quality score (0-100)
   * Simple heuristic - can be enhanced with venue rankings
   */
  private calculateVenueScore(work: OpenAlexWork): number {
    // For now, just check if venue exists (indicates published work)
    // Can be enhanced with venue impact factors, rankings, etc.
    return work.primary_location?.source?.display_name ? 70 : 50;
  }

  /**
   * Generate recommendation reason text
   */
  private getRecommendationReason(
    type: PaperRecommendation['recommendation_type'],
    seedWork?: OpenAlexWork
  ): string {
    switch (type) {
      case 'related_works':
        return 'Related to this paper in the citation graph';
      case 'cited_by':
        return 'Cites this paper';
      case 'co_citation':
        return 'Frequently cited together';
      case 'author':
        return 'By the same authors';
      case 'venue':
        return 'Published in the same venue';
      case 'semantic':
        return 'Semantically similar';
      case 'hybrid':
        return 'Multiple relevance signals';
      default:
        return 'Recommended for you';
    }
  }

  /**
   * Cache recommendations in database
   */
  async cacheRecommendations(
    sourceDocumentId: string,
    recommendations: PaperRecommendation[]
  ): Promise<void> {
    this.ensureAuthenticated();

    try {
      // Check if paper is already in user's library
      const userLibraryCheck = recommendations.map(async (rec) => {
        if (rec.doi || rec.title) {
          const { data: inLibrary } = await supabase.rpc('is_paper_in_library', {
            user_id_param: this.currentUserId!,
            paper_doi: rec.doi || null,
            paper_title: rec.title,
          });
          return { rec, inLibrary: inLibrary || false };
        }
        return { rec, inLibrary: false };
      });

      const checkedRecs = await Promise.all(userLibraryCheck);

      // Insert/update recommendations
      const inserts = checkedRecs
        .filter(({ inLibrary }) => !inLibrary) // Exclude if already in library
        .map(({ rec }) => ({
          user_id: this.currentUserId!,
          source_document_id: sourceDocumentId,
          openalex_id: rec.openalex_id,
          title: rec.title,
          authors: rec.authors,
          abstract_inverted_index: rec.abstract ? this.createInvertedIndex(rec.abstract) : null,
          publication_year: rec.publication_year,
          cited_by_count: rec.cited_by_count,
          open_access_url: rec.open_access_url,
          doi: rec.doi,
          venue: rec.venue,
          topics: rec.topics,
          recommendation_type: rec.recommendation_type,
          recommendation_score: rec.recommendation_score,
          recommendation_reason: rec.recommendation_reason,
        }));

      if (inserts.length > 0) {
        const { error } = await supabase
          .from('paper_recommendations')
          .upsert(inserts, {
            onConflict: 'user_id,openalex_id,source_document_id',
            ignoreDuplicates: false,
          });

        if (error) {
          throw error;
        }
      }

      logger.info('Cached paper recommendations', {
        userId: this.currentUserId,
        sourceDocumentId,
        count: inserts.length,
      });
    } catch (error) {
      logger.error('Error caching recommendations', { sourceDocumentId }, error as Error);
      throw error;
    }
  }

  /**
   * Simple inverted index creation (for caching)
   */
  private createInvertedIndex(text: string): Record<string, number[]> {
    const words = text.toLowerCase().split(/\s+/);
    const index: Record<string, number[]> = {};
    words.forEach((word, position) => {
      if (!index[word]) {
        index[word] = [];
      }
      index[word].push(position);
    });
    return index;
  }

  /**
   * Get cached recommendations for a document
   */
  async getCachedRecommendations(
    sourceDocumentId: string,
    filters?: RecommendationFilters
  ): Promise<PaperRecommendation[]> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabase.rpc('get_paper_recommendations', {
        source_doc_id: sourceDocumentId,
        user_id_param: this.currentUserId!,
        limit_count: 50,
        min_score: filters?.minScore || 0,
        recommendation_type_filter: null,
      });

      if (error) {
        throw error;
      }

      let recommendations = (data || []) as PaperRecommendation[];

      // Apply additional filters
      if (filters) {
        if (filters.minYear) {
          recommendations = recommendations.filter(r => (r.publication_year || 0) >= filters.minYear!);
        }
        if (filters.maxYear) {
          recommendations = recommendations.filter(r => (r.publication_year || 9999) <= filters.maxYear!);
        }
        if (filters.minCitations) {
          recommendations = recommendations.filter(r => r.cited_by_count >= filters.minCitations!);
        }
        if (filters.openAccessOnly) {
          recommendations = recommendations.filter(r => !!r.open_access_url);
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error getting cached recommendations', { sourceDocumentId }, error as Error);
      return [];
    }
  }

  /**
   * Update user feedback on a recommendation
   */
  async updateFeedback(
    recommendationId: string,
    feedback: 'relevant' | 'not_relevant' | 'saved',
    savedToLibrary: boolean = false
  ): Promise<boolean> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabase.rpc('update_paper_recommendation_feedback', {
        recommendation_id: recommendationId,
        user_id_param: this.currentUserId!,
        feedback,
        saved_to_library: savedToLibrary,
      });

      if (error) {
        throw error;
      }

      return data || false;
    } catch (error) {
      logger.error('Error updating feedback', { recommendationId }, error as Error);
      return false;
    }
  }

  /**
   * Extract OpenAlex ID from DOI or title
   */
  async findPaperByDOI(doi: string, email?: string): Promise<OpenAlexWork | null> {
    try {
      const url = `${this.OPENALEX_BASE_URL}/works/${doi}`;
      const data = await this.fetchWorks(url, email);
      return data.results?.[0] || null;
    } catch (error) {
      logger.error('Error finding paper by DOI', { doi }, error as Error);
      return null;
    }
  }
}

export const openAlexRecommendationService = new OpenAlexRecommendationService();
