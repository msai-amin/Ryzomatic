import React from 'react'
import { useAppStore } from '../store/appStore'
import { EmptyState } from './EmptyState'
import { PDFViewer } from './PDFViewer'

export const DocumentViewer: React.FC = () => {
  const { currentDocument, typography } = useAppStore()

  if (!currentDocument) {
    return <EmptyState />
  }

  // Use PDF viewer for PDF documents
  if (currentDocument.type === 'pdf' && currentDocument.pdfData && currentDocument.totalPages) {
    return <PDFViewer document={currentDocument} />
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
    <div className="flex justify-center">
      <div 
        className="rounded-xl p-8 transition-all duration-300"
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
      >
        <div className="prose prose-lg max-w-none">
          <pre className="whitespace-pre-wrap font-inherit leading-inherit">
            {cleanContent(currentDocument.content)}
          </pre>
        </div>
      </div>
    </div>
  )
}


