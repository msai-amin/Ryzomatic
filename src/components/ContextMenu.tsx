import React, { useEffect, useRef } from 'react'
import { Sparkles, BookOpen, FileText } from 'lucide-react'

export interface ContextMenuOption {
  label: string
  icon: React.ReactNode
  onClick: () => void
  className?: string
}

interface ContextMenuProps {
  x: number
  y: number
  options: ContextMenuOption[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Add slight delay to prevent immediate close from the right-click event
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 10)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position if menu would go off screen
  const adjustPosition = () => {
    if (!menuRef.current) return { x, y }

    const menuRect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Adjust horizontal position
    if (x + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 10
    }

    // Adjust vertical position
    if (y + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 10
    }

    return { x: adjustedX, y: adjustedY }
  }

  const position = adjustPosition()

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'transparent' }}
      />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 rounded-lg shadow-2xl border animate-scale-in"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          minWidth: '200px',
        }}
      >
        <div className="py-2">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => {
                option.onClick()
                onClose()
              }}
              className={`w-full px-4 py-2 flex items-center space-x-3 transition-colors ${
                option.className || ''
              }`}
              style={{
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-background)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <span className="flex-shrink-0">{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// Predefined context menu options factory
export const createAIContextMenuOptions = (
  onClarification: () => void,
  onFurtherReading: () => void,
  onSaveNote: () => void
): ContextMenuOption[] => [
  {
    label: 'Ask AI for Clarification',
    icon: <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />,
    onClick: onClarification,
  },
  {
    label: 'Get Further Reading',
    icon: <BookOpen className="w-4 h-4" style={{ color: 'var(--color-secondary, #10b981)' }} />,
    onClick: onFurtherReading,
  },
  {
    label: 'Save as Note',
    icon: <FileText className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />,
    onClick: onSaveNote,
  },
]

