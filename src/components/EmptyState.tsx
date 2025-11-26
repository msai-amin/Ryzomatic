import React, { useCallback } from 'react'
import { Upload, FileText, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface EmptyStateProps {
  onUploadClick?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onUploadClick }) => {
  const openCustomReadingWizard = useAppStore((state) => state.openCustomReadingWizard)

  const handleUpload = useCallback(() => {
    if (onUploadClick) {
      onUploadClick()
    } else {
      window.dispatchEvent(new CustomEvent('app:open-upload'))
    }
  }, [onUploadClick])

  const handleOpenCustomReading = useCallback(() => {
      openCustomReadingWizard('empty-state')
  }, [openCustomReadingWizard])

  return (
    <div 
      className="flex flex-col items-center justify-center py-16 px-4 relative min-h-screen"
      style={{
        backgroundImage: 'url(/onboarding-images/default-pdf-background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundBlendMode: 'overlay',
      }}
    >
      {/* Overlay to ensure text readability */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
      />
      <div 
        id="onboarding-welcome"
        data-onboarding="onboarding-welcome"
        className="flex flex-col items-center justify-center relative z-10"
      >
        <div 
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce-subtle"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <FileText className="w-12 h-12" style={{ color: 'var(--color-text-inverse)' }} />
      </div>
      
      <h2 className="text-heading-2 mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.03em', fontWeight: '600' }}>
        Welcome to ryzomatic
      </h2>
      
      <p className="text-center max-w-md mb-12 text-body" style={{ color: 'var(--color-text-secondary)' }}>
        Upload a document to get started. Our AI assistant can help you understand, 
        summarize, and answer questions about your content.
      </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl">
        <div 
          className="text-center p-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
          onClick={() => handleUpload()}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleUpload()
            }
          }}
        >
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
            }}
          >
            <Upload className="w-6 h-6" style={{ color: 'var(--color-text-inverse)' }} />
          </div>
          <h3 className="text-heading-3 mb-2" style={{ color: 'var(--color-text-primary)' }}>Upload Documents</h3>
          <p className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>
            Support for text files, PDFs, and EPUBs with automatic content extraction
          </p>
        </div>
        
        <div 
          className="text-center p-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
        >
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{
              background: 'linear-gradient(135deg, var(--color-secondary-light) 0%, var(--color-secondary) 100%)',
            }}
          >
            <Sparkles className="w-6 h-6" style={{ color: 'var(--color-text-inverse)' }} />
          </div>
          <h3 className="text-heading-3 mb-2" style={{ color: 'var(--color-text-primary)' }}>AI Chat</h3>
          <p className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>
            Ask questions and get intelligent insights about your documents
          </p>
        </div>
        
        <button
          id="step-custom-reading-card"
          className="text-center p-6 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--border-radius-lg)',
          }}
          onClick={handleOpenCustomReading}
          type="button"
        >
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{
              background: 'linear-gradient(135deg, var(--color-success-light) 0%, var(--color-success) 100%)',
            }}
          >
            <FileText className="w-6 h-6" style={{ color: 'var(--color-text-inverse)' }} />
          </div>
          <h3 className="text-heading-3 mb-2" style={{ color: 'var(--color-text-primary)' }}>Customizable Reading</h3>
          <p className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>
            Adjust typography, themes, and layout for optimal reading experience
          </p>
        </button>
      </div>
    </div>
  )
}


