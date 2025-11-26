import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, Square, Settings, ChevronUp, ChevronDown, Timer, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Tooltip } from './Tooltip'
import { timerService, TimerState } from '../services/timerService'

interface PomodoroBottomBarProps {
  onExpand?: () => void
}

export const PomodoroBottomBar: React.FC<PomodoroBottomBarProps> = ({ onExpand }) => {
  const { user, currentDocument } = useAppStore()
  const [timerState, setTimerState] = useState<TimerState>(timerService.getState())
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  // Initialize position on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && position === null) {
      // Calculate initial position from right-20 (80px from right) and top-4 (16px from top)
      setPosition({
        x: window.innerWidth - 120, // Approximate width + margin
        y: 16
      })
    }
  }, [position])

  // Subscribe to timer service
  useEffect(() => {
    const unsubscribe = timerService.subscribe(setTimerState)
    return unsubscribe
  }, [])

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
    switch (timerState.mode) {
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
    timerService.toggleTimer(user.id, currentDocument?.id)
  }

  const handleStop = () => {
    timerService.resetTimer(user.id)
  }

  const handleClose = () => {
    timerService.resetTimer(user.id)
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !position) return // Only handle left mouse button
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setDragStartPos({ x: e.clientX, y: e.clientY })
    setIsDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Constrain to viewport (approximate width: 120px, height: 50px)
      const maxX = window.innerWidth - 120
      const maxY = window.innerHeight - 50
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false)
      
      // If it was a small movement (click), expand the timer
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + 
        Math.pow(e.clientY - dragStartPos.y, 2)
      )
      
      // If movement was less than 5px, treat it as a click
      if (dragDistance < 5) {
        // Small delay to allow click handler to fire
        setTimeout(() => {
          setIsCollapsed(false)
        }, 10)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, dragStartPos])

  if (isCollapsed) {
    const renderInHeader = typeof document !== 'undefined' && !!document.getElementById('pomodoro-collapsed-anchor')

    const collapsedButton = (
      <div
        className={`${renderInHeader ? 'inline-flex items-center transition-all duration-300 mr-2' : 'fixed z-50 transition-all duration-300 select-none'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundColor: modeInfo.bgColor,
          border: `1px solid ${modeInfo.borderColor}`,
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: renderInHeader ? 'none' : isDragging ? '0 10px 25px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
          left: renderInHeader || position === null ? undefined : `${position.x}px`,
          top: renderInHeader || position === null ? undefined : `${position.y}px`,
          right: renderInHeader || position !== null ? undefined : '20px',
          transform: renderInHeader ? undefined : isDragging ? 'scale(1.05)' : 'scale(1)',
          userSelect: 'none'
        }}
        onMouseDown={renderInHeader ? undefined : handleMouseDown}
      >
        <button
          onClick={() => {
            // Only expand if we're not dragging
            if (!isDragging) {
              setIsCollapsed(false)
            }
          }}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
          style={{ color: modeInfo.color, backgroundColor: 'transparent', pointerEvents: isDragging ? 'none' : 'auto' }}
          onMouseEnter={(e) => {
            if (!renderInHeader && !isDragging) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
            }
          }}
          onMouseLeave={(e) => {
            if (!renderInHeader) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <span className="text-lg">{modeInfo.icon}</span>
          <span className="text-sm font-medium">{formatTime(timerState.timeLeft)}</span>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    )

    if (renderInHeader) {
      const anchor = document.getElementById('pomodoro-collapsed-anchor')!
      return createPortal(collapsedButton, anchor)
    }

    return collapsedButton
  }

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 sm:left-8 sm:right-8 md:left-16 md:right-16 lg:left-32 lg:right-32"
      style={{
        backgroundColor: modeInfo.bgColor,
        border: `2px solid ${modeInfo.borderColor}`,
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        maxWidth: '800px',
        margin: '0 auto',
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
                {timerState.isRunning ? 'Running' : 'Paused'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Timer className="w-5 h-5" style={{ color: modeInfo.color }} />
            <span 
              className="text-2xl font-mono font-bold"
              style={{ color: modeInfo.color }}
            >
              {formatTime(timerState.timeLeft)}
            </span>
          </div>
        </div>

        {/* Center - Controls */}
        <div className="flex items-center space-x-2">
          <Tooltip content={timerState.isRunning ? "Pause Timer" : "Start Timer"} position="top">
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
              {timerState.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
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

          <Tooltip content="Close Timer" position="top">
            <button
              onClick={handleClose}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                e.currentTarget.style.color = 'var(--color-text-primary)'
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
