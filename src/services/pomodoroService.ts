import { pomodoroSessions, PomodoroSession, PomodoroBookStats } from '../../lib/supabase'

export interface PomodoroSessionData {
  id: string
  bookId: string
  mode: 'work' | 'shortBreak' | 'longBreak'
  startedAt: Date
  endedAt?: Date
  durationSeconds?: number
  completed: boolean
}

export interface DailyStats {
  date: string
  totalSessions: number
  totalMinutes: number
  workSessions: number
  workMinutes: number
  booksStudied: number
}

export interface TimePattern {
  hourOfDay: number
  totalSessions: number
  totalMinutes: number
  averageSessionMinutes: number
}

export interface WeeklyStats {
  weekStart: string
  totalWorkMinutes: number
  totalSessions: number
  uniqueBooks: number
  mostProductiveDay: string
  mostProductiveHour: number
}

class PomodoroService {
  private activeSessionId: string | null = null
  private activeBookId: string | null = null
  private sessionStartTime: number | null = null

  /**
   * Start a new Pomodoro session
   */
  async startSession(
    userId: string, 
    bookId: string, 
    mode: 'work' | 'shortBreak' | 'longBreak'
  ): Promise<PomodoroSessionData | null> {
    try {
      // Close any existing active session first
      if (this.activeSessionId) {
        await this.stopCurrentSession(false) // Mark as incomplete
      }

      const { data, error } = await pomodoroSessions.startSession(userId, bookId, mode)
      
      if (error) {
        console.error('Failed to start Pomodoro session:', error)
        return null
      }

      if (data) {
        this.activeSessionId = data.id
        this.activeBookId = bookId
        this.sessionStartTime = Date.now()
        
        // Store in localStorage for recovery
        this.saveToLocalStorage(data)

        return {
          id: data.id,
          bookId: data.book_id,
          mode: data.mode,
          startedAt: new Date(data.started_at),
          completed: data.completed
        }
      }

      return null
    } catch (error) {
      console.error('Error starting Pomodoro session:', error)
      return null
    }
  }

  /**
   * Stop the current active session
   */
  async stopCurrentSession(completed: boolean = true): Promise<PomodoroSessionData | null> {
    if (!this.activeSessionId || !this.sessionStartTime) {
      console.warn('No active session to stop')
      return null
    }

    try {
      const durationSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000)
      
      const { data, error } = await pomodoroSessions.stopSession(
        this.activeSessionId,
        durationSeconds,
        completed
      )

      if (error) {
        console.error('Failed to stop Pomodoro session:', error)
        // Clear active session even if there was an error
        this.clearActiveSession()
        return null
      }

      // Clear active session
      this.clearActiveSession()

      if (data) {
        return {
          id: data.id,
          bookId: data.book_id,
          mode: data.mode,
          startedAt: new Date(data.started_at),
          endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
          durationSeconds: data.duration_seconds,
          completed: data.completed
        }
      }

      return null
    } catch (error) {
      console.error('Error stopping Pomodoro session:', error)
      // Clear active session even if there was an error
      this.clearActiveSession()
      return null
    }
  }

  /**
   * Pause session (stop but mark as incomplete)
   */
  async pauseSession(): Promise<PomodoroSessionData | null> {
    return this.stopCurrentSession(false)
  }

  /**
   * Get stats for a specific book
   */
  async getBookStats(bookId: string): Promise<PomodoroBookStats | null> {
    try {
      const { data, error } = await pomodoroSessions.getBookStats(bookId)
      
      if (error) {
        console.error('Failed to get book stats:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error getting book stats:', error)
      return null
    }
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(userId: string, daysBack: number = 7): Promise<DailyStats[]> {
    try {
      const { data, error } = await pomodoroSessions.getDailyStats(userId, daysBack)
      
      if (error) {
        console.error('Failed to get daily stats:', error)
        return []
      }

      return (data || []).map((stat: any) => ({
        date: stat.date,
        totalSessions: stat.total_sessions,
        totalMinutes: stat.total_minutes,
        workSessions: stat.work_sessions,
        workMinutes: stat.work_minutes,
        booksStudied: stat.books_studied
      }))
    } catch (error) {
      console.error('Error getting daily stats:', error)
      return []
    }
  }

  /**
   * Get time-of-day patterns
   */
  async getTimePatterns(userId: string, daysBack: number = 30): Promise<TimePattern[]> {
    try {
      const { data, error } = await pomodoroSessions.getTimePatterns(userId, daysBack)
      
      if (error) {
        console.error('Failed to get time patterns:', error)
        return []
      }

      return (data || []).map((pattern: any) => ({
        hourOfDay: pattern.hour_of_day,
        totalSessions: pattern.total_sessions,
        totalMinutes: pattern.total_minutes,
        averageSessionMinutes: pattern.average_session_minutes
      }))
    } catch (error) {
      console.error('Error getting time patterns:', error)
      return []
    }
  }

  /**
   * Get weekly summary
   */
  async getWeeklySummary(userId: string): Promise<WeeklyStats[]> {
    try {
      const { data, error } = await pomodoroSessions.getWeeklySummary(userId)
      
      if (error) {
        console.error('Failed to get weekly summary:', error)
        return []
      }

      return (data || []).map((week: any) => ({
        weekStart: week.week_start,
        totalWorkMinutes: week.total_work_minutes,
        totalSessions: week.total_sessions,
        uniqueBooks: week.unique_books,
        mostProductiveDay: week.most_productive_day,
        mostProductiveHour: week.most_productive_hour
      }))
    } catch (error) {
      console.error('Error getting weekly summary:', error)
      return []
    }
  }

  /**
   * Check for and restore active session from localStorage
   */
  async restoreSession(userId: string): Promise<PomodoroSessionData | null> {
    try {
      const stored = localStorage.getItem('activePomodoroSession')
      if (!stored) return null

      const sessionData = JSON.parse(stored)
      
      // Check if session is still active in database
      const { data, error } = await pomodoroSessions.getActiveSession(userId)
      
      if (error || !data) {
        this.clearActiveSession()
        return null
      }

      // Restore local state
      this.activeSessionId = data.id
      this.activeBookId = data.book_id
      this.sessionStartTime = new Date(data.started_at).getTime()

      return {
        id: data.id,
        bookId: data.book_id,
        mode: data.mode as 'work' | 'shortBreak' | 'longBreak',
        startedAt: new Date(data.started_at),
        completed: false
      }
    } catch (error) {
      console.error('Error restoring session:', error)
      this.clearActiveSession()
      return null
    }
  }

  /**
   * Get current active session info
   */
  getActiveSessionInfo() {
    return {
      sessionId: this.activeSessionId,
      bookId: this.activeBookId,
      startTime: this.sessionStartTime,
      elapsedSeconds: this.sessionStartTime 
        ? Math.floor((Date.now() - this.sessionStartTime) / 1000)
        : 0
    }
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession(): boolean {
    return this.activeSessionId !== null
  }

  /**
   * Check if active session is for specific book
   */
  isActiveForBook(bookId: string): boolean {
    return this.activeBookId === bookId && this.activeSessionId !== null
  }

  /**
   * Clear active session state
   */
  private clearActiveSession() {
    this.activeSessionId = null
    this.activeBookId = null
    this.sessionStartTime = null
    localStorage.removeItem('activePomodoroSession')
  }

  /**
   * Save session to localStorage for recovery
   */
  private saveToLocalStorage(session: PomodoroSession) {
    try {
      localStorage.setItem('activePomodoroSession', JSON.stringify({
        id: session.id,
        bookId: session.book_id,
        mode: session.mode,
        startedAt: session.started_at
      }))
    } catch (error) {
      console.error('Failed to save session to localStorage:', error)
    }
  }
}

export const pomodoroService = new PomodoroService()

