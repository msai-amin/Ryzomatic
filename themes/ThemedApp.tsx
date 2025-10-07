import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTheme, ThemeSwitcher } from './ThemeProvider'
import { ThemedHeader } from './ThemedHeader'
import { ThemedSidebar } from './ThemedSidebar'
import { ThemedMainContent } from './ThemedMainContent'
import { DocumentViewer } from '../src/components/DocumentViewer'
import { ChatModal } from '../src/components/ChatModal'
import { useAppStore } from '../src/store/appStore'

const ThemedAppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const { currentTheme } = useTheme()
  const { isChatOpen, toggleChat } = useAppStore()

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
      <ThemedHeader />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <ThemedSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        />

        {/* Main Content */}
        <ThemedMainContent>
          <DocumentViewer />
        </ThemedMainContent>
      </div>

      {/* Chat Modal */}
      {isChatOpen && (
        <ChatModal onClose={() => toggleChat()} />
      )}

      {/* Floating Action Button */}
      <button
        className="fixed shadow-lg transition-colors"
        style={{
          bottom: 'var(--spacing-lg)',
          right: 'var(--spacing-lg)',
          width: 'var(--floating-button-size)',
          height: 'var(--floating-button-size)',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
          boxShadow: 'var(--shadow-lg)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary)'
        }}
        onClick={() => {
          console.log('Floating action button clicked')
        }}
      >
        <Plus className="w-6 h-6" />
      </button>

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
