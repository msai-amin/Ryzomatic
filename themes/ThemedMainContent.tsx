import React, { useState } from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { StudyGuidePanel } from '../src/components/ResearchNotes/StudyGuidePanel'
import { NoteTemplateSelector } from '../src/components/ResearchNotes/NoteTemplateSelector'
import { AIAssistedNotes } from '../src/components/ResearchNotes/AIAssistedNotes'
import { NotesList } from '../src/components/ResearchNotes/NotesList'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const { currentDocument } = useAppStore()
  const { annotationColors } = useTheme()
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)
  const [sectionsExpanded, setSectionsExpanded] = useState({
    studyGuide: false,
    createNote: false,
    aiAssisted: false,
    myNotes: false,
  })

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleTemplateSelect = (type: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => {
    console.log('Selected template type:', type)
    // TODO: Open note editor with selected template
  }

  const handleNoteSelected = (note: any) => {
    console.log('Note selected:', note)
    // TODO: Open note in editor
  }

  const handleNotesGenerated = () => {
    console.log('Notes generated, refreshing list')
    // The NotesList will auto-refresh when the notes array changes
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
            </div>

            {/* Study Guide Section */}
            <StudyGuidePanel
              isExpanded={sectionsExpanded.studyGuide}
              onToggle={() => toggleSection('studyGuide')}
            />

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
                  Templates
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

            {/* My Notes Section */}
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

            {/* Color Legend */}
          <div className="mb-6">
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Annotation Colors
            </h3>
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

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Tooltip content="Export all your notes to a file" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Export Notes
                </button>
              </Tooltip>
              <Tooltip content="AI-generated summary of this document" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Generate Summary
                </button>
              </Tooltip>
              <Tooltip content="Generate citation in multiple formats" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Create Citation
                </button>
              </Tooltip>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}