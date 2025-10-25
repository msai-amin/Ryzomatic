import React, { useState, useRef, useEffect } from 'react'
import { 
  MoreVertical, 
  RotateCw, 
  Library, 
  Upload, 
  StickyNote, 
  Download, 
  Search, 
  Volume2, 
  Settings,
  X
} from 'lucide-react'
import { Tooltip } from './Tooltip'

interface PDFToolbarMoreMenuProps {
  isOpen: boolean
  onClose: () => void
  onRotate: () => void
  onLibrary: () => void
  onUpload: () => void
  onNotes: () => void
  onDownload: () => void
  onSearch: () => void
  onTTS: () => void
  onSettings: () => void
  triggerRef: React.RefObject<HTMLElement>
}

export const PDFToolbarMoreMenu: React.FC<PDFToolbarMoreMenuProps> = ({
  isOpen,
  onClose,
  onRotate,
  onLibrary,
  onUpload,
  onNotes,
  onDownload,
  onSearch,
  onTTS,
  onSettings,
  triggerRef
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
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

  // Position menu relative to trigger
  useEffect(() => {
    if (isOpen && triggerRef.current && menuRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const menu = menuRef.current
      
      // Position below the trigger button
      menu.style.position = 'fixed'
      menu.style.top = `${triggerRect.bottom + 8}px`
      menu.style.left = `${triggerRect.left + triggerRect.width / 2 - menu.offsetWidth / 2}px`
      menu.style.zIndex = '9999'
    }
  }, [isOpen, triggerRef])

  if (!isOpen) return null

  const menuItems = [
    {
      icon: RotateCw,
      label: 'Rotate',
      action: onRotate,
      description: 'Rotate document 90° clockwise'
    },
    {
      icon: Library,
      label: 'Library',
      action: onLibrary,
      description: 'View document library'
    },
    {
      icon: Upload,
      label: 'Upload',
      action: onUpload,
      description: 'Upload new document'
    },
    {
      icon: StickyNote,
      label: 'Notes',
      action: onNotes,
      description: 'Open notes panel'
    },
    {
      icon: Download,
      label: 'Download',
      action: onDownload,
      description: 'Download current document'
    },
    {
      icon: Search,
      label: 'Search',
      action: onSearch,
      description: 'Search within document'
    },
    {
      icon: Volume2,
      label: 'Text-to-Speech',
      action: onTTS,
      description: 'Read document aloud'
    },
    {
      icon: Settings,
      label: 'Settings',
      action: onSettings,
      description: 'Open settings'
    }
  ]

  return (
    <div
      ref={menuRef}
      className="bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px]"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          More Options
        </span>
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

      {/* Menu Items */}
      <div className="py-1">
        {menuItems.map((item, index) => (
          <Tooltip key={index} content={item.description} position="right">
            <button
              onClick={() => {
                item.action()
                onClose()
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-left transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <item.icon className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              <span className="text-sm">{item.label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
