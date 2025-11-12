import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  MoreVertical,
  Settings,
  GripVertical,
  Star,
  StarOff,
  Move
} from 'lucide-react';
import { Collection } from '../../services/libraryOrganizationService';
import { useAppStore } from '../../store/appStore';

interface CollectionTreeProps {
  collections: Collection[];
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  onCreateCollection: (parentId?: string) => void;
  onRenameCollection: (collectionId: string, name: string) => Promise<void> | void;
  onOpenCollectionDetails: (collection: Collection) => void;
  onDeleteCollection: (collectionId: string) => void;
  onToggleFavorite: (collectionId: string, isFavorite: boolean) => void;
  onReorderCollections: (parentId: string | null, orderedIds: string[]) => Promise<void> | void;
  onMoveCollection: (collectionId: string) => void;
  className?: string;
}

interface CollectionNodeProps {
  collection: Collection;
  level: number;
  isExpanded: boolean;
  onToggle: (collectionId: string) => void;
  onSelect: (collectionId: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (collectionId: string, name: string) => Promise<void> | void;
  onOpenDetails: (collection: Collection) => void;
  onDelete: (collectionId: string) => void;
  onToggleFavorite: (collectionId: string, isFavorite: boolean) => void;
  onMove: (collectionId: string) => void;
  isSelected: boolean;
  isDragOver: boolean;
}

const CollectionNode: React.FC<CollectionNodeProps> = ({
  collection,
  level,
  isExpanded,
  onToggle,
  onSelect,
  onCreateChild,
  onRename,
  onOpenDetails,
  onDelete,
  onToggleFavorite,
  onMove,
  isSelected,
  isDragOver
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = (collection.book_count || 0) > 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: collection.id });

  const draggableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragOver ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : undefined
  };

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
    const trimmed = editName.trim();
    if (!trimmed || trimmed === collection.name) {
      setEditName(collection.name);
      setIsEditing(false);
      return;
    }

    try {
      await onRename(collection.id, trimmed);
    } catch (error) {
      console.error('Failed to rename collection:', error);
      setEditName(collection.name);
    } finally {
    setIsEditing(false);
    }
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
      case 'details':
        onOpenDetails(collection);
        break;
      case 'move':
        onMove(collection.id);
        break;
    }
  };

  return (
    <div className="relative" ref={setNodeRef} style={draggableStyle}>
      <div
        className="flex items-center py-1 px-2 rounded-md cursor-pointer group transition-colors"
        style={{ 
          paddingLeft: `${level * 16 + 8}px`,
          backgroundColor: isSelected
            ? 'rgba(59, 130, 246, 0.1)'
            : isDragOver
              ? 'rgba(59, 130, 246, 0.06)'
              : 'transparent',
          color: isSelected ? '#3b82f6' : 'var(--color-text-primary)',
        }}
        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={() => onSelect(collection.id)}
        onContextMenu={handleContextMenu}
      >
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="mr-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Reorder collection"
        >
          <GripVertical className="w-3 h-3" />
        </button>

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
            onClick={() => handleAction('move')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Move className="w-4 h-4" />
            Move to...
          </button>
          <button
            onClick={() => handleAction('details')}
            className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Settings className="w-4 h-4" />
            Edit Details
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
  onRenameCollection,
  onOpenCollectionDetails,
  onDeleteCollection,
  onToggleFavorite,
  onReorderCollections,
  onMoveCollection,
  className = ''
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const {
    setActiveCollection,
    collectionDragState,
    setCollectionDragState
  } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  const { treeData, parentMap, siblingsMap } = useMemo(() => {
    const map = new Map<string, Collection & { children: Collection[] }>();
    const parent = new Map<string, string | null>();
    const siblings = new Map<string | null, string[]>();

    const sorted = [...collections].sort((a, b) => {
      const parentA = a.parent_id ?? '';
      const parentB = b.parent_id ?? '';
      if (parentA === parentB) {
        return (a.display_order ?? 0) - (b.display_order ?? 0);
      }
      return parentA.localeCompare(parentB);
    });

    sorted.forEach(collection => {
      map.set(collection.id, { ...collection, children: [] });
      parent.set(collection.id, collection.parent_id ?? null);
      const parentId = collection.parent_id ?? null;
      if (!siblings.has(parentId)) {
        siblings.set(parentId, []);
      }
      siblings.get(parentId)!.push(collection.id);
    });

    const roots: (Collection & { children: Collection[] })[] = [];

    sorted.forEach(collection => {
      const node = map.get(collection.id)!;
      if (collection.parent_id) {
        const parentNode = map.get(collection.parent_id);
        if (parentNode) {
          parentNode.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return {
      treeData: roots,
      parentMap: parent,
      siblingsMap: siblings
  };
  }, [collections]);

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

  const renderCollectionLevel = (
    nodes: (Collection & { children: Collection[] })[],
    level: number,
    parentId: string | null
  ) => {
    if (nodes.length === 0) return null;

    return (
      <SortableContext
        items={nodes.map(node => node.id)}
        strategy={verticalListSortingStrategy}
      >
        {nodes.map(node => {
          const isExpanded = expandedCollections.has(node.id);
          const isSelected = selectedCollectionId === node.id;
          const isDragOver = collectionDragState.overId === node.id;

          return (
            <div key={node.id}>
        <CollectionNode
                collection={node}
          level={level}
          isExpanded={isExpanded}
          onToggle={toggleExpanded}
          onSelect={handleSelectCollection}
          onCreateChild={onCreateCollection}
                onRename={onRenameCollection}
                onOpenDetails={onOpenCollectionDetails}
          onDelete={onDeleteCollection}
          onToggleFavorite={onToggleFavorite}
                onMove={onMoveCollection}
          isSelected={isSelected}
                isDragOver={isDragOver}
              />
              {isExpanded &&
                renderCollectionLevel(
                  node.children as (Collection & { children: Collection[] })[],
                  level + 1,
                  node.id
        )}
      </div>
    );
        })}
      </SortableContext>
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setCollectionDragState({
      activeId: String(event.active.id),
      overId: null
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    setCollectionDragState({
      overId: event.over ? String(event.over.id) : null
    });
  };

  const handleDragCancel = () => {
    setCollectionDragState({
      activeId: null,
      overId: null
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setCollectionDragState({
      activeId: null,
      overId: null
    });

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeParent = parentMap.get(activeId) ?? null;
    const overParent = parentMap.get(overId) ?? null;

    if (activeParent !== overParent) {
      // Cross-parent drops handled via moveCollection; ignore here.
      return;
    }

    const siblings = siblingsMap.get(activeParent) ?? [];
    const oldIndex = siblings.indexOf(activeId);
    const newIndex = siblings.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newOrder = [...siblings];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, activeId);

    try {
      await onReorderCollections(activeParent, newOrder);
    } catch (error) {
      console.error('Failed to reorder collections:', error);
    }
  };

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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-1">
          {renderCollectionLevel(treeData, 0, null)}
        </div>
      </DndContext>

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
