import React, { useState, useEffect } from 'react'
import { Trophy, Star, Zap, Target, Flame, Clock, Coffee, Moon, Sun, Crown, Award, BookOpen, ChevronRight, Lock } from 'lucide-react'
import { pomodoroGamificationService, Achievement, AchievementProgress } from '../services/pomodoroGamificationService'

interface AchievementPanelProps {
  userId: string
  className?: string
}

const getAchievementIcon = (achievementType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'first_steps': <Target className="w-5 h-5" />,
    'consistent_reader': <BookOpen className="w-5 h-5" />,
    'marathon': <Zap className="w-5 h-5" />,
    'streak_master': <Flame className="w-5 h-5" />,
    'early_bird': <Sun className="w-5 h-5" />,
    'night_owl': <Moon className="w-5 h-5" />,
    'focus_champion': <Award className="w-5 h-5" />,
    'speed_reader': <Zap className="w-5 h-5" />,
    'century_club': <Crown className="w-5 h-5" />
  }
  
  return iconMap[achievementType] || <Trophy className="w-5 h-5" />
}

export const AchievementPanel: React.FC<AchievementPanelProps> = ({ userId, className = '' }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [progress, setProgress] = useState<AchievementProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAchievements()
  }, [userId])

  const loadAchievements = async () => {
    try {
      setLoading(true)
      setError(null)

      const [achievementsData, progressData] = await Promise.all([
        pomodoroGamificationService.getUserAchievements(userId),
        pomodoroGamificationService.getAchievementProgress(userId)
      ])

      setAchievements(achievementsData)
      setProgress(progressData)
    } catch (err) {
      console.error('Error loading achievements:', err)
      setError('Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }

  const getAchievementStatus = (achievementType: string) => {
    const unlocked = achievements.find(a => a.achievement_type === achievementType)
    const progressData = progress.find(p => p.achievement_type === achievementType)
    
    return {
      isUnlocked: !!unlocked,
      progress: progressData?.progress_percentage || 0,
      current: progressData?.current_progress || 0,
      target: progressData?.target_progress || 1,
      unlockedAt: unlocked?.unlocked_at
    }
  }

  const allAchievements = [
    'first_steps',
    'consistent_reader', 
    'marathon',
    'streak_master',
    'early_bird',
    'night_owl',
    'focus_champion',
    'speed_reader',
    'century_club'
  ]

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Achievements
        </h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Achievements
        </h3>
        <div className="p-4 rounded-lg" style={{ 
          backgroundColor: 'var(--color-error-light)',
          color: 'var(--color-error)'
        }}>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadAchievements}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Achievements
        </h3>
        <div className="flex items-center space-x-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <Trophy className="w-4 h-4" />
          <span>{achievements.length}/{allAchievements.length}</span>
        </div>
      </div>

      {/* Achievement List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {allAchievements.map((achievementType) => {
          const details = pomodoroGamificationService.getAchievementDetails(achievementType)
          const status = getAchievementStatus(achievementType)
          
          return (
            <div
              key={achievementType}
              className={`p-3 rounded-lg border transition-all ${
                status.isUnlocked 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
              style={{
                backgroundColor: status.isUnlocked 
                  ? `${details.color}10` 
                  : 'var(--color-background)',
                borderColor: status.isUnlocked 
                  ? details.color 
                  : 'var(--color-border)'
              }}
            >
              <div className="flex items-center space-x-3">
                {/* Icon */}
                <div
                  className={`p-2 rounded-full ${
                    status.isUnlocked ? 'opacity-100' : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: status.isUnlocked 
                      ? `${details.color}20` 
                      : 'var(--color-surface)',
                    color: status.isUnlocked 
                      ? details.color 
                      : 'var(--color-text-tertiary)'
                  }}
                >
                  {status.isUnlocked ? getAchievementIcon(achievementType) : <Lock className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-medium ${
                      status.isUnlocked ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {details.title}
                    </h4>
                    {status.isUnlocked && (
                      <div className="flex items-center space-x-1 text-xs text-green-600">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Unlocked</span>
                      </div>
                    )}
                  </div>
                  
                  <p className={`text-sm ${
                    status.isUnlocked ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {details.description}
                  </p>

                  {/* Progress bar for locked achievements */}
                  {!status.isUnlocked && status.target > 1 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        <span>Progress</span>
                        <span>{status.current} / {status.target}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: details.color,
                            width: `${Math.min(100, status.progress)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Unlocked date */}
                  {status.isUnlocked && status.unlockedAt && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      Unlocked {new Date(status.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      {achievements.length > 0 && (
        <div className="p-3 rounded-lg" style={{ 
          backgroundColor: 'var(--color-primary-light)',
          color: 'var(--color-primary-dark)'
        }}>
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">
              {achievements.length === allAchievements.length 
                ? 'All achievements unlocked! 🎉' 
                : `${achievements.length} of ${allAchievements.length} achievements unlocked`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default AchievementPanel
