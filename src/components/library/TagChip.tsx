import React, { useState } from 'react';
import { X, Edit3, Trash2, MoreVertical } from 'lucide-react';
import { Tag } from '../../services/libraryOrganizationService';

interface TagChipProps {
  tag: Tag;
  isSelected?: boolean;
  isRemovable?: boolean;
  isEditable?: boolean;
  showCount?: boolean;
  onSelect?: (tag: Tag) => void;
  onRemove?: (tagId: string) => void;
  onEdit?: (tag: Tag) => void;
  onDelete?: (tagId: string) => void;
  className?: string;
}

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  isSelected = false,
  isRemovable = false,
  isEditable = false,
  showCount = false,
  onSelect,
  onRemove,
  onEdit,
  onDelete,
  className = ''
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onSelect) {
      onSelect(tag);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(tag.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditable) {
      setShowContextMenu(true);
    }
  };

  const handleAction = (action: string) => {
    setShowContextMenu(false);
    switch (action) {
      case 'edit':
        onEdit?.(tag);
        break;
      case 'delete':
        onDelete?.(tag.id);
        break;
    }
  };

  return (
    <div className="relative">
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'ring-2 ring-offset-1' 
            : 'hover:shadow-sm'
        } ${className}`}
        style={{
          backgroundColor: isSelected ? tag.color + '20' : tag.color + '15',
          color: tag.color,
          border: `1px solid ${tag.color}40`,
          boxShadow: isSelected ? `0 0 0 2px ${tag.color}40` : undefined
        }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {/* Tag name */}
        <span className="truncate max-w-32">{tag.name}</span>
        
        {/* Usage count */}
        {showCount && (
          <span 
            className="px-1 py-0.5 rounded-full text-xs"
            style={{
              backgroundColor: tag.color + '30',
              color: tag.color
            }}
          >
            {tag.usage_count}
          </span>
        )}

        {/* Remove button */}
        {isRemovable && onRemove && (
          <button
            onClick={handleRemove}
            className="ml-1 p-0.5 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
            style={{ color: tag.color }}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* More actions button (for editable tags) */}
        {isEditable && isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(true);
            }}
            className="ml-1 p-0.5 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors"
            style={{ color: tag.color }}
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Context menu */}
      {showContextMenu && isEditable && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border z-50">
          <button
            onClick={() => handleAction('edit')}
            className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={() => handleAction('delete')}
            className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

interface TagListProps {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tag: Tag) => void;
  onTagRemove?: (tagId: string) => void;
  onTagEdit?: (tag: Tag) => void;
  onTagDelete?: (tagId: string) => void;
  showCount?: boolean;
  isEditable?: boolean;
  maxVisible?: number;
  className?: string;
}

export const TagList: React.FC<TagListProps> = ({
  tags,
  selectedTags,
  onTagSelect,
  onTagRemove,
  onTagEdit,
  onTagDelete,
  showCount = false,
  isEditable = false,
  maxVisible = 10,
  className = ''
}) => {
  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleTags.map(tag => (
        <TagChip
          key={tag.id}
          tag={tag}
          isSelected={selectedTags.includes(tag.id)}
          isRemovable={!!onTagRemove}
          isEditable={isEditable}
          showCount={showCount}
          onSelect={onTagSelect}
          onRemove={onTagRemove}
          onEdit={onTagEdit}
          onDelete={onTagDelete}
        />
      ))}
      
      {remainingCount > 0 && (
        <div className="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
          +{remainingCount} more
        </div>
      )}
    </div>
  );
};

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onTagToggle: (tagId: string) => void;
  onClearAll: () => void;
  className?: string;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  tags,
  selectedTags,
  onTagToggle,
  onClearAll,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear all
          </button>
        )}
      </div>
      
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {tags.map(tag => (
          <label
            key={tag.id}
            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedTags.includes(tag.id)}
              onChange={() => onTagToggle(tag.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span className="text-sm text-gray-700 flex-1">{tag.name}</span>
            <span className="text-xs text-gray-500">({tag.usage_count})</span>
          </label>
        ))}
      </div>
    </div>
  );
};
