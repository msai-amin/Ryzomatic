import React, { useState, useRef, useEffect } from 'react'
import { Highlighter, X } from 'lucide-react'
import { AnnotationColorPicker } from '../../themes/ThemeProvider'
import { Tooltip } from './Tooltip'

interface HighlightColorPopoverProps {
  isOpen: boolean
  onClose: () => void
  selectedColor: string
  onColorSelect: (color: string) => void
  triggerRef: React.RefObject<HTMLElement>
}

export const HighlightColorPopover: React.FC<HighlightColorPopoverProps> = ({
  isOpen,
  onClose,
  selectedColor,
  onColorSelect,
  triggerRef
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  // Position popover relative to trigger
  useEffect(() => {
    if (isOpen && triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popover = popoverRef.current
      
      // Position above the trigger button
      popover.style.position = 'fixed'
      popover.style.top = `${triggerRect.top - popover.offsetHeight - 8}px`
      popover.style.left = `${triggerRect.left + triggerRect.width / 2 - popover.offsetWidth / 2}px`
      popover.style.zIndex = '9999'
    }
  }, [isOpen, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px]"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Highlighter className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Highlight Colors
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Color Picker */}
      <AnnotationColorPicker
        selectedColor={selectedColor}
        onColorSelect={onColorSelect}
      />

      {/* Instructions */}
      <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Select a color to highlight text. Click and drag to highlight selected text in your document.
        </p>
      </div>
    </div>
  )
}
