import React, { useState } from 'react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { useTheme } from './ThemeProvider'
import { ChevronRight, ChevronLeft } from 'lucide-react'

interface ThemedMainContentProps {
  children?: React.ReactNode
}

export const ThemedMainContent: React.FC<ThemedMainContentProps> = ({ children }) => {
  const { currentDocument } = useAppStore()
  const { annotationColors } = useTheme()
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true)

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
        className="flex-1 p-8 overflow-y-auto relative"
        style={{
          backgroundColor: 'var(--color-background)',
        }}
      >
        {children}
      </div>

      {/* Right Sidebar - Only show if there's a current document */}
      {currentDocument && (
        <div 
          className="transition-all duration-300 ease-in-out overflow-y-auto relative"
          style={{
            width: isRightSidebarOpen ? '320px' : '0px',
            backgroundColor: 'var(--color-surface)',
            borderLeft: isRightSidebarOpen ? '1px solid var(--color-border)' : 'none',
          }}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className="absolute -left-10 top-4 p-2 rounded-l-lg shadow-md hover:shadow-lg transition-all z-10"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRight: 'none',
              color: 'var(--color-text-primary)',
            }}
            title={isRightSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {isRightSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Sidebar Content */}
          <div 
            className="p-8"
            style={{
              opacity: isRightSidebarOpen ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              visibility: isRightSidebarOpen ? 'visible' : 'hidden',
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
                    style={{ backgroundColor: color.color }}
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
        </div>
      )}
    </div>
  )
}