import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, CheckCircle, AlertCircle, Volume2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { CleanupPreferences } from '../services/textCleanupService'

interface TextCleanupModalProps {
  onClose: () => void
  onApply: (preferences: CleanupPreferences, applyToAllPages: boolean) => Promise<void>
  isProcessing: boolean
  currentPageNumber: number
  totalPages: number
  scrollMode: 'single' | 'continuous'
}

export const TextCleanupModal: React.FC<TextCleanupModalProps> = ({
  onClose,
  onApply,
  isProcessing,
  currentPageNumber,
  totalPages,
  scrollMode
}) => {
  const { typography } = useAppStore()
  
  const [preferences, setPreferences] = useState<CleanupPreferences>({
    reorganizeParagraphs: false,
    removeFormulae: false,
    removeFootnotes: false,
    removeSideNotes: false,
    removeHeadersFooters: false,
    simplifyFormatting: false,
    reorganizationStyle: 'logical',
    optimizeForTTS: false
  })
  
  const [applyToAllPages, setApplyToAllPages] = useState(false)

  const handleTogglePreference = (key: keyof CleanupPreferences) => {
    if (key === 'reorganizationStyle') return // Don't toggle this, it's a select
    
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleStyleChange = (style: 'logical' | 'chronological' | 'topic-based') => {
    setPreferences(prev => ({
      ...prev,
      reorganizationStyle: style
    }))
  }

  const handleApply = async () => {
    // Check if at least one option is selected
    const hasSelection = 
      preferences.reorganizeParagraphs ||
      preferences.removeFormulae ||
      preferences.removeFootnotes ||
      preferences.removeSideNotes ||
      preferences.removeHeadersFooters ||
      preferences.simplifyFormatting ||
      preferences.optimizeForTTS

    if (!hasSelection) {
      alert('Please select at least one cleanup option.')
      return
    }

    await onApply(preferences, applyToAllPages && scrollMode === 'continuous')
  }

  return createPortal(
    <div 
      className="fixed inset-0 flex items-start justify-center z-[9999] pt-20 pb-8 px-4 overflow-y-auto" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose()
        }
      }}
    >
      <div 
        className="rounded-xl shadow-xl max-w-2xl w-full mx-4 animate-scale-in my-auto" 
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" style={{ color: 'var(--color-primary, #3b82f6)' }} />
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Text Cleanup & Organization
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--color-text-secondary, #6b7280)' }}
            onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.color = 'var(--color-text-primary, #1f2937)')}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary, #6b7280)'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Message */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--color-primary, #3b82f6)' }} />
              <div className="flex-1 text-sm" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
                <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                  AI-Powered Text Cleanup
                </p>
                <p>
                  Use AI to organize and clean your text. Select the options below to customize how the text should be processed.
                  The original text will be preserved, and you can restore it at any time.
                </p>
              </div>
            </div>
          </div>

          {/* Cleanup Options */}
          <div>
            <label className="block text-sm font-medium mb-4" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Cleanup Options
            </label>
            <div className="space-y-3">
              {/* Optimize for TTS - Prominent option */}
              <label className="flex items-start space-x-3 cursor-pointer group p-3 rounded-lg border-2 transition-colors" 
                style={{ 
                  borderColor: preferences.optimizeForTTS ? 'var(--color-primary, #3b82f6)' : 'var(--color-border)',
                  backgroundColor: preferences.optimizeForTTS ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                }}>
                <input
                  type="checkbox"
                  checked={preferences.optimizeForTTS}
                  onChange={() => handleTogglePreference('optimizeForTTS')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" style={{ color: 'var(--color-primary, #3b82f6)' }} />
                    <span className="text-sm font-semibold group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                      Optimize for TTS
                    </span>
                    {preferences.optimizeForTTS && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary, #3b82f6)' }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Prepare text for optimal Text-to-Speech playback: expand abbreviations, format numbers for speech, 
                    fix punctuation, break long sentences, remove non-speech elements (formulas, citations, URLs), 
                    and improve natural flow while preserving paragraph breaks for pauses.
                  </span>
                </div>
              </label>

              {/* Reorganize Paragraphs */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.reorganizeParagraphs}
                  onChange={() => handleTogglePreference('reorganizeParagraphs')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                      Reorganize Paragraphs
                    </span>
                  </div>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Improve paragraph flow and logical order
                  </span>
                  {preferences.reorganizeParagraphs && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <span className="text-xs block mb-2" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
                        Reorganization Style:
                      </span>
                      <div className="flex gap-2">
                        {(['logical', 'chronological', 'topic-based'] as const).map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => handleStyleChange(style)}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 ${
                              preferences.reorganizationStyle === style
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            {style === 'logical' ? 'Logical Flow' : style === 'chronological' ? 'Chronological' : 'Topic-Based'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {/* Remove Formulae */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.removeFormulae}
                  onChange={() => handleTogglePreference('removeFormulae')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Remove Formulae
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Remove all mathematical expressions and equations
                  </span>
                </div>
              </label>

              {/* Remove Footnotes */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.removeFootnotes}
                  onChange={() => handleTogglePreference('removeFootnotes')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Remove Footnotes
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Remove footnote references and footnote content
                  </span>
                </div>
              </label>

              {/* Remove Side Notes */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.removeSideNotes}
                  onChange={() => handleTogglePreference('removeSideNotes')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Remove Side Notes
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Remove margin annotations and sidebars
                  </span>
                </div>
              </label>

              {/* Remove Headers/Footers */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.removeHeadersFooters}
                  onChange={() => handleTogglePreference('removeHeadersFooters')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Remove Headers/Footers
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Remove page numbers and repeated document headers/footers
                  </span>
                </div>
              </label>

              {/* Simplify Formatting */}
              <label className="flex items-start space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={preferences.simplifyFormatting}
                  onChange={() => handleTogglePreference('simplifyFormatting')}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Simplify Formatting
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Simplify complex formatting while preserving readability
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Apply To All Pages Option */}
          {scrollMode === 'continuous' && totalPages > 1 && (
            <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllPages}
                  onChange={(e) => setApplyToAllPages(e.target.checked)}
                  disabled={isProcessing}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                    Apply to All Pages
                  </span>
                  <span className="text-xs mt-1 block" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
                    Clean all {totalPages} pages (may take longer)
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                color: 'var(--color-text-secondary, #6b7280)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f3f4f6)')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isProcessing}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Apply Cleanup</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

