import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles,
  Upload,
  CheckCircle,
  Loader2,
  Volume2,
  BookOpen,
  X,
  ArrowRight
} from 'lucide-react'
import { DocumentUpload } from '../DocumentUpload'
import { useAppStore, CustomReadingWizardStep } from '../../store/appStore'
import { cleanupDocumentText, TTS_OPTIMIZE_PREFERENCES } from '../../services/textCleanupService'

const getStepTitle = (step: CustomReadingWizardStep) => {
  switch (step) {
    case 'welcome':
      return 'Customizable Reading Setup'
    case 'upload':
      return 'Upload Your Document'
    case 'optimize':
      return 'Optimising for Audio'
    case 'complete':
      return 'Ready to Read'
    default:
      return 'Customizable Reading'
  }
}

export const CustomizableReadingWizard: React.FC = () => {
  const {
    customReadingWizard,
    closeCustomReadingWizard,
    advanceCustomReadingWizard,
    setCustomReadingWizardStatus,
    documents,
    updateDocument,
    setCurrentDocument,
    updatePDFViewer,
    setIsRightSidebarOpen,
    user
  } = useAppStore((state) => ({
    customReadingWizard: state.customReadingWizard,
    closeCustomReadingWizard: state.closeCustomReadingWizard,
    advanceCustomReadingWizard: state.advanceCustomReadingWizard,
    setCustomReadingWizardStatus: state.setCustomReadingWizardStatus,
    documents: state.documents,
    updateDocument: state.updateDocument,
    setCurrentDocument: state.setCurrentDocument,
    updatePDFViewer: state.updatePDFViewer,
    setIsRightSidebarOpen: state.setIsRightSidebarOpen,
    user: state.user
  }))

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const stepSequence: CustomReadingWizardStep[] = ['welcome', 'upload', 'optimize', 'complete']
  const userId = user?.id ?? null

  const stepIndex = stepSequence.indexOf(customReadingWizard.step)
  const displayStepLabel =
    customReadingWizard.step === 'welcome'
      ? 'Introduction'
      : customReadingWizard.step === 'complete'
        ? 'Step 3 of 3'
        : `Step ${stepIndex} of 3`

  const currentDocument = useMemo(() => {
    if (!customReadingWizard.documentId) return null
    return documents.find((doc) => doc.id === customReadingWizard.documentId) || null
  }, [customReadingWizard.documentId, documents])

  // CRITICAL: Normalize document ID to prevent React comparison error
  // React's dependency comparison function accesses .length on nested array properties
  const normalizedDocumentId = currentDocument?.id ?? ''
  
  // CRITICAL: Safe destructuring with defaults - guarantees arrays are always arrays
  // Level 1 Guard: Default currentDocument to {} if null/undefined
  // Level 2 Guard: Default pageTexts and cleanedPageTexts to [] if missing
  const { 
    pageTexts: safePageTexts = [], 
    cleanedPageTexts: safeCleanedPageTexts = [] 
  } = currentDocument || {}

  useEffect(() => {
    if (!customReadingWizard.isOpen) {
      setShowUploadModal(false)
      setProgress({ current: 0, total: 0 })
    }
  }, [customReadingWizard.isOpen])

  useEffect(() => {
    if (!customReadingWizard.isOpen || customReadingWizard.step !== 'upload') {
      setShowUploadModal(false)
    }
  }, [customReadingWizard.isOpen, customReadingWizard.step])

  useEffect(() => {
    if (
      !customReadingWizard.isOpen ||
      customReadingWizard.step !== 'optimize' ||
      customReadingWizard.status !== 'optimizing' ||
      !customReadingWizard.documentId
    ) {
      return
    }

    const document = currentDocument

    if (!document) {
      setCustomReadingWizardStatus('error', 'Uploaded document could not be found.')
      return
    }

    // CRITICAL: Use safe destructured arrays instead of accessing document directly
    const totalSegments =
      safePageTexts.length ||
      safeCleanedPageTexts.length ||
      (document.content ? 1 : 0)

    setProgress({ current: 0, total: Math.max(totalSegments, 1) })

    let cancelled = false

    const optimise = async () => {
      try {
        const { cleanedTexts } = await cleanupDocumentText({
          document,
          preferences: TTS_OPTIMIZE_PREFERENCES,
          onProgress: ({ current, total }) => {
            if (!cancelled) {
              setProgress({ current, total })
            }
          },
          userId,
          existingCleaned: Array.isArray(safeCleanedPageTexts) && safeCleanedPageTexts.length > 0 ? safeCleanedPageTexts : null
        })

        if (cancelled) return

        updateDocument({ ...document, cleanedPageTexts: cleanedTexts })
        advanceCustomReadingWizard('complete', {
          documentId: document.id,
          status: 'ready',
          error: null
        })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Failed to optimise text for audio playback.'
        setCustomReadingWizardStatus('error', message)
      }
    }

    optimise()

    return () => {
      cancelled = true
    }
  }, [
    advanceCustomReadingWizard,
    normalizedDocumentId,
    customReadingWizard.documentId,
    customReadingWizard.isOpen,
    customReadingWizard.status,
    customReadingWizard.step,
    setCustomReadingWizardStatus,
    updateDocument,
    userId
  ])

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null
  }

  if (!customReadingWizard.isOpen) {
    return null
  }

  const status = customReadingWizard.status

  const handleClose = () => {
    closeCustomReadingWizard()
  }

  const handleBegin = () => {
    advanceCustomReadingWizard('upload', { status: 'uploading', error: null })
    setShowUploadModal(true)
  }

  const handleUploadComplete = (documentId: string) => {
    setShowUploadModal(false)
    advanceCustomReadingWizard('optimize', {
      documentId,
      status: 'optimizing',
      error: null
    })
  }

  const handleRetry = () => {
    if (!customReadingWizard.documentId) return
    advanceCustomReadingWizard('optimize', {
      status: 'optimizing',
      error: null
    })
  }

  const handleStartReading = () => {
    if (!currentDocument) {
      setCustomReadingWizardStatus('error', 'Document could not be loaded.')
      return
    }

    setCurrentDocument(currentDocument)
    updatePDFViewer({
      readingMode: true,
      viewMode: currentDocument.type === 'pdf' ? 'pdf' : 'text'
    })
    setIsRightSidebarOpen(false)
    closeCustomReadingWizard()
  }

  const renderWelcome = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Create a tailored reading session with typography presets, audio-ready text, and a synced TTS experience. We&apos;ll guide you through a short setup.
        </p>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <li>• Upload your PDF or EPUB</li>
          <li>• Optimise the text for natural Text-to-Speech playback</li>
          <li>• Launch directly into the reader with audio controls ready</li>
        </ul>
      </div>
      <button
        onClick={handleBegin}
        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Begin Setup
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )

  const renderUpload = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Upload the document you want to prepare. We support PDF and EPUB files with advanced extraction and metadata handling.
        </p>
      </div>

      {currentDocument && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-primary-light)' }}>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {currentDocument.name}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                Document uploaded successfully. Proceed to optimisation.
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              advanceCustomReadingWizard('optimize', {
                status: 'optimizing',
                error: null
              })
            }
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Optimise for Audio
          </button>
        </div>
      )}

      {!currentDocument && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition hover:bg-[var(--color-surface-hover)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      )}
    </div>
  )

  const renderOptimise = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-start gap-3">
          <Volume2 className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Preparing audio-friendly text
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              We&apos;re optimising each page for natural speech: expanding abbreviations, smoothing punctuation, and preserving paragraph pauses.
            </p>
          </div>
        </div>
      </div>

      {status === 'optimizing' && (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {progress.total > 0
              ? `Processing section ${Math.min(progress.current + 1, progress.total)} of ${progress.total}`
              : 'Analysing document structure...'}
          </p>
        </div>
      )}

      {status === 'error' && customReadingWizard.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p>{customReadingWizard.error}</p>
          <button
            onClick={handleRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            Retry optimisation
          </button>
        </div>
      )}
    </div>
  )

  const renderComplete = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--color-primary-light)' }}>
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Document is audio-ready
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Text-to-Speech playback will use the enhanced transcript for smoother narration and more natural pacing.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span>{currentDocument?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <span>Audio controls will be available as soon as you enter reading mode.</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleStartReading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Start reading with audio
        </button>
        <button
          onClick={handleClose}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-[var(--color-surface-hover)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          Close wizard
        </button>
      </div>
    </div>
  )

  const renderStep = () => {
    switch (customReadingWizard.step) {
      case 'welcome':
        return renderWelcome()
      case 'upload':
        return renderUpload()
      case 'optimize':
        return renderOptimise()
      case 'complete':
        return renderComplete()
      default:
        return null
    }
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.58)' }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-2xl rounded-2xl shadow-2xl border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div
            className="flex items-center justify-between border-b px-6 py-5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(236, 72, 153, 0.12))'
                }}
              >
                <Sparkles className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {getStepTitle(customReadingWizard.step)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {displayStepLabel}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-full p-2 transition hover:bg-[var(--color-surface-hover)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 py-6">
            {renderStep()}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <DocumentUpload
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
          setAsCurrentDocument={false}
          zIndexClass="z-[10001]"
        />
      )}
    </>,
    document.body
  )
}

