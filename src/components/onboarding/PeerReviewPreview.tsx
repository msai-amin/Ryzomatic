import React from 'react'

/**
 * Visual preview component for Peer Review onboarding
 * Shows the split-view layout with blurred text to protect privacy
 */
export const PeerReviewPreview: React.FC = () => {
  return (
    <div className="w-full rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex h-48 bg-[var(--color-background)]">
        {/* Left Panel - Document Viewer */}
        <div className="w-1/2 border-r" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-full p-4 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-2 opacity-60">
              <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
              <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
              <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
            </div>
            {/* Document Content */}
            <div className="flex-1 bg-white rounded p-3 overflow-hidden">
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200 blur-sm" />
                <div className="h-3 w-full rounded bg-gray-100 blur-sm" />
                <div className="h-3 w-5/6 rounded bg-gray-100 blur-sm" />
                <div className="h-3 w-4/5 rounded bg-gray-100 blur-sm" />
                <div className="h-3 w-full rounded bg-gray-100 blur-sm" />
                <div className="h-3 w-3/4 rounded bg-gray-100 blur-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Review Editor */}
        <div className="w-1/2">
          <div className="h-full p-4 flex flex-col">
            {/* Header */}
            <div className="mb-2">
              <div className="h-5 w-32 rounded bg-[var(--color-primary)]/20 blur-sm mb-2" />
              {/* Toolbar */}
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
                <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
                <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
                <div className="w-6 h-6 rounded bg-[var(--color-border)]" />
                <div className="w-6 h-6 rounded bg-[var(--color-primary)]/30" />
              </div>
            </div>
            {/* Editor Content */}
            <div className="flex-1 bg-[var(--color-surface)] rounded border p-3 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <div className="space-y-2">
                <div className="h-4 w-1/4 rounded bg-[var(--color-primary)]/10 blur-sm" />
                <div className="h-3 w-full rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
                <div className="h-3 w-5/6 rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
                <div className="h-3 w-full rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
                <div className="h-4 w-1/3 rounded bg-[var(--color-primary)]/10 blur-sm mt-3" />
                <div className="h-3 w-full rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
                <div className="h-3 w-4/5 rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
              </div>
            </div>
            {/* Footer */}
            <div className="mt-2 flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-green-500/20 blur-sm" />
              <div className="h-6 w-24 rounded bg-[var(--color-primary)]/20 blur-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Visual preview for AI Auto Review step
 * Shows before and after states
 */
export const AIReviewPreview: React.FC = () => {
  return (
    <div className="w-full rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
      <div className="bg-[var(--color-surface)] p-4">
        {/* Before state */}
        <div className="mb-4">
          <div className="text-xs mb-2 opacity-60" style={{ color: 'var(--color-text-secondary)' }}>Before AI Review</div>
          <div className="h-20 bg-[var(--color-background)] rounded border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-xs opacity-40" style={{ color: 'var(--color-text-tertiary)' }}>Empty editor...</div>
          </div>
        </div>
        {/* Arrow */}
        <div className="flex justify-center mb-4">
          <div className="text-2xl">↓</div>
        </div>
        {/* After state */}
        <div>
          <div className="text-xs mb-2 opacity-60" style={{ color: 'var(--color-text-secondary)' }}>After AI Review</div>
          <div className="h-32 bg-[var(--color-background)] rounded border p-3 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="space-y-2">
              <div className="h-3 w-1/4 rounded bg-[var(--color-primary)]/20 blur-sm" />
              <div className="h-2 w-full rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
              <div className="h-2 w-5/6 rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
              <div className="h-3 w-1/3 rounded bg-[var(--color-primary)]/20 blur-sm mt-2" />
              <div className="h-2 w-full rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
              <div className="h-2 w-4/5 rounded bg-[var(--color-text-secondary)]/10 blur-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

