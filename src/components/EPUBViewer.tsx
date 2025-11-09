import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { useAppStore } from '../store/appStore'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { ChevronLeft, ChevronRight, BookOpen, List, Type, SlidersHorizontal, Search } from 'lucide-react'
import { AudioWidget } from './AudioWidget'

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
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const [showToc, setShowToc] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ section: number; snippet: string; count: number }>>([])
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const [activeImage, setActiveImage] = useState<string | null>(null)

  // Ensure current page is within EPUB bounds
  const totalSections = currentDocument?.pageTexts?.length || 0

  useEffect(() => {
    if (!currentDocument || currentDocument.type !== 'epub') return
    if (totalSections === 0) return

    if (pdfViewer.currentPage < 1 || pdfViewer.currentPage > totalSections) {
      updatePDFViewer({ currentPage: 1 })
    }
  }, [currentDocument, pdfViewer.currentPage, totalSections, updatePDFViewer])

  const currentPage = useMemo(() => {
    if (!currentDocument || currentDocument.type !== 'epub' || totalSections === 0) return 1
    return Math.min(Math.max(pdfViewer.currentPage, 1), totalSections)
  }, [currentDocument, pdfViewer.currentPage, totalSections])

  const chapterTitle = useMemo(() => {
    const chapters = (currentDocument?.metadata?.chapters || []) as Array<{ title?: string }>
    return chapters[currentPage - 1]?.title || `Section ${currentPage}`
  }, [currentDocument, currentPage])

  const highlightRegex = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) return null
    try {
      return new RegExp(`(${escapeRegExp(query)})`, 'gi')
    } catch (error) {
      console.error('Invalid search query regex:', error)
      return null
    }
  }, [searchQuery])

  const currentContent = useMemo(() => {
    if (!currentDocument || currentDocument.type !== 'epub') return ''
    return currentDocument.pageTexts?.[currentPage - 1] || ''
  }, [currentDocument, currentPage])

  const sanitizedSections = useMemo(() => {
    if (!currentDocument || currentDocument.type !== 'epub') {
      return []
    }

    const total = currentDocument.pageTexts?.length || 0

    const makeHighlightedText = (text: string) => {
      if (!text) return ''
      const paragraphs = text
        .split('\n')
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)

      if (paragraphs.length === 0) return ''

      const html = paragraphs
        .map((paragraph) => {
          if (highlightRegex) {
            return paragraph.replace(
              highlightRegex,
              '<mark class="epub-search-highlight">$1</mark>'
            )
          }
          return paragraph
        })
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join('')

      return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
    }

    const computeSection = (index: number) => {
      const originalHtml = currentDocument.pageHtml?.[index] || ''
      if (originalHtml) {
        const highlightedHtml = highlightRegex
          ? originalHtml.replace(
              highlightRegex,
              '<mark class="epub-search-highlight">$1</mark>'
            )
          : originalHtml
        return DOMPurify.sanitize(highlightedHtml, { USE_PROFILES: { html: true } })
      }

      const fallbackText = currentDocument.pageTexts?.[index] || ''
      return makeHighlightedText(fallbackText)
    }

    const shouldComputeAll =
      pdfViewer.scrollMode === 'continuous' || !!highlightRegex || showSearchPanel

    if (!shouldComputeAll) {
      const index = Math.max(0, Math.min(currentPage - 1, total - 1))
      const resultArray = new Array(total).fill('')
      resultArray[index] = computeSection(index)
      return resultArray
    }

    return currentDocument.pageTexts?.map((_, index) => computeSection(index)) || []
  }, [currentDocument, highlightRegex, pdfViewer.scrollMode, showSearchPanel, currentPage])

  const sanitizedHtml = useMemo(() => {
    return sanitizedSections[currentPage - 1] || ''
  }, [sanitizedSections, currentPage])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query || !currentDocument?.pageTexts) {
      setSearchResults([])
      return
    }

    const lowerQuery = query.toLowerCase()
    const queryRegex = new RegExp(escapeRegExp(query), 'gi')

    const results =
      currentDocument.pageTexts
        ?.map((text, index) => {
          if (!text) return null
          const matches = text.match(queryRegex)
          if (!matches) return null

          const lowerText = text.toLowerCase()
          const firstIndex = lowerText.indexOf(lowerQuery)
          const start = Math.max(0, firstIndex - 60)
          const end = Math.min(text.length, firstIndex + query.length + 60)
          const snippetRaw = text.substring(start, end)
          const highlightedSnippet = snippetRaw.replace(
            queryRegex,
            '<mark class="epub-search-highlight">$1</mark>'
          )

          return {
            section: index + 1,
            snippet: DOMPurify.sanitize(highlightedSnippet, { USE_PROFILES: { html: true } }),
            count: matches.length
          }
        })
        .filter((result): result is { section: number; snippet: string; count: number } => result !== null) || []

    setSearchResults(results)
  }, [searchQuery, currentDocument])

  useEffect(() => {
    sectionRefs.current = new Array(sanitizedSections.length).fill(null)
  }, [sanitizedSections.length])

  useEffect(() => {
    if (pdfViewer.scrollMode !== 'continuous') return
    const target = sectionRefs.current[currentPage - 1]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage, pdfViewer.scrollMode])

  const toggleScrollMode = useCallback(() => {
    updatePDFViewer({
      scrollMode: pdfViewer.scrollMode === 'single' ? 'continuous' : 'single'
    })
  }, [pdfViewer.scrollMode, updatePDFViewer])

  useEffect(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchPanel(false)
  }, [currentDocument?.id])

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

  const handleContentClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement
      event.preventDefault()
      setActiveImage(img.currentSrc || img.src)
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
  }, [currentDocument, setSelectedTextContext])

  if (!currentDocument || currentDocument.type !== 'epub' || totalSections === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        <p>No EPUB content available.</p>
      </div>
    )
  }

  const progressPercent = Math.round((currentPage / totalSections) * 100)
  const chapters =
    (currentDocument.metadata?.chapters as Array<{ title?: string; id?: string }>) || []

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

  const fontOptions = [
    { label: 'Serif', value: 'serif' },
    { label: 'Sans Serif', value: 'sans' },
    { label: 'Monospace', value: 'mono' }
  ]

  const lineHeightOptions = [
    { label: 'Comfortable', value: 1.5 },
    { label: 'Relaxed', value: 1.75 },
    { label: 'Spacious', value: 2 },
    { label: 'Extra Spacious', value: 2.25 }
  ]

  const widthOptions = [
    { label: 'Compact', value: 640 },
    { label: 'Cozy', value: 720 },
    { label: 'Comfort', value: 800 },
    { label: 'Wide', value: 960 },
    { label: 'Ultra Wide', value: 1100 }
  ]

  const themeOptions = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Sepia', value: 'sepia' }
  ]

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

          <button
            onClick={toggleScrollMode}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border text-sm transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {pdfViewer.scrollMode === 'single' ? 'Single Section' : 'Continuous'}
          </button>

          <button
            onClick={() => setShowToc((prev) => !prev)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: showToc ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
            aria-label="Toggle table of contents"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSearchPanel((prev) => !prev)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: showSearchPanel ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
            aria-label="Search in book"
          >
            <Search className="w-4 h-4" />
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

          <button
            onClick={() => setShowPreferences((prev) => !prev)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: showPreferences ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
            aria-label="Reader settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

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
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {pdfViewer.scrollMode === 'single' ? (
          <div
            className="w-full mx-auto rounded-2xl shadow-md p-8 transition-all duration-300"
            style={{
              ...themeStyles,
              fontFamily,
              fontSize: `${typography.fontSize}px`,
              lineHeight: typography.lineHeight,
              boxShadow: 'var(--shadow-md)',
              maxWidth: `${typography.maxWidth || 800}px`
            }}
            onContextMenu={handleContextMenu}
            onClick={handleContentClick}
          >
            <article className="prose prose-lg max-w-none epub-content-single">
              {sanitizedHtml ? (
                <div
                  className="epub-content"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-inherit leading-relaxed">
                  {currentContent}
                </pre>
              )}
            </article>
          </div>
        ) : (
          <div
            className="w-full mx-auto space-y-10 transition-all duration-300"
            style={{
              ...themeStyles,
              fontFamily,
              fontSize: `${typography.fontSize}px`,
              lineHeight: typography.lineHeight,
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--border-radius-xl)',
              boxShadow: 'var(--shadow-md)',
              maxWidth: `${typography.maxWidth ? Math.max(typography.maxWidth + 160, typography.maxWidth) : 960}px`
            }}
          >
            {sanitizedSections.map((sectionHtml, index) => {
              const paragraphFragments = (currentDocument.pageTexts?.[index] || '')
                .split('\n')
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph) => `<p>${paragraph}</p>`)

              const fallbackHtml =
                paragraphFragments.length > 0
                  ? DOMPurify.sanitize(paragraphFragments.join(''), { USE_PROFILES: { html: true } })
                  : ''

              return (
                <section
                  key={index}
                  ref={(node) => {
                    sectionRefs.current[index] = node
                  }}
                  className="prose prose-lg max-w-none epub-section"
                  onContextMenu={handleContextMenu}
                  onClick={handleContentClick}
                >
                  <div
                    className="epub-content"
                    dangerouslySetInnerHTML={{
                      __html: sectionHtml || fallbackHtml
                    }}
                  />
                </section>
              )
            })}
          </div>
        )}
      </div>

      {showToc && (
        <aside
          className="fixed top-24 right-6 w-64 max-h-[70vh] overflow-y-auto rounded-lg border shadow-lg z-40 bg-white dark:bg-slate-900"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="px-4 py-3 border-b font-semibold"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Table of Contents
          </div>
          <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {Array.from({ length: totalSections }).map((_, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    updatePDFViewer({ currentPage: index + 1 })
                    setShowToc(false)
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
                  style={{
                    color: index + 1 === currentPage ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  {chapters[index]?.title || `Section ${index + 1}`}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {showSearchPanel && (
        <aside
          className="fixed top-24 right-[19rem] w-80 max-h-[70vh] overflow-y-auto rounded-lg border shadow-lg z-40 bg-white dark:bg-slate-900"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="px-4 py-3 border-b font-semibold flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Search
            <button
              onClick={() => setShowSearchPanel(false)}
              className="text-xs text-blue-500 hover:underline"
            >
              Close
            </button>
          </div>
          <div className="p-4 space-y-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search within this book..."
              className="w-full border rounded-md px-3 py-2"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <div>
              <p className="text-xs mb-2">
                {searchQuery.trim().length === 0
                  ? 'Enter a word or phrase to highlight matches.'
                  : searchResults.length === 0
                    ? 'No matches found.'
                    : `${searchResults.reduce((total, result) => total + result.count, 0)} match(es) across ${searchResults.length} section(s).`}
              </p>
              <ul className="space-y-3">
                {searchResults.map((result) => (
                  <li key={`${result.section}-${result.snippet}`}>
                    <button
                      onClick={() => {
                        updatePDFViewer({ currentPage: result.section })
                        setShowSearchPanel(false)
                      }}
                      className="w-full text-left border rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: 'var(--color-primary)' }}>Section {result.section}</span>
                        <span>{result.count} hit{result.count > 1 ? 's' : ''}</span>
                      </div>
                      <div
                        className="text-sm leading-snug"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      )}

      {showPreferences && (
        <aside
          className="fixed top-24 right-72 w-72 max-h-[70vh] overflow-y-auto rounded-lg border shadow-lg z-40 bg-white dark:bg-slate-900"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div
            className="px-4 py-3 border-b font-semibold flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Reader Settings
            <button
              onClick={() => setShowPreferences(false)}
              className="text-xs text-blue-500 hover:underline"
            >
              Close
            </button>
          </div>
          <div className="p-4 space-y-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="space-y-2">
              <label className="block font-medium">Font family</label>
              <select
                value={typography.fontFamily}
                onChange={(event) => updateTypography({ fontFamily: event.target.value as typeof typography.fontFamily })}
                className="w-full border rounded-md px-2 py-1"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {fontOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Line height</label>
              <select
                value={typography.lineHeight}
                onChange={(event) => updateTypography({ lineHeight: Number(event.target.value) })}
                className="w-full border rounded-md px-2 py-1"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {lineHeightOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Theme</label>
              <select
                value={typography.theme}
                onChange={(event) => updateTypography({ theme: event.target.value as typeof typography.theme })}
                className="w-full border rounded-md px-2 py-1"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {themeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Layout width</label>
              <select
                value={typography.maxWidth || 800}
                onChange={(event) => updateTypography({ maxWidth: Number(event.target.value) })}
                className="w-full border rounded-md px-2 py-1"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {widthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>
      )}

      <div className="px-6 pb-6">
        <AudioWidget />
      </div>

      {activeImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setActiveImage(null)}
              className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md bg-black/60 text-white text-sm hover:bg-black/80 transition-colors"
            >
              Close
            </button>
            <img
              src={activeImage}
              alt="Enlarged illustration"
              className="max-h-[90vh] w-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

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

