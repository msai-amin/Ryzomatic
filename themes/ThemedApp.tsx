import React, { useState, useEffect } from 'react'
import { useTheme, ThemeSwitcher } from './ThemeProvider'
import { ThemedHeader } from './ThemedHeader'
import { ThemedSidebar } from './ThemedSidebar'
import { ThemedMainContent } from './ThemedMainContent'
import { DocumentViewer } from '../src/components/DocumentViewer'
import { ChatPanel } from '../src/components/ChatPanel'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { FeatureTour } from '../src/components/FeatureTour'
import { PomodoroFloatingWidget } from '../src/components/PomodoroFloatingWidget'
import { useAchievementToasts } from '../src/components/AchievementToast'
import { useAppStore } from '../src/store/appStore'
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts'

const ThemedAppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const { currentTheme } = useTheme()
  const { isChatOpen, toggleChat, hasSeenPomodoroTour, user, currentDocument, pomodoroIsRunning } = useAppStore()
  const { showAchievement, AchievementToastContainer } = useAchievementToasts()
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  // Show tour for first-time users
  useEffect(() => {
    if (user && !hasSeenPomodoroTour && currentDocument) {
      // Small delay to ensure UI is fully rendered
      const timer = setTimeout(() => {
        setShowTour(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [user, hasSeenPomodoroTour, currentDocument])

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family-sans)',
      }}
    >
      {/* Header */}
      <ThemedHeader 
        onUploadClick={() => setShowUpload(true)} 
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <ThemedSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        />

        {/* Main Content */}
        <ThemedMainContent>
          <DocumentViewer onUploadClick={() => setShowUpload(true)} />
        </ThemedMainContent>
      </div>

      {/* Chat Panel */}
      {isChatOpen && (
        <ChatPanel onClose={() => toggleChat()} />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <DocumentUpload onClose={() => setShowUpload(false)} />
      )}

      {/* Feature Tour */}
      <FeatureTour 
        isOpen={showTour}
        onClose={() => setShowTour(false)}
        onComplete={() => setShowTour(false)}
      />

      {/* Pomodoro Floating Widget - Always visible when user is authenticated */}
      {user && (
        <PomodoroFloatingWidget 
          onExpand={() => {
            // This could open the full Pomodoro timer in the header
            // For now, we'll just focus on the header button
            const pomodoroButton = document.querySelector('[data-tour="pomodoro-button"]') as HTMLElement
            if (pomodoroButton) {
              pomodoroButton.click()
            }
          }}
        />
      )}

      {/* Achievement Toast Container */}
      <AchievementToastContainer />

      {/* Theme Switcher (for development/testing) */}
      <div 
        className="fixed top-20 right-4 z-50"
        style={{ display: process.env.NODE_ENV === 'development' ? 'block' : 'none' }}
      >
        <ThemeSwitcher />
      </div>
    </div>
  )
}

export const ThemedApp: React.FC = () => {
  return <ThemedAppContent />
}

export default ThemedApp
