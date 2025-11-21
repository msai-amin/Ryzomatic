import React, { useEffect, useState } from 'react'
import { useTheme, ThemeSwitcher } from './ThemeProvider'
import { ThemedHeader } from './ThemedHeader'
import { ThemedSidebar } from './ThemedSidebar'
import { ThemedMainContent } from './ThemedMainContent'
import { DocumentViewer } from '../src/components/DocumentViewer'
import { PomodoroBottomBar } from '../src/components/PomodoroBottomBar'
import { DetachedChatWindow } from '../src/components/DetachedChatWindow'
import { useAchievementToasts } from '../src/components/AchievementToast'
import { useAppStore } from '../src/store/appStore'
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts'
import { OnboardingProvider, OnboardingOverlay, ContextualHelp } from '../src/components/onboarding'
import { backgroundProcessingService } from '../src/services/backgroundProcessingService'
import { timerService, TimerState } from '../src/services/timerService'
import { CustomizableReadingWizard } from '../src/components/customReading/CustomizableReadingWizard'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { AudioWidget } from '../src/components/AudioWidget'

const ThemedAppContent: React.FC = () => {
  const [timerState, setTimerState] = useState<TimerState>(timerService.getState())
  const { currentTheme } = useTheme()
  const {
    user,
    currentDocument,
    pomodoroIsRunning,
    libraryRefreshTrigger,
    isNavRailExpanded,
    setNavRailExpanded,
    isChatOpen,
    openCustomReadingWizard
  } = useAppStore()
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

  const [showUploadModal, setShowUploadModal] = useState(false)

  const handleOpenUpload = () => setShowUploadModal(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleEventUpload = () => handleOpenUpload()
    window.addEventListener('app:open-upload', handleEventUpload as EventListener)
    return () => {
      window.removeEventListener('app:open-upload', handleEventUpload as EventListener)
    }
  }, [])

  // Subscribe to timer service
  useEffect(() => {
    const unsubscribe = timerService.subscribe(setTimerState)
    return unsubscribe
  }, [])


  const workDurationSeconds = timerState.settings.workDuration * 60
  const isTimerPristine =
    !timerState.isRunning &&
    timerState.mode === 'work' &&
    timerState.timeLeft === workDurationSeconds
  const hasActiveTimer = !isTimerPristine

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
        onUploadClick={handleOpenUpload} 
        isSidebarOpen={isNavRailExpanded}
      />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <ThemedSidebar 
          isOpen={isNavRailExpanded} 
          onToggle={() => setNavRailExpanded(!isNavRailExpanded)}
          refreshTrigger={libraryRefreshTrigger}
        />

        {/* Main Content */}
        <ThemedMainContent>
          <DocumentViewer onUploadClick={handleOpenUpload} />
        </ThemedMainContent>
      </div>

      {isChatOpen && <DetachedChatWindow />}

      <CustomizableReadingWizard />
      {showUploadModal && (
        <DocumentUpload onClose={() => setShowUploadModal(false)} />
      )}
      
      {/* Audio Widget - Rendered at app level to be visible in all modes */}
      {/* DEBUG: Test if this section renders at all */}
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        right: '20px', 
        background: 'red', 
        color: 'white', 
        padding: '10px', 
        zIndex: 999999,
        border: '3px solid yellow'
      }}>
        DEBUG: ThemedApp rendering - AudioWidget should be below this
      </div>
      <AudioWidget />

      {/* Pomodoro Bottom Bar - Visible when there is an active or paused session */}
      {user && currentDocument && hasActiveTimer && (
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
