import React, { useState, useEffect } from 'react'
import { useTheme, ThemeSwitcher } from './ThemeProvider'
import { ThemedHeader } from './ThemedHeader'
import { ThemedSidebar } from './ThemedSidebar'
import { ThemedMainContent } from './ThemedMainContent'
import { DocumentViewer } from '../src/components/DocumentViewer'
import { ChatPanel } from '../src/components/ChatPanel'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { PomodoroBottomBar } from '../src/components/PomodoroBottomBar'
import { FloatingActionButtons } from '../src/components/FloatingActionButtons'
import { useAchievementToasts } from '../src/components/AchievementToast'
import { useAppStore } from '../src/store/appStore'
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts'
import { OnboardingProvider, OnboardingOverlay, ContextualHelp } from '../src/components/onboarding'
import { backgroundProcessingService } from '../src/services/backgroundProcessingService'
import { timerService, TimerState } from '../src/services/timerService'

const ThemedAppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [timerState, setTimerState] = useState<TimerState>(timerService.getState())
  const { currentTheme } = useTheme()
  const { isChatOpen, toggleChat, user, currentDocument, pomodoroIsRunning, libraryRefreshTrigger } = useAppStore()
  const { showAchievement, AchievementToastContainer } = useAchievementToasts()
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  // Start background processing service
  useEffect(() => {
    console.log('ThemedApp: Starting background processing service')
    backgroundProcessingService.start()

    // Cleanup on unmount
    return () => {
      console.log('ThemedApp: Stopping background processing service')
      backgroundProcessingService.stop()
    }
  }, [])

  // Subscribe to timer service
  useEffect(() => {
    const unsubscribe = timerService.subscribe(setTimerState)
    return unsubscribe
  }, [])


  return (
    <OnboardingProvider>
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
          refreshTrigger={libraryRefreshTrigger}
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


      {/* Pomodoro Bottom Bar - Visible when user is authenticated, has uploaded a file, and Pomodoro IS running */}
      {user && currentDocument && timerState.isRunning && (
        <PomodoroBottomBar 
          onExpand={() => {
            // Open the full Pomodoro timer in the header
            const pomodoroButton = document.querySelector('[data-tour="pomodoro-button"]') as HTMLElement
            if (pomodoroButton) {
              pomodoroButton.click()
            }
          }}
        />
      )}


      {/* Floating Action Buttons */}
      <FloatingActionButtons />

      {/* Achievement Toast Container */}
      <AchievementToastContainer />

      {/* Onboarding System */}
      <OnboardingOverlay />
      <ContextualHelp />

      {/* Theme Switcher (for development/testing) */}
      <div 
        className="fixed top-24 right-4 z-50"
        style={{ display: process.env.NODE_ENV === 'development' ? 'block' : 'none' }}
      >
        <ThemeSwitcher />
      </div>
      </div>
    </OnboardingProvider>
  )
}

export const ThemedApp: React.FC = () => {
  return <ThemedAppContent />
}

export default ThemedApp
