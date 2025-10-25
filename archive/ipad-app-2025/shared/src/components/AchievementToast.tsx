import React, { useState, useEffect } from 'react'
import { X, Trophy, Star, Zap, Target, Flame, Clock, Coffee, Moon, Sun, Crown, Award, BookOpen } from 'lucide-react'
import { pomodoroGamificationService, Achievement } from '../services/pomodoroGamificationService'

interface AchievementToastProps {
  achievement: {
    achievement_type: string
    metadata: any
  }
  onClose: () => void
  autoClose?: boolean
  duration?: number
}

const getAchievementIcon = (achievementType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'first_steps': <Target className="w-6 h-6" />,
    'consistent_reader': <BookOpen className="w-6 h-6" />,
    'marathon': <Zap className="w-6 h-6" />,
    'streak_master': <Flame className="w-6 h-6" />,
    'early_bird': <Sun className="w-6 h-6" />,
    'night_owl': <Moon className="w-6 h-6" />,
    'focus_champion': <Award className="w-6 h-6" />,
    'speed_reader': <Zap className="w-6 h-6" />,
    'century_club': <Crown className="w-6 h-6" />
  }
  
  return iconMap[achievementType] || <Trophy className="w-6 h-6" />
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ 
  achievement, 
  onClose, 
  autoClose = true, 
  duration = 5000 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  
  const achievementDetails = pomodoroGamificationService.getAchievementDetails(achievement.achievement_type)

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100)
    
    // Auto close
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        handleClose()
      }, duration)
      
      return () => clearTimeout(closeTimer)
    }
    
    return () => clearTimeout(timer)
  }, [autoClose, duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300)
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ${
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      }`}
      style={{
        maxWidth: '400px',
        minWidth: '320px'
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 relative overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)'
        }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `linear-gradient(135deg, ${achievementDetails.color}20, ${achievementDetails.color}40)`
          }}
        />
        
        {/* Confetti effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${20 + i * 15}%`,
                top: `${10 + (i % 2) * 20}%`,
                color: achievementDetails.color,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            >
              ✨
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div
                className="p-2 rounded-full"
                style={{
                  backgroundColor: `${achievementDetails.color}20`,
                  color: achievementDetails.color
                }}
              >
                {getAchievementIcon(achievement.achievement_type)}
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: achievementDetails.color }}>
                  Achievement Unlocked!
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {achievementDetails.title}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleClose}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
            {achievementDetails.description}
          </p>

          {/* Metadata */}
          {achievement.metadata && Object.keys(achievement.metadata).length > 0 && (
            <div className="text-xs p-2 rounded" style={{ 
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-secondary)'
            }}>
              {Object.entries(achievement.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar for incremental achievements */}
          {achievement.metadata?.target && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <span>Progress</span>
                <span>{achievement.metadata.current || 0} / {achievement.metadata.target}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: achievementDetails.color,
                    width: `${Math.min(100, ((achievement.metadata.current || 0) / achievement.metadata.target) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom accent */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: achievementDetails.color }}
        />
      </div>
    </div>
  )
}

// Hook for managing achievement toasts
export const useAchievementToasts = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string
    achievement: { achievement_type: string; metadata: any }
  }>>([])

  const showAchievement = (achievement: { achievement_type: string; metadata: any }) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, achievement }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const AchievementToastContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <AchievementToast
          key={toast.id}
          achievement={toast.achievement}
          onClose={() => removeToast(toast.id)}
          autoClose={true}
          duration={6000}
        />
      ))}
    </div>
  )

  return {
    showAchievement,
    AchievementToastContainer
  }
}

export default AchievementToast
