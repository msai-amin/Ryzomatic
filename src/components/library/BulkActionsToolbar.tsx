import React, { useState } from 'react';
import { 
  FolderPlus, 
  Tag, 
  Star, 
  Archive, 
  Download, 
  Copy, 
  X, 
  Trash2 
} from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onAddToCollection: () => void;
  onAddTags: () => void;
  onToggleFavorite: (isFavorite: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
  onExport: () => void;
  onDetectDuplicates: () => void;
  onClearSelection: () => void;
}

export const BulkActionsToolbar: React.FC<BulkActionsProps> = ({
  selectedCount,
  onAddToCollection,
  onAddTags,
  onToggleFavorite,
  onArchive,
  onDelete,
  onExport,
  onDetectDuplicates,
  onClearSelection
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = () => {
    console.log('BulkActionsToolbar: Delete button clicked, showConfirmDelete:', showConfirmDelete);
    console.log('BulkActionsToolbar: onDelete function:', typeof onDelete);
    console.log('BulkActionsToolbar: selectedCount:', selectedCount);
    
    // Simplified: Just show confirm dialog directly, no two-click pattern
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedCount} book(s)? This action cannot be undone.`);
    
    if (confirmed) {
      console.log('BulkActionsToolbar: User confirmed deletion, calling onDelete()');
      if (typeof onDelete === 'function') {
        try {
          onDelete();
          console.log('BulkActionsToolbar: onDelete() called successfully');
        } catch (error) {
          console.error('BulkActionsToolbar: Error calling onDelete():', error);
          alert(`Failed to delete: ${error.message || 'Unknown error'}`);
        }
      } else {
        console.error('BulkActionsToolbar: onDelete is not a function!', onDelete);
        alert('ERROR: Delete handler is not a function!');
      }
    } else {
      console.log('BulkActionsToolbar: User cancelled deletion');
    }
    
    // Reset confirmation state if it was set
    setShowConfirmDelete(false);
  };

  return (
    <div 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200"
    >
      <div 
        className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <span 
          className="font-medium pr-3 border-r mr-1"
          style={{ 
            color: 'var(--color-text-primary)',
            borderColor: 'var(--color-border)'
          }}
        >
          {selectedCount} selected
        </span>
        
        <button 
          onClick={onAddToCollection} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Add to Collection"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <FolderPlus className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onAddTags} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Add Tags"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Tag className="w-5 h-5" />
        </button>
        
        <button 
          onClick={() => onToggleFavorite(true)} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Mark as Favorite"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Star className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onArchive} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Archive"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Archive className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onExport} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Export"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Download className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onDetectDuplicates} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Find Duplicates"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Copy className="w-5 h-5" />
        </button>
        
        <div 
          className="w-px h-6 mx-1"
          style={{ backgroundColor: 'var(--color-border)' }}
        />
        
        <button 
          onClick={handleDelete} 
          className={`p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${
            showConfirmDelete ? 'bg-red-100 dark:bg-red-900/30' : ''
          }`}
          title={showConfirmDelete ? "Click again to confirm" : "Delete"}
          style={{ color: showConfirmDelete ? '#DC2626' : '#EF4444' }}
          onMouseEnter={(e) => !showConfirmDelete && (e.currentTarget.style.backgroundColor = 'rgba(254, 242, 242, 0.8)')}
          onMouseLeave={(e) => !showConfirmDelete && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Trash2 className="w-5 h-5" />
        </button>
        
        <button 
          onClick={onClearSelection} 
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Clear Selection"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

