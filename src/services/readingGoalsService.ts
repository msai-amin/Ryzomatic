import { supabase } from '../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface ReadingGoal {
  id: string;
  user_id: string;
  goal_type: 'books_read' | 'pages_read' | 'minutes_studied' | 'notes_created' | 'sessions_completed';
  target_value: number;
  current_value: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  streak_days: number;
  last_activity_date: string | null;
  start_date: string;
  end_date: string | null;
  completed: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  goal_type: ReadingGoal['goal_type'];
  target_value: number;
  period: ReadingGoal['period'];
  metadata?: any;
}

class ReadingGoalsService {
  private currentUserId: string | null = null;

  // Initialize with current user
  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('ReadingGoalsService initialized', { userId });
  }

  // Check if user is authenticated
  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'ReadingGoalsService' }
      );
    }
  }

  // Get all active goals for the user
  async getActiveGoals(): Promise<ReadingGoal[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('reading_goals')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw errorHandler.createError(
          `Failed to get active goals: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getActiveGoals', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting active goals', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Create a new reading goal
  async createGoal(goalInput: CreateGoalInput): Promise<ReadingGoal> {
    this.ensureAuthenticated();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('reading_goals')
        .insert({
          user_id: this.currentUserId!,
          ...goalInput,
          current_value: 0,
          streak_days: 0,
          last_activity_date: null,
          start_date: today,
          end_date: null,
          completed: false,
          metadata: goalInput.metadata || {}
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create goal: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createGoal', error: error.message }
        );
      }

      logger.info('Reading goal created', { goalId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating reading goal', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Update goal progress manually
  async updateGoalProgress(goalId: string, increment: number = 1): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('increment_goal_progress', {
          goal_id_param: goalId,
          increment_by: increment
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to update goal progress: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateGoalProgress', goalId, error: error.message }
        );
      }

      logger.info('Goal progress updated', { goalId, increment, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error updating goal progress', { goalId, increment }, error as Error);
      throw error;
    }
  }

  // Check and update streaks for all goals
  async checkAndUpdateStreaks(): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('check_and_update_streaks', {
          user_id_param: this.currentUserId!
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to update streaks: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'checkAndUpdateStreaks', error: error.message }
        );
      }

      logger.info('Streaks updated', { userId: this.currentUserId });
    } catch (error) {
      logger.error('Error updating streaks', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Mark completed goals
  async markCompletedGoals(): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('mark_completed_goals', {
          user_id_param: this.currentUserId!
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to mark completed goals: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'markCompletedGoals', error: error.message }
        );
      }

      logger.info('Completed goals marked', { userId: this.currentUserId });
    } catch (error) {
      logger.error('Error marking completed goals', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Delete a goal
  async deleteGoal(goalId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('reading_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete goal: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteGoal', goalId, error: error.message }
        );
      }

      logger.info('Reading goal deleted', { goalId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting reading goal', { goalId }, error as Error);
      throw error;
    }
  }

  // Get goal statistics
  async getGoalStats(): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_active_goals', {
          user_id_param: this.currentUserId!
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to get goal stats: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getGoalStats', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting goal stats', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }
}

export const readingGoalsService = new ReadingGoalsService();

