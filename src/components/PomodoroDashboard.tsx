import React, { useState, useEffect } from 'react'
import { X, Calendar, Clock, Target, Trophy, Flame, TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react'
import { pomodoroGamificationService, Achievement, StreakInfo, AchievementProgress } from '../services/pomodoroGamificationService'
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

export const PomodoroDashboard: React.FC<PomodoroDashboardProps> = ({ isOpen, onClose }) => {
  const { user } = useAppStore()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [progress, setProgress] = useState<AchievementProgress[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [documentStats, setDocumentStats] = useState<DocumentStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      loadDashboardData()
    }
  }, [isOpen, user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const [achievementsData, streakData, progressData] = await Promise.all([
        pomodoroGamificationService.getUserAchievements(user.id),
        pomodoroGamificationService.getUserStreak(user.id),
        pomodoroGamificationService.getAchievementProgress(user.id)
      ])

      setAchievements(achievementsData)
      setStreak(streakData)
      setProgress(progressData)

      // Generate mock weekly data for now
      setWeeklyData(generateMockWeeklyData())
      setDocumentStats(generateMockDocumentStats())

    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const generateMockWeeklyData = (): WeeklyData[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, index) => ({
      day,
      sessions: Math.floor(Math.random() * 8) + 1,
      minutes: Math.floor(Math.random() * 200) + 25
    }))
  }

  const generateMockDocumentStats = (): DocumentStats[] => {
    return [
      { name: 'Research Paper.pdf', sessions: 15, minutes: 375, percentage: 35 },
      { name: 'Literature Review.docx', sessions: 12, minutes: 300, percentage: 28 },
      { name: 'Methodology Notes.pdf', sessions: 8, minutes: 200, percentage: 19 },
      { name: 'Data Analysis.pdf', sessions: 6, minutes: 150, percentage: 14 },
      { name: 'Conclusion.docx', sessions: 4, minutes: 100, percentage: 4 }
    ]
  }

  const getTotalSessions = () => {
    return progress.reduce((sum, p) => sum + p.current_progress, 0)
  }

  const getTotalMinutes = () => {
    return getTotalSessions() * 25 // Assuming 25 minutes per session
  }

  const getAverageSessionLength = () => {
    const totalSessions = getTotalSessions()
    return totalSessions > 0 ? Math.round(getTotalMinutes() / totalSessions) : 0
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
                      <p className="text-2xl font-bold">{streak?.current_streak || 0}</p>
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
                  {weeklyData.map((day, index) => (
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
                  {documentStats.map((doc, index) => (
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
