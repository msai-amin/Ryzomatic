import React from 'react'
import { useAppStore } from '../../store/appStore'

export const ReviewPanel: React.FC = () => {
  const { reviewCitations } = useAppStore()

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] text-[var(--color-text-primary)]">
      <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
        <h2 className="font-semibold text-lg">Review Editor</h2>
        <div className="flex gap-2">
           {/* Toolbar placeholders */}
           <button className="p-1 hover:bg-[var(--color-surface-hover)] rounded">B</button>
           <button className="p-1 hover:bg-[var(--color-surface-hover)] rounded">I</button>
           <button className="p-1 hover:bg-[var(--color-surface-hover)] rounded">List</button>
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="prose prose-invert max-w-none">
          <h3 className="text-[var(--color-text-primary)]">General Comments</h3>
          <p className="text-[var(--color-text-secondary)]">
            Start writing your review here...
          </p>
          
          {/* Citations List */}
          {reviewCitations.length > 0 && (
            <div className="my-4 space-y-2">
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Citations</h4>
              {reviewCitations.map((citation, index) => (
                <blockquote key={index} className="pl-4 border-l-2 border-[var(--color-primary)] text-sm italic text-[var(--color-text-secondary)]">
                  {citation}
                </blockquote>
              ))}
            </div>
          )}

          {/* Placeholder for Drag & Drop area */}
          <div className="my-8 p-8 border-2 border-dashed border-[var(--color-border)] rounded-lg text-center text-[var(--color-text-tertiary)]">
            Drag highlighted text here to create a citation
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-background-secondary)]">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-tertiary)]">Auto-saved 2m ago</span>
          <button className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-hover)]">
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}

