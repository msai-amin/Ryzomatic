import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Settings, X, Coffee, BookOpen, Clock } from 'lucide-react'
import { Tooltip } from './Tooltip'
import { useAppStore } from '../store/appStore'
import { pomodoroService } from '../services/pomodoroService'

interface PomodoroSettings {
  workDuration: number // in minutes
  shortBreakDuration: number // in minutes
  longBreakDuration: number // in minutes
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
  notificationsEnabled: boolean
}

type TimerMode = 'work' | 'shortBreak' | 'longBreak'

interface PomodoroTimerProps {
  documentId?: string | null
  documentName?: string
  onClose?: () => void
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ documentId, documentName, onClose }) => {
  const { user, activePomodoroSessionId, setPomodoroSession } = useAppStore()
  const [settings, setSettings] = useState<PomodoroSettings>({
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    notificationsEnabled: true,
  })

  const [mode, setMode] = useState<TimerMode>('work')
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60) // in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null)

  // Initialize notification sound
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    const createBeep = () => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    }
    
    notificationSoundRef.current = { play: createBeep } as any
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Timer countdown logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, timeLeft])

  const handleTimerComplete = async () => {
    setIsRunning(false)
    
    // Save completed session to database
    if (user && activePomodoroSessionId && mode === 'work') {
      const duration = settings.workDuration * 60
      await pomodoroService.stopCurrentSession(true) // Mark as completed
      setPomodoroSession(null, null, null)
    }
    
    // Play notification sound
    if (settings.notificationsEnabled && notificationSoundRef.current) {
      notificationSoundRef.current.play()
    }

    // Show browser notification
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const title = mode === 'work' ? 'Work Session Complete!' : 'Break Time Over!'
      const body = mode === 'work' 
        ? 'Great job! Time for a break.' 
        : 'Break is over. Ready for another session?'
      
      new Notification(title, { body, icon: '/favicon.ico' })
    }

    // Transition to next mode
    if (mode === 'work') {
      setCompletedSessions((prev) => prev + 1)
      const shouldTakeLongBreak = (completedSessions + 1) % settings.sessionsUntilLongBreak === 0
      const nextMode: TimerMode = shouldTakeLongBreak ? 'longBreak' : 'shortBreak'
      setMode(nextMode)
      setTimeLeft(shouldTakeLongBreak ? settings.longBreakDuration * 60 : settings.shortBreakDuration * 60)
      
      if (settings.autoStartBreaks) {
        setIsRunning(true)
      }
    } else {
      setMode('work')
      setTimeLeft(settings.workDuration * 60)
      
      if (settings.autoStartPomodoros) {
        setIsRunning(true)
      }
    }
  }

  const toggleTimer = async () => {
    if (!isRunning) {
      // Starting timer - create session if user is authenticated and document is available
      if (user && documentId && mode === 'work') {
        const session = await pomodoroService.startSession(user.id, documentId, mode)
        if (session) {
          setPomodoroSession(session.id, session.bookId, Date.now())
        }
      }
      setIsRunning(true)
    } else {
      // Pausing timer - save current session
      if (user && activePomodoroSessionId) {
        const duration = settings.workDuration * 60 - timeLeft
        await pomodoroService.stopCurrentSession(false) // Mark as incomplete pause
        setPomodoroSession(null, null, null)
      }
      setIsRunning(false)
    }
  }

  const resetTimer = async () => {
    // Stop active session if running
    if (user && activePomodoroSessionId && isRunning) {
      await pomodoroService.stopCurrentSession(false) // Mark as incomplete
      setPomodoroSession(null, null, null)
    }
    
    setIsRunning(false)
    const duration = mode === 'work' 
      ? settings.workDuration 
      : mode === 'shortBreak' 
        ? settings.shortBreakDuration 
        : settings.longBreakDuration
    setTimeLeft(duration * 60)
  }

  const switchMode = async (newMode: TimerMode) => {
    // Stop active session if switching modes
    if (user && activePomodoroSessionId && isRunning) {
      const duration = settings.workDuration * 60 - timeLeft
      await pomodoroService.stopCurrentSession(false) // Mark as incomplete
      setPomodoroSession(null, null, null)
    }
    
    setIsRunning(false)
    setMode(newMode)
    const duration = newMode === 'work' 
      ? settings.workDuration 
      : newMode === 'shortBreak' 
        ? settings.shortBreakDuration 
        : settings.longBreakDuration
    setTimeLeft(duration * 60)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = (): number => {
    const totalDuration = mode === 'work' 
      ? settings.workDuration * 60 
      : mode === 'shortBreak' 
        ? settings.shortBreakDuration * 60 
        : settings.longBreakDuration * 60
    return ((totalDuration - timeLeft) / totalDuration) * 100
  }

  const getModeColor = (): string => {
    switch (mode) {
      case 'work':
        return 'var(--color-primary)'
      case 'shortBreak':
        return 'var(--color-secondary)'
      case 'longBreak':
        return 'var(--color-success)'
      default:
        return 'var(--color-primary)'
    }
  }

  const getModeLabel = (): string => {
    switch (mode) {
      case 'work':
        return 'Focus Time'
      case 'shortBreak':
        return 'Short Break'
      case 'longBreak':
        return 'Long Break'
      default:
        return 'Focus Time'
    }
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // Auto-save session when document changes or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup: save active session when unmounting
      if (user && activePomodoroSessionId && isRunning) {
        const duration = settings.workDuration * 60 - timeLeft
        pomodoroService.stopCurrentSession(false).then(() => {
          setPomodoroSession(null, null, null)
        })
      }
    }
  }, [])

  // Handle document change - pause and save current session
  useEffect(() => {
    const handleDocumentChange = async () => {
      if (user && activePomodoroSessionId && isRunning) {
        // Document changed while timer running - auto-save
        const duration = settings.workDuration * 60 - timeLeft
        await pomodoroService.stopCurrentSession(false)
        setPomodoroSession(null, null, null)
        setIsRunning(false)
      }
    }

    handleDocumentChange()
  }, [documentId])

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-24 z-50 shadow-lg rounded-full p-3 cursor-pointer"
        style={{
          backgroundColor: getModeColor(),
          color: 'white',
        }}
        onClick={() => setIsMinimized(false)}
      >
        <Tooltip content="Open Pomodoro Timer" position="left">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🍅</span>
            <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
          </div>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl shadow-2xl p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `2px solid ${getModeColor()}`,
        width: '320px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 
          className="font-semibold text-lg flex items-center space-x-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <span className="text-xl">🍅</span>
          <span>Pomodoro Timer</span>
        </h3>
        <div className="flex items-center space-x-2">
          <Tooltip content="Minimize" position="left">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip content="Settings" position="left">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
          {onClose && (
            <Tooltip content="Close" position="left">
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {!showSettings ? (
        <>
          {/* Mode Tabs */}
          <div className="flex space-x-2 mb-4">
            <Tooltip content="25 min focus session" position="top">
              <button
                onClick={() => switchMode('work')}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: mode === 'work' ? getModeColor() : 'var(--color-background)',
                  color: mode === 'work' ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                <BookOpen className="w-4 h-4 inline mr-1" />
                Focus
              </button>
            </Tooltip>
            <Tooltip content="5 min short break" position="top">
              <button
                onClick={() => switchMode('shortBreak')}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: mode === 'shortBreak' ? getModeColor() : 'var(--color-background)',
                  color: mode === 'shortBreak' ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                <Coffee className="w-4 h-4 inline mr-1" />
                Short
              </button>
            </Tooltip>
            <Tooltip content="15 min long break" position="top">
              <button
                onClick={() => switchMode('longBreak')}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: mode === 'longBreak' ? getModeColor() : 'var(--color-background)',
                  color: mode === 'longBreak' ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                <Coffee className="w-4 h-4 inline mr-1" />
                Long
              </button>
            </Tooltip>
          </div>

          {/* Timer Display */}
          <div className="text-center mb-4">
            <div
              className="text-sm font-medium mb-2"
              style={{ color: getModeColor() }}
            >
              {getModeLabel()}
            </div>
            <div
              className="text-6xl font-bold font-mono mb-2"
              style={{ color: getModeColor() }}
            >
              {formatTime(timeLeft)}
            </div>
            
            {/* Progress Bar */}
            <div
              className="w-full h-2 rounded-full mb-4"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${getProgress()}%`,
                  backgroundColor: getModeColor(),
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Tooltip content={isRunning ? "Pause" : "Start"} position="top">
              <button
                onClick={toggleTimer}
                className="p-4 rounded-full shadow-lg transition-transform hover:scale-110"
                style={{
                  backgroundColor: getModeColor(),
                  color: 'white',
                }}
              >
                {isRunning ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>
            </Tooltip>
            <Tooltip content="Reset Timer" position="top">
              <button
                onClick={resetTimer}
                className="p-3 rounded-full transition-colors"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            {/* Current Document Info */}
            {documentName && (
              <div className="text-xs p-2 rounded" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-secondary)' }}>
                <div className="flex items-center space-x-1 mb-1">
                  <BookOpen className="w-3 h-3" />
                  <span className="font-medium">Tracking:</span>
                </div>
                <div className="truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {documentName}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm pt-2 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Sessions:</span>{' '}
                <span className="font-bold" style={{ color: getModeColor() }}>
                  {completedSessions}
                </span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                <span className="font-medium">Until long break:</span>{' '}
                <span className="font-bold" style={{ color: getModeColor() }}>
                  {settings.sessionsUntilLongBreak - (completedSessions % settings.sessionsUntilLongBreak)}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Settings Panel */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Focus Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.workDuration}
              onChange={(e) => setSettings({ ...settings, workDuration: parseInt(e.target.value) || 25 })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Short Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.shortBreakDuration}
              onChange={(e) => setSettings({ ...settings, shortBreakDuration: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Long Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.longBreakDuration}
              onChange={(e) => setSettings({ ...settings, longBreakDuration: parseInt(e.target.value) || 15 })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Sessions Until Long Break
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.sessionsUntilLongBreak}
              onChange={(e) => setSettings({ ...settings, sessionsUntilLongBreak: parseInt(e.target.value) || 4 })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStartBreaks}
                onChange={(e) => setSettings({ ...settings, autoStartBreaks: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-start breaks
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStartPomodoros}
                onChange={(e) => setSettings({ ...settings, autoStartPomodoros: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-start focus sessions
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Enable notifications
              </span>
            </label>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: getModeColor(),
              color: 'white',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

