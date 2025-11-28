import { supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface BookRecommendation {
  recommendation_type: 'collection' | 'tag' | 'series' | 'similar';
  id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text';
  score: number;
  reason: string;
}

class LibraryRecommendationsService {
  private currentUserId: string | null = null;

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('LibraryRecommendationsService initialized', { userId });
  }

  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'LibraryRecommendationsService' }
      );
    }
  }

  // Get similar books based on embeddings
  async getSimilarBooks(bookId: string, limit: number = 10): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_similar_books', {
          book_id_param: bookId,
          similarity_threshold: 0.7,
          limit_count: limit
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get similar books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSimilarBooks', bookId, error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting similar books', { bookId }, error as Error);
      return [];
    }
  }

  // Get unified recommendations
  async getRecommendations(): Promise<BookRecommendation[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_unified_recommendations', {
          user_id_param: this.currentUserId!,
          limit_per_type: 5
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get recommendations: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getRecommendations', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting recommendations', { userId: this.currentUserId }, error as Error);
      return [];
    }
  }

  // Get collection-based recommendations
  async getCollectionRecommendations(limit: number = 10): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_collection_based_recommendations', {
          user_id_param: this.currentUserId!,
          limit_count: limit
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get collection recommendations: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getCollectionRecommendations', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting collection recommendations', { userId: this.currentUserId }, error as Error);
      return [];
    }
  }

  // Get tag-based recommendations
  async getTagRecommendations(limit: number = 10): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_tag_based_recommendations', {
          user_id_param: this.currentUserId!,
          limit_count: limit
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get tag recommendations: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getTagRecommendations', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting tag recommendations', { userId: this.currentUserId }, error as Error);
      return [];
    }
  }

  // Get series recommendations
  async getSeriesRecommendations(limit: number = 10): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_series_recommendations', {
          user_id_param: this.currentUserId!,
          limit_count: limit
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get series recommendations: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSeriesRecommendations', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting series recommendations', { userId: this.currentUserId }, error as Error);
      return [];
    }
  }
}

export const libraryRecommendationsService = new LibraryRecommendationsService();

