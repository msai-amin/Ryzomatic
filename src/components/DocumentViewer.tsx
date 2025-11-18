import React, { useState, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { EmptyState } from './EmptyState'
import { PDFViewerV2 } from './PDFViewerV2'
import { EPUBViewer } from './EPUBViewer'
import { ContextMenu, createAIContextMenuOptions } from './ContextMenu'
import { getTextSelectionContext, hasTextSelection } from '../utils/textSelection'
import { storageService, Note } from '../services/storageService'

interface DocumentViewerProps {
  onUploadClick?: () => void
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ onUploadClick }) => {
  const { 
    currentDocument, 
    typography, 
    setSelectedTextContext, 
    setChatMode, 
    toggleChat,
    isChatOpen 
  } = useAppStore()
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Check if there's a text selection
    if (hasTextSelection()) {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleClarification = useCallback(() => {
    const context = getTextSelectionContext()
    if (context) {
      setSelectedTextContext(context)
      setChatMode('clarification')
      if (!isChatOpen) {
        toggleChat()
      }
    }
  }, [setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleFurtherReading = useCallback(() => {
    const context = getTextSelectionContext()
    if (context) {
      setSelectedTextContext(context)
      setChatMode('further-reading')
      if (!isChatOpen) {
        toggleChat()
      }
    }
  }, [setSelectedTextContext, setChatMode, toggleChat, isChatOpen])

  const handleSaveNote = useCallback(() => {
    const context = getTextSelectionContext()
    if (context && currentDocument) {
      const note: Note = {
        id: crypto.randomUUID(),
        bookId: currentDocument.id,
        bookName: currentDocument.name,
        pageNumber: 1, // Default to page 1 for text documents
        content: '',
        selectedText: context.selectedText,
        createdAt: new Date(),
      }
      storageService.saveNote(note)
      console.log('Note saved from selection')
    }
  }, [currentDocument])

  if (!currentDocument) {
    return <EmptyState onUploadClick={onUploadClick} />
  }

  // Use PDF viewer for PDF documents when PDF binary/url is present
  // CRITICAL: Only render PDFViewerV2 if currentDocument.id is defined
  // This prevents React's comparison function from throwing on first render
  if (currentDocument.type === 'pdf' && currentDocument.pdfData) {
    console.log('📄 DocumentViewer: Rendering PDFViewerV2', {
      documentId: currentDocument.id,
      hasPdfData: !!currentDocument.pdfData,
      totalPages: currentDocument.totalPages
    })
    
    // Guard: Don't render if document.id is undefined
    if (!currentDocument.id) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-lg mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Loading document...
            </p>
          </div>
        </div>
      )
    }
    
    return <PDFViewerV2 />
  }

  if (currentDocument.type === 'epub') {
    return <EPUBViewer />
  }

  // Use text viewer for text documents
  const getThemeStyles = () => {
    switch (typography.theme) {
      case 'dark':
        return {
          backgroundColor: '#1f2937',
          color: '#f3f4f6'
        }
      case 'sepia':
        return {
          backgroundColor: '#fef3c7',
          color: '#78350f'
        }
      default:
        return {
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)'
        }
    }
  }

  const getFontFamily = () => {
    switch (typography.fontFamily) {
      case 'serif':
        return 'var(--font-family-serif)'
      case 'mono':
        return 'var(--font-family-mono)'
      default:
        return 'var(--font-family-sans)'
    }
  }

  // Clean the document content by removing unwanted elements
  const cleanContent = (content: string) => {
    // Remove the "Page X Text (Footnotes Hidden)" header
    let cleaned = content.replace(/Page \d+ Text.*?\(Footnotes Hidden\)/g, '')
    
    // Remove any HTML-like elements that might contain the unwanted content
    cleaned = cleaned.replace(/<div[^>]*style="[^"]*font-size:\s*12px[^"]*"[^>]*>.*?<\/div>/gs, '')
    
    // Remove the specific div with max-h-96 and the research paper content
    cleaned = cleaned.replace(/<div[^>]*class="max-h-96[^"]*"[^>]*>.*?<\/div>/gs, '')
    
    return cleaned.trim()
  }

  return (
    <>
      <div className="flex justify-center">
        <div 
          className="rounded-xl p-12 transition-all duration-300"
          style={{
            ...getThemeStyles(),
            fontFamily: getFontFamily(),
            fontSize: `${typography.fontSize}px`,
            lineHeight: typography.lineHeight,
            maxWidth: `${typography.maxWidth}px`,
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--border-radius-lg)',
          }}
          onContextMenu={handleContextMenu}
        >
          <div className="prose prose-lg max-w-none">
            <pre className="whitespace-pre-wrap font-inherit leading-inherit">
              {cleanContent(currentDocument.content)}
            </pre>
          </div>
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
    </>
  )
}


