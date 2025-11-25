import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload,
  Settings,
  User,
  LogOut,
  Sparkles,
  Timer,
  HelpCircle,
  ChevronDown,
  X,
  FileText,
  Volume2,
  StickyNote,
  Library,
  PenTool
} from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { TypographySettings } from '../src/components/TypographySettings'
import { GeneralSettings } from '../src/components/GeneralSettings'
import { LibraryModal } from '../src/components/LibraryModal'
import { AuthModal } from '../src/components/AuthModal'
import { Tooltip } from '../src/components/Tooltip'
import { timerService, TimerState } from '../src/services/timerService'
import { UnsavedChangesDialog } from '../src/components/UnsavedChangesDialog'

interface ThemedHeaderProps {
  onUploadClick: () => void
  isSidebarOpen: boolean
}

export const ThemedHeader: React.FC<ThemedHeaderProps> = ({ onUploadClick, isSidebarOpen }) => {
  const headerRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userButtonRef = useRef<HTMLButtonElement>(null)
  const [timerState, setTimerState] = useState<TimerState>(timerService.getState())
  const {
    toggleChat,
    currentDocument,
    isAuthenticated,
    user,
    logout,
    libraryRefreshTrigger,
    pdfViewer,
    isChatOpen,
    hasSeenPomodoroTour,
    setCurrentDocument,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    setRightSidebarTab,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    closeDocumentWithoutSaving,
    isEditorialMode,
    setEditorialMode,
    audioWidgetVisible,
    setAudioWidgetVisible
  } = useAppStore()

  const [showSettings, setShowSettings] = useState(false)
  const [showGeneralSettings, setShowGeneralSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const handleLogout = async () => {
    await logout()
    setIsUserMenuOpen(false)
  }

  // Handle logo click to return to main UI
  const handleLogoClick = () => {
    if (!currentDocument) {
      // No document open, nothing to do
      return
    }

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      // No unsaved changes, close document immediately
      setCurrentDocument(null)
    }
  }

  // Save changes and close document
  const handleSaveAndClose = async () => {
    // Note: In the current implementation, changes are auto-saved
    // (highlights, notes, reading position, TTS position)
    // So we just need to mark as saved and close
    setHasUnsavedChanges(false)
    setShowUnsavedDialog(false)
    setCurrentDocument(null)
  }

  // Discard changes and close document
  const handleDiscardAndClose = () => {
    closeDocumentWithoutSaving()
    setShowUnsavedDialog(false)
  }

  // Cancel close operation
  const handleCancelClose = () => {
    setShowUnsavedDialog(false)
  }

  useEffect(() => {
    const unsubscribe = timerService.subscribe(setTimerState)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const updateHeaderHeight = () => {
      const height = headerRef.current?.getBoundingClientRect().height ?? 80
      document.documentElement.style.setProperty('--header-height', `${Math.ceil(height)}px`)
    }

    updateHeaderHeight()

    const resizeHandler = () => updateHeaderHeight()
    window.addEventListener('resize', resizeHandler)

    let observer: ResizeObserver | undefined
    if (headerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateHeaderHeight())
      observer.observe(headerRef.current)
    }

    return () => {
      window.removeEventListener('resize', resizeHandler)
      observer?.disconnect()
    }
  }, [currentDocument, isUserMenuOpen, isSidebarOpen, isAuthenticated, user])

  useEffect(() => {
    if (!isUserMenuOpen || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (userMenuRef.current?.contains(target) || userButtonRef.current?.contains(target)) {
        return
      }
      setIsUserMenuOpen(false)
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOpenLibrary = () => setShowLibrary(true)
    window.addEventListener('app:open-library', handleOpenLibrary as EventListener)
    return () => {
      window.removeEventListener('app:open-library', handleOpenLibrary as EventListener)
    }
  }, [])

  const workDurationSeconds = timerState.settings.workDuration * 60
  const isTimerPristine =
    !timerState.isRunning &&
    timerState.mode === 'work' &&
    timerState.timeLeft === workDurationSeconds

  const openLibrary = () => {
    if (user) {
      setShowLibrary(true)
    } else {
      setShowAuth(true)
    }
  }

  const tierLabel = useMemo(() => user?.tier?.toUpperCase() ?? 'STANDARD', [user?.tier])


  return (
    <>
    <header
      ref={headerRef}
      className="sticky top-0 z-50"
      style={{
        background: 'linear-gradient(180deg, var(--color-surface) 0%, rgba(17, 24, 39, 0.95) 100%)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-all hover:bg-[var(--color-surface-hover)] active:scale-95 cursor-pointer"
              style={{ color: 'var(--color-text-primary)' }}
              aria-label="Return to main view"
              title="Return to main view"
            >
              <img src="/ryzomatic-logo.png" alt="ryzomatic" className="h-6 w-6" />
              <span className="text-sm font-semibold tracking-[0.18em]" style={{ color: 'var(--color-text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                ryzomatic
              </span>
            </button>
            
            {/* Navigation: Library */}
            <nav className="flex items-center gap-1">
              <button
                onClick={openLibrary}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{ 
                  color: !currentDocument ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}
                aria-label="Open Library"
              >
                <Library className="h-4 w-4" />
                <span>Library</span>
              </button>
              
              {/* Navigation: Peer Review */}
              {currentDocument && (
                <button
                  onClick={() => setEditorialMode(!isEditorialMode)}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={{ 
                    color: isEditorialMode ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    backgroundColor: isEditorialMode ? 'var(--color-surface-hover)' : 'transparent',
                  }}
                  aria-label="Toggle Peer Review Mode"
                >
                  <PenTool className="h-4 w-4" />
                  <span>Peer Review</span>
                </button>
              )}
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 sm:flex-nowrap">
            {/* Tools Group: Pomodoro + AI Assistant */}
            <div className="flex items-center gap-2">
              {user && currentDocument && (
                <>
                  {/* Audio Widget Toggle - Show when widget is closed */}
                  {!audioWidgetVisible && !isEditorialMode && (
                    <Tooltip content="Open Audio Widget" position="bottom">
                      <button
                        onClick={() => setAudioWidgetVisible(true)}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-[var(--color-surface-hover)]"
                        style={{ 
                          backgroundColor: 'transparent', 
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                        aria-label="Open Audio Widget"
                      >
                        <Volume2 className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Audio</span>
                      </button>
                    </Tooltip>
                  )}
                  
                  {/* Editorial Mode Audio Controls - Show reopen button when audio widget is closed */}
                  {isEditorialMode && !audioWidgetVisible && (
                    <Tooltip content="Open Audio Widget" position="bottom">
                      <button
                        onClick={() => setAudioWidgetVisible(true)}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-[var(--color-surface-hover)]"
                        style={{ 
                          backgroundColor: 'transparent', 
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                        aria-label="Open Audio Widget"
                      >
                        <Volume2 className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Audio</span>
                      </button>
                    </Tooltip>
                  )}
                </>
              )}
              
              {user && currentDocument && isTimerPristine && (
                <Tooltip content="Start Pomodoro timer" position="bottom">
                  <button
                    data-tour="pomodoro-button"
                    onClick={() => timerService.toggleTimer(user?.id, currentDocument?.id)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                    style={{ 
                      backgroundColor: 'transparent', 
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      fontSize: '1.35rem' 
                    }}
                    aria-label="Toggle Pomodoro timer"
                  >
                    🍅
                  </button>
                </Tooltip>
              )}

              <Tooltip content="Ask the AI Assistant" position="bottom">
                <button
                  data-tour="ai-assistant-button"
                  onClick={() => toggleChat()}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    isChatOpen ? 'bg-[var(--color-primary-light)] ring-2 ring-blue-500/60' : ''
                  }`}
                  style={{
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    boxShadow: isChatOpen
                      ? '0 8px 20px rgba(56, 189, 248, 0.25)'
                      : '0 6px 16px rgba(148, 163, 184, 0.18)',
                    background:
                      'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(236, 72, 153, 0.08))'
                  }}
                  aria-pressed={isChatOpen}
                  aria-expanded={isChatOpen}
                  aria-label="Toggle AI assistant"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>AI Chat</span>
                </button>
              </Tooltip>
            </div>

            {/* Actions Group: New Material */}
            {user && (
              <div className="flex items-center gap-2">
                <Tooltip content="Upload new material" position="bottom">
                  <button
                    data-tour="upload-button"
                    onClick={onUploadClick}
                    className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                      border: 'none',
                      boxShadow: '0 12px 28px rgba(56, 189, 248, 0.22)'
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    <span>New Material</span>
                  </button>
                </Tooltip>
              </div>
            )}

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  ref={userButtonRef}
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1 px-2 py-1 text-sm font-medium transition-colors hover:text-[var(--color-primary)]"
                  style={{ color: 'var(--color-text-primary)' }}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <span className="max-w-[180px] truncate">
                    {user.full_name || user.email}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div
                    ref={userMenuRef}
                    className="absolute right-0 mt-2 w-64 rounded-lg border shadow-lg"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)'
                    }}
                    role="menu"
                  >
                    <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {user.full_name || user.email}
                      </p>
                      <span
                        className="mt-1 inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: 'var(--color-primary-light)',
                          color: 'var(--color-primary-dark)'
                        }}
                      >
                        {tierLabel} Plan
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowGeneralSettings(true)
                          setIsUserMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <User className="h-4 w-4" />
                        <span>Account</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowSettings(true)
                          setIsUserMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowHelp(true)
                          setIsUserMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <HelpCircle className="h-4 w-4" />
                        <span>Help</span>
                      </button>
                      <button
                        onClick={() => {
                          openLibrary()
                          setIsUserMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Library className="h-4 w-4" />
                        <span>Library</span>
                      </button>
                      <button
                        onClick={() => {
                          onUploadClick()
                          setIsUserMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Upload className="h-4 w-4" />
                        <span>New Material</span>
                      </button>
                    </div>
                    <div className="border-t px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Tooltip content="Sign in to access all features" position="bottom">
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                  aria-label="Sign in"
                >
                  <User className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {currentDocument && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 mt-3"
            style={{
              borderColor: 'var(--color-border)',
              paddingTop: 'var(--spacing-md)'
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="truncate text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {currentDocument.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {pdfViewer.readingMode && (
                <Tooltip content="Reader settings" position="bottom">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-1 text-sm transition-colors"
                    style={{
                      color: 'var(--color-text-primary)',
                      borderColor: 'var(--color-border)'
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Typography</span>
                  </button>
                </Tooltip>
              )}

              <Tooltip
                content={isRightSidebarOpen ? 'Hide notes & highlights' : 'Show notes & highlights'}
                position="bottom"
              >
                <button
                  onClick={() => {
                    const nextOpen = !isRightSidebarOpen
                    setIsRightSidebarOpen(nextOpen)
                    if (nextOpen) {
                      setRightSidebarTab('notes')
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1 text-sm transition-colors"
                  style={{
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border)'
                  }}
                >
                  <StickyNote className="h-4 w-4" />
                  <span>{isRightSidebarOpen ? 'Hide Panel' : 'Notes & Highlights'}</span>
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </header>

      {showAuth && (
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onAuthSuccess={() => setShowAuth(false)}
        />
      )}

      {showLibrary && (
        <LibraryModal
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
          refreshTrigger={libraryRefreshTrigger}
        />
      )}

      {showSettings && <TypographySettings onClose={() => setShowSettings(false)} />}

      {showGeneralSettings && (
        <GeneralSettings
          isOpen={showGeneralSettings}
          onClose={() => setShowGeneralSettings(false)}
        />
      )}

      {showHelp &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          >
            <div
              className="my-auto w-full max-w-4xl animate-scale-in rounded-xl shadow-xl"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)'
              }}
            >
              <div
                className="flex items-center justify-between border-b p-6"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <h2
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Help & Features Guide
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Sparkles className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        AI Assistant
                      </h3>
                    </div>
                    <div
                      className="space-y-3 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <p>
                        Ask questions about your documents and get intelligent answers powered by AI.
                      </p>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          How to use:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Click the "AI Assistant" button in the header</li>
                          <li>Type your question about the current document</li>
                          <li>Get instant answers with relevant context</li>
                          <li>Ask follow-up questions for deeper understanding</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Example questions:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>"What are the main points of this chapter?"</li>
                          <li>"Explain this concept in simpler terms"</li>
                          <li>"What does this paragraph mean?"</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Timer className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Pomodoro Timer
                      </h3>
                    </div>
                    <div
                      className="space-y-3 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <p>Stay focused and productive with timed work sessions and breaks.</p>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          How to use:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Click the 🍅 tomato icon in the header</li>
                          <li>Start a 25-minute work session</li>
                          <li>Take 5-minute breaks between sessions</li>
                          <li>After 4 sessions, take a 15-minute long break</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Features:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Customizable work and break durations</li>
                          <li>Auto-start options for breaks and sessions</li>
                          <li>Progress tracking and achievements</li>
                          <li>Notifications when sessions end</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Text-to-Speech (TTS)
                      </h3>
                    </div>
                    <div
                      className="space-y-3 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <p>Listen to your documents with natural-sounding voices for better comprehension.</p>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          How to use:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Open a document and click the speaker icon</li>
                          <li>Choose your preferred voice and settings</li>
                          <li>Click play to start reading</li>
                          <li>Adjust speed, pitch, and volume as needed</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Features:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Multiple voice options (Native & Google Cloud)</li>
                          <li>Word highlighting as it reads</li>
                          <li>Auto-advance through paragraphs</li>
                          <li>Customizable reading speed and voice settings</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Note Taking
                      </h3>
                    </div>
                    <div
                      className="space-y-3 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <p>Take structured notes with multiple templates designed for different learning styles.</p>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          How to use:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li>Click the "+" button next to Notes in the right sidebar</li>
                          <li>Choose from 6 different note templates</li>
                          <li>Set a default template in Settings</li>
                          <li>Export notes in multiple formats</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Note Templates:
                        </h4>
                        <ul className="ml-2 list-disc space-y-1">
                          <li><strong>Freeform:</strong> Simple text notes</li>
                          <li><strong>Cornell:</strong> Cue column + Notes + Summary</li>
                          <li><strong>Outline:</strong> Hierarchical structure</li>
                          <li><strong>Mind Map:</strong> Central topic with branches</li>
                          <li><strong>Chart:</strong> Comparison tables</li>
                          <li><strong>Boxing:</strong> Grouped concepts in boxes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-8 rounded-lg p-4"
                  style={{ backgroundColor: 'var(--color-background)' }}
                >
                  <h3
                    className="mb-3 text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    💡 Quick Tips
                  </h3>
                  <div
                    className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <div>
                      <h4
                        className="mb-2 font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Keyboard Shortcuts:
                      </h4>
                      <ul className="space-y-1">
                        <li>
                          • Press <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs dark:bg-gray-700">M</kbd> for
                          Reading Mode
                        </li>
                        <li>
                          • Press <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs dark:bg-gray-700">Space</kbd>{' '}
                          to play/pause TTS
                        </li>
                        <li>
                          • Press <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs dark:bg-gray-700">Esc</kbd>{' '}
                          to close modals
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4
                        className="mb-2 font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Best Practices:
                      </h4>
                      <ul className="space-y-1">
                        <li>• Use Pomodoro for focused reading sessions</li>
                        <li>• Combine TTS with note-taking for better retention</li>
                        <li>• Ask AI questions while reading for deeper understanding</li>
                        <li>• Try different note templates for different content types</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSave={handleSaveAndClose}
        onDiscard={handleDiscardAndClose}
        onCancel={handleCancelClose}
        documentName={currentDocument?.name}
      />
    </>
  )
}
