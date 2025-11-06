import React, { useState, useCallback, useEffect, useRef } from 'react'
// PDF.js will be imported dynamically to avoid ES module issues
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download,
  Eye,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Search,
  Trash2,
  Rows,
  Pause,
  Volume2,
  StickyNote,
  BookOpen,
  MousePointer2,
  Type,
  Upload,
  Library,
  Palette,
  Highlighter,
  Plus,
  Sparkles,
  RotateCcw,
  X
} from 'lucide-react'
import { useAppStore, Document as DocumentType } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { TTSControls } from './TTSControls'
import { NotesPanel } from './NotesPanel'
import { AudioWidget } from './AudioWidget'
import { LibraryModal } from './LibraryModal'
import { DocumentUpload } from './DocumentUpload'
import { VoiceSelector } from './VoiceSelector'
import { TypographySettings } from './TypographySettings'
import { TextCleanupModal } from './TextCleanupModal'
import { storageService } from '../services/storageService'
import { OCRBanner, OCRStatusBadge } from './OCRStatusBadge'
import { FormulaRenderer, FormulaPlaceholder } from './FormulaRenderer'
import { extractMarkedFormulas } from '../utils/pdfTextExtractor'
import { convertMultipleFormulas } from '../services/formulaService'
import { highlightService, Highlight as HighlightType } from '../services/highlightService'
import { HighlightColorPicker } from './HighlightColorPicker'
import { HighlightManagementPanel } from './HighlightManagementPanel'
import { HighlightColorPopover } from './HighlightColorPopover'
import { notesService } from '../services/notesService'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getPDFTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { supabase } from '../../lib/supabase'
import { configurePDFWorker } from '../utils/pdfjsConfig'
// TextLayerBuilder will be imported dynamically after PDF.js is initialized

// Helper function to ensure globalThis.pdfjsLib is set before importing pdf_viewer
async function ensurePDFjsLib(): Promise<void> {
  if (!globalThis.pdfjsLib) {
    const pdfjsModule = await import('pdfjs-dist')
    const pdfjsLib = pdfjsModule.default || pdfjsModule
    globalThis.pdfjsLib = pdfjsLib
    console.log('✅ globalThis.pdfjsLib set via ensurePDFjsLib')
  }
}

// Helper function to safely import TextLayerBuilder
async function getTextLayerBuilder() {
  await ensurePDFjsLib()
  const { TextLayerBuilder } = await import('pdfjs-dist/web/pdf_viewer.mjs')
  return TextLayerBuilder
}

// Text segment interface for structured rendering in READING MODE ONLY
interface TextSegment {
  type: 'word' | 'break' | 'table' | 'formula'
  content: string
  breakLevel?: number // 1=space, 2=line, 3=paragraph, 4=section
  wordIndex?: number
  paragraphIndex?: number
  tableData?: string[] // For table rows
}

// Parse text to preserve paragraph structure - USED ONLY IN READING MODE
// CACHE BUST v3 - Force Vercel to rebuild with new bundle hash
function parseTextWithBreaks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let wordIndex = 0
  let paragraphIndex = 0
  
  // Debug: Log what we're receiving - FORCE DEPLOY v4
  console.log('🔍 parseTextWithBreaks: Received text (FORCE DEPLOY v4):', {
    type: typeof text,
    isString: typeof text === 'string',
    hasSplit: typeof text === 'string' && typeof text.split === 'function',
    timestamp: Date.now(),
    version: '4.0.0'
  });
  
  // Comprehensive text sanitization
  if (text === null || text === undefined) {
    console.warn('parseTextWithBreaks: text is null/undefined, using empty string');
    text = '';
  } else if (typeof text !== 'string') {
    console.warn('parseTextWithBreaks: text is not a string, converting...', {
      type: typeof text,
      constructor: (text as any)?.constructor?.name,
      value: String(text).substring(0, 100) + (String(text).length > 100 ? '...' : '')
    });
    
    if (typeof text === 'object') {
      try {
        text = JSON.stringify(text);
      } catch (e) {
        console.warn('parseTextWithBreaks: Failed to stringify object, using fallback');
        text = String(text);
      }
    } else {
      text = String(text);
    }
  }
  
  // Final safety check
  if (typeof text !== 'string') {
    console.error('parseTextWithBreaks: Failed to convert to string, using empty string');
    text = '';
  }
  
  // First, extract tables and formulas
  const tableRegex = /```table\n([\s\S]*?)\n```/g
  const formulaRegex = /`([^`]+)`/g
  
  let processedText = text
  const tables: { index: number, content: string[] }[] = []
  const formulas: { index: number, content: string }[] = []
  
  // Extract tables
  let tableMatch
  while ((tableMatch = tableRegex.exec(text)) !== null) {
    // Ensure tableMatch[1] is a string
    const tableText = typeof tableMatch[1] === 'string' ? tableMatch[1] : String(tableMatch[1] || '')
    const tableContent = tableText.split('\n').filter(row => row.trim().length > 0)
    const placeholder = `__TABLE_${tables.length}__`
    tables.push({ index: tableMatch.index, content: tableContent })
    processedText = processedText.replace(tableMatch[0], placeholder)
  }
  
  // Extract formulas (but not tables)
  let formulaMatch
  const tempText = processedText
  while ((formulaMatch = formulaRegex.exec(tempText)) !== null) {
    // Ensure formulaMatch[1] is a string
    const formulaText = typeof formulaMatch[1] === 'string' ? formulaMatch[1] : String(formulaMatch[1] || '')
    // Skip if it's a table placeholder
    if (!formulaText.startsWith('__TABLE_')) {
      const placeholder = `__FORMULA_${formulas.length}__`
      formulas.push({ index: formulaMatch.index, content: formulaText })
      processedText = processedText.replace(formulaMatch[0], placeholder)
    }
  }
  
  // Ensure processedText is a string before splitting
  if (typeof processedText !== 'string') {
    console.warn('parseTextWithBreaks: processedText is not a string, converting...', typeof processedText, processedText)
    processedText = String(processedText || '')
  }
  
  // Split by section breaks first (\n\n\n)
  const sections = processedText.split(/\n\n\n/)
  
  sections.forEach((section, sectionIdx) => {
    // Ensure section is a string
    if (typeof section !== 'string') {
      console.warn('parseTextWithBreaks: section is not a string, skipping...', typeof section, section)
      return
    }
    
    if (sectionIdx > 0) {
      segments.push({ type: 'break', content: '', breakLevel: 4 }) // Section break
    }
    
    // Ensure section is a string before splitting
    const safeSection = typeof section === 'string' ? section : String(section || '')
    
    // Split by paragraph breaks (\n\n)
    const paragraphs = safeSection.split(/\n\n/)
    
    paragraphs.forEach((paragraph, paraIdx) => {
      // Ensure paragraph is a string
      if (typeof paragraph !== 'string') {
        console.warn('parseTextWithBreaks: paragraph is not a string, skipping...', typeof paragraph, paragraph)
        return
      }
      
      if (paraIdx > 0) {
        segments.push({ type: 'break', content: '', breakLevel: 3 }) // Paragraph break
        paragraphIndex++
      }
      
      // Ensure paragraph is a string before splitting
      const safeParagraph = typeof paragraph === 'string' ? paragraph : String(paragraph || '')
      
      // Split by line breaks (\n)
      const lines = safeParagraph.split(/\n/)
      
      lines.forEach((line, lineIdx) => {
        // Ensure line is a string
        if (typeof line !== 'string') {
          console.warn('parseTextWithBreaks: line is not a string, skipping...', typeof line, line)
          return
        }
        
        if (lineIdx > 0) {
          segments.push({ type: 'break', content: '', breakLevel: 2 }) // Line break
        }
        
        // Ensure line is a string before splitting
        const safeLine = typeof line === 'string' ? line : String(line || '')
        
        // Split into words
        const words = safeLine.split(/\s+/).filter(w => w.trim().length > 0)
        
        words.forEach((word, idx) => {
          // Check if this word is a table placeholder
          if (word.startsWith('__TABLE_')) {
            const tableIdx = parseInt(word.match(/__TABLE_(\d+)__/)?.[1] || '0')
            const table = tables[tableIdx]
            if (table) {
              segments.push({
                type: 'table',
                content: '',
                tableData: table.content,
                wordIndex: wordIndex++,
                paragraphIndex
              })
            }
          }
          // Check if this word is a formula placeholder
          else if (word.startsWith('__FORMULA_')) {
            const formulaIdx = parseInt(word.match(/__FORMULA_(\d+)__/)?.[1] || '0')
            const formula = formulas[formulaIdx]
            if (formula) {
              segments.push({
                type: 'formula',
                content: formula.content,
                wordIndex: wordIndex++,
                paragraphIndex
              })
            }
          }
          // Regular word
          else {
            segments.push({ 
              type: 'word', 
              content: word, 
              wordIndex: wordIndex++,
              paragraphIndex 
            })
          }
          
          // Add space between words (except last word in line)
          if (idx < words.length - 1) {
            segments.push({ type: 'break', content: ' ', breakLevel: 1 })
          }
        })
      })
    })
  })
  
  return segments
}

// Remove the old local Highlight interface - we'll use the one from highlightService

interface PDFViewerProps {
  // No props needed - gets document from store
}

export const PDFViewer: React.FC<PDFViewerProps> = () => {
  const { 
    currentDocument,
    pdfViewer, 
    tts, 
    typography, 
    updatePDFViewer, 
    updateTTS, 
    updateTypography, 
    setCurrentDocument,
    setSelectedTextContext,
    setChatMode,
    toggleChat,
    isChatOpen,
    user
  } = useAppStore()
  
  // Get document from store (which is sanitized)
  const document = currentDocument
  
  // Safety check - return early if no document
  if (!document) {
    return <div>No document loaded</div>
  }
  
  // Debug: Log document pageTexts when PDFViewer receives it
  if (document.pageTexts) {
    console.log('🔍 PDFViewer: Received document with pageTexts:', {
      documentId: document.id,
      pageTextsLength: document.pageTexts.length,
      pageTextsTypes: document.pageTexts.map((text, i) => ({
        index: i,
        type: typeof text,
        isString: typeof text === 'string',
        value: String(text).substring(0, 50) + (String(text).length > 50 ? '...' : '')
      }))
    });
  }
  
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(pdfViewer.zoom)
  const [rotation, setRotation] = useState(0)
  const [pageInputValue, setPageInputValue] = useState('1')
  
  // CRITICAL: Keep local scale in sync with store zoom for accurate highlighting
  useEffect(() => {
    setScale(pdfViewer.zoom)
  }, [pdfViewer.zoom])
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightPickerPosition, setHighlightPickerPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedTextInfo, setSelectedTextInfo] = useState<{
    text: string
    pageNumber: number
    range: Range | null
  } | null>(null)
  const [highlights, setHighlights] = useState<HighlightType[]>([])
  const [showHighlightColorPopover, setShowHighlightColorPopover] = useState(false)
  const [currentHighlightColor, setCurrentHighlightColor] = useState('#FFD700')
  const [isHighlightMode, setIsHighlightMode] = useState(true) // Auto-enable highlight mode when document loads
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null)
  const [lastCreatedHighlightId, setLastCreatedHighlightId] = useState<string | null>(null)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    text: string
  } | null>(null)
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false)
  const [isToolbarStuck, setIsToolbarStuck] = useState<boolean>(false)
  const [showLibrary, setShowLibrary] = useState<boolean>(false)
  const [showUpload, setShowUpload] = useState<boolean>(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const highlightColorButtonRef = useRef<HTMLButtonElement>(null)
  const [selectedTextForNote, setSelectedTextForNote] = useState<string>('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const [showTypographySettings, setShowTypographySettings] = useState(false)
  const [showHighlightPanel, setShowHighlightPanel] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pageRendered, setPageRendered] = useState(false)
  const [ocrStatus, setOcrStatus] = useState(document.ocrStatus || 'not_needed')
  const [ocrError, setOcrError] = useState<string | undefined>()
  const [ocrCanRetry, setOcrCanRetry] = useState(false)
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPageNum, setEditingPageNum] = useState<number | null>(null)
  const [editedTexts, setEditedTexts] = useState<{ [pageNum: number]: string }>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [formulaLatex, setFormulaLatex] = useState<Map<string, string>>(new Map())
  const [isConvertingFormulas, setIsConvertingFormulas] = useState(false)
  const [formulaConversionProgress, setFormulaConversionProgress] = useState({ current: 0, total: 0 })
  const [lastRenderedDocId, setLastRenderedDocId] = useState<string | null>(null)
  
  // Text cleanup state
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanedPageTexts, setCleanedPageTexts] = useState<{ [pageNum: number]: string }>({})
  const [cleaningProgress, setCleaningProgress] = useState({ current: 0, total: 0 })
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const annotationLayerRef = useRef<HTMLDivElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageTextLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pageAnnotationLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const textLayerInstances = useRef<Map<number, any>>(new Map())
  const annotationLayerInstances = useRef<Map<number, any>>(new Map())

  // CRITICAL: Initialize globalThis.pdfjsLib as early as possible
  // This must happen before any pdf_viewer.mjs imports are evaluated
  useEffect(() => {
    const initPDFjs = async () => {
      try {
        const pdfjsModule = await import('pdfjs-dist')
        const pdfjsLib = pdfjsModule.default || pdfjsModule
        
        if (typeof globalThis !== 'undefined') {
          globalThis.pdfjsLib = pdfjsLib
          console.log('✅ globalThis.pdfjsLib initialized')
        }
      } catch (error) {
        console.error('Failed to initialize PDF.js:', error)
      }
    }
    
    initPDFjs()
  }, []) // Run once on mount

  // Define removeHighlight early to avoid circular dependency issues
  const removeHighlight = useCallback(async (id: string) => {
    try {
      await highlightService.deleteHighlight(id)
      setHighlights(prev => prev.filter(h => h.id !== id))
      
      // Clear selection if this was the selected highlight
      if (selectedHighlightId === id) {
        setSelectedHighlightId(null)
      }
      
      // Clear undo toast if this was the last created highlight
      if (lastCreatedHighlightId === id) {
        setLastCreatedHighlightId(null)
        setShowUndoToast(false)
      }
    } catch (error) {
      console.error('Error deleting highlight:', error)
      alert('Failed to delete highlight. Please try again.')
    }
  }, [selectedHighlightId, lastCreatedHighlightId])

  // CRITICAL: Re-render text layer when zoom/scale changes to maintain alignment
  // Must be after refs are defined to avoid initialization errors
  useEffect(() => {
    if (pdfDocRef.current && pageNumber && !pdfViewer.readingMode && !isLoading) {
      // Force re-render of current page when zoom changes
      // This ensures text layer stays aligned with canvas at new zoom level
      setPageRendered(false)
    }
  }, [pdfViewer.zoom, pageNumber, pdfViewer.readingMode, isLoading])

  // Load PDF document
  useEffect(() => {
    console.log('🔍 PDFViewer useEffect triggered for document.pdfData', {
      documentId: document.id,
      hasPdfData: !!document.pdfData,
      hasPageTexts: !!document.pageTexts,
      pageTextsLength: document.pageTexts?.length || 0
    });
    
    const loadPDF = async () => {
      if (!document.pdfData) return

      console.log('🔍 loadPDF: Starting PDF load process', {
        documentId: document.id,
        hasPageTexts: !!document.pageTexts,
        pageTextsLength: document.pageTexts?.length || 0
      });

      setIsLoading(true)
      setPageRendered(false)

      try {
        // Dynamic import of PDF.js to avoid ES module issues with Vite
        const pdfjsModule = await import('pdfjs-dist')
        
        // Access the actual library - it might be under .default or directly available
        const pdfjsLib = pdfjsModule.default || pdfjsModule
        
        // CRITICAL: Set pdfjsLib as globalThis.pdfjsLib BEFORE importing pdf_viewer
        // This is required by pdf_viewer.mjs which destructures from globalThis.pdfjsLib
        if (typeof globalThis !== 'undefined') {
          globalThis.pdfjsLib = pdfjsLib
        }
        
        // Set up PDF.js worker
        configurePDFWorker(pdfjsLib)

        let pdfData: ArrayBuffer | Uint8Array

        if (document.pdfData instanceof Blob) {
          pdfData = await document.pdfData.arrayBuffer()
        } else if (document.pdfData instanceof ArrayBuffer) {
          // Check if ArrayBuffer is detached
          try {
            new Uint8Array(document.pdfData, 0, 1)
            pdfData = document.pdfData
          } catch (error) {
            console.error('❌ ArrayBuffer is detached, cannot load PDF:', error)
            throw new Error('PDF data is corrupted or detached. Please try re-opening the document.')
          }
        } else if (typeof document.pdfData === 'string') {
          // If it's a blob URL, fetch it
          const response = await fetch(document.pdfData)
          pdfData = await response.arrayBuffer()
        } else {
          throw new Error('Unsupported PDF data format')
        }

        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise
        
        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
        setIsLoading(false)
        console.log('✅ PDF loaded successfully:', pdf.numPages, 'pages')
        console.log('PDF Document Info:', {
          numPages: pdf.numPages,
          hasPageTexts: !!document.pageTexts,
          pageTextsLength: document.pageTexts?.length || 0,
          documentId: document.id,
          scrollMode: pdfViewer.scrollMode
        })
        
        // Debug: Log pageTexts after PDF loading
        if (document.pageTexts) {
          console.log('🔍 loadPDF: PageTexts after PDF loading:', {
            documentId: document.id,
            pageTextsLength: document.pageTexts.length,
            pageTextsTypes: document.pageTexts.map((text, i) => ({
              index: i,
              type: typeof text,
              isString: typeof text === 'string',
              value: String(text).substring(0, 50) + (String(text).length > 50 ? '...' : '')
            }))
          });
        }
      } catch (error) {
        console.error('Error loading PDF:', error)
        setIsLoading(false)
      }
    }

    loadPDF()

    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
      }
    }
  }, [document.pdfData])

  // Re-render PDF when switching back from reading mode
  useEffect(() => {
    if (!pdfViewer.readingMode && pdfDocRef.current && !isLoading) {
      console.log('🔄 Switching back from reading mode, re-rendering PDF...')
      
      // Clear any existing canvas/text layer content
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
      
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = ''
      }
      
      // Clear page text layer refs
      pageTextLayerRefs.current.clear()
      
      // Force re-render by resetting pageRendered state
      // The normal page rendering useEffect will handle the actual re-render
      setPageRendered(false)
      
      console.log('🔄 PDF re-render will be triggered by normal page rendering logic')
    }
  }, [pdfViewer.readingMode, pdfViewer.scrollMode, isLoading])

  // Render current page (single page mode)
  useEffect(() => {
    console.log('🔄 Page render useEffect triggered:', {
      scrollMode: pdfViewer.scrollMode,
      readingMode: pdfViewer.readingMode,
      pageNumber,
      scale,
      rotation,
      hasPdfDoc: !!pdfDocRef.current,
      hasCanvas: !!canvasRef.current
    })
    
    if (pdfViewer.scrollMode === 'continuous') {
      console.log('⏭️ Skipping single page render - continuous mode')
      return
    }
    if (pdfViewer.readingMode) {
      console.log('⏭️ Skipping single page render - reading mode')
      return // Don't render PDF when in reading mode
    }

    const renderPage = async () => {
      if (!pdfDocRef.current || !canvasRef.current) {
        console.log('⏭️ Skipping render - missing refs:', {
          hasPdfDoc: !!pdfDocRef.current,
          hasCanvas: !!canvasRef.current
        })
        return
      }

      console.log('🎨 Starting page render:', pageNumber)
      setPageRendered(false) // Reset rendered state when starting new page

      try {
        // Cancel any ongoing render task
        if (renderTaskRef.current) {
          console.log('🚫 Cancelling previous render task')
          renderTaskRef.current.cancel()
        }

        const page = await pdfDocRef.current.getPage(pageNumber)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context) {
          console.log('❌ No canvas context available')
          return
        }

        const viewport = page.getViewport({ scale, rotation })
        
        // High-DPI display support for crisp rendering
        const dpr = window.devicePixelRatio || 1
        
        // Set canvas dimensions
        canvas.height = viewport.height * dpr
        canvas.width = viewport.width * dpr
        canvas.style.width = viewport.width + 'px'
        canvas.style.height = viewport.height + 'px'
        canvas.style.pointerEvents = 'none'
        
        console.log('📐 Canvas dimensions set:', {
          width: canvas.width,
          height: canvas.height,
          cssWidth: canvas.style.width,
          cssHeight: canvas.style.height,
          dpr: dpr
        })

        // Clear canvas and reset transformations
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        // Scale context to account for high-DPI
        context.scale(dpr, dpr)

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        renderTaskRef.current = page.render(renderContext)
        await renderTaskRef.current.promise
        renderTaskRef.current = null
        
        console.log('✅ Canvas rendered successfully')

          // Render text layer using PDF.js TextLayerBuilder (Firefox's implementation)
          if (textLayerRef.current) {
            try {
              // Cancel any existing text layer builder for this page
              const existingBuilder = textLayerInstances.current.get(pageNumber)
              if (existingBuilder) {
                existingBuilder.cancel()
              }
              
              // Clear the container
              textLayerRef.current.innerHTML = ''
              
              // Match canvas container's positioning and transform exactly
              const canvasContainer = canvasRef.current?.parentElement
              if (canvasContainer) {
                const containerStyles = window.getComputedStyle(canvasContainer)
                const transform = containerStyles.transform
                const transformOrigin = containerStyles.transformOrigin || '0 0'
                
                textLayerRef.current.style.width = viewport.width + 'px'
                textLayerRef.current.style.height = viewport.height + 'px'
                textLayerRef.current.style.position = 'absolute'
                textLayerRef.current.style.top = '0'
                textLayerRef.current.style.left = '0'
                textLayerRef.current.style.transformOrigin = transformOrigin
                
                if (transform && transform !== 'none') {
                  textLayerRef.current.style.transform = transform
                } else {
                  textLayerRef.current.style.transform = 'none'
                }
              } else {
                textLayerRef.current.style.width = viewport.width + 'px'
                textLayerRef.current.style.height = viewport.height + 'px'
                textLayerRef.current.style.position = 'absolute'
                textLayerRef.current.style.top = '0'
                textLayerRef.current.style.left = '0'
                textLayerRef.current.style.transformOrigin = '0 0'
              }
              
              // Safely import TextLayerBuilder (ensures globalThis.pdfjsLib is set first)
              const TextLayerBuilder = await getTextLayerBuilder()
              
              // Create TextLayerBuilder instance (Firefox's approach)
              const textLayerBuilder = new TextLayerBuilder({
                pdfPage: page,
                onAppend: () => {
                  // Optional callback when text layer is appended
                }
              })
              
              // CRITICAL: Replace builder's div with our container BEFORE render
              // This ensures event listeners (#bindMouse) are bound to our container
              // Store the original div for reference
              const originalBuilderDiv = textLayerBuilder.div
              
              // Set our container as the builder's div before render
              // This way all event listeners and content will be in our container
              textLayerBuilder.div = textLayerRef.current
              
              // Copy important attributes from builder's original div setup
              textLayerRef.current.className = originalBuilderDiv.className || 'textLayer'
              textLayerRef.current.tabIndex = originalBuilderDiv.tabIndex || 0
              
              // Render the text layer - it will now render into our container
              await textLayerBuilder.render({
                viewport: viewport
              })
              
              // Store instance for cleanup
              textLayerInstances.current.set(pageNumber, textLayerBuilder)
              
              // Ensure text layer is visible and interactive
              textLayerRef.current.style.setProperty('opacity', '1', 'important')
              textLayerRef.current.style.setProperty('pointer-events', 'auto', 'important')
              textLayerRef.current.style.setProperty('user-select', 'text', 'important')
              textLayerRef.current.style.setProperty('visibility', 'visible', 'important')
              textLayerRef.current.style.setProperty('z-index', '2', 'important')
              textLayerRef.current.style.setProperty('position', 'absolute', 'important')
              
              const spans = textLayerRef.current.querySelectorAll('span')
              console.log('📝 Text layer rendered with TextLayerBuilder:', {
                pageNumber: pageNumber,
                hasTextLayer: !!textLayerRef.current,
                textLayerChildren: textLayerRef.current.children.length,
                spansRendered: spans.length
              })
            } catch (error) {
              console.error('Error rendering text layer with TextLayerBuilder:', error)
            }
          }
          
          // Annotation layer for PDF-native annotations (optional)
          // Note: PDF.js AnnotationLayer not available in 5.4, skipping for now
          // Our custom highlights are rendered separately via div overlays
          
          // Mark page as rendered
          console.log('🎉 Setting pageRendered to true')
          setPageRendered(true)
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('❌ Error rendering page:', error)
        } else {
          console.log('🚫 Render cancelled (normal during page change)')
        }
        setPageRendered(true) // Still mark as "done" even if error
      }
    }

    renderPage()
  }, [pageNumber, scale, rotation, pdfViewer.scrollMode, pdfViewer.readingMode, numPages])

  // Handle document changes - reset when document changes
  useEffect(() => {
    // Reset if document changed
    if (document.id !== lastRenderedDocId) {
      setLastRenderedDocId(document.id)
    }
  }, [document.id, lastRenderedDocId])

  
  // Render all pages (continuous scroll mode)
  useEffect(() => {
    if (pdfViewer.scrollMode !== 'continuous' || !pdfDocRef.current || !numPages) {
      return
    }
    if (pdfViewer.readingMode) return // Don't render PDF when in reading mode
    
    // Always check if we need to re-render by verifying actual DOM state
    const needsRerender = Array.from({ length: numPages }, (_, i) => i + 1).some(pageNum => {
      const textLayerDiv = pageTextLayerRefs.current.get(pageNum)
      const canvas = pageCanvasRefs.current.get(pageNum)
      
      // Need to re-render if:
      // 1. Text layer doesn't exist or is empty
      // 2. Canvas doesn't exist (DOM element was destroyed)
      const needsRender = !textLayerDiv || !canvas || textLayerDiv.children.length === 0
      
      if (needsRender) {
        console.log(`🔍 Page ${pageNum} needs render:`, {
          hasTextLayer: !!textLayerDiv,
          hasCanvas: !!canvas,
          textLayerChildren: textLayerDiv?.children.length || 0
        })
      }
      
      return needsRender
    })
    
    // If zoom/rotation changed, we need to force re-render even if pages look complete
    const hasZoomOrRotationChange = scale !== 1 || rotation !== 0 // This will trigger re-render
    
    if (!needsRerender && !hasZoomOrRotationChange) {
      console.log('🎯 All pages already rendered correctly, skipping')
      return
    }
    
    // Determine the specific reason for re-rendering
    const emptyPages = Array.from({ length: numPages }, (_, i) => i + 1).filter(pageNum => {
      const textLayerDiv = pageTextLayerRefs.current.get(pageNum)
      const canvas = pageCanvasRefs.current.get(pageNum)
      return !textLayerDiv || !canvas || textLayerDiv.children.length === 0
    })
    const reason = `empty/missing elements on pages: ${emptyPages.join(', ')}`
    
    console.log('🔄 Rendering pages for continuous mode:', {
      numPages,
      hasRefs: pageCanvasRefs.current.size > 0,
      scrollMode: pdfViewer.scrollMode,
      needsRerender: true,
      reason,
      canvasRefs: pageCanvasRefs.current.size,
      textLayerRefs: pageTextLayerRefs.current.size
    })

    const renderAllPages = async () => {
      // Wait for BOTH canvas AND textLayer refs to be populated after DOM render
      // Use multiple attempts with increasing delays to ensure refs are ready
      let attempts = 0
      const maxAttempts = 20 // 20 attempts * 50ms = 1 second max wait
      
      while (attempts < maxAttempts && 
             (pageCanvasRefs.current.size === 0 || pageTextLayerRefs.current.size === 0)) {
        await new Promise(resolve => setTimeout(resolve, 50))
        attempts++
      }
      
      if (pageCanvasRefs.current.size === 0) {
        console.warn('⚠️ Canvas refs never populated, aborting render')
        return
      }
      
      if (pageTextLayerRefs.current.size === 0) {
        console.warn('⚠️ TextLayer refs never populated, aborting render')
        return
      }
      
      console.log(`✅ Canvas and TextLayer refs ready after ${attempts * 50}ms, starting render`, {
        canvasRefs: pageCanvasRefs.current.size,
        textLayerRefs: pageTextLayerRefs.current.size,
        expectedPages: numPages
      })
      
      console.log(`🎨 Starting to render ${numPages} pages...`)
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const canvas = pageCanvasRefs.current.get(pageNum)
        const textLayerDiv = pageTextLayerRefs.current.get(pageNum)
        
        console.log(`🎨 Rendering page ${pageNum}:`, {
          hasCanvas: !!canvas,
          hasTextLayer: !!textLayerDiv
        })
        
        if (!canvas) {
          console.log(`⏭️ Skipping page ${pageNum} - canvas ref not ready`)
          continue
        }
        
        if (!textLayerDiv) {
          console.log(`⏭️ Skipping page ${pageNum} - textLayer ref not ready`)
          continue
        }

        try {
          const page = await pdfDocRef.current!.getPage(pageNum)
          const context = canvas.getContext('2d')
          
          if (!context) continue

          const viewport = page.getViewport({ scale, rotation })
          
          // High-DPI display support for crisp rendering
          const dpr = window.devicePixelRatio || 1
          
          // Set canvas dimensions
          canvas.height = viewport.height * dpr
          canvas.width = viewport.width * dpr
          canvas.style.width = viewport.width + 'px'
          canvas.style.height = viewport.height + 'px'
          canvas.style.pointerEvents = 'none'
          
          // Clear canvas and reset transformations
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.clearRect(0, 0, canvas.width, canvas.height)
          
          // Scale context to account for high-DPI
          context.scale(dpr, dpr)

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          }

          await page.render(renderContext).promise
          
          // Render text layer using PDF.js TextLayerBuilder (Firefox's implementation)
          if (textLayerDiv) {
            try {
              // Cancel any existing text layer builder for this page
              const existingBuilder = textLayerInstances.current.get(pageNum)
              if (existingBuilder) {
                existingBuilder.cancel()
              }
              
              // Clear the container
              textLayerDiv.innerHTML = ''
              
              // CRITICAL: Match canvas container's positioning and transform exactly
              // Get the page container (parent of canvas and textLayer)
              const pageContainer = canvas.parentElement
              if (pageContainer) {
                const containerStyles = window.getComputedStyle(pageContainer)
                
                // Match container's transform if present
                const transform = containerStyles.transform
                const transformOrigin = containerStyles.transformOrigin || '0 0'
                
                // Set text layer container size to match canvas exactly
                textLayerDiv.style.width = viewport.width + 'px'
                textLayerDiv.style.height = viewport.height + 'px'
                textLayerDiv.style.position = 'absolute'
                textLayerDiv.style.top = '0'
                textLayerDiv.style.left = '0'
                textLayerDiv.style.transformOrigin = transformOrigin
                
                // Apply same transform as container if any
                if (transform && transform !== 'none') {
                  textLayerDiv.style.transform = transform
                } else {
                  textLayerDiv.style.transform = 'none'
                }
              } else {
                // Fallback: basic positioning if container not found
                textLayerDiv.style.width = viewport.width + 'px'
                textLayerDiv.style.height = viewport.height + 'px'
                textLayerDiv.style.position = 'absolute'
                textLayerDiv.style.top = '0'
                textLayerDiv.style.left = '0'
                textLayerDiv.style.transformOrigin = '0 0'
              }
              
              // Safely import TextLayerBuilder (ensures globalThis.pdfjsLib is set first)
              const TextLayerBuilder = await getTextLayerBuilder()
              
              // Create TextLayerBuilder instance (Firefox's approach)
              const textLayerBuilder = new TextLayerBuilder({
                pdfPage: page,
                onAppend: () => {
                  // Optional callback when text layer is appended
                }
              })
              
              // CRITICAL: Replace builder's div with our container BEFORE render
              // This ensures event listeners (#bindMouse) are bound to our container
              // Store the original div for reference
              const originalBuilderDiv = textLayerBuilder.div
              
              // Set our container as the builder's div before render
              // This way all event listeners and content will be in our container
              textLayerBuilder.div = textLayerDiv
              
              // Copy important attributes from builder's original div setup
              textLayerDiv.className = originalBuilderDiv.className || 'textLayer'
              textLayerDiv.tabIndex = originalBuilderDiv.tabIndex || 0
              
              // Render the text layer - it will now render into our container
              await textLayerBuilder.render({
                viewport: viewport
              })
              
              // Store instance for cleanup
              textLayerInstances.current.set(pageNum, textLayerBuilder)
              
              // Ensure text layer is visible and interactive
              textLayerDiv.style.setProperty('opacity', '1', 'important')
              textLayerDiv.style.setProperty('pointer-events', 'auto', 'important')
              textLayerDiv.style.setProperty('user-select', 'text', 'important')
              textLayerDiv.style.setProperty('visibility', 'visible', 'important')
              textLayerDiv.style.setProperty('z-index', '2', 'important')
              textLayerDiv.style.setProperty('position', 'absolute', 'important')
              
              const spans = textLayerDiv.querySelectorAll('span')
              console.log(`📝 Text layer rendered with TextLayerBuilder for page ${pageNum}:`, {
                hasTextLayer: !!textLayerDiv,
                textLayerChildren: textLayerDiv.children.length,
                spansRendered: spans.length
              })
            } catch (error) {
              console.error(`Error rendering text layer with TextLayerBuilder for page ${pageNum}:`, error)
            }
            
            // Annotation layer for PDF-native annotations (optional)
            // Note: PDF.js AnnotationLayer not available in 5.4, skipping for now
            // Our custom highlights are rendered separately via div overlays
          }
        } catch (error) {
          console.error(`Error rendering page ${pageNum}:`, error)
        }
      }
      
      console.log('🎉 All pages rendered in continuous mode')
    }

    renderAllPages()
    
    // Cleanup function: cancel all text layer builders when dependencies change
    return () => {
      textLayerInstances.current.forEach((builder) => {
        builder.cancel()
      })
      textLayerInstances.current.clear()
    }
  }, [pdfViewer.readingMode, pdfViewer.scrollMode, numPages, scale, rotation])
  
  // Force text layer interactivity after any render (additional safety net)
  useEffect(() => {
    if (pdfViewer.scrollMode === 'continuous' && numPages) {
      // Double-check all text layers are interactive
      const checkTimer = setTimeout(() => {
        pageTextLayerRefs.current.forEach((textLayerDiv, pageNum) => {
          if (textLayerDiv) {
            // Use setProperty with important to ensure styles are applied
            textLayerDiv.style.setProperty('opacity', '1', 'important')
            textLayerDiv.style.setProperty('pointer-events', 'auto', 'important')
            textLayerDiv.style.setProperty('user-select', 'text', 'important')
            textLayerDiv.style.setProperty('-webkit-user-select', 'text', 'important')
            textLayerDiv.style.setProperty('-moz-user-select', 'text', 'important')
            textLayerDiv.style.setProperty('-ms-user-select', 'text', 'important')
            
            // Also ensure all spans are selectable
            const spans = textLayerDiv.querySelectorAll('span')
            spans.forEach(span => {
              if (span instanceof HTMLElement && span.style) {
                span.style.setProperty('pointer-events', 'auto', 'important')
                span.style.setProperty('user-select', 'text', 'important')
                span.style.setProperty('-webkit-user-select', 'text', 'important')
                span.style.setProperty('-moz-user-select', 'text', 'important')
                span.style.setProperty('-ms-user-select', 'text', 'important')
              }
            })
            
            // Log if text layer is empty (potential issue)
            if (textLayerDiv.children.length === 0) {
              console.warn(`⚠️ Text layer for page ${pageNum} is empty!`)
            }
          }
        })
      }, 200) // Check after 200ms
      
      return () => clearTimeout(checkTimer)
    }
  }, [pdfViewer.scrollMode, numPages])

  // Ensure text layer is visible and interactive when pageRendered changes
  useEffect(() => {
    if (textLayerRef.current) {
      // Use setProperty with important to override inline styles
      textLayerRef.current.style.setProperty('opacity', '1', 'important')
      textLayerRef.current.style.setProperty('pointer-events', 'auto', 'important')
      textLayerRef.current.style.setProperty('user-select', 'text', 'important')
      textLayerRef.current.style.setProperty('visibility', 'visible', 'important')
      
      // Ensure all spans are also interactive
        const spans = textLayerRef.current.querySelectorAll('span')
        spans.forEach(span => {
          if (span instanceof HTMLElement && span.style) {
            span.style.setProperty('pointer-events', 'auto', 'important')
            span.style.setProperty('user-select', 'text', 'important')
            span.style.setProperty('-webkit-user-select', 'text', 'important')
            span.style.setProperty('-moz-user-select', 'text', 'important')
            span.style.setProperty('-ms-user-select', 'text', 'important')
          }
        })
      
      console.log('🔍 Ensuring text layer visibility and interactivity:', {
        pageRendered,
        hasTextLayer: !!textLayerRef.current,
        spansCount: spans.length,
        childrenCount: textLayerRef.current.children.length
      })
    }
  }, [pageRendered])

  useEffect(() => {
    setPageInputValue(String(pageNumber))
  }, [pageNumber])

  // Update store with current page for TTS
  useEffect(() => {
    updatePDFViewer({ currentPage: pageNumber })
  }, [pageNumber, updatePDFViewer])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (showNotesPanel && e.key !== 'Escape') return

      switch (e.key) {
        case 'ArrowLeft':
          if (pageNumber > 1) setPageNumber(pageNumber - 1)
          break
        case 'ArrowRight':
          if (numPages && pageNumber < numPages) setPageNumber(pageNumber + 1)
          break
        case '+':
        case '=':
          const newScaleUp = Math.min(scale + 0.1, 3)
          setScale(newScaleUp)
          updatePDFViewer({ zoom: newScaleUp })
          break
        case '-':
        case '_':
          const newScaleDown = Math.max(scale - 0.1, 0.5)
          setScale(newScaleDown)
          updatePDFViewer({ zoom: newScaleDown })
          break
        case 'r':
        case 'R':
          setRotation((rotation + 90) % 360)
          break
        case 'h':
        case 'H':
          break
        case 'm':
        case 'M':
          // Toggle reading mode - don't stop TTS
          updatePDFViewer({ readingMode: !pdfViewer.readingMode })
          break
        case 'j':
        case 'J':
          // Toggle text justification - ONLY in reading mode
          if (pdfViewer.readingMode) {
            updateTypography({ textAlign: typography.textAlign === 'justify' ? 'left' : 'justify' })
          }
          break
        case 'f':
        case 'F':
          // Toggle focus mode - ONLY in reading mode
          if (pdfViewer.readingMode) {
            updateTypography({ focusMode: !typography.focusMode })
          }
          break
        case 'g':
        case 'G':
          // Toggle reading guide - ONLY in reading mode
          if (pdfViewer.readingMode) {
            updateTypography({ readingGuide: !typography.readingGuide })
          }
          break
        case 'e':
        case 'E':
          // Toggle edit mode - ONLY in reading mode and single-page mode
          // In continuous mode, users should use per-page edit buttons
          if (pdfViewer.readingMode && !isEditing && pdfViewer.scrollMode === 'single') {
            // Initialize edited texts with current page texts
            const initialTexts: { [pageNum: number]: string } = {}
            document.pageTexts?.forEach((text, index) => {
              // Ensure text is a string
              const safeText = typeof text === 'string' ? text : String(text || '')
              initialTexts[index + 1] = safeText
            })
            setEditedTexts(initialTexts)
            setIsEditing(true)
            setHasUnsavedChanges(false)
          }
          break
        case 'Escape':
          if (showNotesPanel) {
            setShowNotesPanel(false)
          } else if (isEditing) {
            // Cancel editing
            setIsEditing(false)
            setEditingPageNum(null)
            setEditedTexts({})
            setHasUnsavedChanges(false)
          } else if (pdfViewer.readingMode) {
            // Exit reading mode with Escape key - don't stop TTS
            updatePDFViewer({ readingMode: false })
          }
          break
        case 's':
        case 'S':
          // Save edited text - ONLY in reading mode when editing
          if (pdfViewer.readingMode && isEditing && e.ctrlKey) {
            e.preventDefault()
            handleSaveEditedText()
          }
          break
        case 'Delete':
        case 'Backspace':
          // Delete selected highlight
          if (selectedHighlightId && !isEditing) {
            e.preventDefault()
            removeHighlight(selectedHighlightId)
            setSelectedHighlightId(null)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [pageNumber, numPages, scale, rotation, showNotesPanel, pdfViewer.readingMode, updatePDFViewer, typography.textAlign, typography.focusMode, typography.readingGuide, updateTypography, isEditing, selectedHighlightId, removeHighlight])

  // Intersection observer for toolbar visual feedback
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop
      setIsToolbarStuck(scrollTop > 10) // Show enhanced styling when scrolled down
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Context menu for adding notes
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const selection = window.getSelection()
      const selectedText = selection?.toString().trim()
      
      if (selectedText && selectedText.length > 0) {
        e.preventDefault()
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          text: selectedText
        })
      } else {
        setContextMenu(null)
      }
    }

    const handleClick = (e: MouseEvent) => {
      setContextMenu(null)
      // Clear highlight selection when clicking outside highlights
      // Highlights stop propagation in their onClick handlers, so clicks on highlights won't reach here
      // Only clear if not selecting text (user might be selecting text to highlight)
      if (!window.getSelection()?.toString().trim()) {
        setSelectedHighlightId(null)
      }
    }

    window.document.addEventListener('contextmenu', handleContextMenu)
    window.document.addEventListener('click', handleClick)
    
    return () => {
      window.document.removeEventListener('contextmenu', handleContextMenu)
      window.document.removeEventListener('click', handleClick)
    }
  }, [])

  // Load cleaned text from database when document loads
  useEffect(() => {
    const loadCleanedTexts = async () => {
      if (!document?.id || !user?.id) return
      
      try {
        const { data, error } = await supabase
          .from('user_books')
          .select('page_texts_cleaned')
          .eq('id', document.id)
          .eq('user_id', user.id)
          .single()
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading cleaned texts:', error)
          return
        }
        
        if (data?.page_texts_cleaned && Array.isArray(data.page_texts_cleaned)) {
          // Convert array format to object format { [pageNum: number]: string }
          const cleanedTextsObj: { [pageNum: number]: string } = {}
          data.page_texts_cleaned.forEach((cleanedText: string | null, index: number) => {
            if (cleanedText) {
              cleanedTextsObj[index + 1] = cleanedText // 0-indexed to 1-indexed
            }
          })
          
          // Only update if we have cleaned texts
          if (Object.keys(cleanedTextsObj).length > 0) {
            setCleanedPageTexts(cleanedTextsObj)
            
            // Also update currentDocument in store
            setCurrentDocument({
              ...document,
              cleanedPageTexts: data.page_texts_cleaned
            })
            
            console.log(`✅ Loaded ${Object.keys(cleanedTextsObj).length} cleaned page(s) from database`)
          }
        }
      } catch (error) {
        console.error('Error loading cleaned texts from database:', error)
      }
    }
    
    loadCleanedTexts()
  }, [document?.id, user?.id, setCurrentDocument])

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (tts.isPlaying) {
        ttsManager.stop()
      }
    }
  }, [])

  // Poll for OCR status updates
  useEffect(() => {
    if (ocrStatus === 'processing' || ocrStatus === 'pending') {
      // Start polling for status updates
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/documents?action=ocr-status&documentId=${document.id}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.ocrStatus !== ocrStatus) {
              setOcrStatus(data.ocrStatus);
              
              // Update error info if failed
              if (data.ocrStatus === 'failed') {
                setOcrError(data.ocrMetadata?.error || 'OCR processing failed');
                setOcrCanRetry(data.ocrMetadata?.canRetry ?? true);
              }
              
              // Update document content if completed
              if (data.ocrStatus === 'completed' && data.content) {
                // Update document in store
                console.log('OCR completed successfully, text extracted');
                // TODO: Update document content in store
              }
              
              // Clear interval if done (completed or failed)
              if (data.ocrStatus !== 'processing' && data.ocrStatus !== 'pending') {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error checking OCR status:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Cleanup interval on unmount or status change
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [ocrStatus, document.id])

  // Formula conversion removed from Reading Mode per user request
  // Formulas will no longer be automatically converted when entering reading mode
  // This keeps Reading Mode simpler and faster without formula processing overhead

  // Handle OCR retry
  // Handle saving edited text
  const handleSaveEditedText = useCallback(async () => {
    if (!document.id || Object.keys(editedTexts).length === 0) return

    try {
      // Update all edited page texts
      const updatedPageTexts = [...(document.pageTexts || [])]
      Object.entries(editedTexts).forEach(([pageNumStr, text]) => {
        const pageIndex = parseInt(pageNumStr) - 1
        if (pageIndex >= 0 && pageIndex < updatedPageTexts.length) {
          updatedPageTexts[pageIndex] = text.trim()
        }
      })
      
      // Create updated document
      const updatedDocument = {
        ...document,
        pageTexts: updatedPageTexts
      }
      
      // Update the document in the store
      setCurrentDocument(updatedDocument)
      
      // Save to storage using saveBook
      await storageService.saveBook({
        id: document.id,
        title: document.name,
        fileName: document.name,
        type: 'pdf',
        savedAt: new Date(),
        lastReadPage: pageNumber,
        totalPages: document.totalPages,
        pageTexts: updatedPageTexts,
        notes: [],
        googleDriveId: undefined,
        syncedAt: undefined
      })
      
      setIsEditing(false)
      setEditingPageNum(null)
      setEditedTexts({})
      setHasUnsavedChanges(false)
      
      console.log('✅ All edited pages saved successfully')
    } catch (error) {
      console.error('❌ Error saving edited text:', error)
    }
  }, [document, editedTexts, pageNumber, setCurrentDocument])

  const handleOCRRetry = useCallback(async () => {
    if (!document.id || !document.totalPages) return;

    try {
      setOcrStatus('processing');
      setOcrError(undefined);
      setOcrCanRetry(false);

      // Call OCR service with retry logic
      const { startOCRProcessing } = await import('../services/ocrService');
      
      // Note: In real implementation, we'd get auth token from auth service
      const authToken = 'dummy-token'; // TODO: Get real auth token
      
      const result = await startOCRProcessing(
        {
          documentId: document.id,
          s3Key: `documents/${document.id}`, // TODO: Get real S3 key
          pageCount: document.totalPages,
          options: {
            extractTables: true,
            preserveFormatting: true,
          },
        },
        authToken
      );

      if (result.success) {
        setOcrStatus('completed');
        console.log('OCR retry successful');
      } else {
        setOcrStatus('failed');
        setOcrError(result.error || 'OCR retry failed');
        setOcrCanRetry(result.canRetry ?? true);
      }
    } catch (error: any) {
      console.error('OCR retry failed:', error);
      setOcrStatus('failed');
      setOcrError(error.message || 'Failed to retry OCR');
      setOcrCanRetry(true);
    }
  }, [document.id, document.totalPages])

  // Handle start OCR (for pending status)
  const handleStartOCR = useCallback(async () => {
    // Similar to retry, but for initial OCR request
    handleOCRRetry();
  }, [handleOCRRetry])

  const goToPreviousPage = useCallback(() => {
    if (pageNumber > 1) {
      // Stop TTS when changing pages
      if (tts.isPlaying) {
        ttsManager.stop();
        updateTTS({ isPlaying: false, currentWordIndex: null });
      }
      setPageNumber(pageNumber - 1)
    }
  }, [pageNumber, tts.isPlaying, updateTTS])

  const goToNextPage = useCallback(() => {
    if (numPages && pageNumber < numPages) {
      // Stop TTS when changing pages
      if (tts.isPlaying) {
        ttsManager.stop();
        updateTTS({ isPlaying: false, currentWordIndex: null });
      }
      setPageNumber(pageNumber + 1)
    }
  }, [pageNumber, numPages, tts.isPlaying, updateTTS])

  const goToFirstPage = useCallback(() => {
    // Stop TTS when changing pages
    if (tts.isPlaying) {
      ttsManager.stop();
      updateTTS({ isPlaying: false, currentWordIndex: null });
    }
    setPageNumber(1)
  }, [tts.isPlaying, updateTTS])

  const goToLastPage = useCallback(() => {
    if (numPages) {
      // Stop TTS when changing pages
      if (tts.isPlaying) {
        ttsManager.stop();
        updateTTS({ isPlaying: false, currentWordIndex: null });
      }
      setPageNumber(numPages)
    }
  }, [numPages, tts.isPlaying, updateTTS])

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(scale + 0.1, 3)
    setScale(newScale)
    updatePDFViewer({ zoom: newScale })
  }, [scale, updatePDFViewer])

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(scale - 0.1, 0.5)
    setScale(newScale)
    updatePDFViewer({ zoom: newScale })
  }, [scale, updatePDFViewer])

  const handleRotate = useCallback(() => {
    setRotation((rotation + 90) % 360)
  }, [rotation])

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const page = parseInt(pageInputValue, 10)
    if (page >= 1 && numPages && page <= numPages) {
      // Stop TTS when manually jumping to a different page
      if (page !== pageNumber && tts.isPlaying) {
        ttsManager.stop();
        updateTTS({ isPlaying: false, currentWordIndex: null });
      }
      setPageNumber(page)
    } else {
      setPageInputValue(String(pageNumber))
    }
  }

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
        }, 300)
      }
    } catch (error) {
      console.error('Error downloading file with notes:', error)
      // Fallback to just downloading PDF if notes retrieval fails
      const link = window.document.createElement('a')
      link.href = URL.createObjectURL(new Blob([document.pdfData as BlobPart], { type: 'application/pdf' }))
      link.download = document.name
      link.click()
    }
  }, [document, user, highlights])

  const toggleScrollMode = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Don't stop TTS when switching scroll modes - let it continue playing
    updatePDFViewer({ scrollMode: pdfViewer.scrollMode === 'single' ? 'continuous' : 'single' })
  }, [pdfViewer.scrollMode, updatePDFViewer])

  const toggleReadingMode = useCallback(() => {
    // Don't stop TTS when switching to/from reading mode - let it continue
    updatePDFViewer({ readingMode: !pdfViewer.readingMode })
  }, [pdfViewer.readingMode, updatePDFViewer])

  // Handle text cleanup
  const handleTextCleanup = useCallback(async (
    preferences: {
      reorganizeParagraphs: boolean
      removeFormulae: boolean
      removeFootnotes: boolean
      removeSideNotes: boolean
      removeHeadersFooters: boolean
      simplifyFormatting: boolean
      reorganizationStyle: 'logical' | 'chronological' | 'topic-based'
      optimizeForTTS: boolean
    },
    applyToAllPages: boolean
  ) => {
    setIsCleaning(true)
    setCleaningProgress({ current: 0, total: 0 })

    try {
      const pagesToClean = applyToAllPages && numPages
        ? Array.from({ length: numPages }, (_, i) => i + 1)
        : [pageNumber]

      setCleaningProgress({ current: 0, total: pagesToClean.length })

      const newCleanedTexts: { [pageNum: number]: string } = { ...cleanedPageTexts }

      // Process pages sequentially to avoid overwhelming the API
      for (let i = 0; i < pagesToClean.length; i++) {
        const pageNum = pagesToClean[i]
        const rawPageText = document.pageTexts?.[pageNum - 1]
        
        if (!rawPageText) {
          console.warn(`No text found for page ${pageNum}`)
          continue
        }

        // Ensure pageText is a string
        const pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')

        if (!pageText.trim()) {
          console.warn(`Empty text for page ${pageNum}`)
          continue
        }

        try {
          // Call cleanup API
          const response = await fetch('/api/text/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: pageText,
              preferences,
            }),
          })

          if (!response.ok) {
            throw new Error(`Cleanup API error: ${response.statusText}`)
          }

          const data = await response.json()

          if (data.success && data.cleanedText) {
            newCleanedTexts[pageNum] = data.cleanedText
            console.log(`✅ Successfully cleaned page ${pageNum}`)
          } else {
            console.warn(`Cleanup failed for page ${pageNum}:`, data.error || 'Unknown error')
            if (data.fallback) {
              // Keep original text in cleanedPageTexts so user knows something happened
              // But we won't overwrite if it's just a fallback
            }
          }
        } catch (error) {
          console.error(`Error cleaning page ${pageNum}:`, error)
          // Continue with next page instead of failing completely
        }

        setCleaningProgress({ current: i + 1, total: pagesToClean.length })
      }

      setCleanedPageTexts(newCleanedTexts)
      
      // Save cleaned text to database
      const cleanedCount = Object.keys(newCleanedTexts).length
      if (cleanedCount > 0 && document?.id && user?.id) {
        try {
          // Convert cleanedPageTexts object { [pageNum: number]: string } to array format
          // Create array with same length as pageTexts, using cleaned text where available
          const totalPages = document.pageTexts?.length || numPages || 0
          const cleanedTextsArray: string[] = new Array(totalPages).fill(null)
          
          // Fill in cleaned texts at their respective page indices (1-indexed to 0-indexed)
          Object.entries(newCleanedTexts).forEach(([pageNum, cleanedText]) => {
            const pageIndex = parseInt(pageNum, 10) - 1
            if (pageIndex >= 0 && pageIndex < totalPages && cleanedText) {
              cleanedTextsArray[pageIndex] = cleanedText
            }
          })
          
          // Get existing cleaned texts from database to preserve pages that weren't cleaned in this batch
          const { data: existingBook } = await supabase
            .from('user_books')
            .select('page_texts_cleaned')
            .eq('id', document.id)
            .eq('user_id', user.id)
            .single()
          
          // Merge with existing cleaned texts (preserve previously cleaned pages)
          if (existingBook?.page_texts_cleaned) {
            existingBook.page_texts_cleaned.forEach((existingText: string | null, index: number) => {
              if (existingText && (!cleanedTextsArray[index] || cleanedTextsArray[index] === null)) {
                cleanedTextsArray[index] = existingText
              }
            })
          }
          
          // Update database with merged cleaned texts
          const { error: updateError } = await supabase
            .from('user_books')
            .update({ page_texts_cleaned: cleanedTextsArray })
            .eq('id', document.id)
            .eq('user_id', user.id)
          
          if (updateError) {
            console.error('Failed to save cleaned text to database:', updateError)
            // Don't throw - user already sees cleaned text in UI, this is just persistence
          } else {
            console.log(`✅ Saved cleaned text for ${cleanedCount} page(s) to database`)
            
            // Update currentDocument in store to include cleaned texts
            setCurrentDocument({
              ...document,
              cleanedPageTexts: cleanedTextsArray
            })
          }
        } catch (dbError) {
          console.error('Error saving cleaned text to database:', dbError)
          // Continue even if database save fails - cleaned text is still in state
        }
      }
      
      setShowCleanupModal(false)

      // Show success notification
      if (cleanedCount > 0) {
        // Simple success feedback - could be enhanced with toast notification
        console.log(`Successfully cleaned ${cleanedCount} page(s)`)
      }
    } catch (error) {
      console.error('Text cleanup error:', error)
      alert('Failed to clean text. Please try again.')
    } finally {
      setIsCleaning(false)
      setCleaningProgress({ current: 0, total: 0 })
    }
  }, [document, pageNumber, numPages, cleanedPageTexts, user, setCurrentDocument])

  // Restore original text for a page
  const handleRestoreOriginal = useCallback(async (pageNum: number) => {
    setCleanedPageTexts(prev => {
      const newTexts = { ...prev }
      delete newTexts[pageNum]
      return newTexts
    })
    
    // Also remove from database
    if (document?.id && user?.id) {
      try {
        const { data: existingBook } = await supabase
          .from('user_books')
          .select('page_texts_cleaned')
          .eq('id', document.id)
          .eq('user_id', user.id)
          .single()
        
        if (existingBook?.page_texts_cleaned) {
          const cleanedTextsArray = [...existingBook.page_texts_cleaned]
          const pageIndex = pageNum - 1
          if (pageIndex >= 0 && pageIndex < cleanedTextsArray.length) {
            cleanedTextsArray[pageIndex] = null
            
            await supabase
              .from('user_books')
              .update({ page_texts_cleaned: cleanedTextsArray })
              .eq('id', document.id)
              .eq('user_id', user.id)
            
            // Update currentDocument in store
            setCurrentDocument({
              ...document,
              cleanedPageTexts: cleanedTextsArray
            })
          }
        }
      } catch (error) {
        console.error('Error removing cleaned text from database:', error)
      }
    }
  }, [document, user, setCurrentDocument])

  // Restore all original text
  const handleRestoreAllOriginal = useCallback(async () => {
    setCleanedPageTexts({})
    
    // Also remove from database
    if (document?.id && user?.id) {
      try {
        await supabase
          .from('user_books')
          .update({ page_texts_cleaned: null })
          .eq('id', document.id)
          .eq('user_id', user.id)
        
        // Update currentDocument in store
        setCurrentDocument({
          ...document,
          cleanedPageTexts: undefined
        })
      } catch (error) {
        console.error('Error removing all cleaned text from database:', error)
      }
    }
  }, [document, user, setCurrentDocument])

  const handleAddNote = useCallback((text: string) => {
    setSelectedTextForNote(text)
    setShowNotesPanel(true)
    setContextMenu(null)
  }, [])

  // Load highlights when document loads
  useEffect(() => {
    const loadHighlights = async () => {
      if (!document.id || document.highlightsLoaded) return

      // Check if document was just uploaded (within last 5 seconds)
      // With ID sync fix, only brief delay needed for S3/database completion
      const uploadTime = document.uploadedAt ? new Date(document.uploadedAt).getTime() : 0
      const now = Date.now()
      const isRecentlyUploaded = (now - uploadTime) < 10000 // 10 seconds
      
      // If recently uploaded, wait longer for the database to sync
      if (isRecentlyUploaded) {
        console.log('Document recently uploaded, waiting for database sync...')
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
      }

      try {
        const bookHighlights = await highlightService.getHighlights(document.id, {
          includeOrphaned: true
        })
        setHighlights(bookHighlights)
        
        console.log(`Loaded ${bookHighlights.length} highlights from database`)
        
        // Update document to mark highlights as loaded
        const updatedDoc = { ...document, highlights: bookHighlights, highlightsLoaded: true }
        setCurrentDocument(updatedDoc)
      } catch (error: any) {
        // If book not found, just use empty array (book might not be saved yet or was deleted)
        if (error?.message?.includes('Book not found') || error?.message?.includes('Failed to fetch highlights')) {
          console.log('Book not found or highlights fetch failed, using empty highlights array:', error?.message)
          setHighlights([])
          const updatedDoc = { ...document, highlights: [], highlightsLoaded: true }
          setCurrentDocument(updatedDoc)
        } else {
          console.warn('Highlights not available:', error)
          // Set empty highlights array to prevent repeated attempts
          setHighlights([])
          const updatedDoc = { ...document, highlights: [], highlightsLoaded: true }
          setCurrentDocument(updatedDoc)
        }
      }
    }

    loadHighlights()
  }, [document.id])

  // Debug log when highlights change
  useEffect(() => {
    if (highlights.length > 0) {
      console.log('Rendering highlights:', highlights.map(h => ({
        id: h.id.substring(0, 8),
        page: h.page_number,
        position: h.position_data,
        text: h.highlighted_text.substring(0, 30) + '...'
      })))
    }
  }, [highlights])

  // Handle text selection for highlighting (Method 1)
  // AI Context Menu Handlers
  const handleAIClarification = useCallback(() => {
    // Detect page number from selection or use current page
    let detectedPageNumber = pageNumber
    const selection = window.getSelection()
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const targetElement = range.commonAncestorContainer
      const pageElement = (targetElement as Element).closest?.('[data-page-number]') ||
                         (targetElement.nodeType === Node.TEXT_NODE 
                           ? (targetElement.parentElement as Element)?.closest?.('[data-page-number]')
                           : null)
      
      if (pageElement) {
        const pageAttr = pageElement.getAttribute('data-page-number')
        if (pageAttr) {
          detectedPageNumber = parseInt(pageAttr, 10)
        }
      }
    }
    
    // Get page text - prioritize cleaned text if available, otherwise use original
    const cleanedText = cleanedPageTexts[detectedPageNumber]
    let pageText: string
    
    if (cleanedText) {
      pageText = cleanedText
    } else {
      const rawPageText = document.pageTexts?.[detectedPageNumber - 1]
      pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
    }
    
    const context = getPDFTextSelectionContext(detectedPageNumber, pageText)
    
    if (context) {
      setSelectedTextContext(context)
      setChatMode('clarification')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pageNumber, document.pageTexts, cleanedPageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleAIFurtherReading = useCallback(() => {
    // Detect page number from selection or use current page
    let detectedPageNumber = pageNumber
    const selection = window.getSelection()
    
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const targetElement = range.commonAncestorContainer
      const pageElement = (targetElement as Element).closest?.('[data-page-number]') ||
                         (targetElement.nodeType === Node.TEXT_NODE 
                           ? (targetElement.parentElement as Element)?.closest?.('[data-page-number]')
                           : null)
      
      if (pageElement) {
        const pageAttr = pageElement.getAttribute('data-page-number')
        if (pageAttr) {
          detectedPageNumber = parseInt(pageAttr, 10)
        }
      }
    }
    
    // Get page text - prioritize cleaned text if available, otherwise use original
    const cleanedText = cleanedPageTexts[detectedPageNumber]
    let pageText: string
    
    if (cleanedText) {
      pageText = cleanedText
    } else {
      const rawPageText = document.pageTexts?.[detectedPageNumber - 1]
      pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
    }
    
    const context = getPDFTextSelectionContext(detectedPageNumber, pageText)
    
    if (context) {
      setSelectedTextContext(context)
      setChatMode('further-reading')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pageNumber, document.pageTexts, cleanedPageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleSaveNoteFromContext = useCallback(() => {
    if (contextMenu) {
      handleAddNote(contextMenu.text)
    }
    setContextMenu(null)
  }, [contextMenu])

  const handleTextSelection = useCallback((event: MouseEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
      return
    }

    const selectedText = selection.toString().trim()
    if (selectedText.length < 2) {
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
      return
    }

    // Get the range and position
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Determine which page the selection is on
    let currentPage = pageNumber
    // In reading mode or continuous scroll mode, detect page from DOM
    if (pdfViewer.readingMode || pdfViewer.scrollMode === 'continuous') {
      // Find the page containing the selection
      const targetElement = range.commonAncestorContainer
      const pageElement = (targetElement as Element).closest?.('[data-page-number]') ||
                         (targetElement.nodeType === Node.TEXT_NODE 
                           ? (targetElement.parentElement as Element)?.closest?.('[data-page-number]')
                           : null)
      if (pageElement) {
        const pageAttr = pageElement.getAttribute('data-page-number')
        if (pageAttr) {
          currentPage = parseInt(pageAttr, 10)
        }
      }
    }

    console.log('📝 Text selection detected:', {
      selectedText: selectedText.substring(0, 50),
      scrollMode: pdfViewer.scrollMode,
      pageNumber: currentPage,
      selectionRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      rangeInfo: {
        startContainer: range.startContainer.nodeName,
        endContainer: range.endContainer.nodeName,
        startOffset: range.startOffset,
        endOffset: range.endOffset
      }
    })

    // ALWAYS store selection info (used by notes, AI, context menu, etc.)
    setSelectedTextInfo({
      text: selectedText,
      pageNumber: currentPage,
      range
    })

    // ONLY show highlight picker UI when highlight mode is active
    if (isHighlightMode) {
      setHighlightPickerPosition({
        x: rect.right + 10,
        y: rect.top - 10
      })
    } else {
      // Clear picker UI when not in highlight mode, but keep selection info
      setHighlightPickerPosition(null)
    }
  }, [pdfViewer.scrollMode, pdfViewer.readingMode, pageNumber, isHighlightMode])
  
  // Handle right-click context menu for AI features
  const handleContextMenuClick = useCallback((event: React.MouseEvent) => {
    if (hasTextSelection()) {
      event.preventDefault()
      const selection = window.getSelection()
      if (selection) {
        // Close highlight picker when context menu opens to avoid z-index conflicts
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          text: selection.toString().trim()
        })
      }
    }
  }, [])

  // Create highlight after color selection
  const handleCreateHighlight = useCallback(async (colorId: string, colorHex: string) => {
    if (!selectedTextInfo || !selectedTextInfo.range) {
      console.error('Cannot create highlight: missing selectedTextInfo or range')
      alert('Cannot create highlight: No text selected. Please select text first.')
      setHighlightPickerPosition(null)
      return
    }

    // Check if document is very recently uploaded (within 10 seconds)
    // Need to wait for S3 upload + database save + potential replication delay
    const uploadTime = document.uploadedAt ? new Date(document.uploadedAt).getTime() : 0
    const now = Date.now()
    const isVeryRecentlyUploaded = (now - uploadTime) < 10000 // 10 seconds
    
    if (isVeryRecentlyUploaded) {
      const secondsRemaining = Math.ceil((10000 - (now - uploadTime)) / 1000)
      alert(`⏳ Document is still being saved to database...\n\nPlease wait ${secondsRemaining} more second${secondsRemaining > 1 ? 's' : ''} and try again.`)
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
      return
    }

    try {
      const range = selectedTextInfo.range
      
      // Check if range is still valid (DOM might have changed)
      try {
        const testRect = range.getBoundingClientRect()
        if (!testRect) {
          throw new Error('Range is invalid or detached from DOM')
        }
      } catch (rangeError) {
        console.error('Range is invalid:', rangeError)
        alert('The selected text is no longer valid. Please select the text again.')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }
      
      // Use getBoundingClientRect() instead of getClientRects() for a single unified rect
      // This gives us the bounding box that encompasses the entire selection
      const selectionRect = range.getBoundingClientRect()
      
      // ROBUST VALIDATION: Check for valid selection rectangle
      if (!selectionRect || selectionRect.width === 0 || selectionRect.height === 0) {
        console.error('Invalid bounding rectangle for selection:', selectionRect)
        alert('Cannot create highlight: Invalid text selection. Please try selecting the text again.')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Additional validation for reasonable dimensions
      if (selectionRect.width < 1 || selectionRect.height < 1) {
        console.error('Selection too small to create highlight:', selectionRect)
        alert('Cannot create highlight: Selection is too small. Please select more text.')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Find the page container - look for the element with data-page-number or the canvas parent
      // CRITICAL: We need the exact container that holds both canvas and textLayer
      let pageContainer: HTMLElement | null = null
      
      // Try to find the page container by traversing up the DOM
      let currentElement = range.startContainer.parentElement
      while (currentElement && !pageContainer) {
        // Look for container that has both canvas and textLayer as children
        const hasCanvas = currentElement.querySelector('canvas')
        const hasTextLayer = currentElement.querySelector('.textLayer')
        const position = window.getComputedStyle(currentElement).position
        
        // Preferred: container with both canvas and textLayer, positioned relative
        if (hasCanvas && hasTextLayer && position === 'relative') {
          pageContainer = currentElement as HTMLElement
          break
        }
        // Fallback: container with data-page-number attribute
        if (currentElement.hasAttribute('data-page-number')) {
          pageContainer = currentElement as HTMLElement
          break
        }
        currentElement = currentElement.parentElement
      }

      // Fallback: look for single page mode container (direct parent of canvas)
      if (!pageContainer) {
        const singlePageCanvas = canvasRef.current?.parentElement
        if (singlePageCanvas) {
          // Verify it's the right container (should have position: relative)
          const position = window.getComputedStyle(singlePageCanvas).position
          if (position === 'relative') {
            pageContainer = singlePageCanvas as HTMLElement
          }
        }
      }

      if (!pageContainer) {
        console.error('Could not find page container for highlight')
        alert('Cannot create highlight: Unable to locate page container. Please try again.')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Get the container's bounding rectangle in viewport coordinates
      const containerRect = pageContainer.getBoundingClientRect()
      
      // CRITICAL: Calculate position relative to the page container
      // The text spans use position: absolute within the page container
      // We need to match their coordinate system exactly
      
      // Account for any CSS transforms on the container
      const containerStyles = window.getComputedStyle(pageContainer)
      const transform = containerStyles.transform
      
      // For multi-line selections, use getClientRects() to get all line fragments
      // This provides better accuracy for selections spanning multiple lines
      const rects = range.getClientRects()
      let finalRect: DOMRect
      
      if (rects.length > 1) {
        // Multi-line selection: combine all rects into one bounding box
        const rectArray = Array.from(rects)
        const combinedRect = {
          left: Math.min(...rectArray.map(r => r.left)),
          top: Math.min(...rectArray.map(r => r.top)),
          right: Math.max(...rectArray.map(r => r.right)),
          bottom: Math.max(...rectArray.map(r => r.bottom)),
        }
        finalRect = {
          ...selectionRect,
          left: combinedRect.left,
          top: combinedRect.top,
          width: combinedRect.right - combinedRect.left,
          height: combinedRect.bottom - combinedRect.top,
        } as DOMRect
      } else {
        // Single-line selection: use the bounding rect directly
        finalRect = selectionRect
      }
      
      // selectionRect gives us viewport coordinates, containerRect gives us the container's viewport position
      // Subtracting gives us the position within the container - same coordinate system as text spans
      let rawPosition = {
        x: finalRect.left - containerRect.left,
        y: finalRect.top - containerRect.top,
        width: finalRect.width,
        height: finalRect.height
      }
      
      // CRITICAL: Account for container transforms that might affect coordinate system
      // If container has a transform (e.g., scale), we need to adjust coordinates
      if (transform && transform !== 'none') {
        // Parse transform matrix if present
        const matrixMatch = transform.match(/matrix\(([^)]+)\)/)
        if (matrixMatch) {
          const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()))
          if (values.length >= 4) {
            // Transform scaling is typically in values[0] (scaleX) and values[3] (scaleY)
            // Translation is in values[4] (translateX) and values[5] (translateY)
            const scaleX = values[0] || 1
            const scaleY = values[3] || 1
            
            // If transform is applied, coordinates need to be adjusted
            // getBoundingClientRect already accounts for transforms, but we need
            // to ensure we're using the right coordinate space
            // For most cases, getBoundingClientRect handles this correctly
            // But if there's scaling, we may need to adjust
            if (scaleX !== 1 || scaleY !== 1) {
              // The coordinates from getBoundingClientRect are already transformed
              // But we need to work in the container's local coordinate space
              // This is already handled by subtracting containerRect, so we're good
            }
          }
        }
      }

      // TEXT ALIGNMENT: Use browser's getBoundingClientRect() without adjustments
      // Previous adjustments were causing position misalignment - browser rect is already accurate
      
      // Get text element for debugging
      const textElement = range.startContainer.parentElement

      // CRITICAL FIX: Convert screen coordinates to PDF viewport coordinates
      // The text layer uses PDF.js viewport coordinates, so we must match that coordinate system
      // Get the actual viewport used for rendering this page
      let viewportPosition = rawPosition
      
      try {
        const page = await pdfDocRef.current.getPage(selectedTextInfo.pageNumber)
        const currentViewport = page.getViewport({ scale, rotation })
        
        // Find the canvas for this page
        const pageCanvas = pdfViewer.scrollMode === 'continuous' 
          ? pageCanvasRefs.current.get(selectedTextInfo.pageNumber)
          : canvasRef.current
        
        if (pageCanvas) {
          // Get the actual rendered size of the canvas (from browser)
          const canvasRect = pageCanvas.getBoundingClientRect()
          
          // Calculate conversion factor: viewport dimensions vs actual rendered size
          // This accounts for any CSS transforms or scaling that might affect the canvas
          const viewportToScreenX = canvasRect.width / currentViewport.width
          const viewportToScreenY = canvasRect.height / currentViewport.height
          
          // Convert screen coordinates (from getBoundingClientRect) to viewport coordinates
          // The text layer spans use viewport coordinates directly
          viewportPosition = {
            x: rawPosition.x / viewportToScreenX,
            y: rawPosition.y / viewportToScreenY,
            width: rawPosition.width / viewportToScreenX,
            height: rawPosition.height / viewportToScreenY
          }
          
          console.log('Viewport coordinate conversion:', {
            viewport: { width: currentViewport.width, height: currentViewport.height },
            canvasRect: { width: canvasRect.width, height: canvasRect.height },
            conversionFactors: { x: viewportToScreenX, y: viewportToScreenY },
            rawPosition,
            viewportPosition
          })
        }
      } catch (error) {
        console.warn('Could not get viewport for coordinate conversion, using raw position:', error)
        // Fall back to using raw position (existing behavior)
      }

      // ROBUST SCALING: Normalize by current scale so positions are stored at scale 1.0
      // This ensures highlights scale correctly when zoom changes
      // Add safeguards to prevent division by zero or invalid scale values
      const safeScale = Math.max(scale, 0.1) // Prevent division by zero
      const position = {
        x: viewportPosition.x / safeScale,
        y: viewportPosition.y / safeScale,
        width: viewportPosition.width / safeScale,
        height: viewportPosition.height / safeScale
      }

      // ROBUST VALIDATION: Check for reasonable position values
      if (position.x < 0 || position.y < 0 || position.width <= 0 || position.height <= 0) {
        console.error('Invalid calculated position:', { rawPosition, position, scale })
        alert('Cannot create highlight: Invalid position calculation. Please try selecting the text again.')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      console.log('Highlight position debug:', {
        pageNumber: selectedTextInfo.pageNumber,
        scrollMode: pdfViewer.scrollMode,
        currentScale: scale,
        currentZoom: pdfViewer.zoom,
        selectionRect: { 
          left: selectionRect.left, 
          top: selectionRect.top, 
          width: selectionRect.width, 
          height: selectionRect.height 
        },
        containerRect: { 
          left: containerRect.left, 
          top: containerRect.top,
          width: containerRect.width,
          height: containerRect.height
        },
        containerInfo: {
          hasDataPageNumber: pageContainer.hasAttribute('data-page-number'),
          pageNumberAttr: pageContainer.getAttribute('data-page-number'),
          className: pageContainer.className,
          offsetTop: pageContainer.offsetTop,
          offsetLeft: pageContainer.offsetLeft,
          scrollTop: scrollContainerRef.current?.scrollTop || 0
        },
        rawPositionBeforeNormalization: rawPosition,
        normalizedPosition: position,
        safeScale: safeScale,
        textElement: {
          fontSize: textElement?.style?.fontSize,
          lineHeight: textElement?.style?.lineHeight,
          tagName: textElement?.tagName
        }
      })

      // Calculate text offset for reading mode sync
      const rawPageText = document.pageTexts?.[selectedTextInfo.pageNumber - 1]
      const pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
      const textOffset = highlightService.calculateTextOffset(
        pageText,
        selectedTextInfo.text,
        0
      )

      // Capture text anchors from PDF.js text content
      let textAnchors: { startIndex?: number; endIndex?: number; itemIds?: number[] } | undefined
      try {
        const page = await pdfDocRef.current.getPage(selectedTextInfo.pageNumber)
        const textContent = await page.getTextContent()
        
        // Find text layer spans that correspond to the selected range
        const selectedText = selectedTextInfo.text.trim()
        const textLayerDiv = pdfViewer.scrollMode === 'continuous'
          ? pageTextLayerRefs.current.get(selectedTextInfo.pageNumber)
          : textLayerRef.current
        
        if (textLayerDiv) {
          // Find all spans within the selection range
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const selectionRange = selection.getRangeAt(0)
            const spans = textLayerDiv.querySelectorAll('span')
            
            const itemIds: number[] = []
            let startIndex: number | undefined
            let endIndex: number | undefined
            
            // Find spans that intersect with the selection
            spans.forEach((span, spanIndex) => {
              const spanRect = span.getBoundingClientRect()
              const rangeRect = selectionRange.getBoundingClientRect()
              
              // Check if span intersects with selection
              const intersects = !(
                spanRect.right < rangeRect.left ||
                spanRect.left > rangeRect.right ||
                spanRect.bottom < rangeRect.top ||
                spanRect.top > rangeRect.bottom
              )
              
              if (intersects) {
                // Use data-text-index attribute if available (from manual rendering)
                const textIndexAttr = span.getAttribute('data-text-index')
                if (textIndexAttr !== null) {
                  const index = parseInt(textIndexAttr, 10)
                  if (!isNaN(index) && !itemIds.includes(index)) {
                    itemIds.push(index)
                    if (startIndex === undefined || index < startIndex) startIndex = index
                    if (endIndex === undefined || index > endIndex) endIndex = index
                  }
                } else {
                  // Fallback: try to match by text content
                  const spanText = span.textContent || ''
                  for (let i = 0; i < textContent.items.length; i++) {
                    const item = textContent.items[i] as any
                    if (item.str === spanText && !itemIds.includes(i)) {
                      itemIds.push(i)
                      if (startIndex === undefined) startIndex = i
                      endIndex = i
                      break
                    }
                  }
                }
              }
            })
            
            // If we found items, create text anchors
            if (itemIds.length > 0) {
              textAnchors = {
                startIndex: startIndex,
                endIndex: endIndex,
                itemIds: itemIds.sort((a, b) => a - b) // Sort ascending
              }
              console.log('📌 Captured text anchors:', textAnchors)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to capture text anchors, continuing without them:', error)
      }

      // Create highlight via service
      console.log('📝 Creating highlight with bookId:', {
        bookId: document.id,
        documentId: document.id,
        documentName: document.name,
        pageNumber: selectedTextInfo.pageNumber,
        hasDocument: !!document,
        documentType: document?.type,
        hasTextAnchors: !!textAnchors
      })
      
      const highlight = await highlightService.createHighlight({
        bookId: document.id,
        pageNumber: selectedTextInfo.pageNumber,
        highlightedText: selectedTextInfo.text,
        colorId,
        colorHex,
        positionData: position,
        textStartOffset: textOffset?.startOffset,
        textEndOffset: textOffset?.endOffset,
        textContextBefore: textOffset?.contextBefore,
        textContextAfter: textOffset?.contextAfter,
        textAnchors: textAnchors
      })

      // Add to local state
      setHighlights(prev => [...prev, highlight])

      // Track last created highlight for undo
      setLastCreatedHighlightId(highlight.id)
      setShowUndoToast(true)
      
      // Auto-hide undo toast after 5 seconds
      setTimeout(() => {
        setShowUndoToast(false)
        setLastCreatedHighlightId(null)
      }, 5000)

      // Clear selection
      window.getSelection()?.removeAllRanges()
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
    } catch (error: any) {
      console.error('Error creating highlight:', error)
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        selectedTextInfo: selectedTextInfo ? {
          text: selectedTextInfo.text.substring(0, 50),
          pageNumber: selectedTextInfo.pageNumber,
          hasRange: !!selectedTextInfo.range
        } : null
      })
      
      // Show user-friendly message based on error type
      if (error.message?.includes('only available in production')) {
        alert('💡 Highlighting is only available in the deployed version.\n\nThis feature requires backend API endpoints that are only active in production.\n\nTo test highlights, please use the deployed app at your Vercel URL.')
      } else if (error.message?.includes('Failed to create highlight')) {
        // Backend error - show the specific error message
        alert(`Failed to create highlight: ${error.message}\n\nPlease check your connection and try again.`)
      } else if (error.message) {
        // Other specific errors
        alert(`Failed to create highlight: ${error.message}`)
      } else {
        // Generic error
        alert(`Failed to create highlight. Please try again.\n\nError: ${error?.message || 'Unknown error'}`)
      }
      
      // Clear UI state on error
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
    }
  }, [selectedTextInfo, document.id, document.pageTexts])

  // Mark highlights as orphaned when page text is edited
  const markPageHighlightsOrphaned = useCallback(async (pageNum: number) => {
    try {
      await highlightService.markPageHighlightsOrphaned(
        document.id,
        pageNum,
        `Page text was edited on ${new Date().toLocaleDateString()}`
      )
      
      // Update local state
      setHighlights(prev => prev.map(h => 
        h.page_number === pageNum && !h.is_orphaned
          ? { ...h, is_orphaned: true, orphaned_reason: `Page text was edited on ${new Date().toLocaleDateString()}` }
          : h
      ))
    } catch (error) {
      console.error('Error marking highlights as orphaned:', error)
    }
  }, [document.id])

  // This function should be called whenever page text is saved after editing
  // Example: handleSavePageEdit(pageNum, newText)
  const handleSavePageEdit = useCallback(async (pageNum: number, newText: string) => {
    // Save the edited text (existing logic would go here)
    // ... your save logic ...
    
    // Mark highlights on this page as orphaned
    await markPageHighlightsOrphaned(pageNum)
  }, [markPageHighlightsOrphaned])

  // Add mouseup event listener for text selection highlighting
  useEffect(() => {
    window.document.addEventListener('mouseup', handleTextSelection as any)
    return () => {
      window.document.removeEventListener('mouseup', handleTextSelection as any)
    }
  }, [handleTextSelection])


  const handleVoiceSelect = useCallback((voice: any) => {
    // Convert voice to the format expected by the store
    const storeVoice = {
      name: voice.name,
      languageCode: voice.languageCode || voice.lang,
      gender: voice.gender,
      type: voice.type || 'native'
    };
    
    ttsManager.setVoice(voice)
    updateTTS({ 
      voice: storeVoice,
      voiceName: voice.name 
    })
    setShowVoiceSelector(false)
  }, [updateTTS])

  if (pdfViewer.readingMode) {
    // Get theme-based styles
    const getThemeStyles = () => {
      switch (typography.theme) {
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

    // Calculate progress percentage
    const progressPercentage = numPages ? (pageNumber / numPages) * 100 : 0

    // Render page content with structured paragraphs and word highlighting
    const renderPageContent = (pageNum: number) => {
      console.log('🔍 renderPageContent: Processing page', {
        pageNum,
        documentId: document.id,
        hasPageTexts: !!document.pageTexts,
        pageTextsLength: document.pageTexts?.length || 0
      });
      
      // Ensure pageTexts array exists and the specific page text is a string
      const rawPageText = document.pageTexts?.[pageNum - 1]
      console.log('🔍 renderPageContent: Raw page text', {
        pageNum,
        rawPageTextType: typeof rawPageText,
        rawPageTextValue: String(rawPageText).substring(0, 100) + (String(rawPageText).length > 100 ? '...' : '')
      });
      
      // Comprehensive sanitization of pageText
      let pageText: string;
      if (rawPageText === null || rawPageText === undefined) {
        console.warn(`renderPageContent: PageText ${pageNum} is null/undefined, using empty string`);
        pageText = '';
      } else if (typeof rawPageText === 'string') {
        pageText = rawPageText;
      } else if (typeof rawPageText === 'object') {
        console.warn(`renderPageContent: PageText ${pageNum} is object, stringifying:`, {
          type: typeof rawPageText,
          constructor: (rawPageText as any)?.constructor?.name,
          keys: Object.keys(rawPageText || {}),
          value: JSON.stringify(rawPageText).substring(0, 100)
        });
        try {
          pageText = JSON.stringify(rawPageText);
        } catch (e) {
          console.warn(`renderPageContent: Failed to stringify PageText ${pageNum}, using fallback`);
          pageText = String(rawPageText);
        }
      } else {
        console.warn(`renderPageContent: PageText ${pageNum} is ${typeof rawPageText}, converting to string`);
        pageText = String(rawPageText);
      }
      
      // Priority: cleaned text > edited text > original page text
      const currentPageText = cleanedPageTexts[pageNum] 
        ? cleanedPageTexts[pageNum]
        : (isEditing && editedTexts[pageNum] ? editedTexts[pageNum] : pageText)
      
      // Ensure currentPageText is a string with additional safety
      let safePageText: string;
      if (currentPageText === null || currentPageText === undefined) {
        console.warn(`renderPageContent: CurrentPageText ${pageNum} is null/undefined, using empty string`);
        safePageText = '';
      } else if (typeof currentPageText === 'string') {
        safePageText = currentPageText;
      } else {
        console.warn(`renderPageContent: CurrentPageText ${pageNum} is ${typeof currentPageText}, converting to string`);
        safePageText = String(currentPageText);
      }
      
      console.log('🔍 renderPageContent: Safe page text', {
        pageNum,
        safePageTextType: typeof safePageText,
        hasSplit: typeof safePageText === 'string' && typeof safePageText.split === 'function'
      });
      
      if (!safePageText) {
        return (
          <div className={`text-center py-8 ${themeStyles.text} opacity-50`}>
            No text available for page {pageNum}.
          </div>
        )
      }

      console.log('🔍 renderPageContent: About to call parseTextWithBreaks', {
        pageNum,
        safePageTextType: typeof safePageText,
        safePageTextValue: (String(safePageText).substring(0, 100) + (String(safePageText).length > 100 ? '...' : ''))
      });

      const segments = parseTextWithBreaks(safePageText)
      const totalWords = segments.filter(s => s.type === 'word').length
      const wordsRead = tts.currentWordIndex !== null ? tts.currentWordIndex + 1 : 0
      
      // Calculate spacing based on multiplier
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
            onContextMenu={handleContextMenuClick}
          >
            {segments.map((segment, index) => {
              if (segment.type === 'break') {
                // Render breaks as spacing
                if (segment.breakLevel === 1) {
                  // Space between words
                  return <span key={`break-${index}`}> </span>
                } else if (segment.breakLevel === 2) {
                  // Line break
                  return <div key={`break-${index}`} style={{ marginTop: `${spacing.line}em` }} />
                } else if (segment.breakLevel === 3) {
                  // Paragraph break
                  return <div key={`break-${index}`} style={{ marginTop: `${spacing.paragraph}em` }} />
                } else if (segment.breakLevel === 4) {
                  // Section break with optional separator
                  return (
                    <div key={`break-${index}`} style={{ marginTop: `${spacing.section}em`, marginBottom: `${spacing.section}em` }}>
                      <div className={`border-t ${themeStyles.text} opacity-20 my-4`} />
                    </div>
                  )
                }
              } else if (segment.type === 'table') {
                // Render table
                return (
                  <div key={`table-${index}`} className="my-4 overflow-x-auto">
                    <table className={`min-w-full border-collapse border ${themeStyles.text} opacity-90`}>
                      <tbody>
                        {segment.tableData?.map((row, rowIdx) => {
                          // Ensure row is a string
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
                // Formula conversion removed from Reading Mode - just render as plain text
                const formulaText = segment.content
                // Render formula as plain monospace text without LaTeX conversion
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
                    {formulaText}
                  </span>
                )
              } else if (segment.type === 'word') {
                // Determine if this word is in the current paragraph
                const isCurrentParagraph = segment.paragraphIndex === currentParagraphIndex
                const isTTSHighlighted = tts.highlightCurrentWord && 
                                     tts.currentWordIndex === segment.wordIndex && 
                                     pageNum === pageNumber
                
                // Check if this word is within a user highlight (read-only in reading mode)
                let userHighlight: HighlightType | undefined
                const pageHighlights = highlights.filter(h => h.page_number === pageNum && !h.is_orphaned)
                
                // Calculate approximate character position for this word
                // This is a simplified approach - we'd need more precise tracking for production
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
                      backgroundColor: userHighlight ? `${userHighlight.color_hex}40` : undefined, // 40 = 25% opacity in hex
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
              
              {/* Text cleanup progress indicator */}
              {isCleaning && cleaningProgress.total > 0 && (
                <div className="flex items-center gap-2 text-xs opacity-70 px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                  <span>Cleaning text... {cleaningProgress.current}/{cleaningProgress.total}</span>
                </div>
              )}
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

              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEditedText}
                    className={`px-4 py-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors font-medium`}
                    title="Save Changes (Ctrl+S)"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditingPageNum(null)
                      setEditedTexts({})
                      setHasUnsavedChanges(false)
                    }}
                    className={`px-4 py-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors font-medium`}
                    title="Cancel (Escape)"
                  >
                    Cancel
                  </button>
                  {hasUnsavedChanges && (
                    <div className={`text-xs ${themeStyles.text} opacity-70`}>
                      Unsaved changes
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      // Initialize edited texts with current page texts
                      const initialTexts: { [pageNum: number]: string } = {}
                      document.pageTexts?.forEach((text, index) => {
                        // Ensure text is a string
                        const safeText = typeof text === 'string' ? text : String(text || '')
                        initialTexts[index + 1] = safeText
                      })
                      setEditedTexts(initialTexts)
                      setIsEditing(true)
                      setHasUnsavedChanges(false)
                    }}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors`}
                    title="Edit Text (E)"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowTypographySettings(true)}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors`}
                    title="Typography Settings"
                  >
                    <Type className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsHighlightMode(!isHighlightMode)
                      // Clear any existing selection and popover when toggling mode
                      if (isHighlightMode) {
                        setHighlightPickerPosition(null)
                        setSelectedTextInfo(null)
                        setShowHighlightColorPopover(false)
                      }
                    }}
                    className={`p-2 rounded-lg transition-colors relative ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText}`}
                    style={{
                      backgroundColor: isHighlightMode ? 'var(--color-primary-light, rgba(59, 130, 246, 0.1))' : undefined,
                      color: isHighlightMode ? 'var(--color-primary, #3b82f6)' : undefined
                    }}
                    title={isHighlightMode ? "Exit Highlight Mode" : "Enter Highlight Mode"}
                  >
                    <Highlighter className="w-5 h-5" />
                    {/* Highlight Mode Marker */}
                    {isHighlightMode && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      // Check if cleanedPageTexts already exists (indicates TTS-ready text has been generated)
                      if (Object.keys(cleanedPageTexts).length > 0) {
                        const confirmed = window.confirm(
                          'This document has already been processed with AI cleanup (TTS-ready text has been generated). Do you want to process it again?'
                        )
                        if (!confirmed) {
                          return
                        }
                      }
                      setShowCleanupModal(true)
                    }}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors`}
                    title="Clean Up Text"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                  {/* Restore Original button - only show if any pages are cleaned */}
                  {Object.keys(cleanedPageTexts).length > 0 && (
                    <button
                      onClick={handleRestoreAllOriginal}
                      className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors`}
                      title="Restore Original Text"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}
              
              {/* Page Navigation - Only show in single page mode */}
              {pdfViewer.scrollMode === 'single' && (
                <>
                  <button
                    onClick={goToPreviousPage}
                    disabled={pageNumber <= 1}
                    className={`p-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToNextPage}
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
          {isEditing ? (
            // Edit mode - show textarea for current page only
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px` }}>
              <div className={`text-xs ${themeStyles.text} opacity-50 mb-6 text-center`}>
                Tip: Use Ctrl+S to save or Escape to cancel
              </div>
              <div className="mb-4">
                <label className={`block text-sm font-medium ${themeStyles.text} mb-2`}>
                  Editing Page {editingPageNum || pageNumber}
                </label>
                <textarea
                  value={editedTexts[editingPageNum || pageNumber] || ''}
                  onChange={(e) => {
                    const currentPage = editingPageNum || pageNumber
                    setEditedTexts(prev => ({
                      ...prev,
                      [currentPage]: e.target.value
                    }))
                    setHasUnsavedChanges(true)
                  }}
                  className={`w-full min-h-96 p-4 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none resize-y ${fontClass} ${themeStyles.text}`}
                  style={{
                    fontSize: `${typography.fontSize}px`,
                    lineHeight: typography.lineHeight,
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)'
                  }}
                  placeholder={`Edit page ${editingPageNum || pageNumber} text here...`}
                  autoFocus
                />
              </div>
            </div>
          ) : pdfViewer.scrollMode === 'continuous' ? (
            // Continuous scroll mode - render all pages
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px`, userSelect: 'text', WebkitUserSelect: 'text' }}>
              {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                // If editing a page, only show that page
                if (editingPageNum !== null && editingPageNum !== pageNum) {
                  return null
                }
                
                return (
                  <div 
                    key={pageNum} 
                    className="mb-16 last:mb-0" 
                    data-page-number={pageNum}
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                  >
                    {/* Page number indicator with edit icon */}
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className={`text-sm ${themeStyles.text} opacity-50`}>
                        — Page {pageNum} —
                      </div>
                      <button
                        onClick={() => {
                          if (editingPageNum === pageNum) {
                            // Stop editing this page
                            setEditingPageNum(null)
                            setIsEditing(false)
                          } else {
                            // Start editing this page
                            const rawInitialText = document.pageTexts?.[pageNum - 1]
                            const initialText = typeof rawInitialText === 'string' ? rawInitialText : String(rawInitialText || '')
                            setEditedTexts(prev => ({
                              ...prev,
                              [pageNum]: prev[pageNum] || initialText
                            }))
                            setEditingPageNum(pageNum)
                            setIsEditing(true)
                          }
                        }}
                        className={`p-2 rounded-lg transition-all ${
                          editingPageNum === pageNum
                            ? 'bg-blue-500 text-white shadow-md'
                            : `${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} hover:shadow-sm`
                        }`}
                        style={{
                          opacity: editingPageNum === pageNum ? 1 : 0.8
                        }}
                        title={editingPageNum === pageNum ? 'Stop editing' : 'Edit this page'}
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      {/* Restore Original button for this page if it's been cleaned */}
                      {cleanedPageTexts[pageNum] && (
                        <button
                          onClick={() => handleRestoreOriginal(pageNum)}
                          className={`p-2 rounded-lg transition-all ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} hover:shadow-sm`}
                          title="Restore original text for this page"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    
                    {/* Page content - show textarea if editing this specific page */}
                    {editingPageNum === pageNum ? (
                      <div className="mb-4">
                        <textarea
                          value={editedTexts[pageNum] || ''}
                          onChange={(e) => {
                            setEditedTexts(prev => ({
                              ...prev,
                              [pageNum]: e.target.value
                            }))
                            setHasUnsavedChanges(true)
                          }}
                          className={`w-full min-h-96 p-4 rounded-lg border-2 border-blue-500 focus:border-blue-600 focus:outline-none resize-y ${fontClass} ${themeStyles.text}`}
                          style={{
                            fontSize: `${typography.fontSize}px`,
                            lineHeight: typography.lineHeight,
                            backgroundColor: 'var(--color-background)',
                            color: 'var(--color-text)'
                          }}
                          placeholder={`Edit page ${pageNum} text here...`}
                        />
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            onClick={async () => {
                              await handleSaveEditedText()
                              setEditingPageNum(null)
                            }}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                            title="Save Changes (Ctrl+S)"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditedTexts(prev => {
                                const newTexts = { ...prev }
                                delete newTexts[pageNum]
                                return newTexts
                              })
                              setEditingPageNum(null)
                              setIsEditing(false)
                              setHasUnsavedChanges(false)
                            }}
                            className={`px-4 py-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors font-medium text-sm`}
                            title="Cancel (Escape)"
                          >
                            Cancel
                          </button>
                          {hasUnsavedChanges && (
                            <div className={`text-xs ${themeStyles.text} opacity-70`}>
                              Unsaved changes
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-lg max-w-none">
                        {renderPageContent(pageNum)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // Single page mode
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px` }}>
              {/* Page number indicator with edit icon */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`text-sm ${themeStyles.text} opacity-50`}>
                  — Page {pageNumber} —
                </div>
                <button
                  onClick={() => {
                    if (editingPageNum === pageNumber) {
                      // Stop editing this page
                      setEditingPageNum(null)
                      setIsEditing(false)
                    } else {
                      // Start editing this page
                      const rawInitialText = document.pageTexts?.[pageNumber - 1]
                      const initialText = typeof rawInitialText === 'string' ? rawInitialText : String(rawInitialText || '')
                      setEditedTexts(prev => ({
                        ...prev,
                        [pageNumber]: prev[pageNumber] || initialText
                      }))
                      setEditingPageNum(pageNumber)
                      setIsEditing(true)
                    }
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    editingPageNum === pageNumber
                      ? 'bg-blue-500 text-white shadow-md'
                      : `${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} hover:shadow-sm`
                  }`}
                  style={{
                    opacity: editingPageNum === pageNumber ? 1 : 0.8
                  }}
                  title={editingPageNum === pageNumber ? 'Stop editing' : 'Edit this page'}
                >
                  <FileText className="w-5 h-5" />
                </button>
                {/* Restore Original button for this page if it's been cleaned */}
                {cleanedPageTexts[pageNumber] && (
                  <button
                    onClick={() => handleRestoreOriginal(pageNumber)}
                    className={`p-2 rounded-lg transition-all ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} hover:shadow-sm`}
                    title="Restore original text for this page"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Page content - show textarea if editing this specific page */}
              {editingPageNum === pageNumber ? (
                <div className="mb-4">
                  <textarea
                    value={editedTexts[pageNumber] || ''}
                    onChange={(e) => {
                      setEditedTexts(prev => ({
                        ...prev,
                        [pageNumber]: e.target.value
                      }))
                      setHasUnsavedChanges(true)
                    }}
                    className={`w-full min-h-96 p-4 rounded-lg border-2 border-blue-500 focus:border-blue-600 focus:outline-none resize-y ${fontClass} ${themeStyles.text}`}
                    style={{
                      fontSize: `${typography.fontSize}px`,
                      lineHeight: typography.lineHeight,
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)'
                    }}
                    placeholder={`Edit page ${pageNumber} text here...`}
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={async () => {
                        await handleSaveEditedText()
                        setEditingPageNum(null)
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                      title="Save Changes (Ctrl+S)"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditedTexts(prev => {
                          const newTexts = { ...prev }
                          delete newTexts[pageNumber]
                          return newTexts
                        })
                        setEditingPageNum(null)
                        setIsEditing(false)
                        setHasUnsavedChanges(false)
                      }}
                      className={`px-4 py-2 ${themeStyles.buttonBg} ${themeStyles.buttonHover} ${themeStyles.buttonText} rounded-lg transition-colors font-medium text-sm`}
                      title="Cancel (Escape)"
                    >
                      Cancel
                    </button>
                    {hasUnsavedChanges && (
                      <div className={`text-xs ${themeStyles.text} opacity-70`}>
                        Unsaved changes
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="prose prose-lg max-w-none">
                  {renderPageContent(pageNumber)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reading Mode Active Indicator - Positioned above audio player */}
        <div className={`fixed bottom-24 left-4 ${themeStyles.indicatorBg} text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2`}>
          <BookOpen className="w-4 h-4" />
          <span className="text-sm font-medium">Reading Mode Active</span>
        </div>

        {/* Audio Widget - also shown in reading mode */}
        <AudioWidget />

        {/* Typography Settings Modal */}
        {showTypographySettings && (
          <TypographySettings onClose={() => setShowTypographySettings(false)} />
        )}

        {/* Text Cleanup Modal */}
        {showCleanupModal && (
          <TextCleanupModal
            onClose={() => setShowCleanupModal(false)}
            onApply={handleTextCleanup}
            isProcessing={isCleaning}
            currentPageNumber={pageNumber}
            totalPages={numPages || 0}
            scrollMode={pdfViewer.scrollMode}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full" style={{ backgroundColor: 'var(--color-background)', paddingBottom: '100px' }}>
      {/* OCR Status Banner */}
      {ocrStatus !== 'not_needed' && ocrStatus !== 'user_declined' && (
        <div className="p-4" style={{ backgroundColor: 'var(--color-background)' }}>
          <OCRBanner
            status={ocrStatus as any}
            onRetry={ocrCanRetry ? handleOCRRetry : undefined}
            onStartOCR={ocrStatus === 'pending' ? handleStartOCR : undefined}
            errorMessage={ocrError}
          />
        </div>
      )}
      
      {/* PDF Controls */}
      <div 
        ref={toolbarRef}
        className={`fixed top-[var(--header-height)] left-0 right-0 z-40 transition-all duration-300 ease-in-out ${isToolbarStuck ? 'backdrop-blur-md shadow-lg' : 'backdrop-blur-sm shadow-sm'}`}
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderBottom: isToolbarStuck 
            ? '2px solid var(--color-border)' 
            : '1px solid var(--color-border)',
          boxShadow: isToolbarStuck 
            ? '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)'
        }}
      >
        <div className="flex items-center justify-center gap-4 p-4">
          {/* Center Section: All Controls */}
          <div className="flex items-center gap-2">
            {/* Group 1: Document Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDownload()
                }}
                className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center shrink-0"
                style={{ 
                  color: 'var(--color-text-primary)', 
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Download PDF with highlights and notes"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>

            {/* Separator */}
            <div 
              className="w-px h-6"
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden="true"
            />

            {/* Group 2: Page Navigation */}
            <div className="flex items-center gap-2">

                <button
                  onClick={goToFirstPage}
                  disabled={pageNumber <= 1}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="First Page"
                >
              <ChevronsLeft className="w-5 h-5" />
                </button>
                <button
              onClick={goToPreviousPage}
                  disabled={pageNumber <= 1}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Previous Page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                className="w-16 px-2 py-1 text-center rounded-lg focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: 'var(--color-background)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--border-radius-md)'
                    }}
                  />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>of {numPages || '?'}</span>
                </form>
                
                <button
                  onClick={goToNextPage}
              disabled={!numPages || pageNumber >= numPages}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Next Page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={goToLastPage}
              disabled={!numPages || pageNumber >= numPages}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Last Page"
                >
              <ChevronsRight className="w-5 h-5" />
              </button>
            </div>

            {/* Separator */}
            <div 
              className="w-px h-6"
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden="true"
            />

            {/* Center Section: View Controls & Annotation Tools */}
            <div className="flex items-center gap-2">
            {/* Group 3: Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
              onClick={handleZoomOut}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
              </button>
            <span className="text-sm min-w-[60px] text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {Math.round(scale * 100)}%
            </span>
              <button
              onClick={handleZoomIn}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
              </button>
            
            </div>

            {/* Separator */}
            <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Group 4: View Mode Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRotate}
                className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
                style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Rotate"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              {/* Scroll Mode Switch */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
              <button
                onClick={toggleScrollMode}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${pdfViewer.scrollMode === 'single' ? 'shadow-sm' : ''}`}
                style={{
                  backgroundColor: pdfViewer.scrollMode === 'single' ? 'var(--color-primary)' : 'transparent',
                  color: pdfViewer.scrollMode === 'single' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'
                }}
                title="Single Page Mode"
              >
                One Page
              </button>
              <button
                onClick={toggleScrollMode}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${pdfViewer.scrollMode === 'continuous' ? 'shadow-sm' : ''}`}
                style={{
                  backgroundColor: pdfViewer.scrollMode === 'continuous' ? 'var(--color-primary)' : 'transparent',
                  color: pdfViewer.scrollMode === 'continuous' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'
                }}
                title="Continuous Scrolling Mode"
              >
                Scrolling
              </button>
              </div>
            </div>

            {/* Separator */}
            <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Group 5: Annotation Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectionMode(!selectionMode)
                }}
                className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
                style={{
                  backgroundColor: selectionMode ? 'var(--color-primary-light)' : 'transparent',
                  color: selectionMode ? 'var(--color-primary)' : 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  if (!selectionMode) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!selectionMode) e.currentTarget.style.backgroundColor = 'transparent'
                }}
                title="Selection Mode"
              >
                <MousePointer2 className="w-5 h-5" />
              </button>

              {/* Highlight Mode Toggle Button */}
              <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsHighlightMode(!isHighlightMode)
                // Clear any existing selection and popover when toggling mode
                if (isHighlightMode) {
                  setHighlightPickerPosition(null)
                  setSelectedTextInfo(null)
                  setShowHighlightColorPopover(false)
                }
              }}
              className="p-2 rounded-lg transition-colors relative w-9 h-9 flex items-center justify-center"
              style={{
                backgroundColor: isHighlightMode ? 'var(--color-primary-light)' : 'transparent',
                color: isHighlightMode ? 'var(--color-primary)' : 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                if (!isHighlightMode) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isHighlightMode) e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title={isHighlightMode ? "Exit Highlight Mode" : "Enter Highlight Mode"}
            >
              <Highlighter className="w-5 h-5" />
              {/* Highlight Mode Marker */}
              {isHighlightMode && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>

            {/* Highlight Color Picker Button */}
            <button
              ref={highlightColorButtonRef}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowHighlightColorPopover(!showHighlightColorPopover)
              }}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
              style={{
                backgroundColor: showHighlightColorPopover ? 'var(--color-primary-light)' : 'transparent',
                color: showHighlightColorPopover ? 'var(--color-primary)' : 'var(--color-text-primary)',
                opacity: 1
              }}
              onMouseEnter={(e) => {
                if (!showHighlightColorPopover) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              }}
              onMouseLeave={(e) => {
                if (!showHighlightColorPopover) e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Highlight Colors"
              disabled={false}
            >
              <Palette className="w-5 h-5" />
            </button>

            {/* Highlight Management Panel Button */}
            {highlights.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowHighlightPanel(true)
                }}
                className="p-2 rounded-lg transition-colors relative"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                title="Manage Highlights"
              >
                <Rows className="w-5 h-5" />
                {highlights.filter(h => h.is_orphaned).length > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" />
                )}
              </button>
            )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />

            {/* Group 6: Reading Mode */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleReadingMode()
              }}
              className="p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center"
              style={{
                backgroundColor: pdfViewer.readingMode ? 'var(--color-primary-light)' : 'transparent',
                color: pdfViewer.readingMode ? 'var(--color-primary)' : 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                if (!pdfViewer.readingMode) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              }}
              onMouseLeave={(e) => {
                if (!pdfViewer.readingMode) e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Reading Mode (M)"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-8 pt-20" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
        {pdfViewer.scrollMode === 'continuous' ? (
          // Continuous scroll mode - render all pages
          <div className="flex flex-col items-center gap-4">
            {isLoading ? (
              // Loading state for continuous mode
              <div className="relative bg-white shadow-2xl p-20">
                <div className="text-center">
                  <div 
                    className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                    style={{ borderColor: 'var(--color-primary)' }}
                  ></div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    Loading PDF...
                  </p>
                </div>
              </div>
            ) : (
              numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div 
                  key={pageNum} 
                  className="relative bg-white shadow-2xl mb-4" 
                  data-page-number={pageNum} 
                  style={{ 
                    minHeight: '600px', 
                    minWidth: '400px',
                    userSelect: 'text',
                    WebkitUserSelect: 'text'
                  }}
                  onContextMenu={handleContextMenuClick}
                >
                  <canvas
                    ref={(el) => {
                      if (el) pageCanvasRefs.current.set(pageNum, el)
                    }}
                    className="block"
                  />
                  <div
                    ref={(el) => {
                      if (el) pageTextLayerRefs.current.set(pageNum, el)
                    }}
                    className="textLayer"
                    style={{ opacity: 1, pointerEvents: 'auto', userSelect: 'text' }}
                  />
                  <div
                    ref={(el) => {
                      if (el) pageAnnotationLayerRefs.current.set(pageNum, el)
                    }}
                    className="annotationLayer"
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      pointerEvents: 'none'
                    }}
                  />
                  {/* Render highlights for this page */}
                  {highlights
                    .filter(h => h.page_number === pageNum)
                    .map(highlight => {
                      // ROBUST SCALING: Scale positions by current scale (positions are stored normalized at scale 1.0)
                      // Add safeguards to prevent invalid scale values
                      const safeScale = Math.max(scale, 0.1)
                      const scaledPosition = {
                        x: highlight.position_data.x * safeScale,
                        y: highlight.position_data.y * safeScale,
                        width: highlight.position_data.width * safeScale,
                        height: highlight.position_data.height * safeScale
                      }
                      
                      return (
                        <div
                          key={highlight.id}
                          className="absolute group"
                                                style={{
                        left: `${scaledPosition.x}px`,
                        top: `${scaledPosition.y}px`,
                        width: `${scaledPosition.width}px`,
                        height: `${scaledPosition.height}px`,
                        backgroundColor: highlight.color_hex,
                        opacity: highlight.is_orphaned ? 0.2 : 0.4,
                        pointerEvents: 'none', // Allow text selection underneath
                        border: selectedHighlightId === highlight.id ? '2px solid #3B82F6' : (highlight.is_orphaned ? '2px dashed #999' : 'none'),
                        zIndex: 3,
                        transformOrigin: '0 0', // Match text layer transform origin
                      }}
                      title={highlight.is_orphaned ? `Orphaned: ${highlight.orphaned_reason}` : highlight.highlighted_text}
                        >
                          {highlight.is_orphaned && (
                            <div className="absolute -top-3 -left-1 bg-yellow-500 text-white text-xs px-1 rounded z-10">
                              ⚠
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              removeHighlight(highlight.id)
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-100 group-hover:opacity-100 transition-all shadow-lg z-10"
                            style={{ pointerEvents: 'auto' }}
                            title="Delete highlight"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))
            )}
      </div>
        ) : (
          // Single page mode
          <div className="flex justify-center">
            <div 
              ref={pageContainerRef} 
              className="relative bg-white shadow-2xl" 
              style={{ 
                minHeight: '600px', 
                minWidth: '400px',
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
              onContextMenu={handleContextMenuClick}
            >
              {/* Loading indicator */}
              {(() => {
                const shouldShowLoading = isLoading || !pageRendered;
                console.log('🔍 Loading indicator check:', {
                  isLoading,
                  pageRendered,
                  shouldShowLoading,
                  numPages
                });
                return shouldShowLoading && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-white z-10"
                    style={{ pointerEvents: 'none' }}
                  >
                    <div className="text-center">
                      <div 
                        className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                        style={{ borderColor: 'var(--color-primary)' }}
                      ></div>
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        {isLoading ? 'Loading PDF...' : 'Rendering page...'}
                      </p>
                    </div>
                  </div>
                );
              })()}
              
              <canvas ref={canvasRef} className="block" style={{ opacity: pageRendered ? 1 : 0, position: 'relative', zIndex: 1, pointerEvents: 'none' }} />
              <div
                ref={textLayerRef}
                className="textLayer"
                style={{ 
                  opacity: 1, // Always visible - programmatically controlled
                  pointerEvents: 'auto', // Always enabled for interaction
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text',
                  visibility: 'visible', // Ensure visible
                  position: 'absolute',
                  zIndex: 2, // Above canvas
                  top: 0,
                  left: 0
                }}
              />
              <div
                ref={annotationLayerRef}
                className="annotationLayer"
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none'
                }}
              />
              
              {/* Render highlights */}
              {highlights
                .filter(h => h.page_number === pageNumber)
                .map(highlight => {
                  // ROBUST SCALING: Scale positions by current scale (positions are stored normalized at scale 1.0)
                  // Add safeguards to prevent invalid scale values
                  const safeScale = Math.max(scale, 0.1)
                  const scaledPosition = {
                    x: highlight.position_data.x * safeScale,
                    y: highlight.position_data.y * safeScale,
                    width: highlight.position_data.width * safeScale,
                    height: highlight.position_data.height * safeScale
                  }
                  
                  return (
                    <div
                      key={highlight.id}
                      className="absolute group"
                      style={{
                        left: `${scaledPosition.x}px`,
                        top: `${scaledPosition.y}px`,
                        width: `${scaledPosition.width}px`,
                        height: `${scaledPosition.height}px`,
                        backgroundColor: highlight.color_hex,
                        opacity: highlight.is_orphaned ? 0.2 : 0.4,
                        pointerEvents: 'none', // Allow text selection underneath
                        border: highlight.is_orphaned ? '2px dashed #999' : 'none',
                        zIndex: 3,
                        // Enable sub-pixel rendering for better alignment
                        transform: 'translateZ(0)',
                        transformOrigin: '0 0', // Match text layer transform origin
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        // Ensure pixel-perfect positioning
                        boxSizing: 'border-box',
                      }}
                      title={highlight.is_orphaned ? `Orphaned: ${highlight.orphaned_reason}` : highlight.highlighted_text}
                    >
                      {highlight.is_orphaned && (
                        <div className="absolute -top-3 -left-1 bg-yellow-500 text-white text-xs px-1 rounded z-10">
                          ⚠
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeHighlight(highlight.id)
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-100 group-hover:opacity-100 transition-all shadow-lg z-10"
                        style={{ pointerEvents: 'auto' }}
                        title="Delete highlight"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
                </div>
        </div>
      )}
          </div>

      {/* AI Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={createAIContextMenuOptions(
            handleAIClarification,
            handleAIFurtherReading,
            handleSaveNoteFromContext
          )}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Notes Panel */}
      <NotesPanel
        isOpen={showNotesPanel}
        onClose={() => setShowNotesPanel(false)}
        bookName={document.name}
        bookId={document.id}
        currentPage={pageNumber}
        selectedText={selectedTextForNote}
      />

      {/* Highlight Color Picker */}
      <HighlightColorPicker
        isOpen={highlightPickerPosition !== null}
        position={highlightPickerPosition || { x: 0, y: 0 }}
        onColorSelect={handleCreateHighlight}
        onCancel={() => {
          setHighlightPickerPosition(null)
          setSelectedTextInfo(null)
        }}
      />

      {/* Undo Toast for Last Created Highlight */}
      {showUndoToast && lastCreatedHighlightId && (
        <div
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4"
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span style={{ color: 'var(--color-text-primary)' }}>Highlight created</span>
          <button
            onClick={() => {
              if (lastCreatedHighlightId) {
                removeHighlight(lastCreatedHighlightId)
                setLastCreatedHighlightId(null)
              }
              setShowUndoToast(false)
            }}
            className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            Undo
          </button>
          <button
            onClick={() => {
              setShowUndoToast(false)
              setLastCreatedHighlightId(null)
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Highlight Management Panel */}
      <HighlightManagementPanel
        isOpen={showHighlightPanel}
        onClose={() => setShowHighlightPanel(false)}
        highlights={highlights}
        onDeleteHighlight={removeHighlight}
        onDeleteMultiple={async (ids) => {
          try {
            await highlightService.deleteHighlights(ids)
            setHighlights(prev => prev.filter(h => !ids.includes(h.id)))
          } catch (error) {
            console.error('Error deleting highlights:', error)
            alert('Failed to delete highlights. Please try again.')
          }
        }}
        onJumpToPage={(pageNum) => {
          setPageNumber(pageNum)
          updatePDFViewer({ currentPage: pageNum })
          setShowHighlightPanel(false)
        }}
        bookName={document.name}
      />

      {/* Audio Widget */}
      <AudioWidget />

      {/* Voice Selector Modal */}
      <VoiceSelector
        isOpen={showVoiceSelector}
        onClose={() => setShowVoiceSelector(false)}
        onVoiceSelect={handleVoiceSelect}
        currentVoice={tts.voice}
      />

      {/* Library Modal */}
      <LibraryModal 
        isOpen={showLibrary} 
        onClose={() => setShowLibrary(false)} 
      />

      {/* Upload Modal */}
      {showUpload && (
        <DocumentUpload onClose={() => setShowUpload(false)} />
      )}

      {/* Highlight Color Popover */}
      <HighlightColorPopover
        isOpen={showHighlightColorPopover}
        onClose={() => setShowHighlightColorPopover(false)}
        selectedColor={currentHighlightColor}
        onColorSelect={setCurrentHighlightColor}
        triggerRef={highlightColorButtonRef}
      />

    </div>
  )
}