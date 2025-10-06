import React, { useState, useCallback, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
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
import { ttsService } from '../services/ttsService'
import { TTSControls } from './TTSControls'
import { NotesPanel } from './NotesPanel'
import { storageService } from '../services/storageService'

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

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
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const pageCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())

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

      try {
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
        console.log('✅ PDF loaded successfully:', pdf.numPages, 'pages')
        console.log('PDF Document Info:', {
          numPages: pdf.numPages,
          hasPageTexts: !!document.pageTexts,
          pageTextsLength: document.pageTexts?.length || 0,
          documentId: document.id
        })
      } catch (error) {
        console.error('Error loading PDF:', error)
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
      if (!pdfDocRef.current || !canvasRef.current) return

      try {
        // Cancel any ongoing render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel()
        }

        const page = await pdfDocRef.current.getPage(pageNumber)
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context) return

        const viewport = page.getViewport({ scale, rotation })
        
        canvas.height = viewport.height
        canvas.width = viewport.width

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        renderTaskRef.current = page.render(renderContext)
        await renderTaskRef.current.promise
        renderTaskRef.current = null

        // Render text layer for selection
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = ''
          const textContent = await page.getTextContent()
          
          // Render text layer manually
          const textLayer = textLayerRef.current
          textContent.items.forEach((item: any) => {
            const div = window.document.createElement('div')
            div.textContent = item.str
            div.style.position = 'absolute'
            div.style.left = `${item.transform[4]}px`
            div.style.top = `${item.transform[5]}px`
            div.style.fontSize = `${item.height}px`
            div.style.fontFamily = item.fontName
            textLayer.appendChild(div)
          })
        }
      } catch (error: any) {
        if (error?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error)
        }
      }
    }

    renderPage()
  }, [pageNumber, scale, rotation, pdfViewer.scrollMode])

  // Render all pages (continuous scroll mode)
  useEffect(() => {
    if (pdfViewer.scrollMode !== 'continuous' || !pdfDocRef.current || !numPages) return

    const renderAllPages = async () => {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const canvas = pageCanvasRefs.current.get(pageNum)
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
        ttsService.stop()
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
    if (tts.isPlaying) {
      ttsService.pause()
      updateTTS({ isPlaying: false })
    } else {
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
        hasPdfData: !!document.pdfData
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
          console.log('On-demand text extraction successful:', pageText.substring(0, 100) + '...')
        } catch (error) {
          console.error('On-demand text extraction failed:', error)
        }
      }
      
      if (pageText) {
        try {
          await ttsService.speak(pageText, () => {
            updateTTS({ isPlaying: false })
          })
          updateTTS({ isPlaying: true })
        } catch (error) {
          console.error('TTS Error:', error)
          updateTTS({ isPlaying: false })
        }
      } else {
        console.warn('No text available for TTS on this page', {
          pageNumber,
          pageTextsLength: document.pageTexts?.length || 0,
          pageTexts: document.pageTexts,
          hasPdfDoc: !!pdfDocRef.current
        })
      }
    }
  }, [tts, pageNumber, document.pageTexts, updateTTS])

  const handleTTSStop = useCallback(() => {
    ttsService.stop()
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
              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-serif text-lg">
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
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* PDF Controls */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          {/* Left controls */}
          <div className="flex items-center gap-2">
                <button
                  onClick={goToFirstPage}
                  disabled={pageNumber <= 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
              <ChevronsLeft className="w-5 h-5" />
                </button>
                <button
              onClick={goToPreviousPage}
                  disabled={pageNumber <= 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
            <form onSubmit={handlePageInputSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                className="w-16 px-2 py-1 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
              <span className="text-sm text-gray-600">of {numPages || '?'}</span>
                </form>
                
                <button
                  onClick={goToNextPage}
              disabled={!numPages || pageNumber >= numPages}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={goToLastPage}
              disabled={!numPages || pageNumber >= numPages}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
              <ChevronsRight className="w-5 h-5" />
                </button>
              </div>

          {/* Center controls */}
          <div className="flex items-center gap-2">
              <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
              </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
            </span>
              <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
              </button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
              <button
              onClick={handleRotate}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Rotate"
            >
              <RotateCw className="w-5 h-5" />
              </button>
              
                      <button
              onClick={toggleScrollMode}
              className={`p-2 rounded-lg transition-colors ${
                pdfViewer.scrollMode === 'continuous' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
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
              className={`p-2 rounded-lg transition-colors ${
                selectionMode ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100'
              }`}
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
              className={`p-2 rounded-lg transition-colors ${
                pdfViewer.readingMode ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-100'
              }`}
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
              className={`p-2 rounded-lg transition-colors ${
                showHighlightMenu ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-100'
              }`}
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
              className={`p-2 rounded-lg transition-colors ${
                showNotesPanel ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
              title="Notes"
            >
              <StickyNote className="w-5 h-5" />
              </button>

                  <button
                    onClick={handleTTSPlay}
              className={`p-2 rounded-lg transition-colors ${
                tts.isPlaying ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100'
              }`}
              title="Text-to-Speech"
            >
              {tts.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
            
            {tts.isPlaying && (
                  <button
                    onClick={handleTTSStop}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Stop"
                  >
                <Square className="w-5 h-5" />
                  </button>
            )}
            
                <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

        {/* Highlight color picker */}
        {showHighlightMenu && (
          <div className="px-4 pb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Highlight color:</span>
            {highlightColors.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  selectedColor === color.value ? 'border-gray-800 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
              </div>
            )}
      </div>

      {/* PDF Canvas Container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-gray-100 p-8">
        {pdfViewer.scrollMode === 'continuous' ? (
          // Continuous scroll mode - render all pages
          <div className="flex flex-col items-center gap-4">
            {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div key={pageNum} className="relative bg-white shadow-2xl" data-page-number={pageNum}>
                <canvas
                  ref={(el) => {
                    if (el) pageCanvasRefs.current.set(pageNum, el)
                  }}
                  className="block"
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
            ))}
      </div>
        ) : (
          // Single page mode
          <div className="flex justify-center">
            <div ref={pageContainerRef} className="relative bg-white shadow-2xl">
              <canvas ref={canvasRef} className="block" />
              <div
                ref={textLayerRef}
                className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden"
                style={{
                  opacity: 0.2,
                  lineHeight: 1.0
                }}
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
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleAddNote(contextMenu.text)}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
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
    </div>
  )
}