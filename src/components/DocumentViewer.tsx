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
  const getThemeClasses = () => {
    switch (typography.theme) {
      case 'dark':
        return 'bg-gray-900 text-gray-100'
      case 'sepia':
        return 'bg-amber-50 text-amber-900'
      default:
        return 'bg-white text-gray-900'
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

  return (
    <div className="flex justify-center">
      <div 
        className={`${getThemeClasses()} ${getFontFamily()} rounded-xl shadow-lg p-8 transition-all duration-300`}
        style={{
          fontSize: `${typography.fontSize}px`,
          lineHeight: typography.lineHeight,
          maxWidth: `${typography.maxWidth}px`,
          width: '100%'
        }}
      >
        <div className="prose prose-lg max-w-none">
          <pre className="whitespace-pre-wrap font-inherit leading-inherit">
            {currentDocument.content}
          </pre>
        </div>
      </div>
    </div>
  )
}


