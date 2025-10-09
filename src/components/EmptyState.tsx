import React from 'react'
import { Upload, FileText, Sparkles } from 'lucide-react'

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div 
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{
          backgroundColor: 'var(--color-primary-light)',
        }}
      >
        <FileText className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
      </div>
      
      <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Welcome to Academic Reader Pro
      </h2>
      
      <p className="text-center max-w-md mb-8" style={{ color: 'var(--color-text-secondary)' }}>
        Upload a document to get started. Our AI assistant can help you understand, 
        summarize, and answer questions about your content.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl">
        <div 
          className="text-center p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Upload Documents</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Support for text files and PDFs with automatic content extraction
          </p>
        </div>
        
        <div 
          className="text-center p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-secondary)' }} />
          <h3 className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>AI Chat</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Ask questions and get intelligent insights about your documents
          </p>
        </div>
        
        <div 
          className="text-center p-6 rounded-xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-success)' }} />
          <h3 className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Customizable Reading</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Adjust typography, themes, and layout for optimal reading experience
          </p>
        </div>
      </div>
    </div>
  )
}


