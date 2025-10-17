import React, { useState, useEffect } from 'react'
import { FileText, Clock, BookOpen, Tag, Timer } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { pomodoroService } from '../src/services/pomodoroService'
import { useTheme, AnnotationColorPicker } from './ThemeProvider'

interface ThemedSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export const ThemedSidebar: React.FC<ThemedSidebarProps> = ({ isOpen, onToggle }) => {
  const { currentDocument, user } = useAppStore()
  const { annotationColors } = useTheme()
  const [currentHighlightColor, setCurrentHighlightColor] = React.useState('#FFD700')
  const [pomodoroStats, setPomodoroStats] = useState<{ [key: string]: { timeMinutes: number, sessions: number } }>({})

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

  // Load Pomodoro stats for mock documents
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return
      
      const stats: { [key: string]: { timeMinutes: number, sessions: number } } = {}
      
      for (const doc of mockDocuments) {
        const bookStats = await pomodoroService.getBookStats(doc.id)
        if (bookStats) {
          stats[doc.id] = {
            timeMinutes: Math.round(bookStats.total_time_minutes),
            sessions: bookStats.total_sessions
          }
        }
      }
      
      setPomodoroStats(stats)
    }
    
    loadStats()
  }, [user])

  if (!isOpen) return null

  return (
    <aside 
      className="overflow-y-auto"
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        height: 'var(--main-content-height)',
      }}
    >
      <div className="p-4">
        {/* Document Library Section */}
        <div className="mb-6">
          <h2 
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Document Library
          </h2>
          
          <div className="space-y-2">
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

        {/* Quick Stats */}
        <div className="space-y-4">
          <h3 
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Reading Stats
          </h3>
          
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
      </div>
    </aside>
  )
}
