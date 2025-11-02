import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface CollectionTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description?: string;
  icon: string;
  color: string;
  structure: any[];
  is_public: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

class CollectionTemplatesService {
  private currentUserId: string | null = null;

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('CollectionTemplatesService initialized', { userId });
  }

  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'CollectionTemplatesService' }
      );
    }
  }

  // Get popular templates
  async getPopularTemplates(limit: number = 10): Promise<CollectionTemplate[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_popular_templates', { limit_count: limit });

      if (error) {
        throw errorHandler.createError(
          `Failed to get popular templates: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getPopularTemplates', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting popular templates', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Create collections from template
  async createFromTemplate(templateId: string): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('create_collections_from_template', {
          template_id_param: templateId,
          user_id_param: this.currentUserId!
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to create from template: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createFromTemplate', templateId, error: error.message }
        );
      }

      logger.info('Collections created from template', { templateId, userId: this.currentUserId });
      return data || [];
    } catch (error) {
      logger.error('Error creating from template', { templateId }, error as Error);
      throw error;
    }
  }

  // Get user's custom templates
  async getUserTemplates(): Promise<CollectionTemplate[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('collection_templates')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('created_at', { ascending: false });

      if (error) {
        throw errorHandler.createError(
          `Failed to get user templates: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getUserTemplates', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting user templates', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Create custom template
  async createTemplate(template: Omit<CollectionTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<CollectionTemplate> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('collection_templates')
        .insert({
          ...template,
          user_id: this.currentUserId
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create template: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createTemplate', error: error.message }
        );
      }

      logger.info('Template created', { templateId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating template', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Delete template
  async deleteTemplate(templateId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('collection_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete template: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteTemplate', templateId, error: error.message }
        );
      }

      logger.info('Template deleted', { templateId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting template', { templateId }, error as Error);
      throw error;
    }
  }
}

export const collectionTemplatesService = new CollectionTemplatesService();

