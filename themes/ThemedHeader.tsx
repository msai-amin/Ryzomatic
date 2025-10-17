import React from 'react'
import { Upload, MessageCircle, Settings, FileText, Library, User, Cloud, LogOut, Menu } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { TypographySettings } from '../src/components/TypographySettings'
import { LibraryModal } from '../src/components/LibraryModal'
import { AuthModal } from '../src/components/AuthModal'
import { PomodoroTimer } from '../src/components/PomodoroTimer'
import { TomatoIcon } from '../src/components/TomatoIcon'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'

export const ThemedHeader: React.FC = () => {
  const { 
    toggleChat, 
    currentDocument, 
    isAuthenticated, 
    user, 
    logout,
    libraryRefreshTrigger
  } = useAppStore()
  const [showUpload, setShowUpload] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showLibrary, setShowLibrary] = React.useState(false)
  const [showAuth, setShowAuth] = React.useState(false)
  const [showPomodoro, setShowPomodoro] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)

  const { currentTheme } = useTheme()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header 
      className="sticky top-0 z-40"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        height: 'var(--header-height)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
      }}
    >
      <div className="flex items-center justify-between h-full">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <Tooltip content="Toggle Sidebar" position="bottom">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              style={{
                color: 'var(--color-text-primary)',
              }}
            >
              <Menu className="w-5 h-5" />
            </button>
          </Tooltip>
          
          <div 
            className="px-3 py-1 font-bold text-sm rounded-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            Academic Reader Pro
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
        <div className="flex items-center space-x-3">
          {/* Search Button */}
          <Tooltip content="Search Documents" position="bottom">
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </Tooltip>

          {/* Show Library and Upload only when user is signed in */}
          {user && (
            <>
              <Tooltip content="View Library" position="bottom">
                <button
                  onClick={() => setShowLibrary(true)}
                  className="btn-secondary flex items-center space-x-2"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-lg)',
                  }}
                >
                  <Library className="w-4 h-4" />
                  <span>Library</span>
                </button>
              </Tooltip>

              <Tooltip content="Upload New Document" position="bottom">
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn-primary flex items-center space-x-2"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                    border: 'none',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: 'var(--border-radius-lg)',
                  }}
                >
                  <Upload className="w-4 h-4" />
                  <span>New Material</span>
                </button>
              </Tooltip>
            </>
          )}
          
          <Tooltip content="Reading Settings" position="bottom">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>

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
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            </Tooltip>
          )}
          
          <Tooltip content="Pomodoro Timer - Stay Focused 🍅" position="bottom">
            <button
              onClick={() => setShowPomodoro(!showPomodoro)}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: showPomodoro ? 'var(--color-primary-light)' : 'transparent',
                color: showPomodoro ? '#dc2626' : '#ef4444', // Tomato red color
                border: showPomodoro ? '2px solid var(--color-primary)' : 'none',
              }}
            >
              <TomatoIcon size={20} className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Text-to-Speech & AI Assistant" position="bottom">
            <button
              onClick={toggleChat}
              className="btn-primary flex items-center space-x-2"
              style={{
                backgroundColor: 'var(--color-secondary)',
                color: 'var(--color-text-inverse)',
                border: 'none',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-lg)',
              }}
            >
              <MessageCircle className="w-4 h-4" />
              <span>TTS</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Pomodoro Timer - Positioned in top right for easy access */}
      {showPomodoro && (
        <div className="absolute top-16 right-4 z-50">
          <PomodoroTimer onClose={() => setShowPomodoro(false)} />
        </div>
      )}

      {/* Modals */}
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

      {showUpload && (
        <DocumentUpload onClose={() => setShowUpload(false)} />
      )}
      
      {showSettings && (
        <TypographySettings onClose={() => setShowSettings(false)} />
      )}
    </header>
  )
}
