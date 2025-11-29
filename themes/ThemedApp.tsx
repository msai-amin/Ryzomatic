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
import { OnboardingProvider, SpotlightTour, useOnboarding } from '../src/components/onboarding'
import { backgroundProcessingService } from '../src/services/backgroundProcessingService'
import { timerService, TimerState } from '../src/services/timerService'
import { CustomizableReadingWizard } from '../src/components/customReading/CustomizableReadingWizard'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { AudioWidget } from '../src/components/AudioWidget'
import { EditorialLayout } from '../src/components/Editorial/EditorialLayout'
import { supabaseStorageService } from '../src/services/supabaseStorageService'

// Wrapper component to use onboarding hook
const SpotlightTourWrapper: React.FC = () => {
  const { tourSteps, handleTourAction } = useOnboarding()
  return <SpotlightTour steps={tourSteps} onAction={handleTourAction} />
}

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
    openCustomReadingWizard,
    isEditorialMode,
    audioWidgetVisible,
    setCurrentDocument
  } = useAppStore()
  const { showAchievement, AchievementToastContainer } = useAchievementToasts()
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  // Restore document from localStorage on page load
  useEffect(() => {
    const restoreDocument = async () => {
      // Only restore if user is authenticated and no document is currently loaded
      if (!user?.id || currentDocument) {
        return
      }

      try {
        const savedDocumentId = window.localStorage.getItem('currentDocumentId')
        if (!savedDocumentId) {
          return
        }

        console.log('ThemedApp: Restoring document from localStorage:', savedDocumentId)
        
        // Load the document from Supabase storage
        const book = await supabaseStorageService.getBook(savedDocumentId)
        if (!book) {
          console.warn('ThemedApp: Saved document not found, clearing localStorage')
          window.localStorage.removeItem('currentDocumentId')
          return
        }

        // Convert the book to a document format
        const safePageTexts = Array.isArray(book.pageTexts) 
          ? book.pageTexts.map((text: any) => typeof text === 'string' ? text : String(text || ''))
          : []
        const safeCleanedPageTexts = Array.isArray(book.cleanedPageTexts)
          ? book.cleanedPageTexts.map((text: any) => typeof text === 'string' ? text : String(text || ''))
          : []

        const doc = {
          id: book.id,
          name: book.title || book.name || 'Untitled',
          type: book.type || 'pdf',
          content: '',
          uploadedAt: book.uploadedAt || new Date(),
          pdfData: book.fileData,
          totalPages: book.totalPages,
          currentPage: book.lastReadPage || 1,
          pageTexts: safePageTexts,
          cleanedPageTexts: safeCleanedPageTexts
        }

        console.log('ThemedApp: Restored document:', {
          id: doc.id,
          name: doc.name,
          type: doc.type,
          hasPdfData: !!doc.pdfData,
          totalPages: doc.totalPages,
          currentPage: doc.currentPage
        })

        setCurrentDocument(doc as any)
      } catch (error) {
        console.error('ThemedApp: Failed to restore document:', error)
        // Clear invalid document ID from localStorage
        try {
          window.localStorage.removeItem('currentDocumentId')
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }

    restoreDocument()
  }, [user?.id, currentDocument, setCurrentDocument])

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
        {isEditorialMode ? (
          <main className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden relative">
             <EditorialLayout />
          </main>
        ) : (
        <ThemedMainContent>
          <DocumentViewer onUploadClick={handleOpenUpload} />
        </ThemedMainContent>
        )}
      </div>

      {isChatOpen && <DetachedChatWindow />}

      <CustomizableReadingWizard />
      {showUploadModal && (
        <DocumentUpload onClose={() => setShowUploadModal(false)} />
      )}
      
      {/* AudioWidget - Persistent across re-renders, only visible when document is loaded */}
      {currentDocument && !isEditorialMode && audioWidgetVisible && <AudioWidget />}

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
      <SpotlightTourWrapper />

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
