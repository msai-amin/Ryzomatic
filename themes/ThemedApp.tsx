import React, { useState } from 'react'
import { useTheme, ThemeSwitcher } from './ThemeProvider'
import { ThemedHeader } from './ThemedHeader'
import { ThemedSidebar } from './ThemedSidebar'
import { ThemedMainContent } from './ThemedMainContent'
import { DocumentViewer } from '../src/components/DocumentViewer'
import { ChatPanel } from '../src/components/ChatPanel'
import { DocumentUpload } from '../src/components/DocumentUpload'
import { useAppStore } from '../src/store/appStore'
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts'

const ThemedAppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const { currentTheme } = useTheme()
  const { isChatOpen, toggleChat } = useAppStore()
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts()

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
