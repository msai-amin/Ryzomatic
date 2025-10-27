import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { NoteTemplateSelector } from '../src/components/ResearchNotes/NoteTemplateSelector'
import { AIAssistedNotes } from '../src/components/ResearchNotes/AIAssistedNotes'
import { NotesList } from '../src/components/ResearchNotes/NotesList'
import { notesService } from '../src/services/notesService'
import { sendMessageToAI } from '../src/services/aiService'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const { currentDocument, user } = useAppStore()
  const { annotationColors } = useTheme()
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [sectionsExpanded, setSectionsExpanded] = useState({
    createNote: false,
    aiAssisted: true, // Expanded by default
    myNotes: false,
    annotationColors: false,
  })
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleTemplateSelect = (type: 'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => {
    console.log('Template selected:', type)
    
    if (type === 'freeform') {
      // Open a simple text editor modal or inline editor
      // TODO: Implement note editor
      alert('Blank text note editor - to be implemented')
    } else {
      // TODO: Open note editor with selected template
      alert(`Note editor for ${type} - to be implemented`)
    }
  }

  const handleNoteSelected = (note: any) => {
    console.log('Note selected:', note)
    // TODO: Open note in editor
  }

  const handleNotesGenerated = () => {
    console.log('Notes generated, refreshing list')
    // The NotesList will auto-refresh when the notes array changes
  }

  const handleExportNotes = async (format: 'markdown' | 'html' | 'json' | 'text') => {
    if (!currentDocument || !user) return
    
    setShowExportDropdown(false)
    
    try {
      const { data: notes } = await notesService.getNotesForBook(user.id, currentDocument.id)
      if (!notes || notes.length === 0) {
        alert('No notes to export')
        return
      }
      
      const content = await notesService.exportNotes(notes, format, currentDocument.name)
      
      // Determine file extension and MIME type
      const extensions = { markdown: 'md', html: 'html', json: 'json', text: 'txt' }
      const mimeTypes = {
        markdown: 'text/markdown',
        html: 'text/html',
        json: 'application/json',
        text: 'text/plain'
      }
      
      // Download as file
      const blob = new Blob([content], { type: mimeTypes[format] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDocument.name}-notes.${extensions[format]}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting notes:', error)
      alert('Failed to export notes')
    }
  }

  const handleGenerateSummary = async () => {
    if (!currentDocument || !user) return
    
    setIsGeneratingSummary(true)
    
    try {
      const documentContent = currentDocument.pageTexts?.join('\n\n') || currentDocument.content || ''
      const summary = await sendMessageToAI(
        'Please provide a comprehensive summary of this document, highlighting the main points, key arguments, and conclusions.',
        documentContent,
        user.tier as any,
        'general'
      )
      
      // Save as a note
      await notesService.createNote(
        user.id,
        currentDocument.id,
        1,
        summary,
        'freeform',
        undefined,
        true
      )
      
      alert('Summary generated and saved to notes!')
    } catch (error) {
      console.error('Error generating summary:', error)
      alert('Failed to generate summary')
    } finally {
      setIsGeneratingSummary(false)
    }
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

            <div className="flex items-center justify-between mb-6">
              <h2 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Research Notes
              </h2>
              <Tooltip content="Create New Note" position="left">
                <button 
                  onClick={() => {
                    setSectionsExpanded(prev => ({ ...prev, createNote: true }))
                  }}
                  className="text-sm px-3 py-1 rounded-full transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  + New Note
                </button>
              </Tooltip>
            </div>

            {/* My Notes Section - MOVED TO TOP */}
            <div className="mb-4">
              <button
                onClick={() => toggleSection('myNotes')}
                className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-opacity-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  My Notes
                </h3>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${sectionsExpanded.myNotes ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--color-text-primary)' }}
                />
              </button>
              {sectionsExpanded.myNotes && (
                <NotesList onNoteSelected={handleNoteSelected} />
              )}
            </div>

            {/* Create Note Section */}
            <div className="mb-4">
              <button
                onClick={() => toggleSection('createNote')}
                className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-opacity-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Template Note Formats
                </h3>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${sectionsExpanded.createNote ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--color-text-primary)' }}
                />
              </button>
              {sectionsExpanded.createNote && (
                <NoteTemplateSelector onSelectTemplate={handleTemplateSelect} />
              )}
            </div>

            {/* AI-Assisted Notes Section */}
            <div className="mb-4">
              <button
                onClick={() => toggleSection('aiAssisted')}
                className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-opacity-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  AI-Generated Notes
                </h3>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${sectionsExpanded.aiAssisted ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--color-text-primary)' }}
                />
              </button>
              {sectionsExpanded.aiAssisted && (
                <AIAssistedNotes onNotesGenerated={handleNotesGenerated} />
              )}
            </div>

            {/* Annotation Colors Section */}
            <div className="mb-4">
              <button
                onClick={() => toggleSection('annotationColors')}
                className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-opacity-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Annotation Colors
                </h3>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${sectionsExpanded.annotationColors ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--color-text-primary)' }}
                />
              </button>
              {sectionsExpanded.annotationColors && (
                <div className="mt-3 px-3">
                  <div className="grid grid-cols-2 gap-2">
                    {annotationColors.map((color, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color.color }}
                        />
                        <span 
                          className="text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {color.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Quick Actions
            </h3>
            <div className="space-y-2">
              {/* Export Notes Dropdown */}
              <div className="relative" ref={exportDropdownRef}>
                <button 
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="w-full text-left text-sm p-2 rounded transition-colors cursor-pointer flex items-center justify-between"
                  style={{ color: 'var(--color-text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>Export Notes</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-90' : ''}`} />
                </button>
                
                {showExportDropdown && (
                  <div 
                    className="absolute left-0 mt-1 w-full rounded-lg shadow-lg py-1 z-50"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <button 
                      onClick={() => handleExportNotes('markdown')} 
                      className="w-full text-left text-sm px-3 py-2 transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Markdown (.md)
                    </button>
                    <button 
                      onClick={() => handleExportNotes('html')} 
                      className="w-full text-left text-sm px-3 py-2 transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      HTML (.html)
                    </button>
                    <button 
                      onClick={() => handleExportNotes('json')} 
                      className="w-full text-left text-sm px-3 py-2 transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      JSON (.json)
                    </button>
                    <button 
                      onClick={() => handleExportNotes('text')} 
                      className="w-full text-left text-sm px-3 py-2 transition-colors"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Plain Text (.txt)
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                className="w-full text-left text-sm p-2 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isGeneratingSummary) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}