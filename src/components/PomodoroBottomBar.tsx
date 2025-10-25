import React, { useState, useEffect } from 'react'
import { Play, Pause, Square, Settings, ChevronUp, ChevronDown, Timer } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Tooltip } from './Tooltip'

interface PomodoroBottomBarProps {
  onExpand?: () => void
}

export const PomodoroBottomBar: React.FC<PomodoroBottomBarProps> = ({ onExpand }) => {
  const { 
    user, 
    pomodoroIsRunning, 
    pomodoroTimeLeft, 
    pomodoroMode,
    setPomodoroSession,
    updatePomodoroTimer,
    setPomodoroTimerToggleRef
  } = useAppStore()
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Don't render if user is not authenticated
  if (!user) {
    return null
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getModeInfo = () => {
    switch (pomodoroMode) {
      case 'work':
        return { 
          label: 'Focus', 
          color: '#ef4444', 
          icon: '🍅',
          bgColor: '#fef2f2',
          borderColor: '#fecaca'
        }
      case 'shortBreak':
        return { 
          label: 'Short Break', 
          color: '#10b981', 
          icon: '☕',
          bgColor: '#f0fdf4',
          borderColor: '#bbf7d0'
        }
      case 'longBreak':
        return { 
          label: 'Long Break', 
          color: '#3b82f6', 
          icon: '🌴',
          bgColor: '#eff6ff',
          borderColor: '#bfdbfe'
        }
      default:
        return { 
          label: 'Pomodoro', 
          color: '#6b7280', 
          icon: '🍅',
          bgColor: '#f9fafb',
          borderColor: '#e5e7eb'
        }
    }
  }

  const modeInfo = getModeInfo()

  const handleStartPause = () => {
    if (pomodoroIsRunning) {
      // Pause timer
      updatePomodoroTimer(pomodoroTimeLeft, false, pomodoroMode)
    } else {
      // Start timer
      updatePomodoroTimer(pomodoroTimeLeft, true, pomodoroMode)
    }
  }

  const handleStop = () => {
    updatePomodoroTimer(25 * 60, false, 'work')
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand()
    }
  }

  if (isCollapsed) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 transition-all duration-300"
        style={{
          backgroundColor: modeInfo.bgColor,
          border: `1px solid ${modeInfo.borderColor}`,
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center space-x-2 p-3 rounded-lg transition-colors"
          style={{ color: modeInfo.color }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span className="text-lg">{modeInfo.icon}</span>
          <span className="text-sm font-medium">{formatTime(pomodoroTimeLeft || 0)}</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: modeInfo.bgColor,
        borderTop: `2px solid ${modeInfo.borderColor}`,
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-center justify-between p-4">
        {/* Left side - Timer info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{modeInfo.icon}</span>
            <div>
              <div 
                className="text-lg font-semibold"
                style={{ color: modeInfo.color }}
              >
                {modeInfo.label}
              </div>
              <div 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {pomodoroIsRunning ? 'Running' : 'Paused'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Timer className="w-5 h-5" style={{ color: modeInfo.color }} />
            <span 
              className="text-2xl font-mono font-bold"
              style={{ color: modeInfo.color }}
            >
              {formatTime(pomodoroTimeLeft || 0)}
            </span>
          </div>
        </div>

        {/* Center - Controls */}
        <div className="flex items-center space-x-2">
          <Tooltip content={pomodoroIsRunning ? "Pause Timer" : "Start Timer"} position="top">
            <button
              onClick={handleStartPause}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: modeInfo.color,
                color: 'white',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {pomodoroIsRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          </Tooltip>

          <Tooltip content="Stop Timer" position="top">
            <button
              onClick={handleStop}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
            >
              <Square className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2">
          <Tooltip content="Open Full Timer" position="top">
            <button
              onClick={handleExpand}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Collapse Timer" position="top">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
