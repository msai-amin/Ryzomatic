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
  Highlighter,
  Trash2,
  Rows,
  Square,
  Play,
  Pause,
  Volume2,
  StickyNote,
  BookOpen,
  MousePointer2
} from 'lucide-react'
import { useAppStore, Document as DocumentType } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { TTSControls } from './TTSControls'
import { NotesPanel } from './NotesPanel'
import { AudioWidget } from './AudioWidget'
import { VoiceSelector } from './VoiceSelector'
import { storageService } from '../services/storageService'

// PDF.js will be imported dynamically

interface Highlight {
  id: string
  pageNumber: number
  text: string
  color: string
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface PDFViewerProps {
  document: DocumentType
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ document }) => {
  const { pdfViewer, tts, updatePDFViewer, updateTTS } = useAppStore()
  
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(pdfViewer.zoom)
  const [rotation, setRotation] = useState(0)
  const [pageInputValue, setPageInputValue] = useState('1')
  const [searchQuery, setSearchQuery] = useState('')
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#FFFF00')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    text: string
  } | null>(null)
  const [showNotesPanel, setShowNotesPanel] = useState<boolean>(false)
  const [selectedTextForNote, setSelectedTextForNote] = useState<string>('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [showVoiceSelector, setShowVoiceSelector] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pageRendered, setPageRendered] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const pageTextLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const highlightColors = [
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#90EE90' },
    { name: 'Blue', value: '#87CEEB' },
    { name: 'Pink', value: '#FFB6C1' },
  ]

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      if (!document.pdfData) return

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
          pdfData = document.pdfData
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
          documentId: document.id
        })
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

  // Render current page (single page mode)
  useEffect(() => {
    if (pdfViewer.scrollMode === 'continuous') return

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
        
        canvas.height = viewport.height
        canvas.width = viewport.width

        console.log('📐 Canvas dimensions set:', {
          width: canvas.width,
          height: canvas.height
        })

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
            console.log('📝 Text layer rendered with improved alignment')
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
  }, [pageNumber, scale, rotation, pdfViewer.scrollMode, numPages])

  // Render all pages (continuous scroll mode)
  useEffect(() => {
    if (pdfViewer.scrollMode !== 'continuous' || !pdfDocRef.current || !numPages) return
    

    const renderAllPages = async () => {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const canvas = pageCanvasRefs.current.get(pageNum)
        const textLayerDiv = pageTextLayerRefs.current.get(pageNum)
        if (!canvas) continue

        try {
          const page = await pdfDocRef.current!.getPage(pageNum)
          const context = canvas.getContext('2d')
          
          if (!context) continue

          const viewport = page.getViewport({ scale, rotation })
          
          canvas.height = viewport.height
          canvas.width = viewport.width

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
          }
        } catch (error) {
          console.error(`Error rendering page ${pageNum}:`, error)
        }
      }
    }

    renderAllPages()
  }, [pdfViewer.scrollMode, numPages, scale, rotation])

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
          setScale(Math.min(scale + 0.1, 3))
          break
        case '-':
        case '_':
          setScale(Math.max(scale - 0.1, 0.5))
          break
        case 'r':
        case 'R':
          setRotation((rotation + 90) % 360)
          break
        case 'h':
        case 'H':
          setShowHighlightMenu(!showHighlightMenu)
          break
        case 'm':
        case 'M':
          toggleReadingMode()
          break
        case 'Escape':
          if (showNotesPanel) {
            setShowNotesPanel(false)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [pageNumber, numPages, scale, rotation, showHighlightMenu, showNotesPanel])

  // Text selection for highlighting and notes
  useEffect(() => {
    const handleSelection = (e: MouseEvent) => {
      const selection = window.getSelection()
      const selectedText = selection?.toString().trim()
      
      if (selectedText && showHighlightMenu) {
        const range = selection?.getRangeAt(0)
        const rect = range?.getBoundingClientRect()
        
        if (rect && pageContainerRef.current) {
          const containerRect = pageContainerRef.current.getBoundingClientRect()
          const relativeRect = {
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height
          }

          const newHighlight: Highlight = {
            id: Date.now().toString(),
            pageNumber,
            text: selectedText,
            color: selectedColor,
            position: relativeRect
          }

          setHighlights([...highlights, newHighlight])
        }
      }
    }

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

    window.document.addEventListener('mouseup', handleSelection)
    window.document.addEventListener('contextmenu', handleContextMenu)
    window.document.addEventListener('click', handleClick)
    
    return () => {
      window.document.removeEventListener('mouseup', handleSelection)
      window.document.removeEventListener('contextmenu', handleContextMenu)
      window.document.removeEventListener('click', handleClick)
    }
  }, [showHighlightMenu, selectedColor, pageNumber, highlights])

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (tts.isPlaying) {
        ttsManager.stop()
      }
    }
  }, [])

  const goToPreviousPage = useCallback(() => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1)
    }
  }, [pageNumber])

  const goToNextPage = useCallback(() => {
    if (numPages && pageNumber < numPages) {
      setPageNumber(pageNumber + 1)
    }
  }, [pageNumber, numPages])

  const goToFirstPage = useCallback(() => {
    setPageNumber(1)
  }, [])

  const goToLastPage = useCallback(() => {
    if (numPages) {
    setPageNumber(numPages)
    }
  }, [numPages])

  const handleZoomIn = useCallback(() => {
    setScale(Math.min(scale + 0.1, 3))
  }, [scale])

  const handleZoomOut = useCallback(() => {
    setScale(Math.max(scale - 0.1, 0.5))
  }, [scale])

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
      setPageNumber(page)
    } else {
      setPageInputValue(String(pageNumber))
    }
  }

  const handleDownload = useCallback(() => {
    const link = window.document.createElement('a')
    link.href = URL.createObjectURL(new Blob([document.pdfData as BlobPart], { type: 'application/pdf' }))
    link.download = document.name
    link.click()
  }, [document])

  const toggleScrollMode = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updatePDFViewer({ scrollMode: pdfViewer.scrollMode === 'single' ? 'continuous' : 'single' })
  }, [pdfViewer.scrollMode, updatePDFViewer])

  const toggleReadingMode = useCallback(() => {
    updatePDFViewer({ readingMode: !pdfViewer.readingMode })
  }, [pdfViewer.readingMode, updatePDFViewer])

  const handleTTSPlay = useCallback(async () => {
    console.log('PDFViewer: handleTTSPlay called', {
      isPlaying: tts.isPlaying,
      hasDocument: !!document,
      documentType: document?.type,
      hasPageTexts: !!document?.pageTexts,
      pageTextsLength: document?.pageTexts?.length || 0
    });
    
    if (tts.isPlaying) {
      console.log('PDFViewer: TTS is playing, stopping...');
      // For Google Cloud TTS, we can't truly pause, so we stop instead
      ttsManager.stop()
      updateTTS({ isPlaying: false })
    } else {
      console.log('PDFViewer: TTS is not playing, starting...');
      // Debug TTS provider info
      const providers = ttsManager.getProviders()
      const availableProviders = ttsManager.getAvailableProviders()
      const configuredProviders = ttsManager.getConfiguredProviders()
      const currentProvider = ttsManager.getCurrentProvider()
      
      console.log('TTS Provider Info:', {
        allProviders: providers.map(p => ({ name: p.name, type: p.type, available: p.isAvailable, configured: p.isConfigured })),
        availableProviders: availableProviders.map(p => ({ name: p.name, type: p.type })),
        configuredProviders: configuredProviders.map(p => ({ name: p.name, type: p.type })),
        currentProvider: currentProvider ? { name: currentProvider.name, type: currentProvider.type } : null
      })
      
      // Try to switch to Google Cloud TTS if available and configured
      if (configuredProviders.some(p => p.type === 'google-cloud')) {
        try {
          const switched = await ttsManager.setProvider('google-cloud')
          console.log('Switched to Google Cloud TTS:', switched)
        } catch (error) {
          console.warn('Failed to switch to Google Cloud TTS:', error)
        }
      }
      
      // Debug logging
      console.log('TTS Debug:', {
        pageNumber,
        totalPages: document.totalPages,
        pageTextsLength: document.pageTexts?.length || 0,
        pageTexts: document.pageTexts,
        currentPageText: document.pageTexts?.[pageNumber - 1],
        documentId: document.id,
        documentName: document.name,
        documentType: document.type,
        hasPdfData: !!document.pdfData,
        fullDocument: document
      })
      
      let pageText = document.pageTexts?.[pageNumber - 1] || ''
      
      // If no pageTexts available, try to extract text on-demand
      if (!pageText && document.type === 'pdf' && pdfDocRef.current) {
        console.log('No pageTexts available, attempting on-demand text extraction...')
        try {
          const page = await pdfDocRef.current.getPage(pageNumber)
          const textContent = await page.getTextContent()
          pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim()
          
          console.log('On-demand text extraction result:', {
            success: true,
            textLength: pageText.length,
            textPreview: pageText.substring(0, 100) + (pageText.length > 100 ? '...' : ''),
            isEmpty: pageText.length === 0,
            isWhitespace: pageText.trim().length === 0
          })
          
          // If we successfully extracted text, update the document in the store
          if (pageText && pageText.trim().length > 0) {
            console.log('Updating document with extracted pageText...')
            const { updateDocument } = useAppStore.getState()
            const updatedPageTexts = [...(document.pageTexts || [])]
            updatedPageTexts[pageNumber - 1] = pageText
            
            updateDocument({
              ...document,
              pageTexts: updatedPageTexts
            })
            
            console.log('Document updated with pageTexts:', {
              pageNumber,
              totalPageTexts: updatedPageTexts.length,
              currentPageTextLength: pageText.length
            })
          }
        } catch (error) {
          console.error('On-demand text extraction failed:', error)
        }
      }
      
      if (pageText && pageText.trim().length > 0) {
        console.log('Starting TTS with text:', {
          textLength: pageText.length,
          textPreview: pageText.substring(0, 50) + '...'
        })
        
        // Try TTS with error handling and fallback
        try {
          console.log('PDFViewer: About to call ttsManager.speak with text:', {
            textLength: pageText.length,
            textPreview: pageText.substring(0, 50) + '...',
            currentProvider: ttsManager.getCurrentProvider()?.name,
            isPlaying: tts.isPlaying
          });
          
          await ttsManager.speak(pageText, () => {
            console.log('PDFViewer: TTS onEnd callback triggered');
      updateTTS({ isPlaying: false })
          })
          
          console.log('PDFViewer: ttsManager.speak completed, updating TTS state to playing');
      updateTTS({ isPlaying: true })
        } catch (error) {
          console.error('PDFViewer: TTS Error:', error)
          
          // If native TTS fails and Google Cloud TTS is available, try switching
          if (currentProvider?.type === 'native' && configuredProviders.some(p => p.type === 'google-cloud')) {
            console.log('Native TTS failed, attempting to switch to Google Cloud TTS...')
            try {
              const switched = await ttsManager.setProvider('google-cloud')
              if (switched) {
                console.log('Successfully switched to Google Cloud TTS, retrying...')
                await ttsManager.speak(pageText, () => {
          updateTTS({ isPlaying: false })
                })
      updateTTS({ isPlaying: true })
                return
              }
            } catch (fallbackError) {
              console.error('Google Cloud TTS fallback also failed:', fallbackError)
            }
          }
          
        updateTTS({ isPlaying: false })
        }
      } else {
        console.warn('No text available for TTS on this page', {
          pageNumber,
          pageTextsLength: document.pageTexts?.length || 0,
          pageTexts: document.pageTexts,
          hasPdfDoc: !!pdfDocRef.current,
          extractedTextLength: pageText?.length || 0,
          extractedTextPreview: pageText?.substring(0, 50) || 'N/A'
        })
      }
    }
  }, [tts, pageNumber, document.pageTexts, updateTTS])

  const handleTTSStop = useCallback(() => {
    ttsManager.stop()
        updateTTS({ isPlaying: false })
  }, [updateTTS])

  const handleAddNote = useCallback((text: string) => {
    setSelectedTextForNote(text)
    setShowNotesPanel(true)
    setContextMenu(null)
  }, [])

  const removeHighlight = useCallback((id: string) => {
    setHighlights(highlights.filter(h => h.id !== id))
  }, [highlights])

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
    const pageText = document.pageTexts?.[pageNumber - 1] || ''
    
    return (
      <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-amber-50 via-white to-orange-50">
        {/* Reading Mode Header */}
        <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-amber-200 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleReadingMode}
                className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>Exit Reading Mode</span>
              </button>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <BookOpen className="w-4 h-4" />
                <span>Page {pageNumber} of {numPages}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPage}
                disabled={pageNumber <= 1}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNextPage}
                disabled={!numPages || pageNumber >= numPages}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Reading Mode Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <div className="prose prose-lg prose-amber max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-sans text-lg">
                {pageText || 'No text available for this page.'}
            </div>
          </div>
          </div>
        </div>

        {/* Reading Mode Active Indicator */}
        <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span className="text-sm font-medium">Reading Mode Active</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* PDF Controls */}
      <div className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-4">
          {/* Left controls */}
          <div className="flex items-center gap-2">
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
              
                      <button
              onClick={toggleScrollMode}
              className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: pdfViewer.scrollMode === 'continuous' ? 'var(--color-primary-light)' : 'transparent',
                    color: pdfViewer.scrollMode === 'continuous' ? 'var(--color-primary)' : 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    if (pdfViewer.scrollMode !== 'continuous') e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (pdfViewer.scrollMode !== 'continuous') e.currentTarget.style.backgroundColor = 'transparent'
                  }}
              title="Scroll Mode"
            >
              <Rows className="w-5 h-5" />
                    </button>

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
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowHighlightMenu(!showHighlightMenu)
              }}
              className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: showHighlightMenu ? 'var(--color-primary-light)' : 'transparent',
                    color: showHighlightMenu ? 'var(--color-primary)' : 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showHighlightMenu) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!showHighlightMenu) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
              title="Highlight (H)"
            >
              <Highlighter className="w-5 h-5" />
            </button>
            
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowNotesPanel(!showNotesPanel)
              }}
              className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: showNotesPanel ? 'var(--color-primary-light)' : 'transparent',
                    color: showNotesPanel ? 'var(--color-primary)' : 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!showNotesPanel) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!showNotesPanel) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
              title="Notes"
            >
              <StickyNote className="w-5 h-5" />
            </button>

              <button
                    onClick={(e) => {
                      console.log('TTS Button clicked!', {
                        event: e,
                        target: e.target,
                        currentTarget: e.currentTarget,
                        isPlaying: tts.isPlaying
                      });
                      handleTTSPlay();
                    }}
              className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: tts.isPlaying ? 'var(--color-primary-light)' : 'transparent',
                      color: tts.isPlaying ? 'var(--color-primary)' : 'var(--color-text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (!tts.isPlaying) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!tts.isPlaying) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
              title={tts.isPlaying ? "Stop" : "Play Text-to-Speech"}
            >
              {tts.isPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

            {tts.isPlaying && (
                  <button
                    onClick={handleTTSStop}
                className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Stop"
                  >
                <Square className="w-5 h-5" />
                  </button>
            )}

                <button
              onClick={() => setShowVoiceSelector(true)}
              className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Select Voice"
                >
              <Volume2 className="w-5 h-5" />
                </button>
            
                <button
              onClick={handleDownload}
              className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Download"
            >
              <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

        {/* Highlight color picker */}
        {showHighlightMenu && (
          <div className="px-4 pb-4 flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Highlight color:</span>
            {highlightColors.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className="w-8 h-8 rounded-full border-2 transition-all"
                style={{ 
                  backgroundColor: color.value,
                  borderColor: selectedColor === color.value ? 'var(--color-text-primary)' : 'var(--color-border)',
                  transform: selectedColor === color.value ? 'scale(1.1)' : 'scale(1)'
                }}
                title={color.name}
              />
            ))}
              </div>
            )}
      </div>

      {/* PDF Canvas Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-8" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
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
                <div key={pageNum} className="relative bg-white shadow-2xl" data-page-number={pageNum} style={{ minHeight: '600px', minWidth: '400px' }}>
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
                  />
                  {/* Render highlights for this page */}
                  {highlights
                    .filter(h => h.pageNumber === pageNum)
                    .map(highlight => (
                      <div
                        key={highlight.id}
                        className="absolute group"
                        style={{
                          left: highlight.position.x,
                          top: highlight.position.y,
                          width: highlight.position.width,
                          height: highlight.position.height,
                          backgroundColor: highlight.color,
                          opacity: 0.4,
                          pointerEvents: 'auto'
                        }}
                      >
                <button
                          onClick={() => removeHighlight(highlight.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                          <Trash2 className="w-3 h-3" />
                </button>
              </div>
                    ))}
            </div>
              ))
            )}
      </div>
        ) : (
          // Single page mode
          <div className="flex justify-center">
            <div ref={pageContainerRef} className="relative bg-white shadow-2xl" style={{ minHeight: '600px', minWidth: '400px' }}>
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
                .filter(h => h.pageNumber === pageNumber)
                .map(highlight => (
                    <div
                      key={highlight.id}
                    className="absolute group"
                      style={{
                      left: highlight.position.x,
                      top: highlight.position.y,
                      width: highlight.position.width,
                      height: highlight.position.height,
                        backgroundColor: highlight.color,
                        opacity: 0.4,
                      pointerEvents: 'auto'
                    }}
                  >
                    <button
                      onClick={() => removeHighlight(highlight.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                      </div>
                    ))}
                </div>
        </div>
      )}
          </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed rounded-lg shadow-lg py-2 z-50"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <button
            onClick={() => handleAddNote(contextMenu.text)}
            className="w-full px-4 py-2 text-left flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <StickyNote className="w-4 h-4" />
            Add to Notes
          </button>
        </div>
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

      {/* Audio Widget */}
      <div className="fixed bottom-4 right-4 z-40">
        <AudioWidget />
      </div>

      {/* Voice Selector Modal */}
      <VoiceSelector
        isOpen={showVoiceSelector}
        onClose={() => setShowVoiceSelector(false)}
        onVoiceSelect={handleVoiceSelect}
        currentVoice={tts.voice}
      />
    </div>
  )
}