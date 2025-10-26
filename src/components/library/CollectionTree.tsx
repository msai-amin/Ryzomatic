import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  MoreVertical,
  Star,
  StarOff
} from 'lucide-react';
import { Collection } from '../../services/libraryOrganizationService';
import { useAppStore } from '../../store/appStore';

interface CollectionTreeProps {
  collections: Collection[];
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  onCreateCollection: (parentId?: string) => void;
  onEditCollection: (collection: Collection) => void;
  onDeleteCollection: (collectionId: string) => void;
  onToggleFavorite: (collectionId: string, isFavorite: boolean) => void;
  className?: string;
}

interface CollectionNodeProps {
  collection: Collection;
  level: number;
  isExpanded: boolean;
  onToggle: (collectionId: string) => void;
  onSelect: (collectionId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEdit: (collection: Collection) => void;
  onDelete: (collectionId: string) => void;
  onToggleFavorite: (collectionId: string, isFavorite: boolean) => void;
  isSelected: boolean;
}

const CollectionNode: React.FC<CollectionNodeProps> = ({
  collection,
  level,
  isExpanded,
  onToggle,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
  onToggleFavorite,
  isSelected
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = collection.book_count && collection.book_count > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu(true);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowContextMenu(false);
  };

  const handleSaveEdit = async () => {
    if (editName.trim() && editName !== collection.name) {
      // Update collection name
      // This would call the libraryOrganizationService.updateCollection
      console.log('Update collection name:', collection.id, editName);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(collection.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleAction = (action: string) => {
    setShowContextMenu(false);
    switch (action) {
      case 'edit':
        handleEdit();
        break;
      case 'create':
        onCreateChild(collection.id);
        break;
      case 'delete':
        onDelete(collection.id);
        break;
    }
  };

  return (
    <div className="relative">
      <div
        className="flex items-center py-1 px-2 rounded-md cursor-pointer group transition-colors"
        style={{ 
          paddingLeft: `${level * 16 + 8}px`,
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          color: isSelected ? '#3b82f6' : 'var(--color-text-primary)',
        }}
        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={() => onSelect(collection.id)}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(collection.id);
          }}
          className="w-4 h-4 flex items-center justify-center mr-1 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : (
            <div className="w-3 h-3" />
          )}
        </button>

        {/* Collection icon */}
        <div className="mr-2">
          {isExpanded ? (
            <FolderOpen 
              className="w-4 h-4" 
              style={{ color: collection.color }}
            />
          ) : (
            <Folder 
              className="w-4 h-4" 
              style={{ color: collection.color }}
            />
          )}
        </div>

        {/* Collection name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              handleSaveEdit()
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 px-1 py-0.5 text-sm rounded focus:outline-none"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-medium truncate">
            {collection.name}
          </span>
        )}

        {/* Book count */}
        {collection.book_count && collection.book_count > 0 && (
          <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>
            ({collection.book_count})
          </span>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(collection.id, !collection.is_favorite);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
          style={{ color: collection.is_favorite ? '#f59e0b' : 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {collection.is_favorite ? (
            <Star className="w-3 h-3 fill-current" />
          ) : (
            <StarOff className="w-3 h-3" />
          )}
        </button>

        {/* More actions button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowContextMenu(!showContextMenu);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
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
            Rename
          </button>
          <button
            onClick={() => handleAction('create')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Plus className="w-4 h-4" />
            New Subcollection
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

export const CollectionTree: React.FC<CollectionTreeProps> = ({
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
  onToggleFavorite,
  className = ''
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const { setActiveCollection } = useAppStore();

  // Build tree structure
  const buildTree = (collections: Collection[]): (Collection & { children: Collection[] })[] => {
    const collectionMap = new Map<string, Collection & { children: Collection[] }>();
    const rootCollections: (Collection & { children: Collection[] })[] = [];

    // Create map with children array
    collections.forEach(collection => {
      collectionMap.set(collection.id, { ...collection, children: [] });
    });

    // Build tree structure
    collections.forEach(collection => {
      const collectionWithChildren = collectionMap.get(collection.id)!;
      
      if (collection.parent_id) {
        const parent = collectionMap.get(collection.parent_id);
        if (parent) {
          parent.children.push(collectionWithChildren);
        }
      } else {
        rootCollections.push(collectionWithChildren);
      }
    });

    return rootCollections;
  };

  const toggleExpanded = (collectionId: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const handleSelectCollection = (collectionId: string) => {
    onSelectCollection(collectionId);
    setActiveCollection(collectionId);
  };

  const handleSelectAll = () => {
    onSelectCollection(null);
    setActiveCollection(null);
  };

  const renderCollectionNode = (collection: Collection & { children: Collection[] }, level: number = 0) => {
    const isExpanded = expandedCollections.has(collection.id);
    const isSelected = selectedCollectionId === collection.id;

    return (
      <div key={collection.id}>
        <CollectionNode
          collection={collection}
          level={level}
          isExpanded={isExpanded}
          onToggle={toggleExpanded}
          onSelect={handleSelectCollection}
          onCreateChild={onCreateCollection}
          onEdit={onEditCollection}
          onDelete={onDeleteCollection}
          onToggleFavorite={onToggleFavorite}
          isSelected={isSelected}
        />
        
        {/* Render children */}
        {isExpanded && collection.children.map(child => 
          renderCollectionNode(child as Collection & { children: Collection[] }, level + 1)
        )}
      </div>
    );
  };

  const treeData = buildTree(collections);

  return (
    <div className={`space-y-1 ${className}`}>
      {/* All Books option */}
      <div
        className="flex items-center py-1 px-2 rounded-md cursor-pointer group transition-colors"
        style={{
          backgroundColor: selectedCollectionId === null ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          color: selectedCollectionId === null ? '#3b82f6' : 'var(--color-text-primary)',
        }}
        onMouseEnter={(e) => selectedCollectionId !== null && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
        onMouseLeave={(e) => selectedCollectionId !== null && (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={handleSelectAll}
      >
        <div className="w-4 h-4 mr-1" />
        <Folder className="w-4 h-4 mr-2" style={{ color: 'var(--color-text-secondary)' }} />
        <span className="flex-1 text-sm font-medium">All Books</span>
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          ({collections.reduce((sum, c) => sum + (c.book_count || 0), 0)})
        </span>
      </div>

      {/* Collections tree */}
      {treeData.map(collection => renderCollectionNode(collection))}

      {/* Create new collection button */}
      <button
        onClick={() => onCreateCollection()}
        className="w-full flex items-center py-2 px-2 text-sm rounded-md transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        New Collection
      </button>
    </div>
  );
};
