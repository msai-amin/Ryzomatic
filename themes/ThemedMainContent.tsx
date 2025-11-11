import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { FileText, Highlighter, Plus, MoreVertical, Download, FileStack, X } from 'lucide-react'
import { NotesList } from '../src/components/ResearchNotes/NotesList'
import { notesService } from '../src/services/notesService'
import { highlightService, Highlight } from '../src/services/highlightService'
import { NoteEditorModal } from '../src/components/ResearchNotes/NoteEditorModal'
import { NoteTemplateSettings } from '../src/components/NoteTemplateSettings'
import { NoteTemplateHelpModal } from '../src/components/NoteTemplateHelpModal'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const {
    currentDocument,
    user,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    pdfViewer,
    rightSidebarTab,
    setRightSidebarTab,
    rightSidebarWidth,
    setRightSidebarWidth
  } = useAppStore()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0)
  const [editingNote, setEditingNote] = useState<any>(null)
  const [showKebabMenu, setShowKebabMenu] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'markdown' | 'html' | 'json' | 'text'>('markdown')
  const [isExporting, setIsExporting] = useState(false)
  const kebabMenuRef = useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  )
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const MIN_PANEL_WIDTH = 280
  const MAX_PANEL_WIDTH = 720

  // Close kebab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kebabMenuRef.current && !kebabMenuRef.current.contains(event.target as Node)) {
        setShowKebabMenu(false)
      }
    }

    if (showKebabMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showKebabMenu])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const maxWidth = Math.min(MAX_PANEL_WIDTH, viewportWidth * 0.9)
    if (rightSidebarWidth > maxWidth) {
      setRightSidebarWidth(maxWidth)
    } else if (rightSidebarWidth < MIN_PANEL_WIDTH) {
      setRightSidebarWidth(MIN_PANEL_WIDTH)
    }
  }, [viewportWidth, rightSidebarWidth, setRightSidebarWidth])

  // Load highlights when tab is active and document changes
  useEffect(() => {
    if (!currentDocument || !user || rightSidebarTab !== 'highlights') return

    const loadHighlights = async () => {
      setHighlightsLoading(true)
      try {
        const bookHighlights = await highlightService.getHighlights(currentDocument.id, {
          includeOrphaned: false
        })
        setHighlights(bookHighlights)
      } catch (error) {
        console.error('Error loading highlights:', error)
        setHighlights([])
      } finally {
        setHighlightsLoading(false)
      }
    }

    loadHighlights()
  }, [currentDocument?.id, user, rightSidebarTab])

  useEffect(() => {
    if (rightSidebarTab !== 'notes' && showKebabMenu) {
      setShowKebabMenu(false)
    }
  }, [rightSidebarTab, showKebabMenu])

  const handleNoteSelected = (note: any) => {
    console.log('Note selected:', note)
    setEditingNote(note)
  }

  const handleEditorClose = () => {
    setEditingNote(null)
  }

  const handleEditorSave = async () => {
    setNotesRefreshTrigger(prev => prev + 1)
  }

  const handleEditorDelete = async () => {
    setNotesRefreshTrigger(prev => prev + 1)
  }

  const handleJumpToPage = (pageNumber: number) => {
    // This will be handled by the PDFViewer component
    console.log('Jump to page:', pageNumber)
  }

  const handleExportNotes = async () => {
    if (!user || !currentDocument) {
      console.error('Cannot export: missing user or document')
      return
    }

    setIsExporting(true)
    setShowKebabMenu(false)
    setShowExportModal(false)

    try {
      // Get all notes for current document
      const { data: notes, error } = await notesService.getNotesForBook(user.id, currentDocument.id)
      
      if (error) {
        console.error('Error fetching notes:', error)
        alert('Failed to export notes. Please try again.')
        return
      }

      if (!notes || notes.length === 0) {
        alert('No notes to export for this document.')
        return
      }

      // Export notes in selected format
      const exportedContent = await notesService.exportNotes(notes, exportFormat, currentDocument.name)
      
      // Create blob and download
      const blob = new Blob([exportedContent], { 
        type: exportFormat === 'html' ? 'text/html' : 
              exportFormat === 'json' ? 'application/json' :
              'text/plain' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDocument.name.replace(/[^a-z0-9]/gi, '_')}-notes.${exportFormat === 'markdown' ? 'md' : exportFormat}`
      a.click()
      URL.revokeObjectURL(url)

      // Success notification
      console.log('Notes exported successfully')
    } catch (error) {
      console.error('Error exporting notes:', error)
      alert('Failed to export notes. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: rightSidebarWidth
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStateRef.current) return
      const delta = dragStateRef.current.startX - moveEvent.clientX
      const maxWidth = Math.min(MAX_PANEL_WIDTH, window.innerWidth * 0.9)
      const nextWidth = Math.min(
        Math.max(dragStateRef.current.startWidth + delta, MIN_PANEL_WIDTH),
        maxWidth
      )
      setRightSidebarWidth(nextWidth)
    }

    const handleMouseUp = () => {
      dragStateRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const maxAllowedWidth = Math.min(MAX_PANEL_WIDTH, viewportWidth * 0.9)
  const clampedWidth = Math.min(Math.max(rightSidebarWidth, MIN_PANEL_WIDTH), maxAllowedWidth)
  const sidebarTabs: Array<{ id: 'notes' | 'highlights'; label: string; icon: React.ElementType }> = [
    { id: 'notes', label: 'Notes', icon: FileStack },
    { id: 'highlights', label: 'Highlights', icon: Highlighter }
  ]

  const renderPanelBody = () => {
    if (rightSidebarTab === 'highlights') {
      if (!currentDocument) {
        return (
          <div
            className="rounded-lg border p-4 text-sm text-center"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Open a document to view highlights.
          </div>
        )
      }

      if (highlightsLoading) {
        return (
          <div className="py-8 text-center">
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Loading highlights...
            </div>
          </div>
        )
      }

      if (highlights.length === 0) {
        return (
          <div className="py-8 text-center">
            <Highlighter
              className="mx-auto mb-4 h-12 w-12 opacity-50"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No highlights yet. Select text to highlight!
            </p>
          </div>
        )
      }

      return (
        <div className="space-y-4">
          {Array.from(new Set(highlights.map((h) => h.page_number)))
            .sort((a, b) => a - b)
            .map((pageNum) => {
              const pageHighlights = highlights.filter((h) => h.page_number === pageNum)
              return (
                <div key={pageNum} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Page {pageNum}
                    </h3>
                    <button
                      onClick={() => handleJumpToPage(pageNum)}
                      className="text-xs text-blue-500 transition-colors hover:text-blue-600"
                    >
                      Jump to page →
                    </button>
                  </div>
                  {pageHighlights.map((highlight) => (
                    <div
                      key={highlight.id}
                      className="rounded-lg border p-3 transition-colors hover:shadow-sm"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)'
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div
                          className="h-3 w-3 rounded"
                          style={{ backgroundColor: highlight.color_hex }}
                        />
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {new Date(highlight.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {highlight.highlighted_text}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
        </div>
      )
    }

    if (!currentDocument) {
      return (
        <div
          className="rounded-lg border p-4 text-sm text-center"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Open a document to write or review notes.
        </div>
      )
    }

    return (
      <NotesList
        onNoteSelected={handleNoteSelected}
        refreshTrigger={notesRefreshTrigger}
      />
    )
  }

  return (
    <div 
      id="main-content"
      className="flex-1 flex"
      style={{
        backgroundColor: 'var(--color-background)',
        minHeight: 'calc(100vh - var(--header-height))',
      }}
    >
      {/* Main Content Area */}
      <div 
        className="flex-1 p-8 overflow-y-auto relative"
        style={{
          backgroundColor: 'var(--color-background)',
        }}
      >
        {children}
      </div>

      {isRightSidebarOpen && (
        <div
          className="relative transition-all duration-300 ease-in-out"
          style={{
            width: `${Math.round(clampedWidth)}px`,
            maxWidth: `${Math.round(maxAllowedWidth)}px`,
            backgroundColor: 'var(--color-surface)',
            borderLeft: '1px solid var(--color-border)',
            height: 'calc(100vh - var(--header-height))',
            position: 'sticky',
            top: 'var(--header-height)',
            zIndex: 45
          }}
        >
          <div
            className="absolute left-0 top-0 h-full w-2 cursor-col-resize"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize contextual panel"
            style={{ transform: 'translateX(-50%)' }}
          />

          <div className="flex h-full flex-col">
            <div
              className="flex flex-col gap-3 border-b px-6 py-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                {sidebarTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = rightSidebarTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setRightSidebarTab(tab.id)}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-sm'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                      aria-pressed={isActive}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText
                      className="h-4 w-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {currentDocument ? currentDocument.name : 'No document selected'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {rightSidebarTab === 'notes'
                          ? 'Capture and organize insights'
                          : 'Review your highlights'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {rightSidebarTab === 'notes' && (
                    <>
                      <Tooltip content="Create new note" position="bottom">
                        <button
                          onClick={async () => {
                            if (!user || !currentDocument) {
                              alert('Please sign in and open a document to create notes.')
                              return
                            }

                            try {
                              const currentPage = pdfViewer?.currentPage || 1
                              const { data, error } = await notesService.createNote(
                                user.id,
                                currentDocument.id,
                                currentPage,
                                '',
                                'freeform',
                                {},
                                false
                              )

                              if (error) {
                                console.error('Error creating note:', error)
                                alert(`Failed to create note: ${error.message || 'Unknown error'}`)
                              } else {
                                setNotesRefreshTrigger((prev) => prev + 1)
                                setRightSidebarTab('notes')
                                if (data) {
                                  setEditingNote(data)
                                }
                              }
                            } catch (error: any) {
                              console.error('Exception creating note:', error)
                              alert(`Failed to create note: ${error?.message || 'Unknown error'}`)
                            }
                          }}
                          className="rounded-lg border bg-[var(--color-primary)] px-3 py-2 text-white transition-colors hover:opacity-90"
                          style={{ borderColor: 'var(--color-primary)' }}
                          disabled={!user || !currentDocument}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </Tooltip>

                      <div className="relative" ref={kebabMenuRef}>
                        <button
                          onClick={() => setShowKebabMenu(!showKebabMenu)}
                          className="rounded-lg border p-2 transition-colors"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text-secondary)'
                          }}
                          aria-haspopup="menu"
                          aria-expanded={showKebabMenu}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {showKebabMenu && (
                          <div
                            className="absolute right-0 z-10 mt-2 w-48 rounded-lg border bg-[var(--color-surface)] shadow-lg"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setShowExportModal(true)
                                  setShowKebabMenu(false)
                                }}
                                disabled={isExporting}
                                className="flex w-full items-center space-x-2 px-4 py-2 text-left text-sm transition-colors"
                                style={{
                                  color: 'var(--color-text)',
                                  opacity: isExporting ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                <Download className="h-4 w-4" />
                                <span>{isExporting ? 'Exporting...' : 'Export Notes'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowSettingsModal(true)
                                  setShowKebabMenu(false)
                                }}
                                className="w-full px-4 py-2 text-left text-sm transition-colors"
                                style={{ color: 'var(--color-text)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                Note Settings
                              </button>
                              <button
                                onClick={() => {
                                  setShowHelpModal(true)
                                  setShowKebabMenu(false)
                                }}
                                className="w-full px-4 py-2 text-left text-sm transition-colors"
                                style={{ color: 'var(--color-text)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                Help
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => setIsRightSidebarOpen(false)}
                    className="rounded-lg border p-2 transition-colors hover:bg-[var(--color-surface-hover)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {renderPanelBody()}
            </div>
          </div>
        </div>
      )}
      
      {/* Note Editor Modal */}
      <NoteEditorModal
        isOpen={!!editingNote}
        onClose={handleEditorClose}
        note={editingNote}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />

      {/* Export Modal */}
      {showExportModal && user && currentDocument && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowExportModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-lg shadow-xl p-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Export Notes
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Choose a format to export your notes from "{currentDocument.name}"
            </p>
            
            <div className="space-y-2 mb-6">
              {(['markdown', 'html', 'json', 'text'] as const).map((format) => (
                <label
                  key={format}
                  className="flex items-center space-x-2 p-3 rounded-md cursor-pointer transition-colors"
                  style={{ 
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value={format}
                    checked={exportFormat === format}
                    onChange={() => setExportFormat(format)}
                  />
                  <span className="text-sm font-medium capitalize">{format} Format</span>
                </label>
              ))}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExportNotes}
                disabled={isExporting}
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                style={{ 
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                  opacity: isExporting ? 0.7 : 1,
                }}
              >
                {isExporting ? 'Exporting...' : <><Download className="w-4 h-4" /> <span>Export</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <NoteTemplateSettings
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Help Modal */}
      <NoteTemplateHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  )
}