import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Star, MoreVertical, Edit2, Trash2, Grid3X3 } from 'lucide-react';
import { BookSeries } from '../../../lib/supabase';
import { libraryOrganizationService } from '../../services/libraryOrganizationService';

interface SeriesCardProps {
  series: BookSeries;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBook: (bookId: string) => void;
}

export const SeriesCard: React.FC<SeriesCardProps> = ({
  series,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onOpenBook
}) => {
  const [books, setBooks] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      loadSeriesData();
    }
  }, [isExpanded, series.id]);

  const loadSeriesData = async () => {
    setIsLoading(true);
    try {
      const [booksData, progressData] = await Promise.all([
        libraryOrganizationService.getSeriesBooks(series.id),
        libraryOrganizationService.getSeriesProgress(series.id)
      ]);
      setBooks(booksData);
      setProgress(progressData);
    } catch (error) {
      console.error('Failed to load series data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="border rounded-lg overflow-hidden transition-all"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)'
      }}
    >
      {/* Series Header */}
      <div 
        className="p-4 cursor-pointer transition-colors"
        onClick={onToggle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
      >
        <div className="flex items-start gap-3">
          <button className="p-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <div className="flex-shrink-0 w-12 h-16 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 
                className="font-semibold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {series.name}
              </h3>
              {series.is_favorite && (
                <Star className="w-4 h-4 flex-shrink-0" style={{ color: '#FBBF24' }} fill="#FBBF24" />
              )}
            </div>
            
            {series.author && (
              <p 
                className="text-sm mb-2 truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                by {series.author}
              </p>
            )}
            
            {series.description && !isExpanded && (
              <p 
                className="text-sm line-clamp-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {series.description}
              </p>
            )}
            
            {progress && (
              <div className="flex items-center gap-2 mt-2">
                <div 
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--color-border)' }}
                >
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(progress.overall_progress || 0, 100)}%`,
                      backgroundColor: '#10B981'
                    }}
                  />
                </div>
                <span 
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {Math.round(progress.overall_progress || 0)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {progress && (
              <span 
                className="text-xs px-2 py-1 rounded-full"
                style={{ 
                  backgroundColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {progress.completed_books || 0}/{progress.total_books || 0}
              </span>
            )}
            
            <div className="relative group">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              
              {/* Context Menu */}
              <div 
                className="absolute right-0 top-8 w-32 rounded-lg shadow-lg border overflow-hidden hidden group-hover:block z-10"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)'
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                  style={{ 
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors text-red-600"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Series Books (when expanded) */}
      {isExpanded && (
        <div 
          className="border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin mx-auto w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : books.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No books in this series yet
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => onOpenBook(book.id)}
                  className="w-full flex items-center gap-3 p-3 rounded transition-colors text-left"
                  style={{ 
                    backgroundColor: 'var(--color-surface)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                >
                  <span 
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{ 
                      backgroundColor: '#3B82F6',
                      color: 'white'
                    }}
                  >
                    {book.series_order || '?'}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <p 
                      className="font-medium truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {book.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {Math.round(book.reading_progress || 0)}%
                      </span>
                      {book.is_favorite && (
                        <Star className="w-3 h-3" style={{ color: '#FBBF24' }} fill="#FBBF24" />
                      )}
                    </div>
                  </div>
                  
                  <div 
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-border)' }}
                  >
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(book.reading_progress || 0, 100)}%`,
                        backgroundColor: '#3B82F6'
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

