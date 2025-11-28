import React from 'react';
import { Book, FileText, MessageSquare } from 'lucide-react';
import { SearchResult } from '../../services/librarySearchService';

interface RecentBookCardProps {
  book: SearchResult;
  onOpen: (book: SearchResult) => void;
}

export const RecentBookCard: React.FC<RecentBookCardProps> = ({
  book,
  onOpen
}) => {
  const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isBinaryFormat = book.file_type === 'pdf';
  const Icon = isBinaryFormat ? Book : FileText;

  return (
    <button
      onClick={() => onOpen(book)}
      className="flex flex-col items-start p-4 rounded-lg border transition-all hover:shadow-md min-w-[200px] max-w-[250px] text-left"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-surface)';
      }}
    >
      <div className="flex items-start gap-3 w-full">
        <div 
          className="flex-shrink-0 w-12 h-12 rounded flex items-center justify-center"
          style={{ 
            backgroundColor: `${isBinaryFormat ? '#3B82F6' : '#10B981'}20`,
            color: isBinaryFormat ? '#3B82F6' : '#10B981'
          }}
        >
          <Icon className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 
            className="font-medium truncate mb-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {book.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            {book.reading_progress > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                {Math.round(book.reading_progress)}%
              </span>
            )}
            <span>•</span>
            <span>{formatTimeAgo(book.last_read_at)}</span>
          </div>
          
          {book.reading_progress > 0 && (
            <div 
              className="h-1 rounded-full overflow-hidden mb-1"
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${Math.min(book.reading_progress, 100)}%`,
                  backgroundColor: '#10B981'
                }}
              />
            </div>
          )}
        </div>
      </div>
      
      {book.notes_count > 0 && (
        <div className="flex items-center gap-2 text-xs mt-2 w-full" style={{ color: 'var(--color-text-tertiary)' }}>
          <MessageSquare className="w-3 h-3" />
          <span>{book.notes_count} notes</span>
        </div>
      )}
    </button>
  );
};

