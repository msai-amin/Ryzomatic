import React from 'react'
import { X, Type, Palette } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface TypographySettingsProps {
  onClose: () => void
}

export const TypographySettings: React.FC<TypographySettingsProps> = ({ onClose }) => {
  const { typography, updateTypography } = useAppStore()

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
        </div>
      </div>
    </div>
  )
}


