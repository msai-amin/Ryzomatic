import React from 'react'
import { Upload, MessageCircle, Settings, FileText, Library, User, Cloud, LogOut, Menu, Bot, Sparkles, Timer } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { TypographySettings } from '../src/components/TypographySettings'
import { ModernLibraryModal } from '../src/components/ModernLibraryModal'
import { AuthModal } from '../src/components/AuthModal'
import { PomodoroTimer } from '../src/components/PomodoroTimer'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { timerService, TimerState } from '../src/services/timerService'

interface ThemedHeaderProps {
  onUploadClick: () => void
  isSidebarOpen: boolean
  onSidebarToggle: () => void
}

export const ThemedHeader: React.FC<ThemedHeaderProps> = ({ onUploadClick, isSidebarOpen, onSidebarToggle }) => {
  const [timerState, setTimerState] = React.useState<TimerState>(timerService.getState())
  const { 
    toggleChat, 
    currentDocument, 
    isAuthenticated, 
    user, 
    logout,
    libraryRefreshTrigger,
    pdfViewer,
    isChatOpen,
    libraryView,
    pomodoroIsRunning,
    pomodoroTimeLeft,
    hasSeenPomodoroTour
  } = useAppStore()
  const [showSettings, setShowSettings] = React.useState(false)
  const [showLibrary, setShowLibrary] = React.useState(false)
  const [showAuth, setShowAuth] = React.useState(false)

  const { currentTheme } = useTheme()

  const handleLogout = async () => {
    await logout()
  }

  // Subscribe to timer service
  React.useEffect(() => {
    const unsubscribe = timerService.subscribe(setTimerState)
    return unsubscribe
  }, [])


  return (
    <header 
      className="sticky top-0 z-50"
      style={{
        background: 'linear-gradient(180deg, var(--color-surface) 0%, rgba(17, 24, 39, 0.95) 100%)',
        borderBottom: '1px solid var(--color-border)',
        height: 'var(--header-height)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center justify-between h-full">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <Tooltip content="Toggle Sidebar" position="bottom">
            <button 
              onClick={onSidebarToggle}
              className="p-2 rounded-lg transition-colors"
              style={{
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
          
          <div className="flex items-center gap-2">
            <img src="/ryzomatic-logo.png" alt="ryzomatic" className="h-6 w-6" />
            <div 
              className="px-3 py-1 font-bold text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.05em',
                fontWeight: '600',
              }}
            >
              ryzomatic
            </div>
          </div>
        </div>

        {/* Document Info */}
        {currentDocument && (
          <div 
            className="flex items-center space-x-2 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <FileText className="w-4 h-4" />
            <span className="truncate max-w-xs">{currentDocument.name}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Search Button */}
          <Tooltip content="Search Documents" position="bottom">
            <button 
              className="p-2 rounded-lg transition-colors"
              style={{
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Search Documents"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </Tooltip>

          {/* Visual Separator */}
          <div 
            className="w-px h-6"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-hidden="true"
          />

          {/* Show Library and Upload only when user is signed in */}
          {user && (
            <>
              <Tooltip content="View Library" position="bottom">
                <button
                  data-tour="library-button"
                  onClick={() => setShowLibrary(true)}
                  className="btn-secondary flex items-center space-x-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-lg)',
                  }}
                  aria-label="View Library"
                >
                  <Library className="w-4 h-4" />
                  <span>Library</span>
                </button>
              </Tooltip>

              <Tooltip 
                content={
                  libraryView.selectedBooks.length > 0 
                    ? "Please deselect books to upload" 
                    : "Upload New Document"
                } 
                position="bottom"
              >
                <button
                  data-tour="upload-button"
                  onClick={onUploadClick}
                  disabled={libraryView.selectedBooks.length > 0}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                    border: 'none',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-lg)',
                    opacity: libraryView.selectedBooks.length > 0 ? 0.5 : 1,
                    cursor: libraryView.selectedBooks.length > 0 ? 'not-allowed' : 'pointer',
                  }}
                  aria-label="Upload New Document"
                >
                  <Upload className="w-4 h-4" />
                  <span>New Material</span>
                </button>
              </Tooltip>

              {/* Visual Separator */}
              <div 
                className="w-px h-6"
                style={{ backgroundColor: 'var(--color-border)' }}
                aria-hidden="true"
              />
            </>
          )}
          
          {/* Settings Button - Only show in Reading Mode */}
          {pdfViewer.readingMode && (
            <Tooltip content="Settings" position="bottom">
              <button
                data-tour="settings-button"
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </Tooltip>
          )}

          {/* Pomodoro Timer Button - Only show when user is authenticated, has a document, and Pomodoro is NOT running */}
          {user && currentDocument && !timerState.isRunning && (
            <Tooltip content={pomodoroIsRunning ? `Timer Running: ${Math.floor((pomodoroTimeLeft || 0) / 60)}:${String((pomodoroTimeLeft || 0) % 60).padStart(2, '0')}` : "Pomodoro Timer - Stay Focused"} position="bottom">
              <button
                data-tour="pomodoro-button"
                onClick={() => timerService.toggleTimer(user?.id, currentDocument?.id)}
                className={`p-2 rounded-lg transition-all duration-300 text-2xl leading-none relative ${
                  !hasSeenPomodoroTour ? 'animate-pulse ring-2 ring-blue-500 ring-opacity-50' : ''
                }`}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                }}
                aria-label={pomodoroIsRunning ? `Pomodoro Timer Running: ${Math.floor((pomodoroTimeLeft || 0) / 60)}:${String((pomodoroTimeLeft || 0) % 60).padStart(2, '0')}` : "Open Pomodoro Timer"}
              >
                🍅
              </button>
            </Tooltip>
          )}

          {/* AI Assistant Button */}
          <Tooltip content="AI Assistant - Ask questions about your documents" position="bottom">
            <button
              data-tour="ai-assistant-button"
              onClick={() => toggleChat()}
              className={`btn-primary flex items-center space-x-2 transition-all duration-200 ${
                isChatOpen ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
              style={{
                backgroundColor: isChatOpen ? 'var(--color-primary-light)' : 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-lg)',
              }}
              aria-label="Open AI Assistant"
            >
              <Bot className="w-4 h-4" />
              <span>AI Assistant</span>
              {isChatOpen && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
          </Tooltip>

          {/* Visual Separator */}
          <div 
            className="w-px h-6"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-hidden="true"
          />

          {/* Auth Button */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-4">
              <Tooltip content={`Signed in as ${user.full_name || user.email}`} position="bottom">
                <div 
                  className="flex items-center space-x-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {user.full_name || user.email}
                  </span>
                  <span 
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary-dark)',
                    }}
                  >
                    {user.tier?.toUpperCase()}
                  </span>
                </div>
              </Tooltip>
              <Tooltip content="Sign Out" position="bottom">
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-error)',
                    border: '1px solid var(--color-error)',
                  }}
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip content="Sign in to access all features" position="bottom">
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="Sign In"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            </Tooltip>
          )}

        </div>
      </div>

      {/* Modals */}
      {showAuth && (
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)} 
          onAuthSuccess={() => setShowAuth(false)}
        />
      )}

      {showLibrary && (
        <ModernLibraryModal 
          isOpen={showLibrary} 
          onClose={() => setShowLibrary(false)} 
          refreshTrigger={libraryRefreshTrigger}
        />
      )}

      {showSettings && (
        <TypographySettings onClose={() => setShowSettings(false)} />
      )}

    </header>
  )
}
