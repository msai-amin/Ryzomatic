import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { ChevronRight, ChevronLeft, FileText, Highlighter, Plus, StickyNote } from 'lucide-react'
import { NotesList } from '../src/components/ResearchNotes/NotesList'
import { notesService } from '../src/services/notesService'
import { highlightService, Highlight } from '../src/services/highlightService'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const { currentDocument, user } = useAppStore()
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notes' | 'highlights'>('notes')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(false)

  // Load highlights when tab is active and document changes
  useEffect(() => {
    if (!currentDocument || !user || activeTab !== 'highlights') return

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
  }, [currentDocument?.id, user, activeTab])

  const handleNoteSelected = (note: any) => {
    console.log('Note selected:', note)
    // TODO: Open note in editor
  }

  const handleJumpToPage = (pageNumber: number) => {
    // This will be handled by the PDFViewer component
    console.log('Jump to page:', pageNumber)
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

      {/* Right Sidebar Toggle Button (visible when sidebar is closed) */}
      {currentDocument && !isRightSidebarOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed top-24 right-4 p-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-primary)',
          }}
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Right Sidebar - Only show if there's a current document */}
      {currentDocument && (
        <div 
          className="transition-all duration-300 ease-in-out overflow-y-auto relative"
          style={{
            width: isRightSidebarOpen ? '320px' : '0px',
            backgroundColor: 'var(--color-surface)',
            borderLeft: isRightSidebarOpen ? '1px solid var(--color-border)' : 'none',
          }}
        >
          {/* Sidebar Content */}
          <div 
            className="p-8"
            style={{
              opacity: isRightSidebarOpen ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              visibility: isRightSidebarOpen ? 'visible' : 'hidden',
            }}
          >
            {/* Close Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setIsRightSidebarOpen(false)}
                className="p-2 rounded-lg transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                }}
                aria-label="Close sidebar"
                title="Close sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex space-x-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-surface)' }}>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'notes' ? 'shadow-sm' : ''
                  }`}
                  style={{
                    backgroundColor: activeTab === 'notes' ? 'var(--color-primary)' : 'transparent',
                    color: activeTab === 'notes' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <StickyNote className="w-4 h-4" />
                    <span>Notes</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('highlights')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'highlights' ? 'shadow-sm' : ''
                  }`}
                  style={{
                    backgroundColor: activeTab === 'highlights' ? 'var(--color-primary)' : 'transparent',
                    color: activeTab === 'highlights' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Highlighter className="w-4 h-4" />
                    <span>Highlights</span>
                  </div>
                </button>
              </div>
              
              {activeTab === 'notes' && (
                <Tooltip content="Create New Note" position="left">
                  <button 
                    onClick={() => {
                      // Open notes panel with empty note
                    }}
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Tab Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {activeTab === 'notes' ? (
                <NotesList onNoteSelected={handleNoteSelected} />
              ) : (
                <div className="space-y-2">
                  {highlightsLoading ? (
                    <div className="text-center py-8">
                      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Loading highlights...
                      </div>
                    </div>
                  ) : highlights.length === 0 ? (
                    <div className="text-center py-8">
                      <Highlighter className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        No highlights yet. Select text to highlight!
                      </p>
                    </div>
                  ) : (
                    // Group highlights by page
                    Array.from(
                      new Set(highlights.map(h => h.page_number))
                    ).sort((a, b) => a - b).map(pageNum => {
                      const pageHighlights = highlights.filter(h => h.page_number === pageNum)
                      return (
                        <div key={pageNum} className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 
                              className="text-sm font-semibold"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              Page {pageNum}
                            </h3>
                            <button
                              onClick={() => handleJumpToPage(pageNum)}
                              className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                            >
                              Jump to page →
                            </button>
                          </div>
                          <div className="space-y-2">
                            {pageHighlights.map((highlight) => (
                              <div
                                key={highlight.id}
                                className="p-3 rounded-lg border transition-colors hover:shadow-sm"
                                style={{
                                  backgroundColor: 'var(--color-surface)',
                                  borderColor: 'var(--color-border)',
                                }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div 
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: highlight.color_hex }}
                                  />
                                  <div className="text-xs ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                    {new Date(highlight.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div 
                                  className="text-sm line-clamp-2"
                                  style={{ color: 'var(--color-text-primary)' }}
                                >
                                  {highlight.highlighted_text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}