import React, { useState, useEffect } from 'react'
import { X, Type, Palette, AlignLeft, AlignJustify, AlignCenter, Space, Eye, Crosshair, Calculator, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { getCacheStats, clearFormulaCache } from '../services/formulaService'

interface TypographySettingsProps {
  onClose: () => void
}

export const TypographySettings: React.FC<TypographySettingsProps> = ({ onClose }) => {
  const { typography, updateTypography } = useAppStore()
  // Fixed syntax error in handleClearCache function
  const [cacheStats, setCacheStats] = useState({ count: 0, totalSize: 0, oldestEntry: null as number | null })
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    setCacheStats(getCacheStats())
  }, [])

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

  const handleThemeChange = (theme: 'light' | 'dark' | 'sepia') => {
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

  const handleRenderFormulasChange = (renderFormulas: boolean) => {
    updateTypography({ renderFormulas })
  }

  const handleClearCache = () => {
    if (window.confirm('Clear all cached formula conversions? You may need to re-convert formulas.')) {
      setClearing(true)
      clearFormulaCache()
      setCacheStats(getCacheStats())
      setTimeout(() => setClearing(false), 500)
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 pt-20 pb-8 px-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-xl shadow-xl max-w-2xl w-full mx-4 animate-scale-in my-auto" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Typography Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Font Family */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
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
                      : 'border-gray-300 hover:border-gray-400'
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
              <Palette className="w-4 h-4" />
              <span>Theme</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: 'Light', preview: '☀️' },
                { value: 'dark', label: 'Dark', preview: '🌙' },
                { value: 'sepia', label: 'Sepia', preview: '📜' }
              ].map(({ value, label, preview }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value as any)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    typography.theme === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-1">{preview}</div>
                  <div className="text-sm">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Text Alignment */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
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
                      : 'border-gray-300 hover:border-gray-400'
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
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
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
            <div className="flex justify-between text-xs mt-1 text-gray-500">
              <span>Compact (0.5x)</span>
              <span>Normal (1x)</span>
              <span>Spacious (2x)</span>
            </div>
          </div>

          {/* Reading Enhancements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
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
                  <Eye className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Focus Mode</span>
                </div>
                <span className="text-xs text-gray-500 ml-auto">Dim surrounding text</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typography.readingGuide}
                  onChange={(e) => handleReadingGuideChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Crosshair className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Reading Guide</span>
                </div>
                <span className="text-xs text-gray-500 ml-auto">Highlight current paragraph</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typography.renderFormulas}
                  onChange={(e) => handleRenderFormulasChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Render Formulas</span>
                </div>
                <span className="text-xs text-gray-500 ml-auto">Convert math to LaTeX</span>
              </label>
            </div>
          </div>

          {/* Formula Cache Management */}
          {typography.renderFormulas && (
            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
                <Calculator className="w-4 h-4" />
                <span>Formula Cache</span>
              </label>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Cached formulas:</span>
                  <span className="font-medium text-gray-900">{cacheStats.count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Cache size:</span>
                  <span className="font-medium text-gray-900">
                    {(cacheStats.totalSize / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  onClick={handleClearCache}
                  disabled={clearing || cacheStats.count === 0}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
                  <span>{clearing ? 'Clearing...' : 'Clear Cache'}</span>
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Clearing cache will require re-converting formulas on next view
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


