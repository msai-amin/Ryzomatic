import React, { useRef, useEffect } from 'react'
import { Upload, MessageCircle, Settings, FileText, Library, User, Cloud, LogOut, Menu, Bot, Sparkles, Timer, Home, Sidebar as SidebarIcon, HelpCircle, Volume2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../src/store/appStore'
import { TypographySettings } from '../src/components/TypographySettings'
import { GeneralSettings } from '../src/components/GeneralSettings'
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
    hasSeenPomodoroTour,
    setCurrentDocument
  } = useAppStore()
  const [showSettings, setShowSettings] = React.useState(false)
  const [showGeneralSettings, setShowGeneralSettings] = React.useState(false)
  const [showHelp, setShowHelp] = React.useState(false)
  const [showLibrary, setShowLibrary] = React.useState(false)
  const [showAuth, setShowAuth] = React.useState(false)
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { currentTheme } = useTheme()

  const handleLogout = async () => {
    await logout()
  }
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

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
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg transition-colors"
              style={{
                color: 'var(--color-text-primary)',
                backgroundColor: showMenu ? 'var(--color-surface-hover)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!showMenu) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!showMenu) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div 
                className="absolute left-0 mt-2 w-56 rounded-lg shadow-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  zIndex: 1000
                }}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setCurrentDocument(null)
                      setShowMenu(false)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2"
                    style={{ 
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <Home className="w-4 h-4" />
                    <span>Close Document</span>
                  </button>
                  <button
                    onClick={() => {
                      onSidebarToggle()
                      setShowMenu(false)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2"
                    style={{ 
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <SidebarIcon className="w-4 h-4" />
                    <span>{isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowGeneralSettings(true)
                      setShowMenu(false)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2"
                    style={{ 
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowHelp(true)
                      setShowMenu(false)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2"
                    style={{ 
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Help</span>
                  </button>
                  {user && (
                    <>
                      <div className="border-t my-1" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="px-4 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          <div className="flex items-center space-x-2 mb-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Account</span>
                          </div>
                          <div className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {user.full_name || user.email}
                          </div>
                          {user.tier && (
                            <div className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>
                              {user.tier.toUpperCase()} Plan
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleLogout()
                          setShowMenu(false)
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                        className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2"
                        style={{ 
                          color: '#ef4444'
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
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

      {showGeneralSettings && (
        <GeneralSettings isOpen={showGeneralSettings} onClose={() => setShowGeneralSettings(false)} />
      )}

      {showHelp && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4 overflow-y-auto" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <div 
            className="rounded-xl shadow-xl max-w-4xl w-full mx-4 animate-scale-in my-auto" 
            style={{ 
              backgroundColor: 'var(--color-surface)', 
              border: '1px solid var(--color-border)' 
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Help & Features Guide
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Assistant */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Bot className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      AI Assistant
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Ask questions about your documents and get intelligent answers powered by AI.</p>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>How to use:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Click the "AI Assistant" button in the header</li>
                        <li>Type your question about the current document</li>
                        <li>Get instant answers with relevant context</li>
                        <li>Ask follow-up questions for deeper understanding</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Example questions:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>"What are the main points of this chapter?"</li>
                        <li>"Explain this concept in simpler terms"</li>
                        <li>"What does this paragraph mean?"</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Pomodoro Timer */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Timer className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Pomodoro Timer
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Stay focused and productive with timed work sessions and breaks.</p>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>How to use:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Click the 🍅 tomato icon in the header</li>
                        <li>Start a 25-minute work session</li>
                        <li>Take 5-minute breaks between sessions</li>
                        <li>After 4 sessions, take a 15-minute long break</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Features:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Customizable work and break durations</li>
                        <li>Auto-start options for breaks and sessions</li>
                        <li>Progress tracking and achievements</li>
                        <li>Notifications when sessions end</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Text-to-Speech */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Text-to-Speech (TTS)
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Listen to your documents with natural-sounding voices for better comprehension.</p>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>How to use:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Open a document and click the speaker icon</li>
                        <li>Choose your preferred voice and settings</li>
                        <li>Click play to start reading</li>
                        <li>Adjust speed, pitch, and volume as needed</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Features:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Multiple voice options (Native & Google Cloud)</li>
                        <li>Word highlighting as it reads</li>
                        <li>Auto-advance through paragraphs</li>
                        <li>Customizable reading speed and voice settings</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Note Taking */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Note Taking
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <p>Take structured notes with multiple templates designed for different learning styles.</p>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>How to use:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Click the "+" button next to Notes in the right sidebar</li>
                        <li>Choose from 6 different note templates</li>
                        <li>Set a default template in Settings</li>
                        <li>Export notes in multiple formats</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Note Templates:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-2">
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

              {/* Quick Tips */}
              <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  💡 Quick Tips
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <div>
                    <h4 className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Keyboard Shortcuts:</h4>
                    <ul className="space-y-1">
                      <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">M</kbd> for Reading Mode</li>
                      <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Space</kbd> to play/pause TTS</li>
                      <li>• Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd> to close modals</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Best Practices:</h4>
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

    </header>
  )
}
