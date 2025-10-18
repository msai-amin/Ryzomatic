import React from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const { currentDocument } = useAppStore()
  const { annotationColors } = useTheme()

  return (
    <div 
      id="main-content"
      className="flex-1 flex"
      style={{
        backgroundColor: 'var(--color-background)',
        minHeight: 'calc(100vh - var(--header-height))',
      }}
    >
      {/* Main Content Area */}
      <div 
        className="flex-1 p-8 overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-background)',
        }}
      >
        {children}
      </div>

      {/* Notes Panel - Only show if there's a current document */}
      {currentDocument && (
        <div 
          className="w-80 p-8 overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Research Notes
            </h2>
            <Tooltip content="Create New Note" position="left">
              <button 
                className="text-sm px-3 py-1 rounded-full"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                + New Note
              </button>
            </Tooltip>
          </div>

          {/* Color Legend */}
          <div className="mb-6">
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Annotation Colors
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {annotationColors.map((color, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color.value }}
                  />
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {color.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Tooltip content="Export all your notes to a file" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Export Notes
                </button>
              </Tooltip>
              <Tooltip content="AI-generated summary of this document" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Generate Summary
                </button>
              </Tooltip>
              <Tooltip content="Generate citation in multiple formats" position="left">
                <button 
                  className="w-full text-left text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Create Citation
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}