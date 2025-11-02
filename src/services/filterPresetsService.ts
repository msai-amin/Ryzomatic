import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { LibraryFilters } from '../store/appStore';

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  filter_config: LibraryFilters;
  icon: string;
  color: string;
  is_favorite: boolean;
  display_order: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

class FilterPresetsService {
  private currentUserId: string | null = null;

  // Initialize with current user
  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('FilterPresetsService initialized', { userId });
  }

  // Check if user is authenticated
  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'FilterPresetsService' }
      );
    }
  }

  // Get all filter presets
  async getPresets(): Promise<FilterPreset[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('filter_presets')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('display_order', { ascending: true });

      if (error) {
        throw errorHandler.createError(
          `Failed to get filter presets: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getPresets', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting filter presets', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Create a new filter preset
  async createPreset(preset: Omit<FilterPreset, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'usage_count' | 'last_used_at'>): Promise<FilterPreset> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('filter_presets')
        .insert({
          user_id: this.currentUserId!,
          ...preset
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create filter preset: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createPreset', error: error.message }
        );
      }

      logger.info('Filter preset created', { presetId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating filter preset', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Update a filter preset
  async updatePreset(id: string, updates: Partial<FilterPreset>): Promise<FilterPreset> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('filter_presets')
        .update(updates)
        .eq('id', id)
        .eq('user_id', this.currentUserId!)
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to update filter preset: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updatePreset', presetId: id, error: error.message }
        );
      }

      logger.info('Filter preset updated', { presetId: id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error updating filter preset', { presetId: id }, error as Error);
      throw error;
    }
  }

  // Delete a filter preset
  async deletePreset(id: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('filter_presets')
        .delete()
        .eq('id', id)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete filter preset: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deletePreset', presetId: id, error: error.message }
        );
      }

      logger.info('Filter preset deleted', { presetId: id, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting filter preset', { presetId: id }, error as Error);
      throw error;
    }
  }

  // Increment usage counter
  async recordUsage(id: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('increment_preset_usage', { preset_id_param: id });

      if (error) {
        // Non-critical, just log it
        logger.warn('Failed to increment preset usage', { presetId: id, error: error.message });
      }
    } catch (error) {
      logger.error('Error recording preset usage', { presetId: id }, error as Error);
    }
  }

  // Get popular presets
  async getPopularPresets(limit: number = 5): Promise<FilterPreset[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_popular_presets', { 
          user_id_param: this.currentUserId!,
          limit_count: limit 
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get popular presets: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getPopularPresets', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting popular presets', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }
}

export const filterPresetsService = new FilterPresetsService();

