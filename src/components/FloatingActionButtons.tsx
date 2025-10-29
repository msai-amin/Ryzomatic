import React, { useState } from 'react'
import { StickyNote, Bot } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Tooltip } from './Tooltip'

export const FloatingActionButtons: React.FC = () => {
  const { user, currentDocument, toggleChat, pdfViewer, isRightSidebarOpen } = useAppStore()
  const [isHovered, setIsHovered] = useState<string | null>(null)

  // Don't show floating buttons if user is not authenticated or no document is loaded
  if (!user || !currentDocument) {
    return null
  }

  const handleQuickNote = () => {
    // Open notes panel with new note
    // This would integrate with your note creation modal
    console.log('Quick note pressed')
  }

  const handleAIChat = () => {
    toggleChat()
  }

  const buttons = [
    {
      id: 'note',
      icon: StickyNote,
      label: 'Quick Note',
      color: '#3b82f6', // Blue
      onClick: handleQuickNote,
    },
    {
      id: 'chat',
      icon: Bot,
      label: 'AI Chat',
      color: '#8b5cf6', // Purple
      onClick: handleAIChat,
    },
  ]

  return (
    <div 
      className="fixed bottom-40 z-60 flex flex-col space-y-3"
      style={{
        right: isRightSidebarOpen ? '288px' : '2rem', // 280px sidebar + 8px gap when open, 32px default
      }}
      onMouseLeave={() => setIsHovered(null)}
    >
      {buttons.map((button, index) => {
        const Icon = button.icon
        const isHovering = isHovered === button.id
        
        return (
          <div key={button.id} className="relative">
            <Tooltip content={button.label} position="left">
              <button
                onClick={button.onClick}
                onMouseEnter={() => setIsHovered(button.id)}
                className="w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex items-center justify-center"
                style={{
                  backgroundColor: button.color,
                  color: 'white',
                }}
                title={button.label}
              >
                <Icon className="w-6 h-6" />
              </button>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}

