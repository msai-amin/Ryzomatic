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
  Plus
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

// PDF.js will be imported dynamically

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
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageTextLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())

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
        const pdfjsLib = await import('pdfjs-dist')
        
        // Set up PDF.js worker - with safety check
        if (pdfjsLib && 'GlobalWorkerOptions' in pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        }

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

          // Render text layer for selection using the SAME viewport
          // CRITICAL: This text layer must be perfectly aligned with the canvas
          // Any changes to positioning, sizing, or transforms will break selection accuracy
          if (textLayerRef.current) {
            textLayerRef.current.innerHTML = ''
            const textContent = await page.getTextContent()
            
            // Manual text layer rendering with proper viewport synchronization
            // These settings have been fine-tuned for perfect alignment
            const textLayerFrag = window.document.createDocumentFragment()
            const textDivs: HTMLSpanElement[] = []
            
            textContent.items.forEach((item: any, index: number) => {
              const tx = item.transform
              
              // Transform PDF coordinates to viewport coordinates
              // For better alignment, we need to account for the full transformation matrix
              const x = tx[4]
              const y = tx[5]
              const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]))
              const fontWidth = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]))
              
              const span = window.document.createElement('span')
              span.textContent = item.str
              span.style.position = 'absolute'
              span.style.left = `${x}px`
              span.style.top = `${viewport.height - y - fontHeight}px`
              span.style.fontSize = `${fontHeight}px`
              span.style.fontFamily = 'sans-serif'
              span.style.lineHeight = '1'
              span.style.whiteSpace = 'pre'
              // Make height match the actual text height more precisely
              span.style.height = `${fontHeight}px`
              span.style.maxHeight = `${fontHeight}px`
              span.style.overflow = 'hidden'
              
              // Calculate width more precisely using PDF metrics
              let spanWidth = item.width
              
              // If no width provided, calculate based on font metrics
              if (!spanWidth || spanWidth <= 0) {
                // Use more conservative character width estimation
                spanWidth = item.str.length * fontHeight * 0.5
              }
              
              // Apply horizontal scaling to match PDF character spacing
              const scaleX = fontWidth / fontHeight
              if (Math.abs(scaleX - 1) > 0.01) {
                span.style.transform = `scaleX(${scaleX})`
                span.style.transformOrigin = '0% 0%'
                // Adjust width to account for scaling
                span.style.width = `${spanWidth / scaleX}px`
              } else {
                span.style.width = `${spanWidth}px`
              }
              
              // Ensure proper text selection behavior
              span.style.userSelect = 'text'
              span.style.cursor = 'text'
              
              textDivs.push(span)
              textLayerFrag.appendChild(span)
            })
            
            textLayerRef.current.appendChild(textLayerFrag)
            
            // CRITICAL: Make text layer visible immediately after rendering
            // Don't wait for pageRendered state to change
            textLayerRef.current.style.opacity = '1'
            
            console.log('📝 Text layer rendered with improved alignment:', {
              textElements: textDivs.length,
              pageNumber: pageNumber,
              hasTextLayer: !!textLayerRef.current,
              textLayerOpacity: textLayerRef.current.style.opacity
            })
          }
          
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
          
          // Render text layer for selection using the SAME viewport
          // CRITICAL: This text layer must be perfectly aligned with the canvas
          // Any changes to positioning, sizing, or transforms will break selection accuracy
          if (textLayerDiv) {
            textLayerDiv.innerHTML = ''
            const textContent = await page.getTextContent()
            
            // Manual text layer rendering with proper viewport synchronization
            // These settings have been fine-tuned for perfect alignment
            const textLayerFrag = window.document.createDocumentFragment()
            
            textContent.items.forEach((item: any, index: number) => {
              const tx = item.transform
              
              // Transform PDF coordinates to viewport coordinates
              // For better alignment, we need to account for the full transformation matrix
              const x = tx[4]
              const y = tx[5]
              const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]))
              const fontWidth = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]))
              
              const span = window.document.createElement('span')
              span.textContent = item.str
              span.style.position = 'absolute'
              span.style.left = `${x}px`
              span.style.top = `${viewport.height - y - fontHeight}px`
              span.style.fontSize = `${fontHeight}px`
              span.style.fontFamily = 'sans-serif'
              span.style.lineHeight = '1'
              span.style.whiteSpace = 'pre'
              // Make height match the actual text height more precisely
              span.style.height = `${fontHeight}px`
              span.style.maxHeight = `${fontHeight}px`
              span.style.overflow = 'hidden'
              
              // Calculate width more precisely using PDF metrics
              let spanWidth = item.width
              
              // If no width provided, calculate based on font metrics
              if (!spanWidth || spanWidth <= 0) {
                // Use more conservative character width estimation
                spanWidth = item.str.length * fontHeight * 0.5
              }
              
              // Apply horizontal scaling to match PDF character spacing
              const scaleX = fontWidth / fontHeight
              if (Math.abs(scaleX - 1) > 0.01) {
                span.style.transform = `scaleX(${scaleX})`
                span.style.transformOrigin = '0% 0%'
                // Adjust width to account for scaling
                span.style.width = `${spanWidth / scaleX}px`
              } else {
                span.style.width = `${spanWidth}px`
              }
              
              // Ensure proper text selection behavior
              span.style.userSelect = 'text'
              span.style.cursor = 'text'
              
              textLayerFrag.appendChild(span)
            })
            
            textLayerDiv.appendChild(textLayerFrag)
            
            // CRITICAL: Make text layer visible and interactive immediately after rendering
            textLayerDiv.style.opacity = '1'
            textLayerDiv.style.pointerEvents = 'auto'
            textLayerDiv.style.userSelect = 'text'
            
            console.log(`📝 Text layer rendered for page ${pageNum}:`, {
              textElements: textContent.items.length,
              hasTextLayer: !!textLayerDiv,
              textLayerOpacity: textLayerDiv.style.opacity,
              textLayerPointerEvents: textLayerDiv.style.pointerEvents,
              textLayerUserSelect: textLayerDiv.style.userSelect,
              childSpans: textLayerDiv.children.length,
              textLayerHTML: textLayerDiv.innerHTML.substring(0, 100) + '...'
            })
          }
        } catch (error) {
          console.error(`Error rendering page ${pageNum}:`, error)
        }
      }
      
      console.log('🎉 All pages rendered in continuous mode')
    }

    renderAllPages()
  }, [pdfViewer.readingMode, pdfViewer.scrollMode, numPages, scale, rotation])
  
  // Force text layer interactivity after any render (additional safety net)
  useEffect(() => {
    if (pdfViewer.scrollMode === 'continuous' && numPages) {
      // Double-check all text layers are interactive
      const checkTimer = setTimeout(() => {
        pageTextLayerRefs.current.forEach((textLayerDiv, pageNum) => {
          if (textLayerDiv) {
            textLayerDiv.style.opacity = '1'
            textLayerDiv.style.pointerEvents = 'auto'
            textLayerDiv.style.userSelect = 'text'
            
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

  // Ensure text layer is visible when pageRendered changes
  useEffect(() => {
    if (pageRendered && textLayerRef.current) {
      textLayerRef.current.style.opacity = '1'
      console.log('🔍 Ensuring text layer visibility after pageRendered change')
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
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [pageNumber, numPages, scale, rotation, showNotesPanel, pdfViewer.readingMode, updatePDFViewer, typography.textAlign, typography.focusMode, typography.readingGuide, updateTypography, isEditing])

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

    const handleClick = () => {
      setContextMenu(null)
    }

    window.document.addEventListener('contextmenu', handleContextMenu)
    window.document.addEventListener('click', handleClick)
    
    return () => {
      window.document.removeEventListener('contextmenu', handleContextMenu)
      window.document.removeEventListener('click', handleClick)
    }
  }, [])

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
          const response = await fetch(`/api/documents/ocr-status?documentId=${document.id}`);
          
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

  // Process formulas for LaTeX conversion when entering reading mode
  useEffect(() => {
    // Debounce formula processing to prevent too frequent conversions
    const timeoutId = setTimeout(async () => {
      const processFormulas = async () => {
        if (!pdfViewer.readingMode || !typography.renderFormulas || !document.pageTexts) {
          return
        }

        // Prevent multiple simultaneous conversions
        if (isConvertingFormulas) {
          return
        }

        // Extract formulas from all pages
        const allFormulas: Array<{ formula: string; isBlock: boolean; marker: string; pageNum: number }> = []
        
        document.pageTexts?.forEach((pageText, index) => {
          // Ensure pageText is a string
          const safePageText = typeof pageText === 'string' ? pageText : String(pageText || '')
          const markedFormulas = extractMarkedFormulas(safePageText)
          
          // Debug: Log formula extraction
          if (markedFormulas.length > 0) {
            console.log(`🔍 Formula extraction - Page ${index + 1}:`, {
              pageText: safePageText.substring(0, 200) + '...',
              markedFormulas: markedFormulas.map(f => ({
                formula: f.formula.substring(0, 50) + '...',
                isBlock: f.isBlock,
                marker: f.marker.substring(0, 30) + '...'
              }))
            })
          }
          
          markedFormulas.forEach(f => {
            allFormulas.push({ ...f, pageNum: index + 1 })
          })
        })

        if (allFormulas.length === 0) {
          console.log('🔍 No formulas found in document pages')
          return
        }
        
        console.log(`🔍 Found ${allFormulas.length} formulas total`, allFormulas.map(f => ({
          formula: f.formula.substring(0, 30) + '...',
          isBlock: f.isBlock,
          pageNum: f.pageNum
        })))

        // Filter out formulas that are already converted
        const formulasToConvert = allFormulas
          .filter(f => !formulaLatex.has(f.formula))
          .map(f => ({
            text: f.formula,
            startIndex: 0,
            endIndex: f.formula.length,
            isBlock: f.isBlock,
            confidence: 1.0,
          }))

        if (formulasToConvert.length === 0) {
          console.log('🔍 All formulas already converted, skipping conversion')
          return
        }
        
        console.log(`🔍 Converting ${formulasToConvert.length} formulas`, formulasToConvert.map(f => ({
          text: f.text.substring(0, 30) + '...',
          isBlock: f.isBlock
        })))

        // Convert formulas that aren't already cached
        setIsConvertingFormulas(true)
        setFormulaConversionProgress({ current: 0, total: formulasToConvert.length })

        try {
          const latexMap = await convertMultipleFormulas(
            formulasToConvert,
            (current, total) => {
              setFormulaConversionProgress({ current, total })
            }
          )

          // Store the LaTeX conversions
          const newLatexMap = new Map(formulaLatex) // Start with existing conversions
          latexMap.forEach((result, formulaText) => {
            newLatexMap.set(formulaText, result.latex)
          })
          
          setFormulaLatex(newLatexMap)
        } catch (error) {
          console.error('Failed to convert formulas:', error)
        } finally {
          setIsConvertingFormulas(false)
        }
      }

      processFormulas()
    }, 500) // 500ms debounce

    return () => clearTimeout(timeoutId)
  }, [pdfViewer.readingMode, typography.renderFormulas, document.pageTexts, document.id, isConvertingFormulas, formulaLatex])

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
            notesContent += `**Text:** ${highlight.text}\n`
            notesContent += `**Color:** ${highlight.color_hex}\n`
            if (highlight.note_text) {
              notesContent += `**Note:** ${highlight.note_text}\n`
            }
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
        // If book not found and recently uploaded, it might still be saving - just use empty array
        if (error?.message?.includes('Book not found') && isRecentlyUploaded) {
          console.log('Book not yet in database, will load highlights on refresh')
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
    // Get current page text for context
    const rawPageText = document.pageTexts?.[pageNumber - 1]
    const pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
    const context = getPDFTextSelectionContext(pageNumber, pageText)
    
    if (context) {
      setSelectedTextContext(context)
      setChatMode('clarification')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pageNumber, document.pageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleAIFurtherReading = useCallback(() => {
    const rawPageText = document.pageTexts?.[pageNumber - 1]
    const pageText = typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
    const context = getPDFTextSelectionContext(pageNumber, pageText)
    
    if (context) {
      setSelectedTextContext(context)
      setChatMode('further-reading')
      if (!isChatOpen) {
        toggleChat()
      }
    }
    setContextMenu(null)
  }, [pageNumber, document.pageTexts, setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleSaveNoteFromContext = useCallback(() => {
    if (contextMenu) {
      handleAddNote(contextMenu.text)
    }
    setContextMenu(null)
  }, [contextMenu])

  const handleTextSelection = useCallback((event: MouseEvent) => {
    // Only show highlight picker when highlight mode is active
    if (!isHighlightMode) {
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
      return
    }

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
    if (pdfViewer.scrollMode === 'continuous') {
      // Find the page containing the selection
      const targetElement = range.commonAncestorContainer
      const pageElement = (targetElement as Element).closest?.('[data-page-number]') ||
                         (targetElement.parentElement as Element)?.closest?.('[data-page-number]')
      if (pageElement) {
        const pageAttr = pageElement.getAttribute('data-page-number')
        if (pageAttr) currentPage = parseInt(pageAttr)
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

    setSelectedTextInfo({
      text: selectedText,
      pageNumber: currentPage,
      range
    })

    // Position the color picker near the selection
    setHighlightPickerPosition({
      x: rect.right + 10,
      y: rect.top - 10
    })
  }, [pdfViewer.scrollMode, pageNumber, isHighlightMode])
  
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
      
      // Use getBoundingClientRect() instead of getClientRects() for a single unified rect
      // This gives us the bounding box that encompasses the entire selection
      const selectionRect = range.getBoundingClientRect()
      
      // ROBUST VALIDATION: Check for valid selection rectangle
      if (!selectionRect || selectionRect.width === 0 || selectionRect.height === 0) {
        console.warn('Invalid bounding rectangle for selection:', selectionRect)
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Additional validation for reasonable dimensions
      if (selectionRect.width < 1 || selectionRect.height < 1) {
        console.warn('Selection too small to create highlight:', selectionRect)
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Find the page container - look for the element with data-page-number or the canvas parent
      let pageContainer: HTMLElement | null = null
      
      // Try to find the page container by traversing up the DOM
      let currentElement = range.startContainer.parentElement
      while (currentElement && !pageContainer) {
        if (currentElement.hasAttribute('data-page-number') || 
            currentElement.classList.contains('relative') && currentElement.querySelector('canvas')) {
          pageContainer = currentElement
          break
        }
        currentElement = currentElement.parentElement
      }

      // Fallback: look for single page mode container
      if (!pageContainer) {
        const singlePageCanvas = canvasRef.current?.parentElement
        if (singlePageCanvas) {
          pageContainer = singlePageCanvas as HTMLElement
        }
      }

      if (!pageContainer) {
        console.warn('Could not find page container')
        setHighlightPickerPosition(null)
        setSelectedTextInfo(null)
        return
      }

      // Get the container's bounding rectangle
      const containerRect = pageContainer.getBoundingClientRect()
      
      // CRITICAL: Calculate position relative to the page container
      // The text spans use position: absolute within the page container
      // We need to match their coordinate system exactly
      
      // selectionRect gives us viewport coordinates, containerRect gives us the container's viewport position
      // Subtracting gives us the position within the container - same coordinate system as text spans
      const rawPosition = {
        x: selectionRect.left - containerRect.left,
        y: selectionRect.top - containerRect.top,
        width: selectionRect.width,
        height: selectionRect.height
      }

      // TEXT ALIGNMENT: Use browser's getBoundingClientRect() without adjustments
      // Previous adjustments were causing position misalignment - browser rect is already accurate
      
      // Get text element for debugging
      const textElement = range.startContainer.parentElement

      // ROBUST SCALING: Normalize by current scale so positions are stored at scale 1.0
      // Add safeguards to prevent division by zero or invalid scale values
      const safeScale = Math.max(scale, 0.1) // Prevent division by zero
      const position = {
        x: rawPosition.x / safeScale,
        y: rawPosition.y / safeScale,
        width: rawPosition.width / safeScale,
        height: rawPosition.height / safeScale
      }

      // ROBUST VALIDATION: Check for reasonable position values
      if (position.x < 0 || position.y < 0 || position.width <= 0 || position.height <= 0) {
        console.warn('Invalid calculated position:', { rawPosition, position, scale })
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

      // Create highlight via service
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
        textContextAfter: textOffset?.contextAfter
      })

      // Add to local state
      setHighlights(prev => [...prev, highlight])

      // Clear selection
      window.getSelection()?.removeAllRanges()
      setHighlightPickerPosition(null)
      setSelectedTextInfo(null)
    } catch (error: any) {
      console.error('Error creating highlight:', error)
      
      // Show user-friendly message
      if (error.message?.includes('only available in production')) {
        alert('💡 Highlighting is only available in the deployed version.\n\nThis feature requires backend API endpoints that are only active in production.\n\nTo test highlights, please use the deployed app at your Vercel URL.')
      } else {
        alert('Failed to create highlight. Please try again.')
      }
    }
  }, [selectedTextInfo, document.id, document.pageTexts])

  const removeHighlight = useCallback(async (id: string) => {
    try {
      await highlightService.deleteHighlight(id)
      setHighlights(prev => prev.filter(h => h.id !== id))
    } catch (error) {
      console.error('Error deleting highlight:', error)
      alert('Failed to delete highlight. Please try again.')
    }
  }, [])

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
      
      const currentPageText = isEditing && editedTexts[pageNum] ? editedTexts[pageNum] : pageText
      
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
              hyphens: typography.textAlign === 'justify' ? 'auto' : 'none'
            }}
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
                // Render formula with LaTeX if enabled and available
                const formulaText = segment.content
                const latex = formulaLatex.get(formulaText)
                
                if (typography.renderFormulas && latex && !isConvertingFormulas) {
                  return (
                    <FormulaRenderer
                      key={`formula-${index}`}
                      latex={latex}
                      isBlock={false}
                      fallback={formulaText}
                      showCopyButton={true}
                    />
                  )
                } else if (typography.renderFormulas && isConvertingFormulas) {
                  return (
                    <FormulaPlaceholder
                      key={`formula-${index}`}
                      text={formulaText}
                      isBlock={false}
                    />
                  )
                } else {
                  // Fallback to monospace rendering
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
                }
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
              
              {/* Formula conversion indicator */}
              {isConvertingFormulas && (
                <div className="flex items-center gap-2 text-xs opacity-70 px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                  <span>Converting formulas... {formulaConversionProgress.current}/{formulaConversionProgress.total}</span>
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
            <div className="mx-auto px-8 py-12" style={{ maxWidth: `${typography.maxWidth}px` }}>
              {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                // If editing a page, only show that page
                if (editingPageNum !== null && editingPageNum !== pageNum) {
                  return null
                }
                
                return (
                  <div key={pageNum} className="mb-16 last:mb-0">
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
        <div className="flex items-center justify-between p-4">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            {/* New Document Button */}
            <button
              onClick={() => setCurrentDocument(null)}
              className="p-2 rounded-lg transition-colors"
              style={{ 
                color: 'var(--color-text-primary)', 
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Upload New Document"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Visual Separator */}
            <div 
              className="w-px h-6"
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden="true"
            />

                <button
                  onClick={goToFirstPage}
                  disabled={pageNumber <= 1}
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              className="p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  title="Last Page"
                >
              <ChevronsRight className="w-5 h-5" />
                </button>
              </div>

          {/* Center controls */}
          <div className="flex items-center gap-2">
              <button
              onClick={handleZoomOut}
              className="p-2 rounded-lg transition-colors"
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
              className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
              </button>
            
            <div className="w-px h-6 mx-2" style={{ backgroundColor: 'var(--color-border)' }} />
            
              <button
              onClick={handleRotate}
              className="p-2 rounded-lg transition-colors"
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

            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelectionMode(!selectionMode)
              }}
              className="p-2 rounded-lg transition-colors"
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
              className="p-2 rounded-lg transition-colors relative"
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
              className="p-2 rounded-lg transition-colors"
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
            
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleReadingMode()
              }}
              className="p-2 rounded-lg transition-colors"
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

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDownload()
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Download PDF with highlights and notes"
            >
              <Download className="w-5 h-5" />
            </button>
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
                    minWidth: '400px'
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
                            pointerEvents: 'none',
                            border: highlight.is_orphaned ? '2px dashed #999' : 'none',
                            zIndex: 3
                          }}
                          title={highlight.is_orphaned ? `Orphaned: ${highlight.orphaned_reason}` : highlight.highlighted_text}
                        >
                          {highlight.is_orphaned && (
                            <div className="absolute -top-3 -left-1 bg-yellow-500 text-white text-xs px-1 rounded">
                              ⚠
                            </div>
                          )}
                          <button
                            onClick={() => removeHighlight(highlight.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ pointerEvents: 'auto' }}
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
              style={{ minHeight: '600px', minWidth: '400px' }}
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
                  <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
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
              
              <canvas ref={canvasRef} className="block" style={{ opacity: pageRendered ? 1 : 0 }} />
              <div
                ref={textLayerRef}
                className="textLayer"
                style={{ opacity: pageRendered ? 1 : 0 }}
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
                        pointerEvents: 'none',
                        border: highlight.is_orphaned ? '2px dashed #999' : 'none',
                        zIndex: 3
                      }}
                      title={highlight.is_orphaned ? `Orphaned: ${highlight.orphaned_reason}` : highlight.highlighted_text}
                    >
                      {highlight.is_orphaned && (
                        <div className="absolute -top-3 -left-1 bg-yellow-500 text-white text-xs px-1 rounded">
                          ⚠
                        </div>
                      )}
                      <button
                        onClick={() => removeHighlight(highlight.id)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ pointerEvents: 'auto' }}
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