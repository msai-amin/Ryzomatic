/**
 * PDFViewerV2 - New PDF Viewer using react-pdf-viewer
 * 
 * This component replaces the custom PDF.js implementation with react-pdf-viewer
 * which provides better highlighting support and eliminates coordinate conversion issues.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Viewer, Worker, DocumentLoadEvent, PageChangeEvent, ZoomEvent, RotateEvent, ScrollMode } from '@react-pdf-viewer/core'
import { highlightPlugin, HighlightArea, RenderHighlightTargetProps, RenderHighlightContentProps, RenderHighlightsProps, SelectionData } from '@react-pdf-viewer/highlight'
import { scrollModePlugin } from '@react-pdf-viewer/scroll-mode'
import { zoomPlugin } from '@react-pdf-viewer/zoom'
import { rotatePlugin, RotateDirection } from '@react-pdf-viewer/rotate'
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
import { Eye, BookOpen, FileText, Type, Highlighter, Sparkles, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, ZoomIn, ZoomOut, RotateCw, Search, Palette, Moon, Sun } from 'lucide-react'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getPDFTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { notesService } from '../services/notesService'
import { AudioWidget } from './AudioWidget'
import { HighlightColorPopover } from './HighlightColorPopover'

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

  // State declarations (must be before early returns per React hooks rules)
  const [highlights, setHighlights] = useState<HighlightType[]>([])
  const [currentHighlightColor, setCurrentHighlightColor] = useState(annotationColors[0]?.id || 'yellow')
  const [currentHighlightColorHex, setCurrentHighlightColorHex] = useState(annotationColors[0]?.hex || '#ffeb3b')
  const [showHighlightColorPopover, setShowHighlightColorPopover] = useState(false)
  const highlightColorButtonRef = useRef<HTMLButtonElement>(null)
  const [numPages, setNumPages] = useState<number>(document?.totalPages || 0)
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isPDFjsReady, setIsPDFjsReady] = useState(false)

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
      if (notes.length > 0 || highlights.length > 0) {
        let notesContent = `# Notes and Highlights for ${document.name}\n\n`
        notesContent += `Generated on: ${new Date().toLocaleString()}\n\n`
        
        // Add highlights section
        if (highlights.length > 0) {
          notesContent += `## Highlights\n\n`
          highlights.forEach((highlight, idx) => {
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
        await notesService.createNote({
          bookId: document.id,
          pageNumber: pdfViewer.currentPage,
          selectedText: context.selectedText,
          content: '',
        })
        console.log('Note saved from selection')
      } catch (error) {
        console.error('Error saving note:', error)
      }
    }
    setContextMenu(null)
  }, [document.id, document.pageTexts, userId, pdfViewer.currentPage])

  // Load highlights when document loads
  useEffect(() => {
    const loadHighlights = async () => {
      if (!document.id) return

      try {
        const bookHighlights = await highlightService.getHighlights(document.id, {
          includeOrphaned: true
        })
        setHighlights(bookHighlights)
        console.log(`Loaded ${bookHighlights.length} highlights from database`)
      } catch (error: any) {
        console.warn('Highlights not available:', error)
        setHighlights([])
      }
    }

    loadHighlights()
  }, [document.id])

  // Note: PDF.js worker is configured via Worker component wrapper
  // No need to manually configure GlobalWorkerOptions

  // Handle creating a new highlight
  const handleCreateHighlight = useCallback(async (
    highlightAreas: HighlightArea[],
    selectedText: string,
    selectionData?: SelectionData
  ) => {
    if (!document.id || !userId || highlightAreas.length === 0) return

    try {
      // Get the first highlight area (react-pdf-viewer provides multiple areas for multi-line selections)
      const firstArea = highlightAreas[0]
      
      // Convert pageIndex (0-based) to pageNumber (1-based)
      const pageNumber = firstArea.pageIndex + 1

      // Get current highlight color
      const color = annotationColors.find(c => c.id === currentHighlightColor) || annotationColors[0]
      const colorHex = color?.hex || currentHighlightColorHex || '#ffeb3b'
      
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
  }, [document.id, userId, currentHighlightColor, annotationColors])

  // Create highlight plugin
  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (props: RenderHighlightTargetProps) => {
      // Render target for creating new highlights
      const color = annotationColors.find(c => c.id === currentHighlightColor) || annotationColors[0]
      const colorHex = color?.hex || currentHighlightColorHex || '#ffeb3b'
      
      return (
        <div
          style={{
            background: 'var(--color-surface, #111827)',
            border: '1px solid var(--color-border, #374151)',
            borderRadius: '4px',
            display: 'flex',
            position: 'absolute',
            left: `${props.selectionRegion.left}%`,
            top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
            transform: 'translate(0, 8px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1,
          }}
        >
          <button
            onClick={props.toggle}
            style={{
              backgroundColor: colorHex,
              border: 'none',
              borderRadius: '4px 0 0 4px',
              padding: '6px 12px',
              cursor: 'pointer',
              color: '#000',
              fontSize: '14px',
              fontWeight: '500',
            }}
            title={`Create highlight (${color?.name || 'yellow'})`}
          >
            Highlight
          </button>
          <button
            onClick={props.cancel}
            style={{
              backgroundColor: 'var(--color-surface-hover, #1f2937)',
              border: 'none',
              borderLeft: '1px solid var(--color-border, #374151)',
              borderRadius: '0 4px 4px 0',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--color-text-primary, #f9fafb)',
              fontSize: '14px',
            }}
            title="Cancel"
          >
            ×
          </button>
        </div>
      )
    },
    renderHighlightContent: (props: RenderHighlightContentProps) => {
      // Render content for editing highlights
      const color = annotationColors.find(c => c.id === currentHighlightColor) || annotationColors[0]
      const colorHex = color?.hex || currentHighlightColorHex || '#ffeb3b'
      
      return (
        <div
          style={{
            background: 'var(--color-surface, #111827)',
            border: '1px solid var(--color-border, #374151)',
            borderRadius: '4px',
            padding: '12px',
            position: 'absolute',
            left: `${props.selectionRegion.left}%`,
            top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
            zIndex: 1,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            minWidth: '200px',
            color: 'var(--color-text-primary, #f9fafb)',
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary, #d1d5db)' }}>
            Selected: "{props.selectedText.substring(0, 50)}{props.selectedText.length > 50 ? '...' : ''}"
          </div>
          {/* Color indicator */}
          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--color-text-tertiary, #9ca3af)' }}>
            Color: <span style={{ fontWeight: '500', color: colorHex }}>{color?.name || 'yellow'}</span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <button
              style={{
                backgroundColor: colorHex,
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                flex: 1,
              }}
              onClick={async () => {
                await handleCreateHighlight(props.highlightAreas, props.selectedText, props.selectionData)
                props.cancel()
              }}
            >
              Save
            </button>
            <button
              style={{
                backgroundColor: 'var(--color-surface-hover, #1f2937)',
                border: '1px solid var(--color-border, #374151)',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--color-text-primary, #f9fafb)',
              }}
              onClick={props.cancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )
    },
    renderHighlights: (props: RenderHighlightsProps) => {
      // Render existing highlights
      const pageHighlights = highlights.filter((highlight) => highlight.page_number - 1 === props.pageIndex)
      
      if (pageHighlights.length === 0) {
        return null
      }
      
      return (
        <div>
          {pageHighlights.map((highlight) => {
            // Convert highlight position data to HighlightArea format
            const highlightAreas = highlight.position_data.highlightAreas || []
            
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
  })


  // Create scroll mode plugin
  const scrollModePluginInstance = scrollModePlugin({
    scrollMode: pdfViewer.scrollMode === 'single' ? ScrollMode.Page : ScrollMode.Vertical,
  })

  // Create zoom plugin
  const zoomPluginInstance = zoomPlugin({ enableShortcuts: false }) // Disable shortcuts, we'll handle them ourselves

  // Create rotate plugin
  const rotatePluginInstance = rotatePlugin()

  // Create search plugin
  const searchPluginInstance = searchPlugin()

  // Create page navigation plugin
  const pageNavigationPluginInstance = pageNavigationPlugin({ enableShortcuts: false }) // Disable shortcuts, we'll handle them ourselves

  // Cache blob URL to prevent memory leaks
  const blobUrlRef = useRef<string | null>(null)
  
  // Convert document.pdfData to a format react-pdf-viewer can use
  const getDocumentUrl = (): string | Uint8Array | ArrayBuffer => {
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
      if (!blobUrlRef.current) {
        blobUrlRef.current = URL.createObjectURL(document.pdfData)
      }
      return blobUrlRef.current
    }

    // If it's an ArrayBuffer, return it as Uint8Array
    if (document.pdfData instanceof ArrayBuffer) {
      return new Uint8Array(document.pdfData)
    }

    // Fallback: try to convert to Uint8Array
    return new Uint8Array(document.pdfData as ArrayBuffer)
  }
  
  // Cleanup blob URL when document changes or component unmounts
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [document.id])

  // Handle document load
  const handleDocumentLoad = useCallback((e: DocumentLoadEvent) => {
    console.log('PDF loaded:', e.doc.numPages)
    setNumPages(e.doc.numPages)
    updatePDFViewer({ currentPage: 1 })
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
            rotatePluginInstance.Rotate({ direction: RotateDirection.Forward })
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
                    onMouseEnter={() => {
                      if (segment.paragraphIndex !== undefined) {
                        setCurrentParagraphIndex(segment.paragraphIndex)
                      }
                    }}
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
          {/* Progress Bar */}
          <div className={`h-1 ${themeStyles.text} opacity-10`}>
            <div 
              className={`h-full ${themeStyles.progressBg} transition-all duration-300`}
              style={{ width: `${progressPercentage}%` }}
              title={`${Math.round(progressPercentage)}% complete`}
            />
          </div>

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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Custom Toolbar */}
        <div 
          className="flex items-center justify-center gap-4 p-4 border-b"
          style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-border)',
            minHeight: '60px'
          }}
          onContextMenu={handleContextMenu}
        >
          {/* Download */}
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
                className="w-16 px-2 py-1 text-center text-sm rounded border"
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
              rotatePluginInstance.Rotate({ direction: RotateDirection.Forward })
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
        </div>
        
        {/* PDF Viewer */}
        <div 
          style={{ 
            flex: 1, 
            overflow: 'hidden',
            backgroundColor: 'var(--color-background, #000000)',
            borderLeft: '1px solid var(--color-border, #374151)'
          }} 
          onContextMenu={handleContextMenu}
          className={`pdf-viewer-container ${pdfViewer.darkMode ? 'pdf-viewer-dark-mode' : ''}`}
        >
          {isPDFjsReady ? (
            <Worker workerUrl={getPDFWorkerSrc()}>
              <Viewer
                fileUrl={getDocumentUrl()}
                plugins={[
                  highlightPluginInstance,
                  scrollModePluginInstance,
                  zoomPluginInstance,
                  rotatePluginInstance,
                  searchPluginInstance,
                  pageNavigationPluginInstance,
                ]}
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
          const matchedColor = annotationColors.find(color => color.hex === colorHex)
          if (matchedColor) {
            setCurrentHighlightColor(matchedColor.id)
          }
        }}
        triggerRef={highlightColorButtonRef}
      />
    </>
  )
}

