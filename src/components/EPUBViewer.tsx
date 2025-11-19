import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { ChevronLeft, ChevronRight, BookOpen, List, Type } from 'lucide-react'

export const EPUBViewer: React.FC = () => {
  const {
    currentDocument,
    pdfViewer,
    updatePDFViewer,
    typography,
    updateTypography,
    setSelectedTextContext,
    setChatMode,
    toggleChat,
    isChatOpen
  } = useAppStore()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // CRITICAL: Normalize document ID and arrays to prevent React comparison error
  // React's dependency comparison function accesses .length on nested array properties
  const normalizedDocumentId = currentDocument?.id ?? ''
  
  // CRITICAL: Safe destructuring with defaults - guarantees arrays are always arrays
  // Level 1 Guard: Default currentDocument to {} if null/undefined
  // Level 2 Guard: Default pageTexts and metadata.chapters to [] if missing
  // This ensures React's dependency comparison never accesses .length on undefined
  const { 
    pageTexts: safePageTexts = [],
    metadata: safeMetadata = {}
  } = currentDocument || {}
  
  const { chapters: safeChapters = [] } = safeMetadata || {}
  
  // CRITICAL: Use array lengths (primitives) instead of arrays in dependency arrays
  // React's 'co' function crashes when arrays are used in dependency arrays and
  // the previous dependency array is undefined. Use primitive numbers (lengths) instead.
  // CRITICAL: Ensure length is always a number, never undefined
  const pageTextsLengthPrimitive = (Array.isArray(safePageTexts) ? safePageTexts.length : 0) || 0
  const chaptersLengthPrimitive = (Array.isArray(safeChapters) ? safeChapters.length : 0) || 0
  
  // Normalize pageTexts to always be an array
  // CRITICAL: Use length primitives in dependency arrays, not arrays themselves
  const normalizedPageTexts = useMemo(() => {
    return Array.isArray(safePageTexts) ? safePageTexts : []
  }, [pageTextsLengthPrimitive]) // Use length (number) instead of array
  
  // Normalize metadata.chapters to always be an array
  // CRITICAL: Use length primitives in dependency arrays, not arrays themselves
  const normalizedChapters = useMemo(() => {
    return Array.isArray(safeChapters) ? safeChapters : []
  }, [chaptersLengthPrimitive]) // Use length (number) instead of array

  // Ensure current page is within EPUB bounds
  const totalSections = normalizedPageTexts.length

  useEffect(() => {
    if (!currentDocument || currentDocument.type !== 'epub') return
    if (totalSections === 0) return

    if (pdfViewer.currentPage < 1 || pdfViewer.currentPage > totalSections) {
      updatePDFViewer({ currentPage: 1 })
    }
  }, [normalizedDocumentId, pdfViewer.currentPage, totalSections, updatePDFViewer])

  const currentPage = useMemo(() => {
    if (!currentDocument || currentDocument.type !== 'epub' || totalSections === 0) return 1
    return Math.min(Math.max(pdfViewer.currentPage, 1), totalSections)
  }, [normalizedDocumentId, pdfViewer.currentPage, totalSections])

  const chapterTitle = useMemo(() => {
    const chapters = normalizedChapters as Array<{ title?: string }>
    return chapters[currentPage - 1]?.title || `Section ${currentPage}`
  }, [chaptersLengthPrimitive, currentPage]) // Use length (number) instead of array

  const currentContent = useMemo(() => {
    if (!currentDocument || currentDocument.type !== 'epub') return ''
    return normalizedPageTexts[currentPage - 1] || ''
  }, [normalizedDocumentId, pageTextsLengthPrimitive, currentPage]) // Use length (number) instead of array

  const handlePrev = useCallback(() => {
    if (currentPage <= 1) return
    updatePDFViewer({ currentPage: currentPage - 1 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage, updatePDFViewer])

  const handleNext = useCallback(() => {
    if (currentPage >= totalSections) return
    updatePDFViewer({ currentPage: currentPage + 1 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage, totalSections, updatePDFViewer])

  const handleChapterSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newPage = Number(event.target.value)
      if (!Number.isNaN(newPage)) {
        updatePDFViewer({ currentPage: newPage })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [updatePDFViewer]
  )

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (hasTextSelection()) {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY })
    }
  }, [])

  const handleClarification = useCallback(() => {
    const context = getTextSelectionContext()
    if (context) {
      setSelectedTextContext(context)
      setChatMode('clarification')
      if (!isChatOpen) toggleChat()
    }
  }, [isChatOpen, setChatMode, setSelectedTextContext, toggleChat])

  const handleFurtherReading = useCallback(() => {
    const context = getTextSelectionContext()
    if (context) {
      setSelectedTextContext(context)
      setChatMode('further-reading')
      if (!isChatOpen) toggleChat()
    }
  }, [isChatOpen, setChatMode, setSelectedTextContext, toggleChat])

  const handleSaveNote = useCallback(() => {
    const context = getTextSelectionContext()
    if (!context || !currentDocument) return

    // Saving notes for EPUB documents is handled via existing note workflows
    setSelectedTextContext(context)
  }, [normalizedDocumentId, setSelectedTextContext])

  if (!currentDocument || currentDocument.type !== 'epub' || totalSections === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        <p>No EPUB content available.</p>
      </div>
    )
  }

  const progressPercent = Math.round((currentPage / totalSections) * 100)
  const chapters = normalizedChapters as Array<{ title?: string; id?: string }>

  const themeStyles = (() => {
    switch (typography.theme) {
      case 'dark':
        return { backgroundColor: '#1f2937', color: '#f3f4f6' }
      case 'sepia':
        return { backgroundColor: '#fef3c7', color: '#78350f' }
      default:
        return {
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)'
        }
    }
  })()

  const fontFamily = (() => {
    switch (typography.fontFamily) {
      case 'serif':
        return 'var(--font-family-serif)'
      case 'mono':
        return 'var(--font-family-mono)'
      default:
        return 'var(--font-family-sans)'
    }
  })()

  return (
    <div className="flex flex-col h-full">
      <header
        className="flex flex-wrap items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {currentDocument.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {chapterTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handlePrev}
            disabled={currentPage <= 1}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            className="px-3 py-1.5 rounded-md border text-sm"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Page {currentPage} of {totalSections} ({progressPercent}%)
          </div>

          <button
            onClick={handleNext}
            disabled={currentPage >= totalSections}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <Type className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            <select
              value={typography.fontSize}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isNaN(value)) {
                  updateTypography({ fontSize: value })
                }
              }}
              className="border rounded-md px-2 py-1 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              {[16, 18, 20, 22, 24].map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <List className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            <select
              value={currentPage}
              onChange={handleChapterSelect}
              className="border rounded-md px-2 py-1 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              {Array.from({ length: totalSections }).map((_, index) => (
                <option key={index} value={index + 1}>
                  {chapters[index]?.title || `Section ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div
          className="max-w-3xl mx-auto rounded-2xl shadow-md p-8 transition-all duration-300"
          style={{
            ...themeStyles,
            fontFamily,
            fontSize: `${typography.fontSize}px`,
            lineHeight: typography.lineHeight,
            boxShadow: 'var(--shadow-md)'
          }}
          onContextMenu={handleContextMenu}
        >
          <article className="prose prose-lg max-w-none">
            <pre className="whitespace-pre-wrap font-inherit leading-relaxed">
              {currentContent}
            </pre>
          </article>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={createAIContextMenuOptions(handleClarification, handleFurtherReading, handleSaveNote)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

