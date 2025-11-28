import React, { useState } from 'react';
import { 
  Book, 
  FileText, 
  Star, 
  StarOff, 
  MoreVertical, 
  Check, 
  Clock, 
  FileAudio, 
  MessageSquare,
  Calendar,
  HardDrive,
  Eye,
  Edit3,
  Trash2,
  Move,
  Share2
} from 'lucide-react';
import { SearchResult } from '../../services/librarySearchService';
import { useAppStore } from '../../store/appStore';
import { libraryOrganizationService } from '../../services/libraryOrganizationService';
import { supabaseStorageService } from '../../services/supabaseStorageService';

interface BookCardProps {
  book: SearchResult;
  viewMode: 'grid' | 'list' | 'comfortable';
  isSelected: boolean;
  onSelect: (bookId: string) => void;
  onOpen: (book: SearchResult) => void;
  onEdit?: (book: SearchResult) => void;
  onDelete?: (bookId: string) => void;
  onMove?: (bookId: string) => void;
  onShare?: (book: SearchResult) => void;
  onToggleFavorite?: (bookId: string, isFavorite: boolean) => void;
  showActions?: boolean;
  className?: string;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  viewMode,
  isSelected,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
  onMove,
  onShare,
  onToggleFavorite,
  showActions = true,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const isBinaryFormat = book.file_type === 'pdf';
  
  const { 
    toggleBookSelection, 
    libraryView 
  } = useAppStore();

  const formatFileSize = (bytes: number): string => {
    // Handle NaN, undefined, or invalid values
    if (!bytes || isNaN(bytes) || bytes <= 0) return 'Unknown size';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      await supabaseStorageService.updateBookMetadata(book.id, {
        is_favorite: !book.is_favorite
      });
      onToggleFavorite?.(book.id, !book.is_favorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu(true);
  };

  const handleAction = (action: string) => {
    setShowContextMenu(false);
    switch (action) {
      case 'edit':
        onEdit?.(book);
        break;
      case 'delete':
        onDelete?.(book.id);
        break;
      case 'move':
        onMove?.(book.id);
        break;
      case 'share':
        onShare?.(book);
        break;
    }
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return '#10B981'; // green
    if (progress >= 50) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const renderTags = () => {
    const visibleTags = book.tags.slice(0, 3);
    const remainingCount = book.tags.length - 3;
    
    return (
      <div className="flex flex-wrap gap-1">
        {visibleTags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 text-xs rounded-full"
            style={{
              backgroundColor: tag.book_tags.color + '20',
              color: tag.book_tags.color,
              border: `1px solid ${tag.book_tags.color}40`
            }}
          >
            {tag.book_tags.name}
          </span>
        ))}
        {remainingCount > 0 && (
          <span 
            className="px-2 py-1 text-xs rounded-full"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-surface-hover)',
            }}
          >
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  const renderCollections = () => {
    if (book.collections.length === 0) return null;
    
    return (
      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {book.collections.slice(0, 2).map((collection, index) => (
          <span key={index} className="flex items-center gap-1">
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: collection.user_collections.color }}
            />
            {collection.user_collections.name}
          </span>
        ))}
        {book.collections.length > 2 && (
          <span>+{book.collections.length - 2}</span>
        )}
      </div>
    );
  };

  const renderMetadata = () => (
    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {book.notes_count > 0 && (
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {book.notes_count}
        </div>
      )}
      {book.pomodoro_sessions_count > 0 && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {book.pomodoro_sessions_count}
        </div>
      )}
      <div className="flex items-center gap-1">
        <HardDrive className="w-3 h-3" />
        {formatFileSize(book.file_size_bytes)}
      </div>
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center p-3 rounded-lg border transition-all duration-200 cursor-pointer group ${className}`}
        style={{
          borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        }}
        onClick={() => onOpen(book)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {/* Selection checkbox */}
        <div className="flex-shrink-0 mr-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(book.id);
            }}
            className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
            style={{
              backgroundColor: isSelected ? '#3b82f6' : 'transparent',
              borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
              color: isSelected ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        </div>

        {/* Book icon */}
        <div className="flex-shrink-0 mr-3">
          {isBinaryFormat ? (
            <FileText className="w-6 h-6 text-red-500" />
          ) : (
            <Book className="w-6 h-6 text-blue-500" />
          )}
        </div>

        {/* Book info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{book.title}</h3>
            {book.is_favorite && (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            )}
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="uppercase">{book.file_type}</span>
            {book.total_pages && <span>{book.total_pages} pages</span>}
            {book.last_read_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(book.last_read_at)}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex-shrink-0 w-24 mr-3">
          <div 
            className="w-full rounded-full h-2"
            style={{ backgroundColor: 'var(--color-border)' }}
          >
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${book.reading_progress}%`,
                backgroundColor: getProgressColor(book.reading_progress)
              }}
            />
          </div>
          <div className="text-xs text-center mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {Math.round(book.reading_progress)}%
          </div>
        </div>

        {/* Metadata */}
        <div className="flex-shrink-0 mr-3">
          {renderMetadata()}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex-shrink-0">
            <button
              onClick={handleToggleFavorite}
              disabled={isUpdating}
              className="p-1 rounded transition-colors"
              style={{
                color: book.is_favorite ? '#f59e0b' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {book.is_favorite ? (
                <Star className="w-4 h-4 fill-current" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        {/* Context menu */}
        {showContextMenu && (
          <div 
            className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <button
              onClick={() => handleAction('edit')}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => handleAction('move')}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Move className="w-4 h-4" />
              Move to Collection
            </button>
            <button
              onClick={() => handleAction('share')}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={() => handleAction('delete')}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  // Grid and comfortable view
  return (
    <div
      className={`relative rounded-lg border transition-all duration-200 cursor-pointer group ${className}`}
      style={{
        borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface)',
      }}
      onClick={() => onOpen(book)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      {/* Selection checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(book.id);
          }}
          className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
          style={{
            backgroundColor: isSelected ? '#3b82f6' : 'var(--color-surface)',
            borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
            color: isSelected ? 'white' : 'var(--color-text-secondary)',
          }}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>
      </div>

      {/* Favorite button */}
      {showActions && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={handleToggleFavorite}
            disabled={isUpdating}
            className="p-1 rounded-full transition-colors"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: book.is_favorite ? '#f59e0b' : 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
          >
            {book.is_favorite ? (
              <Star className="w-4 h-4 fill-current" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* Book cover placeholder */}
      <div 
        className="aspect-[3/4] rounded-t-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-hover)' }}
      >
        {isBinaryFormat ? (
          <FileText className="w-12 h-12 text-red-500" />
        ) : (
          <Book className="w-12 h-12 text-blue-500" />
        )}
      </div>

      {/* Book info */}
      <div className="p-4">
        <div className="mb-2">
          <h3 className="font-medium line-clamp-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>{book.title}</h3>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="uppercase text-xs font-medium">{book.file_type}</span>
            {book.total_pages && <span>• {book.total_pages} pages</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: 'var(--color-text-secondary)' }}>Progress</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{Math.round(book.reading_progress)}%</span>
          </div>
          <div 
            className="w-full rounded-full h-2"
            style={{ backgroundColor: 'var(--color-border)' }}
          >
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${book.reading_progress}%`,
                backgroundColor: getProgressColor(book.reading_progress)
              }}
            />
          </div>
        </div>

        {/* Tags */}
        {book.tags.length > 0 && (
          <div className="mb-3">
            {renderTags()}
          </div>
        )}

        {/* Collections */}
        {book.collections.length > 0 && (
          <div className="mb-3">
            {renderCollections()}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {renderMetadata()}
          {book.last_read_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(book.last_read_at)}
            </span>
          )}
        </div>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div 
          className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <button
            onClick={() => handleAction('edit')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => handleAction('move')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Move className="w-4 h-4" />
            Move to Collection
          </button>
          <button
            onClick={() => handleAction('share')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={() => handleAction('delete')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
