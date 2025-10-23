import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Settings, Maximize2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Tooltip } from './Tooltip'

interface PomodoroFloatingWidgetProps {
  onExpand?: () => void
}

export const PomodoroFloatingWidget: React.FC<PomodoroFloatingWidgetProps> = ({ onExpand }) => {
  const handleExpand = () => {
    setIsExpanded(false) // Hide the floating widget
    if (onExpand) {
      onExpand() // Open the main timer in header
    }
  }
  const { 
    pomodoroTimeLeft,
    pomodoroIsRunning,
    pomodoroMode,
    pomodoroWidgetPosition,
    setPomodoroWidgetPosition,
    updatePomodoroTimer,
    stopPomodoroTimer,
    startPomodoroTimer
  } = useAppStore()
  
  const [isDragging, setIsDragging] = useState(false)
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState(() => {
    // Calculate proper initial position if current position is invalid
    if (pomodoroWidgetPosition.x === 0 && pomodoroWidgetPosition.y === 0) {
      // Use a more conservative calculation
      const x = Math.max(20, (window.innerWidth || 1200) - 160)
      const y = Math.max(20, (window.innerHeight || 800) - 120)
      return { x, y }
    }
    return pomodoroWidgetPosition
  })
  const widgetRef = useRef<HTMLDivElement>(null)

  // Update position when store changes, but only if it's a valid position
  useEffect(() => {
    if (pomodoroWidgetPosition.x !== 0 || pomodoroWidgetPosition.y !== 0) {
      setPosition(pomodoroWidgetPosition)
    }
  }, [pomodoroWidgetPosition])

  // Ensure position is within viewport bounds on mount and window resize
  useEffect(() => {
    const ensurePositionInBounds = () => {
      setPosition(prev => {
        const maxX = Math.max(0, (window.innerWidth || 1200) - 160)
        const maxY = Math.max(0, (window.innerHeight || 800) - 120)
        
        return {
          x: Math.max(20, Math.min(prev.x, maxX)),
          y: Math.max(20, Math.min(prev.y, maxY))
        }
      })
    }
    
    // Run with a small delay to ensure DOM is ready
    const timer = setTimeout(ensurePositionInBounds, 100)
    
    // Also run on window resize
    window.addEventListener('resize', ensurePositionInBounds)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', ensurePositionInBounds)
    }
  }, [])

  // Save position to store when dragging ends
  const handleDragEnd = () => {
    if (isDragging) {
      setPomodoroWidgetPosition(position)
      setIsDragging(false)
    }
  }

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Keep widget within viewport bounds (consistent with other bounds checks)
      const maxX = Math.max(0, (window.innerWidth || 1200) - 160)
      const maxY = Math.max(0, (window.innerHeight || 800) - 120)
      
      setPosition({
        x: Math.max(20, Math.min(newX, maxX)),
        y: Math.max(20, Math.min(newY, maxY))
      })
    }
  }, [isDragging, dragStart])

  // Handle mouse up for dragging
  const handleMouseUp = useCallback(() => {
    handleDragEnd()
  }, [isDragging, position])

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get mode icon and color
  const getModeInfo = () => {
    switch (pomodoroMode) {
      case 'work':
        return { icon: '🍅', color: '#ef4444', bgColor: '#fef2f2' }
      case 'shortBreak':
        return { icon: '☕', color: '#3b82f6', bgColor: '#eff6ff' }
      case 'longBreak':
        return { icon: '🌴', color: '#10b981', bgColor: '#ecfdf5' }
      default:
        return { icon: '🍅', color: '#ef4444', bgColor: '#fef2f2' }
    }
  }

  const modeInfo = getModeInfo()

  // Always render when user is authenticated, but show different states

  return (
    <div
      ref={widgetRef}
      className={`fixed z-50 transition-all duration-200 select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isDragging 
          ? '0 10px 25px rgba(0, 0, 0, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
      onMouseDown={handleMouseDown}
    >
      {isExpanded ? (
        // Expanded view
        <div 
          className="bg-white rounded-lg border border-gray-200 p-3 min-w-[200px]"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{modeInfo.icon}</span>
              <span className="text-sm font-medium capitalize">
                {pomodoroIsRunning ? pomodoroMode.replace(/([A-Z])/g, ' $1').trim() : 'Pomodoro Timer'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Tooltip content="Open Full Timer" position="bottom">
                <button
                  onClick={handleExpand}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Time Display */}
          <div 
            className="text-center mb-3 p-2 rounded"
            style={{ 
              backgroundColor: pomodoroIsRunning ? modeInfo.bgColor : '#f8fafc',
              color: pomodoroIsRunning ? modeInfo.color : '#6b7280'
            }}
          >
            <div className="text-2xl font-mono font-bold">
              {pomodoroTimeLeft ? formatTime(pomodoroTimeLeft) : '25:00'}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-2">
            {pomodoroIsRunning ? (
              <>
                <Tooltip content="Stop Timer" position="top">
                  <button
                    onClick={() => {
                      // Stop timer without counting as completed session
                      stopPomodoroTimer()
                    }}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white'
                    }}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </Tooltip>
              </>
            ) : (
              <Tooltip content="Start Timer" position="top">
                <button
                  onClick={() => startPomodoroTimer()}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                >
                  <Play className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Drag handle */}
          <div 
            className="mt-2 text-center text-xs opacity-50"
            data-drag-handle
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Drag to move
          </div>
        </div>
      ) : (
        // Compact view
        <div 
          className="bg-white rounded-lg border border-gray-200 p-2 cursor-pointer hover:shadow-md transition-all"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)'
          }}
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">{pomodoroIsRunning ? modeInfo.icon : '🍅'}</span>
            <div className="text-right">
              <div 
                className="text-lg font-mono font-bold"
                style={{ color: pomodoroIsRunning ? modeInfo.color : '#6b7280' }}
              >
                {pomodoroIsRunning ? (pomodoroTimeLeft ? formatTime(pomodoroTimeLeft) : '00:00') : 'Start'}
              </div>
              <div 
                className="text-xs capitalize"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {pomodoroIsRunning ? pomodoroMode.replace(/([A-Z])/g, ' $1').trim() : 'Timer'}
              </div>
            </div>
          </div>
          
          {/* Drag handle */}
          <div 
            className="mt-1 text-center text-xs opacity-30 hover:opacity-60 transition-opacity cursor-grab"
            data-drag-handle
            style={{ color: 'var(--color-text-tertiary)' }}
            title="Drag to move widget"
          >
            ⋮⋮
          </div>
        </div>
      )}
    </div>
  )
}

export default PomodoroFloatingWidget
