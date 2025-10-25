import { pomodoroService } from './pomodoroService'
import { pomodoroGamificationService } from './pomodoroGamificationService'

export type TimerMode = 'work' | 'shortBreak' | 'longBreak'

export interface TimerSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
  notificationsEnabled: boolean
}

export interface TimerState {
  isRunning: boolean
  timeLeft: number
  mode: TimerMode
  completedSessions: number
  settings: TimerSettings
}

class TimerService {
  private intervalRef: NodeJS.Timeout | null = null
  private state: TimerState = {
    isRunning: false,
    timeLeft: 25 * 60, // 25 minutes in seconds
    mode: 'work',
    completedSessions: 0,
    settings: {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      notificationsEnabled: true
    }
  }

  private listeners: Set<(state: TimerState) => void> = new Set()

  // Subscribe to timer state changes
  subscribe(listener: (state: TimerState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Get current timer state
  getState(): TimerState {
    return { ...this.state }
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()))
  }

  // Start the timer
  async startTimer(userId?: string, documentId?: string): Promise<void> {
    if (this.state.isRunning) return

    // Start Pomodoro session if user and document are provided
    if (userId && documentId && this.state.mode === 'work') {
      try {
        const session = await pomodoroService.startSession(userId, documentId, this.state.mode)
        if (session) {
          console.log('Pomodoro session started:', session.id)
        }
      } catch (error) {
        console.error('Failed to start Pomodoro session:', error)
        return // Don't start timer if session creation fails
      }
    }

    this.state.isRunning = true
    this.notifyListeners()

    // Start countdown
    this.startCountdown(userId, documentId)
  }

  // Pause the timer
  async pauseTimer(userId?: string): Promise<void> {
    if (!this.state.isRunning) return

    // Stop Pomodoro session if user is provided
    if (userId) {
      try {
        await pomodoroService.stopCurrentSession(false) // Mark as incomplete
        console.log('Pomodoro session paused')
      } catch (error) {
        console.error('Failed to pause Pomodoro session:', error)
      }
    }

    this.state.isRunning = false
    this.notifyListeners()

    // Clear countdown
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
    }
  }

  // Reset the timer
  async resetTimer(userId?: string): Promise<void> {
    // Stop active session if running
    if (userId && this.state.isRunning) {
      await pomodoroService.stopCurrentSession(false) // Mark as incomplete
    }

    this.state.isRunning = false
    this.state.timeLeft = this.state.settings.workDuration * 60
    this.state.mode = 'work'
    this.state.completedSessions = 0
    this.notifyListeners()

    // Clear countdown
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
    }
  }

  // Toggle timer (start/pause)
  async toggleTimer(userId?: string, documentId?: string): Promise<void> {
    if (this.state.isRunning) {
      await this.pauseTimer(userId)
    } else {
      await this.startTimer(userId, documentId)
    }
  }

  // Set timer mode
  setMode(mode: TimerMode): void {
    this.state.mode = mode
    this.state.timeLeft = mode === 'work' 
      ? this.state.settings.workDuration * 60 
      : mode === 'shortBreak' 
        ? this.state.settings.shortBreakDuration * 60 
        : this.state.settings.longBreakDuration * 60
    this.notifyListeners()
  }

  // Update settings
  updateSettings(settings: Partial<TimerSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings }
    this.notifyListeners()
  }

  // Start countdown interval
  private startCountdown(userId?: string, documentId?: string): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
    }

    this.intervalRef = setInterval(() => {
      if (this.state.timeLeft <= 1) {
        this.handleTimerComplete(userId, documentId)
      } else {
        this.state.timeLeft -= 1
        this.notifyListeners()
      }
    }, 1000)
  }

  // Handle timer completion
  private async handleTimerComplete(userId?: string, documentId?: string): Promise<void> {
    this.state.isRunning = false

    // Save completed session to database
    if (userId && this.state.mode === 'work') {
      try {
        await pomodoroService.stopCurrentSession(true) // Mark as completed
        console.log('Pomodoro session completed')

        // Check for achievements
        const newAchievements = await pomodoroGamificationService.checkAchievements(userId, {
          bookId: documentId || undefined,
          mode: 'work',
          completed: true
        })

        await pomodoroGamificationService.updateStreak(userId)

        if (newAchievements.length > 0) {
          console.log('New achievements unlocked:', newAchievements)
        }
      } catch (error) {
        console.error('Error completing Pomodoro session:', error)
      }
    }

    // Play notification sound
    if (this.state.settings.notificationsEnabled) {
      // TODO: Implement notification sound
    }

    // Show browser notification
    if (this.state.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const title = this.state.mode === 'work' ? 'Work Session Complete!' : 'Break Time Over!'
      const body = this.state.mode === 'work' 
        ? 'Great job! Time for a break.' 
        : 'Break is over. Ready for another session?'
      
      new Notification(title, { body, icon: '/favicon.ico' })
    }

    // Transition to next mode
    if (this.state.mode === 'work') {
      this.state.completedSessions += 1
      const shouldTakeLongBreak = this.state.completedSessions % this.state.settings.sessionsUntilLongBreak === 0
      const nextMode: TimerMode = shouldTakeLongBreak ? 'longBreak' : 'shortBreak'
      this.setMode(nextMode)
      
      if (this.state.settings.autoStartBreaks) {
        this.state.isRunning = true
        this.startCountdown(userId, documentId)
      }
    } else {
      this.setMode('work')
      
      if (this.state.settings.autoStartPomodoros) {
        this.state.isRunning = true
        this.startCountdown(userId, documentId)
      }
    }

    this.notifyListeners()
  }

  // Cleanup
  destroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
    }
    this.listeners.clear()
  }
}

export const timerService = new TimerService()
