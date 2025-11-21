import React from 'react'
import { X, AlertTriangle, Save, XCircle } from 'lucide-react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onSave: () => Promise<void>
  onDiscard: () => void
  onCancel: () => void
  documentName?: string
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  documentName
}) => {
  const [isSaving, setIsSaving] = React.useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        className="relative w-full max-w-md rounded-lg shadow-2xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: 'var(--spacing-xl)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 transition-colors hover:bg-[var(--color-surface-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon and Title */}
        <div className="mb-6 flex items-start gap-4">
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ 
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning)'
            }}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 
              className="text-xl font-semibold"
              style={{ 
                color: 'var(--color-text-primary)',
                fontFamily: "'Space Grotesk', sans-serif"
              }}
            >
              Unsaved Changes
            </h2>
            <p 
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {documentName ? `You have unsaved changes in "${documentName}"` : 'You have unsaved changes'}
            </p>
          </div>
        </div>

        {/* Message */}
        <div 
          className="mb-6 rounded-lg p-4"
          style={{ 
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)'
          }}
        >
          <p 
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Do you want to save your changes before closing this document?
          </p>
          <ul 
            className="mt-3 space-y-2 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>Highlights and notes will be saved</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>Reading position will be preserved</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>Audio playback position will be saved</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-text)',
              border: '1px solid var(--color-primary)'
            }}
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Close'}</span>
          </button>

          {/* Discard button */}
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-danger)',
              border: '1px solid var(--color-danger)'
            }}
          >
            <XCircle className="h-4 w-4" />
            <span>Don't Save</span>
          </button>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg px-4 py-3 font-medium transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

