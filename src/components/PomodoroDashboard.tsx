import React, { useState, useEffect } from 'react'
import { X, Calendar, Clock, Target, Trophy, Flame, TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react'
import { pomodoroGamificationService, Achievement, StreakInfo, AchievementProgress } from '../services/pomodoroGamificationService'
import { pomodoroService } from '../services/pomodoroService'
import { useAppStore } from '../store/appStore'

interface PomodoroDashboardProps {
  isOpen: boolean
  onClose: () => void
}

interface WeeklyData {
  day: string
  sessions: number
  minutes: number
}

interface DocumentStats {
  name: string
  sessions: number
  minutes: number
  percentage: number
}

interface PomodoroStats {
  totalSessions: number
  totalMinutes: number
  averageSessionLength: number
  currentStreak: number
  weeklyData: WeeklyData[]
  documentStats: DocumentStats[]
}

export const PomodoroDashboard: React.FC<PomodoroDashboardProps> = ({ isOpen, onClose }) => {
  const { user, documents } = useAppStore()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [progress, setProgress] = useState<AchievementProgress[]>([])
  const [pomodoroStats, setPomodoroStats] = useState<PomodoroStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      loadDashboardData()
    }
  }, [isOpen, user, documents])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Load gamification data
      const [achievementsData, streakData, progressData] = await Promise.all([
        pomodoroGamificationService.getUserAchievements(user.id).catch(() => []),
        pomodoroGamificationService.getUserStreak(user.id).catch(() => null),
        pomodoroGamificationService.getAchievementProgress(user.id).catch(() => [])
      ])

      setAchievements(achievementsData)
      setStreak(streakData)
      setProgress(progressData)

      // Load real Pomodoro stats
      await loadPomodoroStats()

    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const loadPomodoroStats = async () => {
    if (!user) return

    try {
      // Get daily stats for the past 7 days
      const dailyStats = await pomodoroService.getDailyStats(user.id, 7)
      
      // Calculate totals
      const totalSessions = dailyStats.reduce((sum, day) => sum + day.totalSessions, 0)
      const totalMinutes = dailyStats.reduce((sum, day) => sum + day.totalMinutes, 0)
      const averageSessionLength = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0

      // Get current streak
      const currentStreak = streak?.current_streak || 0

      // Format weekly data
      const weeklyData: WeeklyData[] = dailyStats.map(stat => ({
        day: new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' }),
        sessions: stat.totalSessions,
        minutes: stat.totalMinutes
      }))

      // Get document stats
      const documentStats: DocumentStats[] = []
      for (const doc of documents) {
        const bookStats = await pomodoroService.getBookStats(doc.id)
        if (bookStats) {
          documentStats.push({
            name: doc.name,
            sessions: bookStats.total_sessions,
            minutes: Math.round(bookStats.total_time_minutes),
            percentage: totalMinutes > 0 ? Math.round((bookStats.total_time_minutes / totalMinutes) * 100) : 0
          })
        }
      }

      setPomodoroStats({
        totalSessions,
        totalMinutes,
        averageSessionLength,
        currentStreak,
        weeklyData,
        documentStats
      })

    } catch (error) {
      console.error('Error loading Pomodoro stats:', error)
      // Set default values if API fails
      setPomodoroStats({
        totalSessions: 0,
        totalMinutes: 0,
        averageSessionLength: 0,
        currentStreak: 0,
        weeklyData: [],
        documentStats: []
      })
    }
  }

  const getTotalSessions = () => {
    return pomodoroStats?.totalSessions || 0
  }

  const getTotalMinutes = () => {
    return pomodoroStats?.totalMinutes || 0
  }

  const getAverageSessionLength = () => {
    return pomodoroStats?.averageSessionLength || 0
  }

  const getCurrentStreak = () => {
    return pomodoroStats?.currentStreak || 0
  }

  const getWeeklyData = () => {
    return pomodoroStats?.weeklyData || []
  }

  const getDocumentStats = () => {
    return pomodoroStats?.documentStats || []
  }

  const getStreakStatus = () => {
    if (!streak) return { message: 'No streak data', type: 'info' as const }
    
    if (streak.current_streak === 0) {
      return { message: 'Start your first session!', type: 'info' as const }
    }
    
    if (streak.current_streak < 7) {
      return { message: `${streak.current_streak} day streak`, type: 'success' as const }
    }
    
    return { message: `${streak.current_streak} day streak! 🔥`, type: 'success' as const }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Pomodoro Analytics</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Track your productivity and achievements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <Activity className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Failed to load data</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {error}
              </p>
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)'
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#3b82f620' }}>
                      <Target className="w-5 h-5" style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Sessions</p>
                      <p className="text-2xl font-bold">{getTotalSessions()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#10b98120' }}>
                      <Clock className="w-5 h-5" style={{ color: '#10b981' }} />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Time</p>
                      <p className="text-2xl font-bold">{Math.round(getTotalMinutes() / 60)}h</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#f59e0b20' }}>
                      <TrendingUp className="w-5 h-5" style={{ color: '#f59e0b' }} />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Avg Session</p>
                      <p className="text-2xl font-bold">{getAverageSessionLength()}m</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#ef444420' }}>
                      <Flame className="w-5 h-5" style={{ color: '#ef4444' }} />
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Current Streak</p>
                      <p className="text-2xl font-bold">{getCurrentStreak()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Chart */}
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>This Week</span>
                </h3>
                <div className="space-y-3">
                  {getWeeklyData().map((day, index) => (
                    <div key={day.day} className="flex items-center space-x-4">
                      <div className="w-12 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {day.day}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <div 
                            className="h-2 rounded-full"
                            style={{ 
                              backgroundColor: '#3b82f6',
                              width: `${(day.sessions / 8) * 100}%`
                            }}
                          />
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {day.sessions} sessions
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {day.minutes} minutes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Breakdown */}
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <PieChart className="w-5 h-5" />
                  <span>Document Breakdown</span>
                </h3>
                <div className="space-y-3">
                  {getDocumentStats().map((doc, index) => (
                    <div key={doc.name} className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                           style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}>
                        {doc.percentage}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{doc.name}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {doc.sessions} sessions • {doc.minutes} minutes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Achievements Summary */}
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Achievements</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {achievements.slice(0, 6).map((achievement) => {
                    const details = pomodoroGamificationService.getAchievementDetails(achievement.achievement_type)
                    return (
                      <div key={achievement.id} className="flex items-center space-x-3 p-3 rounded-lg"
                           style={{ backgroundColor: `${details.color}10` }}>
                        <div className="p-2 rounded-full" style={{ backgroundColor: `${details.color}20` }}>
                          <Trophy className="w-4 h-4" style={{ color: details.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{details.title}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {new Date(achievement.unlocked_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {achievements.length > 6 && (
                  <div className="mt-3 text-center">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      +{achievements.length - 6} more achievements
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PomodoroDashboard
