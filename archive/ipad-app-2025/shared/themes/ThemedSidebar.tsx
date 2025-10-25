import React, { useState, useEffect } from 'react'
import { FileText, Clock, BookOpen, Tag, Timer, ChevronLeft, ChevronRight, Flame, Trophy, BarChart3, Target } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { pomodoroService } from '../src/services/pomodoroService'
import { pomodoroGamificationService, StreakInfo, Achievement } from '../src/services/pomodoroGamificationService'
import { AchievementPanel } from '../src/components/AchievementPanel'
import { PomodoroDashboard } from '../src/components/PomodoroDashboard'
import { useTheme, AnnotationColorPicker } from './ThemeProvider'

interface ThemedSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export const ThemedSidebar: React.FC<ThemedSidebarProps> = ({ isOpen, onToggle }) => {
  const { currentDocument, user, showPomodoroDashboard, setShowPomodoroDashboard } = useAppStore()
  const { annotationColors } = useTheme()
  const [currentHighlightColor, setCurrentHighlightColor] = React.useState('#FFD700')
  const [pomodoroStats, setPomodoroStats] = useState<{ [key: string]: { timeMinutes: number, sessions: number } }>({})
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(false)

  // Mock data for demonstration
  const mockDocuments = [
    {
      id: '1',
      name: 'Research Paper.pdf',
      progress: 72,
      readingTime: '45 min',
      isActive: true,
    },
    {
      id: '2',
      name: 'Literature Review.docx',
      progress: 28,
      readingTime: '15 min',
      isActive: false,
    },
    {
      id: '3',
      name: 'Methodology Notes.pdf',
      progress: 100,
      readingTime: '2 hours',
      isActive: false,
    },
  ]

  // Load Pomodoro stats for real documents (skip mock data with non-UUID IDs)
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return
      
      // Only load stats for real documents with valid UUID format
      // Mock documents with IDs like "1", "2", "3" will be skipped
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      
      const stats: { [key: string]: { timeMinutes: number, sessions: number } } = {}
      
      for (const doc of mockDocuments) {
        // Only fetch stats for valid UUIDs
        if (uuidRegex.test(doc.id)) {
          const bookStats = await pomodoroService.getBookStats(doc.id)
          if (bookStats) {
            stats[doc.id] = {
              timeMinutes: Math.round(bookStats.total_time_minutes),
              sessions: bookStats.total_sessions
            }
          }
        }
      }
      
      setPomodoroStats(stats)
    }
    
    loadStats()
  }, [user])

  // Load streak and achievements data
  useEffect(() => {
    const loadGamificationData = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        const [streakData, achievementsData] = await Promise.all([
          pomodoroGamificationService.getUserStreak(user.id),
          pomodoroGamificationService.getUserAchievements(user.id)
        ])
        
        setStreak(streakData)
        setAchievements(achievementsData)
      } catch (error) {
        console.error('Error loading gamification data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadGamificationData()
  }, [user])

  return (
    <>
      {/* Toggle Button (visible when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-20 left-4 z-50 p-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-primary)',
          }}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <aside 
        className="overflow-y-auto transition-transform duration-300 ease-in-out sticky top-0"
        style={{
          width: 'var(--sidebar-width)',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, rgba(17, 24, 39, 0.98) 100%)',
          borderRight: '1px solid var(--color-border)',
          height: '100vh',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          marginLeft: isOpen ? '0' : 'calc(-1 * var(--sidebar-width))',
          zIndex: 40,
        }}
      >
        <div className="p-4">
          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onToggle}
              className="p-2 rounded-lg transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Document Library Section */}
          <div className="mb-6">
          <h2 
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Document Library
          </h2>
          
          <div className="space-y-3">
            {mockDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-lg border transition-colors cursor-pointer"
                style={{
                  backgroundColor: doc.isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
                  borderColor: doc.isActive ? 'var(--color-primary)' : 'var(--color-border)',
                }}
                onMouseEnter={(e) => {
                  if (!doc.isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!doc.isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Tooltip content={doc.isActive ? "Currently Active" : "Click to Open"} position="right">
                      <FileText className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    </Tooltip>
                    <h3 
                      className={`text-sm ${doc.isActive ? 'font-semibold' : 'font-medium'}`}
                      style={{ 
                        color: doc.isActive ? '#000000' : 'var(--color-text-primary)' 
                      }}
                    >
                      {doc.name}
                    </h3>
                  </div>
                  {doc.isActive && (
                    <div 
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-inverse)',
                      }}
                    >
                      Active
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Tooltip content="Reading Progress" position="right">
                      <Clock className="w-3 h-3" style={{ color: doc.isActive ? '#4b5563' : 'var(--color-text-tertiary)' }} />
                    </Tooltip>
                    <span style={{ color: doc.isActive ? '#374151' : 'var(--color-text-secondary)' }}>
                      {doc.progress}% complete
                    </span>
                  </div>
                  <Tooltip content="Estimated Reading Time" position="left">
                    <span style={{ color: doc.isActive ? '#4b5563' : 'var(--color-text-tertiary)' }}>
                      {doc.readingTime} reading
                    </span>
                  </Tooltip>
                </div>
                
                {/* Pomodoro Time Display */}
                {pomodoroStats[doc.id] && pomodoroStats[doc.id].timeMinutes > 0 && (
                  <div className="flex items-center space-x-2 text-xs mt-2">
                    <Tooltip content="Time Spent (Pomodoro)" position="right">
                      <Timer className="w-3 h-3" style={{ color: '#ef4444' }} />
                    </Tooltip>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {pomodoroStats[doc.id].timeMinutes} min
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      ({pomodoroStats[doc.id].sessions} sessions)
                    </span>
                  </div>
                )}
                
                {/* Progress Bar */}
                <div 
                  className="w-full rounded-full h-1.5 mt-2"
                  style={{ backgroundColor: 'var(--color-border-light)' }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${doc.progress}%`,
                      backgroundColor: doc.isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Color Coding System */}
        <div className="mb-6">
          <AnnotationColorPicker
            selectedColor={currentHighlightColor}
            onColorSelect={setCurrentHighlightColor}
          />
        </div>

        {/* Enhanced Stats */}
        <div className="space-y-4" data-tour="sidebar-stats">
          <div className="flex items-center justify-between">
            <h3 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Productivity Stats
            </h3>
            <button
              onClick={() => setShowPomodoroDashboard(true)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title="View Analytics Dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Streak Display */}
          {streak && (
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: streak.current_streak > 0 ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${streak.current_streak > 0 ? '#fecaca' : 'var(--color-border)'}`,
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <Flame className="w-4 h-4" style={{ color: streak.current_streak > 0 ? '#ef4444' : '#6b7280' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Current Streak
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold" style={{ color: streak.current_streak > 0 ? '#ef4444' : '#6b7280' }}>
                  {streak.current_streak}
                </div>
                <div className="text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>
                  <div>Best: {streak.longest_streak}</div>
                  <div>Week: {streak.weekly_progress}/{streak.weekly_goal}</div>
                </div>
              </div>
            </div>
          )}

          {/* Achievement Summary */}
          {achievements.length > 0 && (
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <Trophy className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Achievements
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold" style={{ color: '#0ea5e9' }}>
                  {achievements.length}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {achievements.length === 9 ? 'All unlocked! 🎉' : `${achievements.length}/9 unlocked`}
                </div>
              </div>
            </div>
          )}

          {/* Basic Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div 
              className="p-3 rounded-lg text-center"
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                12
              </div>
              <div 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Documents
              </div>
            </div>
            
            <div 
              className="p-3 rounded-lg text-center"
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-secondary)' }}
              >
                47
              </div>
              <div 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Annotations
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6">
          <h3 
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Recent Activity
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-yellow)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Added annotation to Research Paper
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  2 hours ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-blue)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Created new note in Literature Review
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  4 hours ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-green)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Completed Methodology Notes
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  1 day ago
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements Panel */}
        {user && (
          <div className="mt-6">
            <AchievementPanel userId={user.id} />
          </div>
        )}
        </div>
      </aside>

      {/* Pomodoro Dashboard Modal */}
      {user && (
        <PomodoroDashboard 
          isOpen={showPomodoroDashboard}
          onClose={() => setShowPomodoroDashboard(false)}
        />
      )}
    </>
  )
}
