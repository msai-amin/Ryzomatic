import { supabase } from '../../lib/supabase'

export interface Achievement {
  id: string
  achievement_type: string
  unlocked_at: string
  metadata: any
}

export interface StreakInfo {
  current_streak: number
  longest_streak: number
  last_session_date: string | null
  weekly_goal: number
  weekly_progress: number
  week_start_date: string | null
}

export interface AchievementProgress {
  achievement_type: string
  current_progress: number
  target_progress: number
  is_unlocked: boolean
  progress_percentage: number
}

export interface NewAchievement {
  achievement_type: string
  unlocked: boolean
  metadata: any
}

class PomodoroGamificationService {
  /**
   * Check for new achievements after a Pomodoro session
   */
  async checkAchievements(userId: string, sessionData: {
    bookId?: string
    mode: 'work' | 'shortBreak' | 'longBreak'
    completed: boolean
  }): Promise<NewAchievement[]> {
    try {
      const { data, error } = await supabase.rpc('check_pomodoro_achievements', {
        p_user_id: userId,
        p_session_data: sessionData
      })

      if (error) {
        console.error('Error checking achievements:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in checkAchievements:', error)
      return []
    }
  }

  /**
   * Update streak tracking after a completed session
   */
  async updateStreak(userId: string, sessionDate?: Date): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_pomodoro_streak', {
        p_user_id: userId,
        p_session_date: sessionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
      })

      if (error) {
        console.error('Error updating streak:', error)
      }
    } catch (error) {
      console.error('Error in updateStreak:', error)
    }
  }

  /**
   * Get all achievements for a user
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_achievements', {
        p_user_id: userId
      })

      if (error) {
        console.error('Error getting user achievements:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserAchievements:', error)
      return []
    }
  }

  /**
   * Get current streak information for a user
   */
  async getUserStreak(userId: string): Promise<StreakInfo | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_streak', {
        p_user_id: userId
      })

      if (error) {
        console.error('Error getting user streak:', error)
        return null
      }

      return data?.[0] || null
    } catch (error) {
      console.error('Error in getUserStreak:', error)
      return null
    }
  }

  /**
   * Get achievement progress for a user
   */
  async getAchievementProgress(userId: string): Promise<AchievementProgress[]> {
    try {
      const { data, error } = await supabase.rpc('get_achievement_progress', {
        p_user_id: userId
      })

      if (error) {
        console.error('Error getting achievement progress:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAchievementProgress:', error)
      return []
    }
  }

  /**
   * Get achievement details by type
   */
  getAchievementDetails(achievementType: string): {
    title: string
    description: string
    icon: string
    color: string
    category: 'milestone' | 'streak' | 'time' | 'special'
  } {
    const achievements: Record<string, any> = {
      'first_steps': {
        title: 'First Steps',
        description: 'Complete your first Pomodoro session',
        icon: '🎯',
        color: '#3b82f6',
        category: 'milestone'
      },
      'consistent_reader': {
        title: 'Consistent Reader',
        description: 'Complete 3 sessions in one day',
        icon: '📚',
        color: '#10b981',
        category: 'milestone'
      },
      'marathon': {
        title: 'Marathon',
        description: 'Complete 10 sessions on one document',
        icon: '🏃',
        color: '#f59e0b',
        category: 'milestone'
      },
      'streak_master': {
        title: 'Streak Master',
        description: 'Maintain a 7-day streak',
        icon: '🔥',
        color: '#ef4444',
        category: 'streak'
      },
      'early_bird': {
        title: 'Early Bird',
        description: 'Complete a session before 8 AM',
        icon: '🌅',
        color: '#f59e0b',
        category: 'time'
      },
      'night_owl': {
        title: 'Night Owl',
        description: 'Complete a session after 10 PM',
        icon: '🦉',
        color: '#6366f1',
        category: 'time'
      },
      'focus_champion': {
        title: 'Focus Champion',
        description: 'Complete 4 sessions without breaks',
        icon: '💪',
        color: '#8b5cf6',
        category: 'special'
      },
      'speed_reader': {
        title: 'Speed Reader',
        description: 'Complete 50 total sessions',
        icon: '⚡',
        color: '#06b6d4',
        category: 'milestone'
      },
      'century_club': {
        title: 'Century Club',
        description: 'Complete 100 total sessions',
        icon: '💯',
        color: '#f97316',
        category: 'milestone'
      }
    }

    return achievements[achievementType] || {
      title: 'Unknown Achievement',
      description: 'An achievement was unlocked',
      icon: '🏆',
      color: '#6b7280',
      category: 'milestone'
    }
  }

  /**
   * Get streak status message
   */
  getStreakStatusMessage(streak: StreakInfo): {
    message: string
    type: 'success' | 'warning' | 'info'
    icon: string
  } {
    if (streak.current_streak === 0) {
      return {
        message: 'Start your first session to begin a streak!',
        type: 'info',
        icon: '🌱'
      }
    }

    if (streak.current_streak === 1) {
      return {
        message: 'Great start! Keep it going tomorrow.',
        type: 'success',
        icon: '🎉'
      }
    }

    if (streak.current_streak < 7) {
      return {
        message: `${streak.current_streak} day streak! Keep it up!`,
        type: 'success',
        icon: '🔥'
      }
    }

    if (streak.current_streak < 30) {
      return {
        message: `Amazing ${streak.current_streak} day streak! You're on fire!`,
        type: 'success',
        icon: '🚀'
      }
    }

    return {
      message: `Incredible ${streak.current_streak} day streak! You're unstoppable!`,
      type: 'success',
      icon: '👑'
    }
  }

  /**
   * Get weekly progress message
   */
  getWeeklyProgressMessage(streak: StreakInfo): {
    message: string
    progress: number
    type: 'success' | 'warning' | 'info'
  } {
    const progress = (streak.weekly_progress / streak.weekly_goal) * 100

    if (progress >= 100) {
      return {
        message: `Goal achieved! ${streak.weekly_progress}/${streak.weekly_goal} sessions`,
        progress: 100,
        type: 'success'
      }
    }

    if (progress >= 75) {
      return {
        message: `Almost there! ${streak.weekly_progress}/${streak.weekly_goal} sessions`,
        progress,
        type: 'success'
      }
    }

    if (progress >= 50) {
      return {
        message: `Halfway there! ${streak.weekly_progress}/${streak.weekly_goal} sessions`,
        progress,
        type: 'info'
      }
    }

    return {
      message: `Keep going! ${streak.weekly_progress}/${streak.weekly_goal} sessions`,
      progress,
      type: 'warning'
    }
  }

  /**
   * Check if user is close to breaking their streak
   */
  isStreakAtRisk(streak: StreakInfo): boolean {
    if (!streak.last_session_date) return false
    
    const lastSession = new Date(streak.last_session_date)
    const today = new Date()
    const daysSinceLastSession = Math.floor((today.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
    
    return daysSinceLastSession >= 1 && streak.current_streak > 0
  }

  /**
   * Get motivational message based on progress
   */
  getMotivationalMessage(achievements: Achievement[], streak: StreakInfo | null): string {
    const totalAchievements = achievements.length
    const currentStreak = streak?.current_streak || 0

    if (totalAchievements === 0) {
      return "Ready to start your productivity journey? Your first Pomodoro session awaits! 🍅"
    }

    if (totalAchievements < 3) {
      return "Great start! You're building momentum. Keep those sessions coming! 💪"
    }

    if (totalAchievements < 6) {
      return "You're on fire! Your dedication is paying off. Keep up the excellent work! 🔥"
    }

    if (currentStreak >= 7) {
      return "Incredible streak! You're a productivity powerhouse! 🚀"
    }

    if (totalAchievements >= 6) {
      return "Outstanding! You've mastered the art of focused work. You're an inspiration! 👑"
    }

    return "Keep pushing forward! Every session counts towards your goals! ⭐"
  }
}

export const pomodoroGamificationService = new PomodoroGamificationService()
