import React, { useState } from 'react'
import { ImageIcon, ChevronUp, ChevronDown } from 'lucide-react'

export const FigureDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] transition-all duration-300 z-30 shadow-lg`}
      style={{ 
        height: isOpen ? '300px' : '40px',
        width: '50%' // Only cover the PDF side
      }}
    >
      <div 
        className="h-10 flex items-center justify-between px-4 cursor-pointer hover:bg-[var(--color-surface-hover)]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
          <ImageIcon size={16} />
          <span>Figures & Tables (3 detected)</span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </div>

      {isOpen && (
        <div className="h-[260px] p-4 overflow-x-auto flex gap-4">
          {/* Mock Figures */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 h-full bg-[var(--color-background)] rounded border border-[var(--color-border)] p-2 flex flex-col">
              <div className="flex-1 bg-[var(--color-surface-hover)] flex items-center justify-center rounded mb-2">
                <span className="text-[var(--color-text-tertiary)]">Figure {i} Preview</span>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] font-medium truncate">
                Fig {i}: Visual representation of data analysis results
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

