import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Collection } from '../../services/libraryOrganizationService';
import { libraryOrganizationService } from '../../services/libraryOrganizationService';

interface SmartCollectionItemProps {
  collection: Collection;
  isActive: boolean;
  onClick: () => void;
}

export const SmartCollectionItem: React.FC<SmartCollectionItemProps> = ({
  collection,
  isActive,
  onClick
}) => {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        setIsLoading(true);
        const books = await libraryOrganizationService.getSmartCollectionBooks(collection.id);
        setCount(books.length);
      } catch (error) {
        console.error('Failed to load smart collection count:', error);
        setCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    if (collection.id) {
      loadCount();
    }
  }, [collection.id]);

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between w-full p-2 rounded transition-colors ${
        isActive 
          ? 'bg-blue-50 dark:bg-blue-900/20' 
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      style={{
        borderLeft: isActive ? `3px solid ${collection.color}` : '3px solid transparent'
      }}
      title={collection.description || collection.name}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Sparkles 
          className="w-4 h-4 flex-shrink-0" 
          style={{ color: collection.color || '#8B5CF6' }} 
        />
        <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
          {collection.name}
        </span>
      </div>
      {isLoading ? (
        <span className="text-xs text-gray-400">...</span>
      ) : (
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800" style={{ color: 'var(--color-text-secondary)' }}>
          {count}
        </span>
      )}
    </button>
  );
};

