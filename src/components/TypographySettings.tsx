import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Type, Palette, AlignLeft, AlignJustify, AlignCenter, Space, Eye, Crosshair, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { TextCleanupModal } from './TextCleanupModal'
import { cleanupDocumentText, CleanupPreferences } from '../services/textCleanupService'

interface TypographySettingsProps {
  onClose: () => void
}

export const TypographySettings: React.FC<TypographySettingsProps> = ({ onClose }) => {
  const { typography, updateTypography, currentDocument, pdfViewer, user } = useAppStore()
  
  // CRITICAL: Safe destructuring with defaults - guarantees arrays are always arrays
  // Level 1 Guard: Default currentDocument to {} if null/undefined
  // Level 2 Guard: Default cleanedPageTexts to [] if missing
  const { cleanedPageTexts: safeCleanedPageTexts = [] } = currentDocument || {}
  
  const [showTextCleanup, setShowTextCleanup] = useState(false)
  const [isTextCleaning, setIsTextCleaning] = useState(false)

  const handleFontFamilyChange = (fontFamily: 'serif' | 'sans' | 'mono') => {
    updateTypography({ fontFamily })
  }

  const handleFontSizeChange = (fontSize: number) => {
    updateTypography({ fontSize })
  }

  const handleLineHeightChange = (lineHeight: number) => {
    updateTypography({ lineHeight })
  }

  const handleMaxWidthChange = (maxWidth: number) => {
    updateTypography({ maxWidth })
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'sepia' | 'reading') => {
    updateTypography({ theme })
  }

  const handleTextAlignChange = (textAlign: 'left' | 'justify' | 'center') => {
    updateTypography({ textAlign })
  }

  const handleSpacingMultiplierChange = (spacingMultiplier: number) => {
    updateTypography({ spacingMultiplier })
  }

  const handleFocusModeChange = (focusMode: boolean) => {
    updateTypography({ focusMode })
  }

  const handleReadingGuideChange = (readingGuide: boolean) => {
    updateTypography({ readingGuide })
  }

  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center z-[9999] pt-20 pb-8 px-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-xl shadow-xl max-w-2xl w-full mx-4 animate-scale-in my-auto" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>Typography Settings</h2>
          <button
            onClick={onClose}
            className="transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            style={{ color: 'var(--color-text-secondary, #6b7280)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary, #1f2937)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary, #6b7280)'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Font Family */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              <Type className="w-4 h-4" />
              <span>Font Family</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'sans', label: 'Sans Serif', preview: 'Aa' },
                { value: 'serif', label: 'Serif', preview: 'Aa' },
                { value: 'mono', label: 'Monospace', preview: 'Aa' }
              ].map(({ value, label, preview }) => (
                <button
                  key={value}
                  onClick={() => handleFontFamilyChange(value as any)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    typography.fontFamily === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-transparent'
                  }`}
                >
                  <div className={`text-lg mb-1 ${value === 'serif' ? 'font-serif' : value === 'mono' ? 'font-mono' : 'font-sans'}`}>
                    {preview}
                  </div>
                  <div className="text-sm">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Font Size: {typography.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="24"
              value={typography.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Line Height */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Line Height: {typography.lineHeight}
            </label>
            <input
              type="range"
              min="1.2"
              max="2.5"
              step="0.1"
              value={typography.lineHeight}
              onChange={(e) => handleLineHeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Max Width */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Max Width: {typography.maxWidth}px
            </label>
            <input
              type="range"
              min="400"
              max="1200"
              step="50"
              value={typography.maxWidth}
              onChange={(e) => handleMaxWidthChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Theme */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              <Palette className="w-4 h-4" />
              <span>Theme</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: 'light', label: 'Light', preview: '☀️' },
                { value: 'dark', label: 'Dark', preview: '🌙' },
                { value: 'sepia', label: 'Sepia', preview: '📜' },
                { value: 'reading', label: 'Reading', preview: '📖', description: 'Optimized for monitors' }
              ].map(({ value, label, preview, description }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value as any)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    typography.theme === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                  style={{
                    color: typography.theme === value ? undefined : 'var(--color-text-primary)'
                  }}
                >
                  <div className="text-2xl mb-1">{preview}</div>
                  <div className="text-sm font-medium">{label}</div>
                  {description && (
                    <div className="text-xs mt-1 opacity-70">{description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Text Alignment */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              <AlignLeft className="w-4 h-4" />
              <span>Text Alignment</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'left', label: 'Left', Icon: AlignLeft },
                { value: 'justify', label: 'Justify', Icon: AlignJustify },
                { value: 'center', label: 'Center', Icon: AlignCenter }
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => handleTextAlignChange(value as any)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    typography.textAlign === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Spacing Multiplier */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              <Space className="w-4 h-4" />
              <span>Spacing: {typography.spacingMultiplier.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={typography.spacingMultiplier}
              onChange={(e) => handleSpacingMultiplierChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs mt-1 text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-tertiary, #6b7280)' }}>
              <span>Compact (0.5x)</span>
              <span>Normal (1x)</span>
              <span>Spacious (2x)</span>
            </div>
          </div>

          {/* Reading Enhancements */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
              Reading Enhancements
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typography.focusMode}
                  onChange={(e) => handleFocusModeChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-secondary, #6b7280)' }} />
                  <span className="text-sm text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>Focus Mode</span>
                </div>
                <span className="text-xs ml-auto text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-tertiary, #6b7280)' }}>Dim surrounding text</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typography.readingGuide}
                  onChange={(e) => handleReadingGuideChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Crosshair className="w-4 h-4 text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-secondary, #6b7280)' }} />
                  <span className="text-sm text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>Reading Guide</span>
                </div>
                <span className="text-xs ml-auto text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-tertiary, #6b7280)' }}>Highlight current paragraph</span>
              </label>
            </div>
          </div>

          {/* Text Cleanup & Organization */}
          {currentDocument && (
            <div className="border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
              <label className="flex items-center space-x-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100" style={{ color: 'var(--color-text-primary, #1f2937)' }}>
                <Sparkles className="w-4 h-4" />
                <span>Text Cleanup & Organization</span>
              </label>
              <p className="text-sm mb-4 text-gray-600 dark:text-gray-400" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
                Clean and reorganize document text for better readability in reading mode.
              </p>
              <button
                onClick={() => setShowTextCleanup(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Sparkles className="w-4 h-4" />
                <span>Open Text Cleanup</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Text Cleanup Modal */}
      {showTextCleanup && currentDocument && (
        <TextCleanupModal
          onClose={() => setShowTextCleanup(false)}
          onApply={async (preferences: CleanupPreferences, applyToAllPages: boolean) => {
            setIsTextCleaning(true)
            try {
              await cleanupDocumentText({
                document: currentDocument,
                preferences,
                pageNumbers: applyToAllPages ? undefined : [pdfViewer.currentPage],
                userId: user?.id || undefined,
                existingCleaned: Array.isArray(safeCleanedPageTexts) && safeCleanedPageTexts.length > 0 ? safeCleanedPageTexts : null
              })
              setShowTextCleanup(false)
            } catch (error) {
              console.error('Text cleanup error:', error)
              alert('Failed to clean text. Please try again.')
            } finally {
              setIsTextCleaning(false)
            }
          }}
          isProcessing={isTextCleaning}
          currentPageNumber={pdfViewer.currentPage}
          totalPages={pdfViewer.numPages || 0}
          scrollMode={pdfViewer.scrollMode}
        />
      )}
    </div>,
    document.body
  )
}


