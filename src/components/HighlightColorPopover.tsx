import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [computedColors, setComputedColors] = useState<{
    surface: string
    border: string
    textPrimary: string
    textSecondary: string
    surfaceHover: string
    primary: string
  }>({
    surface: '#111827',
    border: '#4b5563',
    textPrimary: '#f9fafb',
    textSecondary: '#9ca3af',
    surfaceHover: '#1f2937',
    primary: '#3b82f6'
  })

  // Compute actual color values from CSS variables
  useEffect(() => {
    if (isOpen) {
      const root = document.documentElement
      const styles = getComputedStyle(root)
      
      const surface = styles.getPropertyValue('--color-surface').trim() || '#111827'
      const border = styles.getPropertyValue('--color-border').trim() || '#4b5563'
      const textPrimary = styles.getPropertyValue('--color-text-primary').trim() || '#f9fafb'
      const textSecondary = styles.getPropertyValue('--color-text-secondary').trim() || '#9ca3af'
      const surfaceHover = styles.getPropertyValue('--color-surface-hover').trim() || '#1f2937'
      const primary = styles.getPropertyValue('--color-primary').trim() || '#3b82f6'
      
      console.log('🎨 HighlightColorPopover: Computed colors', {
        surface,
        border,
        textPrimary,
        textSecondary,
        surfaceHover,
        primary
      })
      
      setComputedColors({
        surface,
        border,
        textPrimary,
        textSecondary,
        surfaceHover,
        primary
      })
    }
  }, [isOpen])

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
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Calculate initial position (above the trigger button)
      let top = triggerRect.top - popover.offsetHeight - 8
      let left = triggerRect.left + triggerRect.width / 2 - popover.offsetWidth / 2
      
      // Adjust horizontal position to stay within viewport
      if (left < 10) {
        left = 10
      } else if (left + popover.offsetWidth > viewportWidth - 10) {
        left = viewportWidth - popover.offsetWidth - 10
      }
      
      // Adjust vertical position to stay within viewport
      if (top < 10) {
        // If not enough space above, position below the trigger
        top = triggerRect.bottom + 8
      }
      
      // Ensure popover doesn't go below viewport
      if (top + popover.offsetHeight > viewportHeight - 10) {
        top = viewportHeight - popover.offsetHeight - 10
      }
      
      popover.style.position = 'fixed'
      popover.style.top = `${top}px`
      popover.style.left = `${left}px`
      popover.style.zIndex = '9999'
      // Ensure background and border colors are set with computed values
      popover.style.backgroundColor = computedColors.surface
      popover.style.borderColor = computedColors.border
      popover.style.color = computedColors.textPrimary
    }
  }, [isOpen, triggerRef, computedColors])

  if (!isOpen) return null

  const popoverContent = (
    <div
      ref={popoverRef}
      className="highlight-popover-dark rounded-lg shadow-xl border p-4 min-w-[280px]"
      style={{
        backgroundColor: computedColors.surface,
        borderColor: computedColors.border,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)',
        color: computedColors.textPrimary,
        // Set CSS variables directly on this element so children can use them
        ['--color-surface' as any]: computedColors.surface,
        ['--color-border' as any]: computedColors.border,
        ['--color-text-primary' as any]: computedColors.textPrimary,
        ['--color-text-secondary' as any]: computedColors.textSecondary,
        ['--color-surface-hover' as any]: computedColors.surfaceHover,
        ['--color-primary' as any]: computedColors.primary,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Highlighter className="w-5 h-5" style={{ color: computedColors.primary }} />
          <h3 className="text-lg font-semibold" style={{ color: computedColors.textPrimary }}>
            Highlight Colors
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: computedColors.textSecondary }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = computedColors.surfaceHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Color Picker - force dark background */}
      <div style={{ 
        backgroundColor: computedColors.surface,
        padding: '0',
        margin: '0',
      }}>
        <AnnotationColorPicker
          selectedColor={selectedColor}
          onColorSelect={onColorSelect}
        />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: computedColors.surface }}>
        <p className="text-sm" style={{ color: computedColors.textSecondary }}>
          Select a color to highlight text. Click and drag to highlight selected text in your document.
        </p>
      </div>
    </div>
  )

  // Render in portal to avoid CSS conflicts with react-pdf-viewer
  const portalRoot = typeof document !== 'undefined' ? document.body : null
  if (!portalRoot) return null

  return createPortal(popoverContent, portalRoot)
}
