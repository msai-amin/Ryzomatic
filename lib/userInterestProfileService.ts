import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService.js';

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

export interface InterestConcept {
  concept: string;
  frequency: number;
  importance: number;
  firstSeen?: string;
  lastSeen?: string;
}

export interface InterestTrends {
  emerging: string[];
  declining: string[];
  stable: string[];
}

export interface InterestProfile {
  userId: string;
  interestVector?: number[];
  topConcepts: InterestConcept[];
  interestTrends: InterestTrends;
  totalNotesAnalyzed: number;
  totalHighlightsAnalyzed: number;
  analysisPeriodDays: number;
  lastAnalyzedAt?: string;
}

export class UserInterestProfileService {
  /**
   * Build or update interest profile for a user
   */
  async buildInterestProfile(userId: string, days: number = 30): Promise<InterestProfile | null> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return null;
    }
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Fetch notes and highlights from the specified period
      const [notesResult, highlightsResult] = await Promise.all([
        supabase
          .from('user_notes')
          .select('id, content, created_at, embedding')
          .eq('user_id', userId)
          .gte('created_at', cutoffDate.toISOString())
          .not('embedding', 'is', null),
        supabase
          .from('user_highlights')
          .select('id, highlighted_text, created_at, embedding')
          .eq('user_id', userId)
          .eq('is_orphaned', false)
          .gte('created_at', cutoffDate.toISOString())
          .not('embedding', 'is', null),
      ]);

      const notes = notesResult.data || [];
      const highlights = highlightsResult.data || [];

      if (notes.length === 0 && highlights.length === 0) {
        // Return empty profile
        return {
          userId,
          topConcepts: [],
          interestTrends: { emerging: [], declining: [], stable: [] },
          totalNotesAnalyzed: 0,
          totalHighlightsAnalyzed: 0,
          analysisPeriodDays: days,
        };
      }

      // Calculate average interest vector from all embeddings
      const allEmbeddings: number[][] = [];
      
      notes.forEach(note => {
        if (note.embedding) {
          try {
            const embeddingArray = JSON.parse(note.embedding);
            if (Array.isArray(embeddingArray) && embeddingArray.length > 0) {
              allEmbeddings.push(embeddingArray);
            }
          } catch (e) {
            // Skip invalid embeddings
          }
        }
      });

      highlights.forEach(highlight => {
        if (highlight.embedding) {
          try {
            const embeddingArray = JSON.parse(highlight.embedding);
            if (Array.isArray(embeddingArray) && embeddingArray.length > 0) {
              allEmbeddings.push(embeddingArray);
            }
          } catch (e) {
            // Skip invalid embeddings
          }
        }
      });

      // Calculate average vector
      let interestVector: number[] | undefined;
      if (allEmbeddings.length > 0) {
        interestVector = new Array(allEmbeddings[0].length).fill(0);
        allEmbeddings.forEach(emb => {
          emb.forEach((val, idx) => {
            interestVector![idx] += val;
          });
        });
        interestVector = interestVector.map(val => val / allEmbeddings.length);
      }

      // Extract top concepts from notes and highlights
      const topConcepts = await this.extractTopConcepts(notes, highlights, days);

      // Calculate trends
      const interestTrends = await this.calculateTrends(userId, topConcepts, days);

      // Update or create profile in database
      const profile: InterestProfile = {
        userId,
        interestVector,
        topConcepts,
        interestTrends,
        totalNotesAnalyzed: notes.length,
        totalHighlightsAnalyzed: highlights.length,
        analysisPeriodDays: days,
        lastAnalyzedAt: new Date().toISOString(),
      };

      // Store in database
      const interestVectorString = interestVector 
        ? embeddingService.formatForPgVector(interestVector)
        : null;

      await supabase.rpc('update_interest_profile', {
        p_user_id: userId,
        p_interest_vector: interestVectorString,
        p_top_concepts: JSON.stringify(topConcepts),
        p_interest_trends: JSON.stringify(interestTrends),
        p_total_notes: notes.length,
        p_total_highlights: highlights.length,
        p_analysis_period_days: days,
      });

      return profile;
    } catch (error) {
      console.error('Error building interest profile:', error);
      return null;
    }
  }

  /**
   * Extract top concepts from notes and highlights
   */
  private async extractTopConcepts(
    notes: Array<{ content: string; created_at: string }>,
    highlights: Array<{ highlighted_text: string; created_at: string }>,
    days: number
  ): Promise<InterestConcept[]> {
    // Simple frequency-based extraction
    // In a production system, you'd use more sophisticated NLP
    const conceptMap = new Map<string, { count: number; firstSeen: string; lastSeen: string }>();

    // Extract from notes
    notes.forEach(note => {
      const words = note.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4); // Filter short words

      words.forEach(word => {
        const existing = conceptMap.get(word);
        if (existing) {
          existing.count++;
          if (note.created_at < existing.firstSeen) existing.firstSeen = note.created_at;
          if (note.created_at > existing.lastSeen) existing.lastSeen = note.created_at;
        } else {
          conceptMap.set(word, {
            count: 1,
            firstSeen: note.created_at,
            lastSeen: note.created_at,
          });
        }
      });
    });

    // Extract from highlights
    highlights.forEach(highlight => {
      const words = highlight.highlighted_text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4);

      words.forEach(word => {
        const existing = conceptMap.get(word);
        if (existing) {
          existing.count++;
          if (highlight.created_at < existing.firstSeen) existing.firstSeen = highlight.created_at;
          if (highlight.created_at > existing.lastSeen) existing.lastSeen = highlight.created_at;
        } else {
          conceptMap.set(word, {
            count: 1,
            firstSeen: highlight.created_at,
            lastSeen: highlight.created_at,
          });
        }
      });
    });

    // Convert to InterestConcept array and calculate importance
    const concepts: InterestConcept[] = Array.from(conceptMap.entries())
      .map(([concept, data]) => {
        const daysSinceFirst = (Date.now() - new Date(data.firstSeen).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - daysSinceFirst / days);
        const frequencyScore = Math.min(1, data.count / 10); // Normalize to 0-1
        const importance = (frequencyScore * 0.6 + recencyScore * 0.4);

        return {
          concept,
          frequency: data.count,
          importance,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
        };
      })
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20); // Top 20 concepts

    return concepts;
  }

  /**
   * Calculate interest trends (emerging, declining, stable)
   */
  private async calculateTrends(
    userId: string,
    currentConcepts: InterestConcept[],
    days: number
  ): Promise<InterestTrends> {
    // Compare with previous period to identify trends
    const previousCutoff = new Date();
    previousCutoff.setDate(previousCutoff.getDate() - days * 2);

    const currentCutoff = new Date();
    currentCutoff.setDate(currentCutoff.getDate() - days);

    // Get concepts from previous period
    const [previousNotes, previousHighlights] = await Promise.all([
      supabase
        .from('user_notes')
        .select('content, created_at')
        .eq('user_id', userId)
        .gte('created_at', previousCutoff.toISOString())
        .lt('created_at', currentCutoff.toISOString()),
      supabase
        .from('user_highlights')
        .select('highlighted_text, created_at')
        .eq('user_id', userId)
        .eq('is_orphaned', false)
        .gte('created_at', previousCutoff.toISOString())
        .lt('created_at', currentCutoff.toISOString()),
    ]);

    const previousConcepts = await this.extractTopConcepts(
      previousNotes.data || [],
      previousHighlights.data || [],
      days
    );

    const previousConceptMap = new Map(previousConcepts.map(c => [c.concept, c]));
    const currentConceptMap = new Map(currentConcepts.map(c => [c.concept, c]));

    const emerging: string[] = [];
    const declining: string[] = [];
    const stable: string[] = [];

    currentConcepts.forEach(concept => {
      const previous = previousConceptMap.get(concept.concept);
      if (!previous) {
        // New concept - emerging
        emerging.push(concept.concept);
      } else if (concept.frequency < previous.frequency * 0.5) {
        // Significantly decreased - declining
        declining.push(concept.concept);
      } else {
        // Stable
        stable.push(concept.concept);
      }
    });

    // Check for concepts that disappeared
    previousConcepts.forEach(concept => {
      if (!currentConceptMap.has(concept.concept)) {
        declining.push(concept.concept);
      }
    });

    return { emerging, declining, stable };
  }

  /**
   * Get interest trends for a user
   */
  async getInterestTrends(userId: string): Promise<InterestTrends | null> {
    try {
      const { data: profile } = await supabase
        .from('user_interest_profiles')
        .select('interest_trends')
        .eq('user_id', userId)
        .single();

      if (!profile || !profile.interest_trends) {
        // Build profile if it doesn't exist
        const newProfile = await this.buildInterestProfile(userId);
        return newProfile?.interestTrends || null;
      }

      return profile.interest_trends as InterestTrends;
    } catch (error) {
      console.error('Error getting interest trends:', error);
      return null;
    }
  }

  /**
   * Get recommended documents based on interest profile
   */
  async getRecommendedDocuments(userId: string, limit: number = 10): Promise<string[]> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return [];
    }
    
    try {
      // Get user's interest profile
      const profile = await this.buildInterestProfile(userId);
      if (!profile || !profile.interestVector) {
        return [];
      }

      // Find similar documents using interest vector
      const queryEmbedding = embeddingService.formatForPgVector(profile.interestVector);

      const { data: similarDocs } = await supabase.rpc('find_similar_documents', {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        similarity_threshold: 0.7,
        result_limit: limit,
      });

      return similarDocs?.map((doc: any) => doc.book_id) || [];
    } catch (error) {
      console.error('Error getting recommended documents:', error);
      return [];
    }
  }

  /**
   * Get cached interest profile
   */
  async getCachedProfile(userId: string): Promise<InterestProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_interest_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        userId: data.user_id,
        interestVector: data.interest_vector ? JSON.parse(data.interest_vector) : undefined,
        topConcepts: data.top_concepts as InterestConcept[],
        interestTrends: data.interest_trends as InterestTrends,
        totalNotesAnalyzed: data.total_notes_analyzed,
        totalHighlightsAnalyzed: data.total_highlights_analyzed,
        analysisPeriodDays: data.analysis_period_days,
        lastAnalyzedAt: data.last_analyzed_at,
      };
    } catch (error) {
      console.error('Error getting cached profile:', error);
      return null;
    }
  }
}

export const userInterestProfileService = new UserInterestProfileService();

