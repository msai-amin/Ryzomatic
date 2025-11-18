/**
 * PDFViewerV2 - New PDF Viewer using react-pdf-viewer
 * 
 * This component replaces the custom PDF.js implementation with react-pdf-viewer
 * which provides better highlighting support and eliminates coordinate conversion issues.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Viewer, Worker, DocumentLoadEvent, PageChangeEvent, ZoomEvent, RotateEvent, ScrollMode } from '@react-pdf-viewer/core'
import { highlightPlugin, HighlightArea, RenderHighlightTargetProps, RenderHighlightContentProps, RenderHighlightsProps, SelectionData } from '@react-pdf-viewer/highlight'
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { rotatePlugin } from '@react-pdf-viewer/rotate'
import { searchPlugin } from '@react-pdf-viewer/search'
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation'

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/highlight/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'
import '@react-pdf-viewer/search/lib/styles/index.css'
import '@react-pdf-viewer/page-navigation/lib/styles/index.css'

import { useAppStore, Document as DocumentType } from '../store/appStore'
import { highlightService, Highlight as HighlightType } from '../services/highlightService'
import { useTheme } from '../../themes/ThemeProvider'
import { getPDFWorkerSrc, configurePDFWorker } from '../utils/pdfjsConfig'
import { parseTextWithBreaks, TextSegment } from '../utils/readingModeUtils'
import { Eye, BookOpen, FileText, Type, Highlighter, Sparkles, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, ZoomIn, ZoomOut, RotateCw, Search, Palette, Moon, Sun, Maximize2, StickyNote, Library, Upload, MousePointer, Save, MessageSquare, Lightbulb, X } from 'lucide-react'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getPDFTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { notesService } from '../services/notesService'
import { AudioWidget } from './AudioWidget'
import { HighlightColorPopover } from './HighlightColorPopover'
import { OCRBanner, OCRStatusBadge } from './OCRStatusBadge'
import { HighlightManagementPanel } from './HighlightManagementPanel'
import { NotesPanel } from './NotesPanel'
import { LibraryModal } from './LibraryModal'
import { DocumentUpload } from './DocumentUpload'
import { TTSControls } from './TTSControls'

interface PDFViewerV2Props {
  // No props needed - gets document from store
}

export const PDFViewerV2: React.FC<PDFViewerV2Props> = () => {
  const {
    currentDocument,
    pdfViewer,
    typography,
    tts,
    updatePDFViewer,
    updateTypography,
    updateTTS,
    user,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    setRightSidebarTab,
    setSelectedTextContext,
    setChatMode,
    toggleChat,
    isChatOpen,
  } = useAppStore()

  const { annotationColors } = useTheme()
  const userId = user?.id ?? null

  // Get document from store
  const document = currentDocument

  // Early return if no document - prevents infinite loops
  if (!document || !document.pdfData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            No document loaded
          </p>
        </div>
      </div>
    )
  }

  // Safety check: ensure annotationColors is an array
  // CRITICAL: This must be defined before any useMemo hooks to prevent undefined.length errors
  const safeAnnotationColors = Array.isArray(annotationColors) ? annotationColors : []
  const safeAnnotationColorsLength = safeAnnotationColors.length

  // State declarations (must be before early returns per React hooks rules)
  const [highlights, setHighlights] = useState<HighlightType[]>([])
  // Ref to store highlights for use in plugin render functions (avoids recreating plugin on every highlight change)
  const highlightsRef = useRef<HighlightType[]>([])
  const [currentHighlightColor, setCurrentHighlightColor] = useState(safeAnnotationColors[0]?.id || 'yellow')
  const [currentHighlightColorHex, setCurrentHighlightColorHex] = useState((safeAnnotationColors[0] as any)?.color || '#ffeb3b')
  const [showHighlightColorPopover, setShowHighlightColorPopover] = useState(false)
  const highlightColorButtonRef = useRef<HTMLButtonElement>(null)
  const [numPages, setNumPages] = useState<number>(document?.totalPages || 0)
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number | null>(null)
  const currentParagraphIndexRef = useRef<number | null>(null)
  const isUpdatingParagraphRef = useRef<boolean>(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isPDFjsReady, setIsPDFjsReady] = useState(false)
  const [ocrStatus, setOcrStatus] = useState(document?.ocrStatus || 'not_needed')
  const [ocrError, setOcrError] = useState<string | undefined>()
  const [ocrCanRetry, setOcrCanRetry] = useState(false)
  const [showHighlightPanel, setShowHighlightPanel] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [selectionEnabled, setSelectionEnabled] = useState(true)

  // Log component mount
  console.log('🔍 PDFViewerV2: Component rendering', {
    hasDocument: !!document,
    hasPdfData: !!document?.pdfData,
    isPDFjsReady,
    documentId: document?.id
  })

  // Ensure PDF.js is initialized before rendering Worker
  // CRITICAL: react-pdf-viewer's Worker component accesses PDF.js directly
  // We need to ensure GlobalWorkerOptions exists on the PDF.js instance it uses
  // NOTE: This useEffect MUST run before any early returns, so it's placed here
  useEffect(() => {
    console.log('🔍 PDFViewerV2: useEffect for PDF.js initialization started', {
      hasDocument: !!document,
      hasPdfData: !!document?.pdfData
    })
    
    const ensurePDFjs = async () => {
      try {
        console.log('🔍 PDFViewerV2: Starting PDF.js import...')
        
        let pdfjsLib: any
        
        // CRITICAL: Use globalThis.pdfjsLib if it exists (set in main.tsx)
        // This avoids Vite bundling issues with dynamic imports
        if (typeof globalThis !== 'undefined' && (globalThis as any).pdfjsLib) {
          pdfjsLib = (globalThis as any).pdfjsLib
          console.log('📚 PDFViewerV2: Using globalThis.pdfjsLib', {
            hasGlobalWorkerOptions: !!pdfjsLib?.GlobalWorkerOptions,
            hasGetDocument: !!pdfjsLib?.getDocument,
            libKeys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 10) : []
          })
        } else {
          // Fallback: Try dynamic import if globalThis.pdfjsLib doesn't exist
          console.log('📚 PDFViewerV2: globalThis.pdfjsLib not found, trying dynamic import...')
          const pdfjsModule = await import('pdfjs-dist')
          pdfjsLib = pdfjsModule.default || pdfjsModule
          
          // Set as globalThis for future use
          if (typeof globalThis !== 'undefined') {
            ;(globalThis as any).pdfjsLib = pdfjsLib
          }
        }
        
        console.log('📚 PDFViewerV2: PDF.js imported', {
          hasLib: !!pdfjsLib,
          hasGlobalWorkerOptions: !!pdfjsLib?.GlobalWorkerOptions,
          libKeys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 10) : [],
          hasGetDocument: !!pdfjsLib?.getDocument
        })
        
        // Set as globalThis.pdfjsLib for consistency
        if (typeof globalThis !== 'undefined') {
          ;(globalThis as any).pdfjsLib = pdfjsLib
        }
        
        // Check if globalThis.pdfjsLib already exists (from main.tsx) and use it if it's the same
        if (typeof globalThis !== 'undefined' && (globalThis as any).pdfjsLib) {
          const existingLib = (globalThis as any).pdfjsLib
          console.log('📚 PDFViewerV2: Found existing globalThis.pdfjsLib', {
            hasGlobalWorkerOptions: !!existingLib?.GlobalWorkerOptions,
            workerSrc: existingLib?.GlobalWorkerOptions?.workerSrc,
            isSameInstance: existingLib === pdfjsLib
          })
          
          // Use existing if it has GlobalWorkerOptions configured
          if (existingLib?.GlobalWorkerOptions?.workerSrc) {
            console.log('✅ PDFViewerV2: Using existing PDF.js instance')
            
            // CRITICAL: react-pdf-viewer's Worker uses require('pdfjs-dist') which gets transpiled to ES module import
            // The dynamic import returns an empty object in Vite, so we can't configure it that way
            // Instead, we rely on the fact that globalThis.pdfjsLib is already configured
            // and hope that react-pdf-viewer will use the same instance or that the Worker
            // component will accept the workerUrl prop and configure it itself
            // 
            // Actually, looking at the Worker component source, it tries to set:
            // PdfJsApi__namespace.GlobalWorkerOptions.workerSrc = workerUrl
            // So it expects GlobalWorkerOptions to exist on the module it imports
            // 
            // Since the dynamic import returns empty, we need to ensure the module is configured
            // before react-pdf-viewer imports it. The best way is to ensure main.tsx configured it,
            // which it should have. But if react-pdf-viewer imports a different instance, we're stuck.
            //
            // Let's try a different approach: use the workerUrl prop on Worker component
            // and hope it can configure the module itself, OR accept that we can't configure
            // the module and let the Worker component handle it (it might create GlobalWorkerOptions
            // if it doesn't exist)
            
            console.log('✅ PDFViewerV2: Using existing PDF.js instance (globalThis.pdfjsLib)')
            console.log('📚 PDFViewerV2: Note - react-pdf-viewer Worker will use its own pdfjs-dist import')
            console.log('📚 PDFViewerV2: Worker component should handle GlobalWorkerOptions configuration via workerUrl prop')
            
            setIsPDFjsReady(true)
            return
          } else if (existingLib?.GlobalWorkerOptions) {
            // Configure worker if not set
            console.log('📚 PDFViewerV2: Configuring worker on existing instance...')
            configurePDFWorker(existingLib)
            if (existingLib.GlobalWorkerOptions.workerSrc) {
              console.log('✅ PDFViewerV2: Configured existing PDF.js instance', {
                workerSrc: existingLib.GlobalWorkerOptions.workerSrc
              })
              
              // Also configure the module for react-pdf-viewer
              try {
                const pdfjsModule = await import('pdfjs-dist')
                const moduleLib = pdfjsModule.default || pdfjsModule
                if (moduleLib?.GlobalWorkerOptions) {
                  moduleLib.GlobalWorkerOptions.workerSrc = existingLib.GlobalWorkerOptions.workerSrc
                }
                if (pdfjsModule.default?.GlobalWorkerOptions) {
                  pdfjsModule.default.GlobalWorkerOptions.workerSrc = existingLib.GlobalWorkerOptions.workerSrc
                }
                if (pdfjsModule.GlobalWorkerOptions) {
                  pdfjsModule.GlobalWorkerOptions.workerSrc = existingLib.GlobalWorkerOptions.workerSrc
                }
              } catch (moduleError) {
                console.warn('⚠️ PDFViewerV2: Failed to configure pdfjs-dist module:', moduleError)
              }
              
              setIsPDFjsReady(true)
              return
            }
          }
        }
        
        // CRITICAL: Ensure GlobalWorkerOptions exists
        // In pdfjs-dist v3.x, GlobalWorkerOptions should always exist
        if (!pdfjsLib) {
          console.error('❌ PDFViewerV2: pdfjsLib is null/undefined after import')
          setIsPDFjsReady(false)
          return
        }
        
        // Check if GlobalWorkerOptions exists
        if (!pdfjsLib.GlobalWorkerOptions) {
          console.error('❌ PDFViewerV2: GlobalWorkerOptions missing from PDF.js library', {
            pdfjsLibKeys: Object.keys(pdfjsLib).slice(0, 20),
            pdfjsLibType: typeof pdfjsLib
          })
          setIsPDFjsReady(false)
          return
        }
        
        // CRITICAL: Ensure GlobalWorkerOptions.workerSrc is set BEFORE Worker component renders
        // react-pdf-viewer's Worker component will try to access this immediately
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          console.log('📚 PDFViewerV2: Configuring worker...')
          configurePDFWorker(pdfjsLib)
        }
        
        // Verify it was set correctly
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          console.error('❌ PDFViewerV2: Failed to set workerSrc', {
            hasGlobalWorkerOptions: !!pdfjsLib.GlobalWorkerOptions,
            workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
          })
          setIsPDFjsReady(false)
          return
        }
        
        // CRITICAL: Import and configure pdfjs-dist module for react-pdf-viewer
        // react-pdf-viewer's Worker uses require('pdfjs-dist') which gets transpiled to ES module import
        // We need to ensure the module it imports also has GlobalWorkerOptions configured
        const workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc
        try {
          const pdfjsModule = await import('pdfjs-dist')
          const moduleLib = pdfjsModule.default || pdfjsModule
          
          // Configure the module instance that react-pdf-viewer will import
          if (moduleLib?.GlobalWorkerOptions) {
            moduleLib.GlobalWorkerOptions.workerSrc = workerSrc
            console.log('📚 PDFViewerV2: Configured pdfjs-dist module default export')
          }
          
          // Also configure module exports
          if (pdfjsModule.default?.GlobalWorkerOptions) {
            pdfjsModule.default.GlobalWorkerOptions.workerSrc = workerSrc
          }
          if (pdfjsModule.GlobalWorkerOptions) {
            pdfjsModule.GlobalWorkerOptions.workerSrc = workerSrc
          }
          
          console.log('✅ PDFViewerV2: PDF.js ready', {
            hasGlobalWorkerOptions: !!pdfjsLib.GlobalWorkerOptions,
            workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
            pdfjsVersion: pdfjsLib.version || 'unknown',
            moduleDefaultHasWorkerSrc: !!pdfjsModule.default?.GlobalWorkerOptions?.workerSrc,
            moduleHasWorkerSrc: !!pdfjsModule.GlobalWorkerOptions?.workerSrc,
            moduleLibHasWorkerSrc: !!moduleLib?.GlobalWorkerOptions?.workerSrc
          })
        } catch (moduleError) {
          console.warn('⚠️ PDFViewerV2: Failed to configure pdfjs-dist module:', moduleError)
          console.log('✅ PDFViewerV2: PDF.js ready (using globalThis instance only)', {
            hasGlobalWorkerOptions: !!pdfjsLib.GlobalWorkerOptions,
            workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
          })
        }
        
        setIsPDFjsReady(true)
      } catch (error) {
        console.error('❌ PDFViewerV2: Failed to ensure PDF.js initialization:', error)
        setIsPDFjsReady(false)
      }
    }
    
    ensurePDFjs()
  }, []) // Run once on mount
  
  // Toggle reading mode
  const toggleReadingMode = useCallback(() => {
    updatePDFViewer({ readingMode: !pdfViewer.readingMode })
  }, [pdfViewer.readingMode, updatePDFViewer])

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    updatePDFViewer({ darkMode: !pdfViewer.darkMode })
  }, [pdfViewer.darkMode, updatePDFViewer])
  
  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (hasTextSelection()) {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }, [])
  
  // Handle download
  const handleDownload = useCallback(async () => {
    if (!user || !document) return

    try {
      // Download the PDF file
      const pdfLink = window.document.createElement('a')
      pdfLink.href = URL.createObjectURL(new Blob([document.pdfData as BlobPart], { type: 'application/pdf' }))
      pdfLink.download = document.name
      pdfLink.click()

      // Get notes for this document
      const { data: notesData } = await notesService.getNotesForBook(user.id, document.id)
      const notes = notesData || []

      // Create notes file content
      // Safety check: ensure highlights is an array
      const safeHighlights = Array.isArray(highlights) ? highlights : []
      if (notes.length > 0 || safeHighlights.length > 0) {
        let notesContent = `# Notes and Highlights for ${document.name}\n\n`
        notesContent += `Generated on: ${new Date().toLocaleString()}\n\n`
        
        // Add highlights section
        if (safeHighlights.length > 0) {
          notesContent += `## Highlights\n\n`
          safeHighlights.forEach((highlight, idx) => {
            notesContent += `### Highlight ${idx + 1} (Page ${highlight.page_number})\n`
            notesContent += `**Text:** ${highlight.highlighted_text}\n`
            notesContent += `**Color:** ${highlight.color_hex}\n`
            notesContent += `**Date:** ${new Date(highlight.created_at).toLocaleString()}\n\n`
          })
        }

        // Add notes section
        if (notes.length > 0) {
          notesContent += `## Notes\n\n`
          notes.forEach((note, idx) => {
            notesContent += `### Note ${idx + 1} (Page ${note.page_number})\n`
            notesContent += `**Type:** ${note.note_type}\n`
            notesContent += `**Content:**\n${note.content}\n`
            notesContent += `**Date:** ${new Date(note.created_at).toLocaleString()}\n\n`
          })
        }

        // Download notes file
        const notesBlob = new Blob([notesContent], { type: 'text/markdown' })
        const notesLink = window.document.createElement('a')
        notesLink.href = URL.createObjectURL(notesBlob)
        notesLink.download = `${document.name.replace(/\.pdf$/i, '')}-notes-and-highlights.md`
        
        // Trigger download after a small delay to ensure PDF download starts first
        setTimeout(() => {
          notesLink.click()
          URL.revokeObjectURL(notesLink.href)
        }, 500)
      }

      // Clean up PDF blob URL
      URL.revokeObjectURL(pdfLink.href)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF. Please try again.')
    }
  }, [user, document, highlights])

  // Handle context menu actions
  const handleClarification = useCallback(() => {
    const pageText = document.pageTexts?.[pdfViewer.currentPage - 1]
    const context = getPDFTextSelectionContext(pdfViewer.currentPage, pageText)
    if (context) {
      setSelectedTextContext(context)
      setChatMode('clarification')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pdfViewer.currentPage, document.pageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])
  
  const handleFurtherReading = useCallback(() => {
    const pageText = document.pageTexts?.[pdfViewer.currentPage - 1]
    const context = getPDFTextSelectionContext(pdfViewer.currentPage, pageText)
    if (context) {
      setSelectedTextContext(context)
      setChatMode('further-reading')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pdfViewer.currentPage, document.pageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])
  
  const handleSaveNote = useCallback(async () => {
    const pageText = document.pageTexts?.[pdfViewer.currentPage - 1]
    const context = getPDFTextSelectionContext(pdfViewer.currentPage, pageText)
    if (context && document.id && userId) {
      try {
        await notesService.createNote(
          userId,
          document.id,
          pdfViewer.currentPage,
          context.selectedText,
          'freeform',
          undefined,
          false
        )
        console.log('Note saved from selection')
      } catch (error) {
        console.error('Error saving note:', error)
      }
    }
    setContextMenu(null)
  }, [document.id, document.pageTexts, userId, pdfViewer.currentPage])

  // Sync highlights ref with state
  useEffect(() => {
    highlightsRef.current = highlights
  }, [highlights])

  // Load highlights when document loads
  useEffect(() => {
    const loadHighlights = async () => {
      if (!document.id) return

      try {
        const bookHighlights = await highlightService.getHighlights(document.id, {
          includeOrphaned: true
        })
        // Don't wipe out existing local highlights if backend returns empty (e.g., local dev/no API)
        if (Array.isArray(bookHighlights) && bookHighlights.length > 0) {
          setHighlights(bookHighlights)
          console.log(`Loaded ${bookHighlights.length} highlights from database`)
        } else {
          console.log('Skipping highlight overwrite: backend returned empty; preserving local highlights')
        }
      } catch (error: any) {
        console.warn('Highlights not available:', error)
        // Preserve any locally created highlights instead of clearing
      }
    }

    loadHighlights()
  }, [document.id])

  // Poll for OCR status updates
  useEffect(() => {
    if (!document?.id) return
    
    if (ocrStatus === 'processing' || ocrStatus === 'pending') {
      // Start polling for status updates
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/documents?action=ocr-status&documentId=${document.id}`)
          
          if (response.ok) {
            const data = await response.json()
            
            if (data.ocrStatus !== ocrStatus) {
              setOcrStatus(data.ocrStatus)
              
              // Update error info if failed
              if (data.ocrStatus === 'failed') {
                setOcrError(data.ocrMetadata?.error || 'OCR processing failed')
                setOcrCanRetry(data.ocrMetadata?.canRetry ?? true)
              }
              
              // Update document content if completed
              if (data.ocrStatus === 'completed' && data.content) {
                console.log('OCR completed successfully, text extracted')
                // TODO: Update document content in store
              }
              
              // Clear interval if done (completed or failed)
              if (data.ocrStatus !== 'processing' && data.ocrStatus !== 'pending') {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current)
                  pollingIntervalRef.current = null
                }
              }
            }
          }
        } catch (error) {
          console.error('Error checking OCR status:', error)
        }
      }, 3000) // Poll every 3 seconds

      // Cleanup interval on unmount or status change
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [ocrStatus, document?.id])

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (typeof window === 'undefined' || !window.document) return

    if (!isFullscreen) {
      if (window.document.documentElement.requestFullscreen) {
        window.document.documentElement.requestFullscreen()
      }
    } else {
      if (window.document.exitFullscreen) {
        window.document.exitFullscreen()
      }
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }

    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Handle window resize to ensure responsive sizing
  // This is especially important after document upload when container size may change
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.document === 'undefined') return

    const handleResize = () => {
      // Trigger a resize event on the viewer container to force react-pdf-viewer to recalculate
      const viewerContainer = window.document.querySelector('.pdf-viewer-container')
      if (viewerContainer) {
        // Dispatch a custom resize event
        window.dispatchEvent(new Event('resize'))
      }
    }

    window.addEventListener('resize', handleResize)
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  // Recalculate size when document changes (e.g., after upload)
  useEffect(() => {
    if (!document?.id) return

    // Small delay to ensure DOM has updated and container has proper size
    const timeoutId = setTimeout(() => {
      // Force a resize event to trigger react-pdf-viewer recalculation
      window.dispatchEvent(new Event('resize'))
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [document?.id])

  // Note: PDF.js worker is configured via Worker component wrapper
  // No need to manually configure GlobalWorkerOptions

  // Handle creating a new highlight
  const handleCreateHighlight = useCallback(async (
    highlightAreas: HighlightArea[],
    selectedText: string,
    selectionData?: SelectionData
  ) => {
    if (!document.id || !userId || !highlightAreas || highlightAreas.length === 0) return

    try {
      // Get the first highlight area (react-pdf-viewer provides multiple areas for multi-line selections)
      const firstArea = highlightAreas[0]
      
      // Convert pageIndex (0-based) to pageNumber (1-based)
      const pageNumber = firstArea.pageIndex + 1

      // Get current highlight color
      const color = safeAnnotationColors.find(c => c.id === currentHighlightColor) || safeAnnotationColors[0]
      const colorHex = (color as any)?.color || currentHighlightColorHex || '#ffeb3b'
      
      // Create highlight using highlight service
      const newHighlight = await highlightService.createHighlight({
        bookId: document.id,
        pageNumber,
        highlightedText: selectedText || '',
        colorId: currentHighlightColor,
        colorHex: colorHex,
        positionData: {
          highlightAreas,
          selectionData,
        },
      })

      // Add to local state
      setHighlights(prev => [...prev, newHighlight])
      
      console.log('Highlight created:', newHighlight)
    } catch (error) {
      console.error('Error creating highlight:', error)
      alert('Failed to create highlight. Please try again.')
    }
  }, [document.id, userId, currentHighlightColor, currentHighlightColorHex, annotationColors])

  // Create highlight plugin - MUST be memoized to prevent infinite re-renders
  // The plugin instance must be stable across renders unless dependencies change
  const highlightPluginInstance = useMemo(() => highlightPlugin({
    renderHighlightTarget: (props: RenderHighlightTargetProps) => {
      if (!selectionEnabled) {
        return null
      }
      // Auto-open the highlight content popover at the selection location
      // so actions appear automatically after selection (without extra click).
      setTimeout(() => {
        try {
          props.toggle()
        } catch (_) {
          // no-op
        }
      }, 0)
      return null
    },
    renderHighlightContent: (props: RenderHighlightContentProps) => {
      // Render content for editing highlights
      // Safety check: ensure annotationColors is defined and is an array
      const colors = safeAnnotationColors
      const color = colors.find(c => c.id === currentHighlightColor) || colors[0]
      const colorHex = (color as any)?.color || currentHighlightColorHex || '#ffeb3b'
      
      // Safety check: ensure selectionRegion exists
      if (!props.selectionRegion) {
        return null
      }
      
      // Calculate position with viewport boundary detection
      const leftPercent = props.selectionRegion.left || 0
      const topPercent = (props.selectionRegion.top || 0) + (props.selectionRegion.height || 0)
      // Adjust if popup would go off right edge (assuming ~300px width)
      const adjustedLeft = leftPercent > 70 ? `${leftPercent - 15}%` : `${leftPercent}%`
      
      return (
        <div
          style={{
            background: 'var(--color-surface, #111827)',
            border: '1px solid var(--color-border, #374151)',
            borderRadius: '8px',
            padding: '10px',
            position: 'absolute',
            left: adjustedLeft,
            top: `${topPercent}%`,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            minWidth: '240px',
            maxWidth: '320px',
            color: 'var(--color-text-primary, #f9fafb)',
          }}
        >
          {/* Selected text preview - simplified */}
          <div style={{ 
            marginBottom: '10px', 
            fontSize: '13px', 
            color: 'var(--color-text-secondary, #d1d5db)',
            lineHeight: '1.4',
            padding: '6px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--color-background, #0f172a)',
            maxHeight: '60px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            "{props.selectedText && props.selectedText.length > 80 ? props.selectedText.substring(0, 80) + '...' : (props.selectedText || '')}"
          </div>

          {/* Primary Action - Save Highlight */}
          <button
            style={{
              backgroundColor: colorHex,
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '8px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            onClick={async () => {
              if (props.selectedText && props.highlightAreas) {
                await handleCreateHighlight(props.highlightAreas, props.selectedText, props.selectionData)
              }
              props.cancel()
            }}
          >
            <Save className="w-4 h-4" />
            Save Highlight
          </button>

          {/* Secondary Actions - Grouped */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginBottom: '6px'
          }}>
            <button
              style={{
                backgroundColor: 'var(--color-surface-hover, #1f2937)',
                border: '1px solid var(--color-border, #374151)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--color-text-primary, #f9fafb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface, #111827)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #1f2937)'}
              onClick={() => {
                if (props.selectedText) {
                  setSelectedTextContext({
                    selectedText: props.selectedText,
                    beforeContext: '',
                    afterContext: '',
                    pageNumber: (props.highlightAreas?.[0]?.pageIndex ?? 0) + 1,
                    fullContext: props.selectedText
                  })
                  setChatMode('clarification')
                  if (!isChatOpen) toggleChat()
                }
                props.cancel()
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI
            </button>
            <button
              style={{
                backgroundColor: 'var(--color-surface-hover, #1f2937)',
                border: '1px solid var(--color-border, #374151)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--color-text-primary, #f9fafb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface, #111827)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #1f2937)'}
              onClick={() => {
                if (props.selectedText) {
                  setSelectedTextContext({
                    selectedText: props.selectedText,
                    beforeContext: '',
                    afterContext: '',
                    pageNumber: (props.highlightAreas?.[0]?.pageIndex ?? 0) + 1,
                    fullContext: props.selectedText
                  })
                  setChatMode('further-reading')
                  if (!isChatOpen) toggleChat()
                }
                props.cancel()
              }}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Suggestions
            </button>
          </div>

          {/* Tertiary Actions */}
          <div style={{
            display: 'flex',
            gap: '6px'
          }}>
            <button
              style={{
                backgroundColor: 'var(--color-surface-hover, #1f2937)',
                border: '1px solid var(--color-border, #374151)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--color-text-primary, #f9fafb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                flex: 1,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface, #111827)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #1f2937)'}
              onClick={async () => {
                try {
                  if (document.id && userId && props.selectedText) {
                    await notesService.createNote(
                      userId,
                      document.id,
                      ((props.highlightAreas?.[0]?.pageIndex ?? 0) + 1),
                      props.selectedText,
                      'freeform',
                      undefined,
                      false
                    )
                    setIsRightSidebarOpen(true)
                    setRightSidebarTab('notes')
                  }
                } catch (err) {
                  console.error('Failed to save note from selection popover', err)
                }
                props.cancel()
              }}
            >
              <StickyNote className="w-3.5 h-3.5" />
              Save Note
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border, #374151)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--color-text-secondary, #d1d5db)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #1f2937)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={props.cancel}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )
    },
    renderHighlights: (props: RenderHighlightsProps) => {
      // Render existing highlights - use ref to avoid plugin recreation on highlight changes
      // Safety check: ensure highlightsRef.current is defined and is an array
      const highlights = Array.isArray(highlightsRef.current) ? highlightsRef.current : []
      const pageHighlights = highlights.filter((highlight) => highlight.page_number - 1 === props.pageIndex)
      
      if (pageHighlights.length === 0) {
        return null
      }
      
      return (
        <div>
          {pageHighlights.map((highlight) => {
            // Convert highlight position data to HighlightArea format
            const highlightAreas = highlight.position_data?.highlightAreas || []
            
            return highlightAreas
              .filter((area) => area.pageIndex === props.pageIndex)
              .map((area, idx) => (
                <div
                  key={`${highlight.id}-${idx}`}
                  style={{
                    background: highlight.color_hex || '#ffeb3b',
                    opacity: 0.4,
                    cursor: 'pointer',
                    ...props.getCssProperties(area, props.rotation),
                  }}
                  onClick={() => {
                    // Handle highlight click (e.g., show notes, edit, etc.)
                    console.log('Highlight clicked:', highlight)
                    // TODO: Open highlight management panel or show highlight details
                  }}
                  onMouseEnter={(e) => {
                    // Show highlight on hover
                    e.currentTarget.style.opacity = '0.6'
                  }}
                  onMouseLeave={(e) => {
                    // Reset opacity on mouse leave
                    e.currentTarget.style.opacity = '0.4'
                  }}
                />
              ))
          })}
        </div>
      )
    },
  }), [
    // Dependencies that affect the plugin behavior
    // Note: Only include primitive values and stable references
    // highlights is accessed via ref, so we don't need it in dependencies
    selectionEnabled,
    currentHighlightColor,
    currentHighlightColorHex,
    handleCreateHighlight,
    // Use nullish coalescing to ensure these are never undefined (React comparison issue)
    document.id ?? '',
    userId ?? '',
    // annotationColors is used in renderHighlightContent, but we check if it's an array
    // Include it to ensure plugin updates if colors change
    // Note: Use safeAnnotationColorsLength (number) instead of array to prevent React comparison issues
    safeAnnotationColorsLength,
    // Store setters are stable and don't need to be in dependencies
    // isChatOpen is a primitive value that affects behavior
    isChatOpen,
  ])

  // Create scroll mode plugin (do NOT wrap in useMemo; keep hook order consistent)
  const scrollModePluginInstance = scrollModePlugin()

  // Create zoom plugin (do NOT wrap in useMemo)
  const zoomPluginInstance = zoomPlugin({ enableShortcuts: false }) // Disable shortcuts, we'll handle them ourselves

  // Create rotate plugin (do NOT wrap in useMemo)
  const rotatePluginInstance = rotatePlugin()

  // Create search plugin (do NOT wrap in useMemo)
  // TEMPORARILY DISABLED: searchPlugin causing "t.get is not a function" error
  // const searchPluginInstance = searchPlugin()

  // Create page navigation plugin (do NOT wrap in useMemo)
  const pageNavigationPluginInstance = pageNavigationPlugin({ enableShortcuts: false }) // Disable shortcuts, we'll handle them ourselves

  // CRITICAL: Memoize plugins array to prevent infinite re-renders
  // The plugins themselves are stable, but the array reference changes on every render
  // Filter out any undefined plugins to prevent errors
  const plugins = useMemo(() => {
    // Ensure all plugins are defined before creating array
    if (!highlightPluginInstance || !scrollModePluginInstance || !zoomPluginInstance || 
        !rotatePluginInstance || !pageNavigationPluginInstance) {
      console.warn('⚠️ PDFViewerV2: Some plugins are undefined', {
        highlightPluginInstance: !!highlightPluginInstance,
        scrollModePluginInstance: !!scrollModePluginInstance,
        zoomPluginInstance: !!zoomPluginInstance,
        rotatePluginInstance: !!rotatePluginInstance,
        pageNavigationPluginInstance: !!pageNavigationPluginInstance,
      })
      return [] // Return empty array if plugins aren't ready
    }
    
    const pluginList = [
      highlightPluginInstance,
      scrollModePluginInstance,
      zoomPluginInstance,
      rotatePluginInstance,
      // searchPluginInstance, // TEMPORARILY DISABLED due to "t.get is not a function" error
      pageNavigationPluginInstance,
    ]
    
    return pluginList
  }, [
    // Only recreate if these dependencies change
    highlightPluginInstance,
    scrollModePluginInstance,
    zoomPluginInstance,
    rotatePluginInstance,
    // searchPluginInstance, // TEMPORARILY DISABLED
    pageNavigationPluginInstance,
  ])

  // Cache blob URL and Uint8Array to prevent memory leaks and infinite re-renders
  const blobUrlRef = useRef<string | null>(null)
  const uint8ArrayRef = useRef<Uint8Array | null>(null)
  const documentIdRef = useRef<string | null>(null)
  
  // Convert document.pdfData to a format react-pdf-viewer can use
  // CRITICAL: Use refs to cache values and prevent infinite re-renders
  // Creating new Uint8Array on every render causes React to see it as a new value
  const documentUrl = useMemo((): string | Uint8Array => {
    // pdfData is guaranteed to exist at this point due to early return above
    if (!document.pdfData) {
      throw new Error('No PDF data available - this should not happen')
    }

    // If it's already a string (URL), return it
    if (typeof document.pdfData === 'string') {
      return document.pdfData
    }

    // If it's a Blob, create a blob URL (cached)
    if (document.pdfData instanceof Blob) {
      // Only create new blob URL if document changed
      if (documentIdRef.current !== document.id || !blobUrlRef.current) {
        // Clean up old blob URL if document changed
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }
        blobUrlRef.current = URL.createObjectURL(document.pdfData)
        documentIdRef.current = document.id
      }
      return blobUrlRef.current
    }

    // If it's an ArrayBuffer, cache the Uint8Array to prevent infinite re-renders
    if (document.pdfData instanceof ArrayBuffer) {
      // Only recreate if document changed or ref is empty
      if (documentIdRef.current !== document.id || !uint8ArrayRef.current) {
        try {
          // Always clone the ArrayBuffer to prevent detachment
          const clonedBuffer = document.pdfData.slice(0)
          uint8ArrayRef.current = new Uint8Array(clonedBuffer)
          documentIdRef.current = document.id
          console.log('✅ PDFViewerV2: Cloned ArrayBuffer for PDF.js:', {
            originalSize: document.pdfData.byteLength,
            clonedSize: clonedBuffer.byteLength,
            documentId: document.id
          });
        } catch (error) {
          // If cloning fails, the ArrayBuffer is likely already detached or corrupted
          console.error('❌ PDFViewerV2: Failed to clone ArrayBuffer:', error)
          throw new Error('PDF data is corrupted or detached. Please try re-opening the document.')
        }
      }
      return uint8ArrayRef.current
    }

    // Fallback: try to convert to Uint8Array (shouldn't reach here if pdfData is ArrayBuffer)
    try {
      if (documentIdRef.current !== document.id || !uint8ArrayRef.current) {
        uint8ArrayRef.current = new Uint8Array(document.pdfData as ArrayBuffer)
        documentIdRef.current = document.id
      }
      return uint8ArrayRef.current
    } catch (error) {
      console.error('❌ PDFViewerV2: Failed to convert pdfData to Uint8Array:', error)
      throw new Error('PDF data format is invalid. Please try re-opening the document.')
    }
  }, [document.id]) // Only depend on document.id, not pdfData (which might change reference)
  
  // Cleanup blob URL and refs when document changes or component unmounts
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      // Clear Uint8Array ref when document changes
      if (documentIdRef.current !== document.id) {
        uint8ArrayRef.current = null
        documentIdRef.current = null
      }
    }
  }, [document.id])

  // Sync ref with state when currentParagraphIndex changes
  useEffect(() => {
    currentParagraphIndexRef.current = currentParagraphIndex
  }, [currentParagraphIndex])

  // Memoized handler for paragraph index updates to prevent infinite loops
  const handleParagraphMouseEnter = useCallback((paragraphIdx: number | undefined) => {
    // CRITICAL: Prevent any updates if already updating or during render
    if (isUpdatingParagraphRef.current || paragraphIdx === undefined) {
      return
    }
    
    // Only update if value actually changed
    if (currentParagraphIndexRef.current !== paragraphIdx) {
      // Set flag immediately to prevent any concurrent updates
      isUpdatingParagraphRef.current = true
      currentParagraphIndexRef.current = paragraphIdx
      
      // Use setTimeout to defer state update to next event loop
      // This ensures we're not in a render cycle
      setTimeout(() => {
        if (currentParagraphIndexRef.current === paragraphIdx) {
          setCurrentParagraphIndex(paragraphIdx)
        }
        // Reset flag after a delay to prevent rapid updates
        setTimeout(() => {
          isUpdatingParagraphRef.current = false
        }, 100)
      }, 0)
    }
  }, [])

  // Handle document load
  const handleDocumentLoad = useCallback((e: DocumentLoadEvent) => {
    console.log('PDF loaded:', e.doc.numPages)
    setNumPages(e.doc.numPages)
    updatePDFViewer({ currentPage: 1, numPages: e.doc.numPages })
  }, [updatePDFViewer])

  // Handle page change
  const handlePageChange = useCallback((e: PageChangeEvent) => {
    updatePDFViewer({ currentPage: e.currentPage + 1 }) // Convert 0-based to 1-based
  }, [updatePDFViewer])

  // Handle zoom change
  const handleZoom = useCallback((e: ZoomEvent) => {
    updatePDFViewer({ zoom: e.scale })
  }, [updatePDFViewer])

  // Handle rotation change
  const handleRotate = useCallback((e: RotateEvent) => {
    updatePDFViewer({ rotation: e.rotation })
  }, [updatePDFViewer])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          if (pdfViewer.currentPage > 1) {
            updatePDFViewer({ currentPage: pdfViewer.currentPage - 1 })
            pageNavigationPluginInstance.jumpToPage(pdfViewer.currentPage - 2) // Convert to 0-based
          }
          break
        case 'ArrowRight':
          if (numPages && pdfViewer.currentPage < numPages) {
            updatePDFViewer({ currentPage: pdfViewer.currentPage + 1 })
            pageNavigationPluginInstance.jumpToPage(pdfViewer.currentPage) // Convert to 0-based
          }
          break
        case '+':
        case '=':
          if (!e.shiftKey) {
            e.preventDefault()
            const newZoom = Math.min(pdfViewer.zoom + 0.1, 3)
            updatePDFViewer({ zoom: newZoom })
            zoomPluginInstance.zoomTo(newZoom)
          }
          break
        case '-':
        case '_':
          if (!e.shiftKey) {
            e.preventDefault()
            const newZoom = Math.max(pdfViewer.zoom - 0.1, 0.5)
            updatePDFViewer({ zoom: newZoom })
            zoomPluginInstance.zoomTo(newZoom)
          }
          break
        case 'r':
        case 'R':
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            // Programmatically rotate forward
            // @ts-ignore - rotate is provided by plugin instance
            rotatePluginInstance.rotate?.()
          }
          break
        case 'm':
        case 'M':
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            toggleReadingMode()
          }
          break
        case 'j':
        case 'J':
          if (pdfViewer.readingMode && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            updateTypography({ textAlign: typography.textAlign === 'justify' ? 'left' : 'justify' })
          }
          break
        case 'f':
        case 'F':
          if (pdfViewer.readingMode && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            updateTypography({ focusMode: !typography.focusMode })
          }
          break
        case 'g':
        case 'G':
          if (pdfViewer.readingMode && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            updateTypography({ readingGuide: !typography.readingGuide })
          }
          break
        case 'Escape':
          if (contextMenu) {
            setContextMenu(null)
          } else if (pdfViewer.readingMode) {
            e.preventDefault()
            updatePDFViewer({ readingMode: false })
          }
          break
        default:
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [
    pdfViewer.currentPage,
    pdfViewer.zoom,
    pdfViewer.readingMode,
    numPages,
    typography.textAlign,
    typography.focusMode,
    typography.readingGuide,
    updatePDFViewer,
    updateTypography,
    toggleReadingMode,
    contextMenu,
    pageNavigationPluginInstance,
    zoomPluginInstance,
    rotatePluginInstance,
  ])

  // Render reading mode
  const renderReadingMode = () => {
    // Safety check: ensure pageTexts exists
    if (!document.pageTexts || !Array.isArray(document.pageTexts)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Page text not available. Please wait for the document to finish loading.
            </p>
          </div>
        </div>
      )
    }

    // Get theme-based styles
    const getThemeStyles = () => {
      switch (typography.theme) {
        case 'reading':
          // Reading mode theme - optimized for monitor reading
          return {
            background: 'bg-[#faf8f3]', // Match header color exactly
            text: 'text-[#2c2416]',
            headerBg: 'bg-[#faf8f3]/90',
            headerBorder: 'border-[#d4c9b8]',
            buttonBg: 'bg-[#e5dfd2]',
            buttonHover: 'hover:bg-[#d4c9b8]',
            buttonText: 'text-[#2c2416]',
            indicatorBg: 'bg-[#8b7355]',
            highlightBg: 'bg-[#d4a574]/30',
            progressBg: 'bg-[#8b7355]'
          }
        case 'dark':
          return {
            background: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
            text: 'text-gray-100',
            headerBg: 'bg-gray-800/90',
            headerBorder: 'border-gray-700',
            buttonBg: 'bg-gray-700',
            buttonHover: 'hover:bg-gray-600',
            buttonText: 'text-gray-100',
            indicatorBg: 'bg-gray-700',
            highlightBg: 'bg-blue-900/50',
            progressBg: 'bg-blue-500'
          }
        case 'sepia':
          return {
            background: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100',
            text: 'text-amber-900',
            headerBg: 'bg-amber-100/90',
            headerBorder: 'border-amber-300',
            buttonBg: 'bg-amber-200',
            buttonHover: 'hover:bg-amber-300',
            buttonText: 'text-amber-900',
            indicatorBg: 'bg-amber-600',
            highlightBg: 'bg-amber-300',
            progressBg: 'bg-amber-500'
          }
        default: // light
          return {
            background: 'bg-gradient-to-br from-amber-50 via-white to-orange-50',
            text: 'text-gray-800',
            headerBg: 'bg-white/90',
            headerBorder: 'border-amber-200',
            buttonBg: 'bg-amber-100',
            buttonHover: 'hover:bg-amber-200',
            buttonText: 'text-amber-900',
            indicatorBg: 'bg-amber-500',
            highlightBg: 'bg-amber-200',
            progressBg: 'bg-amber-500'
          }
      }
    }

    const getFontFamily = () => {
      switch (typography.fontFamily) {
        case 'serif':
          return 'font-serif'
        case 'mono':
          return 'font-mono'
        default:
          return 'font-sans'
      }
    }

    const themeStyles = getThemeStyles()
    const fontClass = getFontFamily()
    const pageNumber = pdfViewer.currentPage

    // Calculate progress percentage
    const progressPercentage = numPages ? (pageNumber / numPages) * 100 : 0

    // Render page content
    const renderPageContent = (pageNum: number) => {
      // Get page text
      const rawPageText = document.pageTexts?.[pageNum - 1]
      
      // Sanitize page text
      let pageText: string
      if (rawPageText === null || rawPageText === undefined) {
        pageText = ''
      } else if (typeof rawPageText === 'string') {
        pageText = rawPageText
      } else if (typeof rawPageText === 'object') {
        try {
          pageText = JSON.stringify(rawPageText)
        } catch (e) {
          pageText = String(rawPageText)
        }
      } else {
        pageText = String(rawPageText)
      }
      
      if (!pageText) {
        return (
          <div className={`text-center py-8 ${themeStyles.text} opacity-50`}>
            No text available for page {pageNum}.
          </div>
        )
      }

      const segments = parseTextWithBreaks(pageText)
      // Safety check: ensure segments is an array
      if (!Array.isArray(segments)) {
        console.error('PDFViewerV2: parseTextWithBreaks returned non-array:', segments)
        return (
          <div className={`text-center py-8 ${themeStyles.text} opacity-50`}>
            Error processing page {pageNum} text.
          </div>
        )
      }
      const totalWords = segments.filter(s => s.type === 'word').length
      const wordsRead = tts.currentWordIndex !== null ? tts.currentWordIndex + 1 : 0
      
      // Calculate spacing
      const baseSpacing = {
        line: 0.5,
        paragraph: 1.0,
        section: 2.0
      }
      
      const spacing = {
        line: baseSpacing.line * typography.spacingMultiplier,
        paragraph: baseSpacing.paragraph * typography.spacingMultiplier,
        section: baseSpacing.section * typography.spacingMultiplier
      }
      
      return (
        <div>
          {/* Word count indicator */}
          <div className={`text-xs ${themeStyles.text} opacity-50 mb-4 text-center`}>
            {wordsRead} / {totalWords} words {wordsRead > 0 && `(${Math.round((wordsRead / totalWords) * 100)}%)`}
          </div>
          
          <div 
            className={`${themeStyles.text} ${fontClass}`}
            style={{
              fontSize: `${typography.fontSize}px`,
              lineHeight: typography.lineHeight,
              textAlign: typography.textAlign,
              hyphens: typography.textAlign === 'justify' ? 'auto' : 'none',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text'
            }}
            data-page-number={pageNum}
          >
            {segments.map((segment, index) => {
              if (segment.type === 'break') {
                if (segment.breakLevel === 1) {
                  return <span key={`break-${index}`}> </span>
                } else if (segment.breakLevel === 2) {
                  return <div key={`break-${index}`} style={{ marginTop: `${spacing.line}em` }} />
                } else if (segment.breakLevel === 3) {
                  return <div key={`break-${index}`} style={{ marginTop: `${spacing.paragraph}em` }} />
                } else if (segment.breakLevel === 4) {
                  return (
                    <div key={`break-${index}`} style={{ marginTop: `${spacing.section}em`, marginBottom: `${spacing.section}em` }}>
                      <div className={`border-t ${themeStyles.text} opacity-20 my-4`} />
                    </div>
                  )
                }
              } else if (segment.type === 'table') {
                return (
                  <div key={`table-${index}`} className="my-4 overflow-x-auto">
                    <table className={`min-w-full border-collapse border ${themeStyles.text} opacity-90`}>
                      <tbody>
                        {segment.tableData?.map((row, rowIdx) => {
                          const rowText = typeof row === 'string' ? row : String(row || '')
                          const cells = rowText.split('\t')
                          return (
                            <tr key={rowIdx} className="border-b">
                              {cells.map((cell, cellIdx) => (
                                <td 
                                  key={cellIdx} 
                                  className="border px-3 py-2 text-sm"
                                  style={{ fontFamily: 'monospace' }}
                                >
                                  {cell.trim()}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              } else if (segment.type === 'formula') {
                return (
                  <span
                    key={`formula-${index}`}
                    className={`inline-block px-2 py-1 mx-1 rounded ${themeStyles.text} bg-opacity-10`}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: `${typography.fontSize * 0.95}px`,
                      backgroundColor: themeStyles.text.includes('gray-100') ? '#1f2937' : '#f3f4f6'
                    }}
                  >
                    {segment.content}
                  </span>
                )
              } else if (segment.type === 'word') {
                const isCurrentParagraph = segment.paragraphIndex === currentParagraphIndex
                const isTTSHighlighted = tts.highlightCurrentWord && 
                                     tts.currentWordIndex === segment.wordIndex && 
                                     pageNum === pageNumber
                
                // Check if this word is within a user highlight
                let userHighlight: HighlightType | undefined
                const pageHighlights = highlights.filter(h => h.page_number === pageNum && !h.is_orphaned)
                
                // Calculate approximate character position
                const cumulativeTextLength = segments.slice(0, index).reduce((sum, seg) => 
                  sum + (seg.type === 'word' ? seg.content.length + 1 : 0), 0
                )
                
                for (const hl of pageHighlights) {
                  if (hl.text_start_offset !== undefined && hl.text_end_offset !== undefined) {
                    if (cumulativeTextLength >= hl.text_start_offset && 
                        cumulativeTextLength < hl.text_end_offset) {
                      userHighlight = hl
                      break
                    }
                  }
                }
                
                // Apply focus mode dimming
                const opacity = typography.focusMode && !isCurrentParagraph ? 0.3 : 1
                
                // Apply reading guide
                const hasParagraphIndicator = typography.readingGuide && isCurrentParagraph
                
                return (
                  <span
                    key={`word-${index}`}
                    className={`inline-block transition-all duration-200 ${
                      isTTSHighlighted 
                        ? `${themeStyles.highlightBg} px-1 rounded shadow-sm transform scale-105` 
                        : 'bg-transparent'
                    }`}
                    style={{
                      opacity,
                      backgroundColor: userHighlight ? `${userHighlight.color_hex}40` : undefined,
                      borderLeft: hasParagraphIndicator && segment.wordIndex === segment.paragraphIndex ? '3px solid currentColor' : undefined,
                      paddingLeft: hasParagraphIndicator && segment.wordIndex === segment.paragraphIndex ? '0.5em' : undefined
                    }}
                    title={userHighlight ? `Highlight: ${userHighlight.highlighted_text}` : undefined}
                    // TEMPORARILY DISABLED: onMouseEnter handler causing infinite render loop
                    // TODO: Re-enable with proper debouncing/throttling
                    // onMouseEnter={(e: React.MouseEvent) => {
                    //   e.stopPropagation()
                    //   handleParagraphMouseEnter(segment.paragraphIndex)
                    // }}
                  >
                    {segment.content}
                  </span>
                )
              }
              return null
            })}
          </div>
        </div>
      )
    }

    // Render reading mode view
    return (
      <div className={`flex-1 flex flex-col h-full ${themeStyles.background}`} style={{ paddingBottom: '100px' }}>
        {/* Reading Mode Header */}
        <div className={`sticky top-0 z-50 ${themeStyles.headerBg} backdrop-blur-sm border-b ${themeStyles.headerBorder} shadow-sm`}>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleReadingMode}
                className={`flex items-center gap-2 px-4 py-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors font-medium shadow-sm`}
                title="Exit Reading Mode (Press M or Escape)"
              >
                <Eye className="w-4 h-4" />
                <span>Exit Reading Mode</span>
              </button>
              
              <div className={`flex items-center gap-2 text-sm ${themeStyles.text}`}>
                <BookOpen className="w-4 h-4" />
                <span>
                  {pdfViewer.scrollMode === 'single' 
                    ? `Page ${pageNumber} of ${numPages}` 
                    : `${numPages} pages total`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Scroll Mode Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updatePDFViewer({ scrollMode: 'single' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors ${
                    pdfViewer.scrollMode === 'single' 
                      ? `${themeStyles.buttonBg} ${themeStyles.buttonText}` 
                      : `${themeStyles.text} opacity-60 hover:opacity-80`
                  }`}
                  title="One Page Mode"
                >
                  One Page
                </button>
                <button
                  onClick={() => updatePDFViewer({ scrollMode: 'continuous' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors ${
                    pdfViewer.scrollMode === 'continuous' 
                      ? `${themeStyles.buttonBg} ${themeStyles.buttonText}` 
                      : `${themeStyles.text} opacity-60 hover:opacity-80`
                  }`}
                  title="Scrolling Mode"
                >
                  Scrolling
                </button>
              </div>
              
              {/* Page Navigation - Only show in single page mode */}
              {pdfViewer.scrollMode === 'single' && (
                <>
                  <button
                    onClick={() => updatePDFViewer({ currentPage: Math.max(1, pageNumber - 1) })}
                    disabled={pageNumber <= 1}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => updatePDFViewer({ currentPage: Math.min(numPages, pageNumber + 1) })}
                    disabled={!numPages || pageNumber >= numPages}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reading Mode Content */}
        <div className="flex-1 overflow-y-auto">
          {pdfViewer.scrollMode === 'continuous' ? (
            // Continuous scroll mode - render all pages
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px`, userSelect: 'text', WebkitUserSelect: 'text' }}>
              {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div 
                  key={pageNum} 
                  className="mb-16 last:mb-0" 
                  data-page-number={pageNum}
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                >
                  <div className={`text-sm ${themeStyles.text} opacity-50 mb-4 text-center`}>
                    — Page {pageNum} —
                  </div>
                  {renderPageContent(pageNum)}
                </div>
              ))}
            </div>
          ) : (
            // Single page mode - render current page only
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px`, userSelect: 'text', WebkitUserSelect: 'text' }}>
              {renderPageContent(pageNumber)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // If reading mode is enabled, render reading mode instead of PDF viewer
  if (pdfViewer.readingMode) {
    return (
      <>
        {renderReadingMode()}
        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={createAIContextMenuOptions(
              handleClarification,
              handleFurtherReading,
              handleSaveNote
            )}
            onClose={() => setContextMenu(null)}
          />
        )}
      </>
    )
  }

  // Render PDF viewer with custom toolbar
  return (
    <>
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex', 
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0  // Allow flex child to shrink below content size
        }}
      >
        {/* Custom Toolbar */}
        <div 
          className="flex flex-wrap items-center justify-center gap-4 px-4 py-3 border-b"
          style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)',
            minHeight: '60px'
          }}
          onContextMenu={handleContextMenu}
        >
          {/* Download (replaces Library in viewer header) */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: 'transparent',
              border: '1px solid var(--color-border)'
            }}
            title="Download PDF"
          >
            <Download className="w-5 h-5" />
          </button>
          
          {/* Upload */}
          <button
            onClick={() => setShowUpload(true)}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: 'transparent'
            }}
            title="Upload Document"
          >
            <Upload className="w-5 h-5" />
          </button>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: isFullscreen ? 'var(--color-primary-light)' : 'transparent'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                pageNavigationPluginInstance.jumpToPage(0)
                updatePDFViewer({ currentPage: 1 })
              }}
              disabled={pdfViewer.currentPage <= 1}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="First Page"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                pageNavigationPluginInstance.jumpToPreviousPage()
              }}
              disabled={pdfViewer.currentPage <= 1}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="Previous Page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {/* Current Page Display */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={numPages || 1}
                value={pdfViewer.currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value, 10)
                  if (page >= 1 && page <= (numPages || 1)) {
                    updatePDFViewer({ currentPage: page })
                    pageNavigationPluginInstance.jumpToPage(page - 1) // Convert to 0-based
                  }
                }}
                className="w-12 sm:w-16 px-2 py-1 text-center text-sm rounded border"
                style={{
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)'
                }}
                title="Page number"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                of {numPages || 0}
              </span>
            </div>
            
            <button
              onClick={() => {
                pageNavigationPluginInstance.jumpToNextPage()
              }}
              disabled={!numPages || pdfViewer.currentPage >= numPages}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="Next Page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (numPages) {
                  pageNavigationPluginInstance.jumpToPage(numPages - 1)
                  updatePDFViewer({ currentPage: numPages })
                }
              }}
              disabled={!numPages || pdfViewer.currentPage >= numPages}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="Last Page"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newZoom = Math.max(pdfViewer.zoom - 0.1, 0.5)
                updatePDFViewer({ zoom: newZoom })
                zoomPluginInstance.zoomTo(newZoom)
              }}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
              {Math.round(pdfViewer.zoom * 100)}%
            </span>
            <button
              onClick={() => {
                const newZoom = Math.min(pdfViewer.zoom + 0.1, 3)
                updatePDFViewer({ zoom: newZoom })
                zoomPluginInstance.zoomTo(newZoom)
              }}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Rotate */}
          <button
            onClick={() => {
              // @ts-ignore
              rotatePluginInstance.rotate?.()
            }}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
            title="Rotate"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          
          {/* Scroll Mode Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => {
                updatePDFViewer({ scrollMode: 'single' })
                scrollModePluginInstance.switchScrollMode(ScrollMode.Page)
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                pdfViewer.scrollMode === 'single' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: pdfViewer.scrollMode === 'single' ? 'var(--color-primary)' : 'transparent',
                color: pdfViewer.scrollMode === 'single' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'
              }}
              title="Single Page Mode"
            >
              One Page
            </button>
            <button
              onClick={() => {
                updatePDFViewer({ scrollMode: 'continuous' })
                scrollModePluginInstance.switchScrollMode(ScrollMode.Vertical)
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                pdfViewer.scrollMode === 'continuous' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: pdfViewer.scrollMode === 'continuous' ? 'var(--color-primary)' : 'transparent',
                color: pdfViewer.scrollMode === 'continuous' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'
              }}
              title="Continuous Scrolling Mode"
            >
              Scrolling
            </button>
          </div>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Reading Mode Toggle */}
          <button
            onClick={toggleReadingMode}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: pdfViewer.readingMode ? 'var(--color-primary-light)' : 'transparent'
            }}
            title="Toggle Reading Mode (M)"
          >
            <Eye className="w-5 h-5" />
          </button>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: pdfViewer.darkMode ? 'var(--color-primary-light)' : 'transparent'
            }}
            title={pdfViewer.darkMode ? 'Disable Dark Mode' : 'Enable Dark Mode'}
          >
            {pdfViewer.darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {/* Separator */}
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />
          
          {/* Highlight Color Picker Button */}
          <button
            ref={highlightColorButtonRef}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowHighlightColorPopover(!showHighlightColorPopover)
            }}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center relative"
            style={{
              backgroundColor: showHighlightColorPopover ? 'var(--color-primary-light)' : 'transparent',
              color: showHighlightColorPopover ? 'var(--color-primary)' : 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => {
              if (!showHighlightColorPopover) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
            }}
            onMouseLeave={(e) => {
              if (!showHighlightColorPopover) e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title={`Highlight Color: ${annotationColors.find(c => c.id === currentHighlightColor)?.name || 'yellow'}`}
          >
            <Palette className="w-5 h-5" />
            {/* Color indicator dot */}
            <div
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white"
              style={{
                backgroundColor: currentHighlightColorHex,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
              }}
            />
          </button>
          
          {/* Highlight Management Panel - moved next to Highlight Colors */}
          <button
            onClick={() => setShowHighlightPanel(!showHighlightPanel)}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: 'var(--color-text-primary)', 
              backgroundColor: showHighlightPanel ? 'var(--color-primary-light)' : 'transparent'
            }}
            title="Highlight Management"
          >
            <Highlighter className="w-5 h-5" />
          </button>
          
          {/* Toggle Selection/Highlight (Finger mode) */}
          <button
            onClick={() => setSelectionEnabled((v) => !v)}
            className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
            style={{ 
              color: selectionEnabled ? 'var(--color-text-primary)' : 'var(--color-primary)', 
              backgroundColor: selectionEnabled ? 'transparent' : 'var(--color-primary-light)'
            }}
            title={selectionEnabled ? 'Deactivate selection/highlight (Finger mode)' : 'Activate selection/highlight'}
            aria-pressed={!selectionEnabled}
          >
            <MousePointer className="w-5 h-5" />
          </button>
          
        </div>
        
        
        {/* OCR Banner */}
        {ocrStatus && ocrStatus !== 'not_needed' && (
          <OCRBanner
            status={ocrStatus as 'pending' | 'processing' | 'completed' | 'failed'}
            errorMessage={ocrError}
            onRetry={ocrCanRetry ? async () => {
              if (!document?.id) return
              try {
                const { authService } = await import('../services/supabaseAuthService')
                const session = await authService.getSession()
                const token = session?.access_token
                if (!token) {
                  console.error('No access token available')
                  return
                }
                const response = await fetch(`/api/documents?action=ocr-process&documentId=${document.id}`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                if (response.ok) {
                  setOcrStatus('processing')
                }
              } catch (error) {
                console.error('Error retrying OCR:', error)
              }
            } : undefined}
            onStartOCR={ocrStatus === 'pending' ? async () => {
              if (!document?.id) return
              try {
                const { authService } = await import('../services/supabaseAuthService')
                const session = await authService.getSession()
                const token = session?.access_token
                if (!token) {
                  console.error('No access token available')
                  return
                }
                const response = await fetch(`/api/documents?action=ocr-process&documentId=${document.id}`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                if (response.ok) {
                  setOcrStatus('processing')
                }
              } catch (error) {
                console.error('Error starting OCR:', error)
              }
            } : undefined}
          />
        )}
        
        {/* PDF Viewer */}
        <div 
          style={{ 
            flex: 1, 
            overflow: 'hidden',
            backgroundColor: 'var(--color-background, #000000)',
            borderLeft: '1px solid var(--color-border, #374151)',
            userSelect: selectionEnabled ? 'text' : 'none',
            cursor: selectionEnabled ? undefined as unknown as string : 'pointer'
          }} 
          onContextMenu={handleContextMenu}
          className={`pdf-viewer-container ${pdfViewer.darkMode ? 'pdf-viewer-dark-mode' : ''}`}
        >
          {/* Override selection preview color - use neutral browser selection color, not highlight color */}
          <style>{`
            /* Override react-pdf-viewer highlight selection preview to use neutral color */
            /* Target all possible selection preview classes */
            .rpv-highlight__selected-area,
            .rpv-highlight__selected-area *,
            [data-testid="highlight-selected-area"],
            .rpv-core__viewer .rpv-highlight__selected-area,
            .rpv-core__viewer .rpv-highlight__selected-area *,
            .pdf-viewer-container .rpv-highlight__selected-area,
            .pdf-viewer-container [class*="highlight"][class*="selected"],
            .pdf-viewer-container [class*="selected"][class*="area"],
            /* Target any element with inline style background-color that matches highlight colors */
            .pdf-viewer-container [style*="background-color"]:not([data-highlight-id]) {
              background-color: rgba(0, 123, 255, 0.2) !important;
              color: inherit !important;
            }
            /* Ensure saved highlights (with data-highlight-id) keep their colors */
            .pdf-viewer-container [data-highlight-id] {
              /* Let saved highlights use their assigned colors - don't override */
            }
          `}</style>
          {isPDFjsReady ? (
            <Worker workerUrl={getPDFWorkerSrc()}>
              <Viewer
                fileUrl={documentUrl}
                plugins={plugins}
                initialPage={pdfViewer.currentPage - 1} // Convert 1-based to 0-based (zero-based index per docs)
                defaultScale={pdfViewer.zoom}
                initialRotation={pdfViewer.rotation}
                scrollMode={pdfViewer.scrollMode === 'single' ? ScrollMode.Page : ScrollMode.Vertical}
                onDocumentLoad={handleDocumentLoad}
                onPageChange={handlePageChange}
                onZoom={handleZoom}
                onRotate={handleRotate}
                renderLoader={(percentages: number) => (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }}></div>
                      <p className="text-lg mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Loading PDF... {percentages}%
                      </p>
                    </div>
                  </div>
                )}
                renderError={(error: Error) => (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-lg mb-2 text-red-500">Failed to load PDF</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {error.message}
                      </p>
                    </div>
                  </div>
                )}
              />
            </Worker>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-lg mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Initializing PDF viewer...
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Please wait
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={createAIContextMenuOptions(
            handleClarification,
            handleFurtherReading,
            handleSaveNote
          )}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {/* Audio Widget */}
      <AudioWidget />
      
      {/* Highlight Color Popover */}
      <HighlightColorPopover
        isOpen={showHighlightColorPopover}
        onClose={() => setShowHighlightColorPopover(false)}
        selectedColor={currentHighlightColorHex}
        onColorSelect={(colorHex) => {
          setCurrentHighlightColorHex(colorHex)
          const matchedColor = annotationColors.find((color: any) => color.color === colorHex)
          if (matchedColor) {
            setCurrentHighlightColor(matchedColor.id)
          }
        }}
        triggerRef={highlightColorButtonRef}
      />
      
      {/* Highlight Management Panel */}
      {showHighlightPanel && (
        <HighlightManagementPanel
          isOpen={showHighlightPanel}
          highlights={highlights}
          onClose={() => setShowHighlightPanel(false)}
          onDeleteHighlight={async (id) => {
            try {
              await highlightService.deleteHighlight(id)
              setHighlights(prev => prev.filter(h => h.id !== id))
            } catch (error) {
              console.error('Error deleting highlight:', error)
            }
          }}
          onDeleteMultiple={async (ids) => {
            try {
              await Promise.all(ids.map(id => highlightService.deleteHighlight(id)))
              setHighlights(prev => prev.filter(h => !ids.includes(h.id)))
            } catch (error) {
              console.error('Error deleting highlights:', error)
            }
          }}
          onJumpToPage={(pageNumber) => {
            updatePDFViewer({ currentPage: pageNumber })
            pageNavigationPluginInstance.jumpToPage(pageNumber - 1)
          }}
          bookName={document?.name || 'Document'}
        />
      )}
      
      {/* Notes Panel */}
      {isRightSidebarOpen && (
        <NotesPanel
          isOpen={isRightSidebarOpen}
          bookName={document?.name || 'Document'}
          bookId={document?.id || ''}
          currentPage={pdfViewer.currentPage}
          onClose={() => setIsRightSidebarOpen(false)}
        />
      )}
      
      {/* Library Modal */}
      {showLibrary && (
        <LibraryModal
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}
      
      {/* Document Upload Modal */}
      {showUpload && (
        <DocumentUpload
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false)
          }}
        />
      )}
      
    </>
  )
}
