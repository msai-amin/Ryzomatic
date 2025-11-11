import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Plus, 
  Settings, 
  RefreshCw, 
  Check, 
  Trash2, 
  Move, 
  Share2, 
  Upload,
  Palette,
  Bookmark,
  Layers,
  Sparkles,
  BookOpen,
  Tag as TagIcon,
  Folder
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { librarySearchService, SearchResult } from '../services/librarySearchService';
import { libraryOrganizationService, Collection, Tag } from '../services/libraryOrganizationService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { supabase } from '../../lib/supabase';
import { BookCard } from './library/BookCard';
import { CollectionTree } from './library/CollectionTree';
import { TagChip, TagList, TagFilter } from './library/TagChip';
import { LibrarySearchBar } from './library/LibrarySearchBar';
import { SmartCollectionItem } from './library/SmartCollectionItem';
import { RecentBookCard } from './library/RecentBookCard';
import { BulkActionsToolbar } from './library/BulkActionsToolbar';
import { DocumentUpload } from './DocumentUpload';

const COLLECTION_COLOR_OPTIONS = [
  '#3B82F6',
  '#EC4899',
  '#22C55E',
  '#F59E0B',
  '#8B5CF6',
  '#0EA5E9',
  '#F97316',
  '#14B8A6'
];

const COLLECTION_ICON_OPTIONS = [
  { value: 'folder', label: 'Folder', Icon: Folder },
  { value: 'book-open', label: 'Book', Icon: BookOpen },
  { value: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { value: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { value: 'layers', label: 'Layers', Icon: Layers },
  { value: 'tag', label: 'Tag', Icon: TagIcon }
];

type NotificationType = 'success' | 'error' | 'info';

interface LibraryNotification {
  id: string;
  type: NotificationType;
  message: string;
}

interface CollectionDetailsDialogProps {
  collection: Collection;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Collection>) => Promise<void> | void;
}

const CollectionDetailsDialog: React.FC<CollectionDetailsDialogProps> = ({
  collection,
  open,
  saving,
  onClose,
  onSave
}) => {
  const [color, setColor] = useState(collection.color);
  const [icon, setIcon] = useState(collection.icon || 'folder');

  useEffect(() => {
    if (open) {
      setColor(collection.color);
      setIcon(collection.icon || 'folder');
    }
  }, [collection, open]);

  const IconPreview = COLLECTION_ICON_OPTIONS.find(option => option.value === icon)?.Icon ?? Folder;

  const handleSubmit = async () => {
    try {
      await onSave({ color, icon });
      onClose();
    } catch (error) {
      console.error('Failed to save collection details:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-xl border shadow-xl bg-white dark:bg-slate-900"
        style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Edit Collection
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <div className="flex items-center gap-3">
            <IconPreview className="w-6 h-6" style={{ color }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{collection.name}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Choose color and icon</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Palette className="w-4 h-4" />
              Color
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {COLLECTION_COLOR_OPTIONS.map(option => (
                <button
                  key={option}
                  onClick={() => setColor(option)}
                  className={`h-10 rounded-lg border transition-transform ${
                    color === option ? 'ring-2 ring-offset-2 ring-blue-500 scale-105' : ''
                  }`}
                  style={{ backgroundColor: option, borderColor: 'rgba(0,0,0,0.1)' }}
                  aria-label={`Select color ${option}`}
                />
              ))}
            </div>
          </div>

  <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Icon
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {COLLECTION_ICON_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setIcon(option.value)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
                    icon === option.value ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-slate-800' : 'border-transparent'
                  }`}
                  style={{ color: icon === option.value ? '#2563EB' : 'var(--color-text-secondary)' }}
                >
                  <option.Icon className="w-5 h-5" />
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
interface ModernLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number;
}

export const ModernLibraryModal: React.FC<ModernLibraryModalProps> = ({
  isOpen,
  onClose,
  refreshTrigger
}) => {
  const [books, setBooks] = useState<SearchResult[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recentBooks, setRecentBooks] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collectionPickerSelection, setCollectionPickerSelection] = useState<string[]>([]);
  const [editingCollectionDetails, setEditingCollectionDetails] = useState<Collection | null>(null);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [tagManagerMode, setTagManagerMode] = useState<'assign' | 'remove' | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [showMoveCollectionModal, setShowMoveCollectionModal] = useState(false);
  const [collectionToMove, setCollectionToMove] = useState<Collection | null>(null);
  const [moveCollectionParentId, setMoveCollectionParentId] = useState<string | null>(null);
  const [isMovingCollection, setIsMovingCollection] = useState(false);
  const [notifications, setNotifications] = useState<LibraryNotification[]>([]);

  const generateNotificationId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `notice_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, [setNotifications]);

  const pushNotification = useCallback((type: NotificationType, message: string) => {
    const id = generateNotificationId();
    setNotifications(prev => [...prev, { id, type, message }]);

    const timeoutMs = type === 'error' ? 7000 : 4000;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        dismissNotification(id);
      }, timeoutMs);
    }
  }, [dismissNotification, setNotifications]);

  const refreshCollections = useCallback(async () => {
    try {
      const latestCollections = await libraryOrganizationService.getCollections();
      setCollections(latestCollections);
    } catch (refreshError) {
      console.error('Failed to refresh collections after error:', refreshError);
    }
  }, [setCollections]);

  const refreshTags = useCallback(async () => {
    try {
      const latestTags = await libraryOrganizationService.getTags();
      setTags(latestTags);
    } catch (refreshError) {
      console.error('Failed to refresh tags after error:', refreshError);
    }
  }, [setTags]);

  const getNotificationStyle = useCallback((type: NotificationType) => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          borderColor: 'rgba(34, 197, 94, 0.35)',
          textColor: '#166534'
        };
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.35)',
          textColor: '#b91c1c'
        };
      default:
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          borderColor: 'rgba(59, 130, 246, 0.35)',
          textColor: '#1d4ed8'
        };
    }
  }, []);
  
  const {
    libraryView,
    setLibraryView,
    setSearchQuery,
    setLibraryFilters,
    setActiveCollection,
    setSelectedTags,
    toggleBookSelection,
    clearSelection,
    tagManagerOpen,
    setTagManagerOpen,
    pendingAssignmentTargets,
    setPendingAssignmentTargets,
    isAuthenticated
  } = useAppStore();

  // Load initial data
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      // Small delay to ensure services are initialized with user ID
      const timer = setTimeout(() => {
        loadData();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, refreshTrigger, isAuthenticated]);

  // Search books when filters change
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      // Small delay to ensure services are initialized with user ID
      const timer = setTimeout(() => {
        searchBooks();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [libraryView.searchQuery, libraryView.filters, libraryView.sortBy, libraryView.sortOrder, isOpen, isAuthenticated]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load collections, tags, and recent books in parallel
      const [collectionsData, tagsData] = await Promise.all([
        libraryOrganizationService.getCollections(),
        libraryOrganizationService.getTags()
      ]);
      
      setCollections(collectionsData);
      setTags(tagsData);
      
      // Load recent books
      try {
        const { results } = await librarySearchService.searchBooks(
          {},
          { field: 'last_read_at', order: 'desc' },
          5
        );
        setRecentBooks(results.filter(b => b.last_read_at));
      } catch (error) {
        console.error('Failed to load recent books:', error);
      }
    } catch (err) {
      setError('Failed to load library data');
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const searchBooks = async () => {
    setIsLoading(true);
    
    try {
      const { results } = await librarySearchService.searchBooks(
        {
          searchQuery: libraryView.searchQuery,
          ...libraryView.filters
        },
        {
          field: libraryView.sortBy,
          order: libraryView.sortOrder
        },
        100, // Load more books for better UX
        null // No cursor for initial load
      );
      
      setBooks(results);
    } catch (err) {
      setError('Failed to search books');
      console.error('Error searching books:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback((query: string, filters: any) => {
    setSearchQuery(query);
    setLibraryFilters(filters);
  }, [setSearchQuery, setLibraryFilters]);

  const handleFiltersChange = useCallback((filters: any) => {
    setLibraryFilters(filters);
  }, [setLibraryFilters]);

  const handleSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setLibraryView({ sortBy: field as any, sortOrder: order });
  }, [setLibraryView]);

  const handleViewModeChange = useCallback((mode: 'grid' | 'list' | 'comfortable') => {
    setLibraryView({ viewMode: mode });
  }, [setLibraryView]);

  const handleCollectionSelect = useCallback((collectionId: string | null) => {
    setActiveCollection(collectionId);
    if (collectionId) {
      setLibraryFilters({ collections: [collectionId] });
    } else {
      setLibraryFilters({ collections: [] });
    }
  }, [setActiveCollection, setLibraryFilters]);

  const handleTagSelect = useCallback((tag: Tag) => {
    const newTags = libraryView.selectedTags.includes(tag.id)
      ? libraryView.selectedTags.filter(id => id !== tag.id)
      : [...libraryView.selectedTags, tag.id];
    
    setSelectedTags(newTags);
    setLibraryFilters({ tags: newTags });
  }, [libraryView.selectedTags, setSelectedTags, setLibraryFilters]);

  const handleTagToggle = useCallback((tagId: string) => {
    const newTags = libraryView.selectedTags.includes(tagId)
      ? libraryView.selectedTags.filter(id => id !== tagId)
      : [...libraryView.selectedTags, tagId];
    
    setSelectedTags(newTags);
    setLibraryFilters({ tags: newTags });
  }, [libraryView.selectedTags, setSelectedTags, setLibraryFilters]);

  // Helper function to sanitize pageTexts arrays
  const sanitizePageTexts = (pageTexts: any[] | undefined): string[] => {
    if (!pageTexts || !Array.isArray(pageTexts)) return [];
    return pageTexts.map(text => typeof text === 'string' ? text : String(text || ''));
  };

  const handleBookOpen = useCallback(async (book: SearchResult) => {
    try {
      setIsLoading(true);
      
      // Fetch the full book data from storage
      const bookData = await supabaseStorageService.getBook(book.id);
      
      if (!bookData) {
        throw new Error('Book not found');
      }

      // Convert to Document format
      const cleanedPageTexts = sanitizePageTexts(bookData.pageTexts);
      const combinedContent =
        cleanedPageTexts.length > 0
          ? cleanedPageTexts.join('\n\n')
          : typeof bookData.text_content === 'string'
            ? bookData.text_content
            : typeof bookData.fileData === 'string'
              ? bookData.fileData
              : '';

      const document = {
        id: bookData.id,
        name: bookData.title,
        content: combinedContent,
        type: bookData.type as 'text' | 'pdf' | 'epub',
        uploadedAt: bookData.savedAt,
        pdfData: bookData.type === 'pdf' ? bookData.fileData : undefined,
        epubData:
          bookData.type === 'epub' && bookData.fileData instanceof ArrayBuffer
            ? new Blob([bookData.fileData], { type: 'application/epub+zip' })
            : undefined,
        totalPages: bookData.totalPages,
        lastReadPage: bookData.lastReadPage,
        pageTexts: cleanedPageTexts,
        cleanedPageTexts: bookData.cleanedPageTexts || cleanedPageTexts
      };

      // Set the current document and close the library
      useAppStore.getState().setCurrentDocument(document as any);
      onClose();
    } catch (error) {
      console.error('Failed to open book:', error);
      setError('Failed to open book. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  const handleBookEdit = useCallback((book: SearchResult) => {
    setSelectedBook(book);
    // Show edit modal or inline editing
  }, []);

  const handleBookDelete = useCallback(async (bookId: string) => {
    try {
      await supabaseStorageService.deleteBook(bookId);
      // Refresh the books list after deletion
      await searchBooks();
      clearSelection();
    } catch (error) {
      console.error('Failed to delete book:', error);
      alert('Failed to delete book');
    }
  }, [searchBooks, clearSelection]);

  const handleBulkAction = useCallback(async (action: string) => {
    if (libraryView.selectedBooks.length === 0) return;
    
    switch (action) {
      case 'delete':
        if (confirm(`Delete ${libraryView.selectedBooks.length} books?`)) {
          try {
            await Promise.all(libraryView.selectedBooks.map(id => supabaseStorageService.deleteBook(id)));
            // Refresh the books list after deletion
            await searchBooks();
            clearSelection();
          } catch (error) {
            console.error('Failed to delete books:', error);
            alert('Failed to delete some books');
          }
        }
        break;
      case 'favorite':
        try {
          await Promise.all(libraryView.selectedBooks.map(id => 
            supabaseStorageService.updateBookMetadata(id, { is_favorite: true })
          ));
          // Refresh books to show updated favorites
          searchBooks();
          clearSelection();
        } catch (error) {
          console.error('Failed to favorite books:', error);
          alert('Failed to favorite some books');
        }
        break;
    }
  }, [libraryView.selectedBooks, books, clearSelection, searchBooks]);

  const handleCreateCollection = useCallback(async (name: string, parentId?: string) => {
    try {
      const collection = await libraryOrganizationService.createCollection({
        name,
        parent_id: parentId,
        color: '#3B82F6',
        icon: 'folder',
        is_favorite: false,
        display_order: 0
      });
      
      setCollections([...collections, collection]);
      setShowCreateCollection(false);
      pushNotification('success', 'Collection created successfully.');
    } catch (error) {
      console.error('Failed to create collection:', error);
      pushNotification('error', 'Failed to create collection. Please try again.');
      await refreshCollections();
    }
  }, [collections, pushNotification, refreshCollections]);

  const handleCreateTag = useCallback(async (name: string, color: string) => {
    try {
      const tag = await libraryOrganizationService.createTag({
        name,
        color,
        category: 'general'
      });
      
      setTags([...tags, tag]);
      setShowCreateTag(false);
      pushNotification('success', 'Tag created successfully.');
    } catch (error) {
      console.error('Failed to create tag:', error);
      pushNotification('error', 'Failed to create tag. Please try again.');
      await refreshTags();
    }
  }, [tags, pushNotification, refreshTags]);

  const handleSmartCollectionSelect = useCallback((collectionId: string) => {
    handleCollectionSelect(collectionId);
  }, [handleCollectionSelect]);

  const handleStartMoveCollection = useCallback((collectionId: string) => {
    const target = collections.find(collection => collection.id === collectionId);
    if (!target) {
      return;
    }

    setCollectionToMove(target);
    setMoveCollectionParentId(target.parent_id ?? null);
    setShowMoveCollectionModal(true);
  }, [collections]);

  const handleCloseMoveCollectionModal = useCallback(() => {
    setShowMoveCollectionModal(false);
    setCollectionToMove(null);
    setMoveCollectionParentId(null);
    setIsMovingCollection(false);
  }, []);

  const handleSubmitMoveCollection = useCallback(async () => {
    if (!collectionToMove) {
      return;
    }

    const originalParentId = collectionToMove.parent_id ?? null;
    if (originalParentId === moveCollectionParentId) {
      handleCloseMoveCollectionModal();
      return;
    }

    setIsMovingCollection(true);
    try {
      await libraryOrganizationService.moveCollection(collectionToMove.id, moveCollectionParentId);
      await refreshCollections();
      pushNotification('success', 'Collection moved.');
      handleCloseMoveCollectionModal();
    } catch (error) {
      console.error('Failed to move collection:', error);
      pushNotification('error', 'Failed to move collection. Please try again.');
      await refreshCollections();
      setIsMovingCollection(false);
    }
  }, [collectionToMove, moveCollectionParentId, refreshCollections, pushNotification, handleCloseMoveCollectionModal]);

  const flattenedCollections = useMemo(() => {
    const map = new Map<string, Collection[]>();
    const ordered: Array<{ collection: Collection; depth: number }> = [];

    collections.forEach(collection => {
      const parentKey = collection.parent_id ?? 'root';
      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }
      map.get(parentKey)!.push(collection);
    });

    const sortByDisplay = (a: Collection, b: Collection) =>
      (a.display_order ?? 0) - (b.display_order ?? 0);

    const traverse = (parentId: string | null, depth: number) => {
      const key = parentId ?? 'root';
      const siblings = (map.get(key) || []).sort(sortByDisplay);
      siblings.forEach(collection => {
        ordered.push({ collection, depth });
        traverse(collection.id, depth + 1);
      });
    };

    traverse(null, 0);
    return ordered;
  }, [collections]);

  const moveCollectionOptions = useMemo(
    () => flattenedCollections.filter(({ collection }) => !collection.is_smart),
    [flattenedCollections]
  );

  const blockedCollectionIds = useMemo(() => {
    if (!collectionToMove) {
      return new Set<string>();
    }

    const blocked = new Set<string>([collectionToMove.id]);
    const stack = [collectionToMove.id];

    while (stack.length > 0) {
      const current = stack.pop()!;
      collections.forEach(candidate => {
        if (!candidate.is_smart && candidate.parent_id === current && !blocked.has(candidate.id)) {
          blocked.add(candidate.id);
          stack.push(candidate.id);
        }
      });
    }

    return blocked;
  }, [collectionToMove, collections]);

  const availableMoveOptions = useMemo(() => {
    if (!collectionToMove) {
      return moveCollectionOptions;
    }
    return moveCollectionOptions.filter(({ collection }) => collection.id !== collectionToMove.id);
  }, [moveCollectionOptions, collectionToMove]);

  const moveSelectionChanged = useMemo(() => {
    if (!collectionToMove) {
      return false;
    }
    return (collectionToMove.parent_id ?? null) !== moveCollectionParentId;
  }, [collectionToMove, moveCollectionParentId]);

  const handleRenameCollection = useCallback(async (collectionId: string, name: string) => {
    try {
      await libraryOrganizationService.updateCollection(collectionId, { name });
      setCollections(prev =>
        prev.map(collection =>
          collection.id === collectionId ? { ...collection, name } : collection
        )
      );
    } catch (error) {
      console.error('Failed to rename collection:', error);
      pushNotification('error', 'Failed to rename collection. Changes were not saved.');
      await refreshCollections();
      throw error;
    }
  }, [pushNotification, refreshCollections]);

  const handleReorderCollections = useCallback(async (parentId: string | null, orderedIds: string[]) => {
    try {
      await libraryOrganizationService.reorderCollections(parentId, orderedIds);
      setCollections(prev =>
        prev.map(collection => {
          if ((collection.parent_id ?? null) === (parentId ?? null)) {
            const index = orderedIds.indexOf(collection.id);
            if (index !== -1) {
              return { ...collection, display_order: index };
            }
          }
          return collection;
        })
      );
    } catch (error) {
      console.error('Failed to reorder collections:', error);
      pushNotification('error', 'Failed to reorder collections. Display refreshed to match the server.');
      await refreshCollections();
    }
  }, [pushNotification, refreshCollections]);

  const handleOpenCollectionDetails = useCallback((collection: Collection) => {
    setEditingCollectionDetails(collection);
  }, []);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    const confirmed = window.confirm('Delete this collection? Books inside will remain in your library.');
    if (!confirmed) return;

    try {
      await libraryOrganizationService.deleteCollection(collectionId);
      setCollections(prev => prev.filter(collection => collection.id !== collectionId));
      if (libraryView.selectedCollectionId === collectionId) {
        setActiveCollection(null);
        setLibraryFilters({ collections: [] });
      }
      pushNotification('success', 'Collection deleted.');
    } catch (error) {
      console.error('Failed to delete collection:', error);
      pushNotification('error', 'Failed to delete collection. Please try again.');
      await refreshCollections();
    }
  }, [libraryView.selectedCollectionId, setActiveCollection, setLibraryFilters, pushNotification, refreshCollections]);

  const handleToggleCollectionFavorite = useCallback(async (collectionId: string, isFavorite: boolean) => {
    try {
      await libraryOrganizationService.updateCollection(collectionId, { is_favorite: isFavorite });
      setCollections(prev =>
        prev.map(collection =>
          collection.id === collectionId ? { ...collection, is_favorite: isFavorite } : collection
        )
      );
    } catch (error) {
      console.error('Failed to update collection favorite status:', error);
      pushNotification('error', 'Failed to update collection favorite status.');
      await refreshCollections();
    }
  }, [pushNotification, refreshCollections]);

  const handleBulkAddToCollection = useCallback(() => {
    setCollectionPickerSelection([]);
    setShowCollectionPicker(true);
  }, []);

  const handleBulkAddTags = useCallback(() => {
    setTagManagerMode('assign');
    setSelectedTagIds([]);
    setTagManagerOpen(true);
  }, [setTagManagerOpen]);

  const handleBulkRemoveTags = useCallback(() => {
    setTagManagerMode('remove');
    setSelectedTagIds([]);
    setTagManagerOpen(true);
  }, [setTagManagerOpen]);

  const handleSaveCollectionDetails = useCallback(async (updates: Partial<Collection>) => {
    if (!editingCollectionDetails) return;

    setIsSavingCollection(true);
    try {
      await libraryOrganizationService.updateCollection(editingCollectionDetails.id, updates);
      setCollections(prev =>
        prev.map(collection =>
          collection.id === editingCollectionDetails.id
            ? { ...collection, ...updates }
            : collection
        )
      );
      setEditingCollectionDetails(prev =>
        prev ? { ...prev, ...updates } : prev
      );
      pushNotification('success', 'Collection details updated.');
    } catch (error) {
      console.error('Failed to update collection details:', error);
      pushNotification('error', 'Failed to update collection details. Display refreshed to match the server.');
      await refreshCollections();
    } finally {
      setIsSavingCollection(false);
    }
  }, [editingCollectionDetails, pushNotification, refreshCollections]);

  const handleApplyCollectionAssignment = useCallback(async () => {
    if (collectionPickerSelection.length === 0 || libraryView.selectedBooks.length === 0) {
      setShowCollectionPicker(false);
      setCollectionPickerSelection([]);
      return;
    }

    try {
      await Promise.all(
        collectionPickerSelection.flatMap(collectionId =>
          libraryView.selectedBooks.map(bookId =>
            libraryOrganizationService
              .addBookToCollection(bookId, collectionId)
              .catch(error => {
                const message = (error as Error)?.message ?? '';
                if (message.includes('duplicate')) {
                  return;
                }
                throw error;
              })
          )
        )
      );
      await searchBooks();
      clearSelection();
      setShowCollectionPicker(false);
      setCollectionPickerSelection([]);
    } catch (error) {
      console.error('Failed to assign collection:', error);
      alert('Failed to assign collection');
    }
  }, [collectionPickerSelection, libraryView.selectedBooks, searchBooks, clearSelection]);

  const toggleCollectionSelection = useCallback((collectionId: string) => {
    setCollectionPickerSelection(prev =>
      prev.includes(collectionId)
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  }, []);

  const toggleSelectedTag = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const handleApplyTags = useCallback(async () => {
    if (!tagManagerMode || libraryView.selectedBooks.length === 0) {
      setTagManagerOpen(false);
      setTagManagerMode(null);
      setSelectedTagIds([]);
      return;
    }

    if (selectedTagIds.length === 0) {
      setTagManagerOpen(false);
      setTagManagerMode(null);
      return;
    }

    setIsApplyingTags(true);
    try {
      if (tagManagerMode === 'assign') {
        await libraryOrganizationService.batchAddTags(libraryView.selectedBooks, selectedTagIds);
      } else {
        await libraryOrganizationService.batchRemoveTags(libraryView.selectedBooks, selectedTagIds);
      }
      await searchBooks();
      clearSelection();
      setTagManagerOpen(false);
      setTagManagerMode(null);
      setSelectedTagIds([]);
    } catch (error) {
      console.error('Failed to update tags:', error);
      alert('Failed to update tags');
    } finally {
      setIsApplyingTags(false);
    }
  }, [tagManagerMode, selectedTagIds, libraryView.selectedBooks, searchBooks, clearSelection, setTagManagerOpen]);

  const handleBulkToggleFavorite = useCallback(async (isFavorite: boolean) => {
    try {
      await libraryOrganizationService.batchToggleFavorite(libraryView.selectedBooks, isFavorite);
      searchBooks();
      clearSelection();
    } catch (error) {
      console.error('Failed to bulk toggle favorite:', error);
      alert('Failed to update favorites');
    }
  }, [libraryView.selectedBooks, searchBooks, clearSelection]);

  const handleBulkArchive = useCallback(async () => {
    try {
      await libraryOrganizationService.batchArchive(libraryView.selectedBooks);
      searchBooks();
      clearSelection();
    } catch (error) {
      console.error('Failed to bulk archive:', error);
      alert('Failed to archive books');
    }
  }, [libraryView.selectedBooks, searchBooks, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    console.log('ModernLibraryModal: handleBulkDelete called with books:', libraryView.selectedBooks);
    try {
      // Get current user ID
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get Trash collection ID to check if books are in Trash
      const { data: trashCollection } = await supabase
        .from('user_collections')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('name', 'Trash')
        .maybeSingle();
      
      const trashCollectionId = trashCollection?.id;
      console.log('ModernLibraryModal: Trash collection ID:', trashCollectionId);
      
      // Check which books are in Trash
      const { data: bookCollections } = await supabase
        .from('book_collections')
        .select('book_id, collection_id')
        .in('book_id', libraryView.selectedBooks);
      
      const booksInTrash = new Set(
        (bookCollections || [])
          .filter(bc => bc.collection_id === trashCollectionId)
          .map(bc => bc.book_id)
      );
      
      console.log('ModernLibraryModal: Books in Trash:', Array.from(booksInTrash));
      console.log('ModernLibraryModal: Starting deletion of', libraryView.selectedBooks.length, 'books');
      
      await Promise.all(
        libraryView.selectedBooks.map(async (bookId) => {
          console.log('ModernLibraryModal: Processing book:', bookId, 'inTrash:', booksInTrash.has(bookId));
          try {
            if (booksInTrash.has(bookId)) {
              // Permanently delete if in Trash
              console.log('ModernLibraryModal: Permanently deleting book from Trash:', bookId);
              await supabaseStorageService.permanentlyDeleteBook(bookId);
              console.log('ModernLibraryModal: Successfully permanently deleted book:', bookId);
            } else {
              // Move to Trash if not in Trash
              console.log('ModernLibraryModal: Moving book to Trash:', bookId);
              await supabaseStorageService.deleteBook(bookId);
              console.log('ModernLibraryModal: Successfully moved book to Trash:', bookId);
            }
          } catch (error) {
            console.error('ModernLibraryModal: Failed to delete book:', bookId, error);
            throw error;
          }
        })
      );
      
      console.log('ModernLibraryModal: All books processed successfully');
      // Refresh the books list after deletion
      await searchBooks();
      clearSelection();
      console.log('ModernLibraryModal: Library refreshed after deletion');
    } catch (error) {
      console.error('ModernLibraryModal: Failed to bulk delete:', error);
      console.error('ModernLibraryModal: Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      alert(`Failed to delete books: ${error?.message || 'Unknown error'}`);
    }
  }, [libraryView.selectedBooks, searchBooks, clearSelection]);

  const handleEmptyTrash = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete all books in Trash? This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      console.log('ModernLibraryModal: Emptying Trash');
      const result = await supabaseStorageService.emptyTrash();
      console.log('ModernLibraryModal: Trash emptied, deleted count:', result.deletedCount);
      
      // Refresh the books list
      await searchBooks();
      clearSelection();
      
      alert(`Successfully deleted ${result.deletedCount} book(s) from Trash.`);
    } catch (error) {
      console.error('ModernLibraryModal: Failed to empty Trash:', error);
      alert(`Failed to empty Trash: ${error?.message || 'Unknown error'}`);
    }
  }, [searchBooks, clearSelection]);

  const handleBulkExport = useCallback(async () => {
    try {
      const data = await libraryOrganizationService.batchExport(libraryView.selectedBooks);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `books_export_${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to bulk export:', error);
      alert('Failed to export books');
    }
  }, [libraryView.selectedBooks]);

  const handleBulkDetectDuplicates = useCallback(async () => {
    if (libraryView.selectedBooks.length !== 1) {
      alert('Please select exactly one book to detect duplicates');
      return;
    }
    try {
      const duplicates = await libraryOrganizationService.detectDuplicates(libraryView.selectedBooks[0]);
      if (duplicates.length > 0) {
        alert(`Found ${duplicates.length} potential duplicates`);
        console.log('Duplicates:', duplicates);
      } else {
        alert('No duplicates found');
      }
    } catch (error) {
      console.error('Failed to detect duplicates:', error);
      alert('Failed to detect duplicates');
    }
  }, [libraryView.selectedBooks]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 animate-fadeIn library-modal-overlay"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-7xl h-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col animate-scaleIn"
        style={{
          backgroundColor: 'var(--color-background)',
          border: '2px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-4">
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              📚 Library
            </h2>
            {libraryView.selectedBooks.length > 0 && (
              <div className="flex items-center gap-2">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {libraryView.selectedBooks.length} selected
                </span>
                <button
                  onClick={() => clearSelection()}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {bulkMode && libraryView.selectedBooks.length > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={() => handleBulkAction('favorite')}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: 'rgba(250, 204, 21, 0.1)',
                    color: 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(250, 204, 21, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(250, 204, 21, 0.1)';
                  }}
                >
                  Favorite
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: 'var(--color-error-light, rgba(239, 68, 68, 0.1))',
                    color: 'var(--color-error)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-error-light, rgba(239, 68, 68, 0.2))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-error-light, rgba(239, 68, 68, 0.1))';
                  }}
                >
                  Delete
                </button>
              </div>
            )}
            
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className="px-3 py-1 text-sm rounded transition-colors"
              style={{
                backgroundColor: bulkMode ? 'var(--color-primary-light, rgba(37, 99, 235, 0.1))' : 'var(--color-surface)',
                color: bulkMode ? 'var(--color-primary)' : 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                if (!bulkMode) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!bulkMode) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                }
              }}
            >
              {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
            </button>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            
            <button
              onClick={onClose}
              className="p-2 rounded transition-colors"
              style={{ 
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              aria-label="Close Library"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div 
          className="p-6 border-b"
          style={{
            backgroundColor: 'var(--color-background)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <LibrarySearchBar
                onSearch={handleSearch}
                onFiltersChange={handleFiltersChange}
                onSortChange={handleSortChange}
                onViewModeChange={handleViewModeChange}
              />
            </div>
            {/* Empty Trash button - shown when Trash collection is selected */}
            {collections.find(c => c.id === libraryView.selectedCollectionId && c.name === 'Trash') && (
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 text-sm rounded transition-colors flex items-center gap-2 whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--color-error-light, rgba(239, 68, 68, 0.1))',
                  color: 'var(--color-error)',
                  border: '1px solid var(--color-error-light, rgba(239, 68, 68, 0.3))'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-light, rgba(239, 68, 68, 0.2))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-light, rgba(239, 68, 68, 0.1))';
                }}
                title="Permanently delete all books in Trash"
              >
                <Trash2 className="w-4 h-4" />
                Empty Trash
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <div 
            className="w-80 border-r flex flex-col overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            {notifications.length > 0 && (
              <div
                className="p-4 border-b space-y-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {notifications.map(notification => {
                  const style = getNotificationStyle(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className="flex items-start justify-between gap-3 rounded-md text-sm"
                      style={{
                        backgroundColor: style.backgroundColor,
                        border: `1px solid ${style.borderColor}`,
                        color: style.textColor,
                        padding: '0.75rem'
                      }}
                    >
                      <span className="flex-1">{notification.message}</span>
                      <button
                        onClick={() => dismissNotification(notification.id)}
                        className="p-1 rounded transition-colors"
                        style={{ color: style.textColor }}
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Smart Collections */}
            {collections.filter(c => c.is_smart).length > 0 && (
              <div 
                className="p-4 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 
                    className="font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    ✨ Smart Collections
                  </h3>
                </div>
                <div className="space-y-1">
                  {collections.filter(c => c.is_smart).map(collection => (
                    <SmartCollectionItem
                      key={collection.id}
                      collection={collection}
                      isActive={libraryView.selectedCollectionId === collection.id}
                      onClick={() => handleSmartCollectionSelect(collection.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Collections */}
            <div 
              className="p-4 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 
                  className="font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  📁 Collections
                </h3>
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <CollectionTree
                collections={collections.filter(c => !c.is_smart)}
                selectedCollectionId={libraryView.selectedCollectionId}
                onSelectCollection={handleCollectionSelect}
                onCreateCollection={handleCreateCollection}
                onRenameCollection={handleRenameCollection}
                onOpenCollectionDetails={handleOpenCollectionDetails}
                onDeleteCollection={handleDeleteCollection}
                onToggleFavorite={handleToggleCollectionFavorite}
                onReorderCollections={handleReorderCollections}
                onMoveCollection={handleStartMoveCollection}
              />
            </div>

            {/* Tags */}
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 
                  className="font-medium"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  🏷️ Tags
                </h3>
                <button
                  onClick={() => setShowCreateTag(true)}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <TagFilter
                tags={tags}
                selectedTags={libraryView.selectedTags}
                onTagToggle={handleTagToggle}
                onClearAll={() => setSelectedTags([])}
              />
            </div>
          </div>

          {/* Center content */}
          <div 
            className="flex-1 flex flex-col"
            style={{ backgroundColor: 'var(--color-background)' }}
          >
            {/* Books grid/list */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Recently Read Section */}
              {!libraryView.searchQuery && !libraryView.selectedCollectionId && recentBooks.length > 0 && (
                <div className="mb-6">
                  <h2 
                    className="text-lg font-semibold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    📖 Recently Read
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {recentBooks.map(book => (
                      <RecentBookCard
                        key={book.id}
                        book={book}
                        onOpen={handleBookOpen}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <p 
                      className="mb-4"
                      style={{ color: 'var(--color-error)' }}
                    >
                      {error}
                    </p>
                    <button
                      onClick={loadData}
                      className="px-4 py-2 rounded transition-colors"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-inverse)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : books.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <p 
                      className="text-lg font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      No books found
                    </p>
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Try adjusting your search or filters
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 ${
                  libraryView.viewMode === 'grid' 
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : libraryView.viewMode === 'comfortable'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1'
                }`}>
                  {books.map(book => (
                    <BookCard
                      key={book.id}
                      book={book}
                      viewMode={libraryView.viewMode}
                      isSelected={libraryView.selectedBooks.includes(book.id)}
                      onSelect={toggleBookSelection}
                      onOpen={handleBookOpen}
                      onEdit={handleBookEdit}
                      onDelete={handleBookDelete}
                      onMove={(id) => console.log('Move book:', id)}
                      onShare={(book) => console.log('Share book:', book)}
                      onToggleFavorite={(id, isFavorite) => console.log('Toggle favorite:', id, isFavorite)}
                      showActions={!bulkMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Book details */}
          {selectedBook && (
            <div 
              className="w-80 border-l p-6 overflow-y-auto"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Book Details</h3>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{selectedBook.title}</h4>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{selectedBook.file_type.toUpperCase()}</p>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Progress</h5>
                  <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${selectedBook.reading_progress}%`,
                        backgroundColor: 'var(--color-primary)'
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {Math.round(selectedBook.reading_progress)}% complete
                  </p>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Tags</h5>
                  <TagList
                    tags={selectedBook.tags.map(t => ({
                      id: t.tag_id,
                      name: t.book_tags.name,
                      color: t.book_tags.color,
                      category: t.book_tags.category,
                      usage_count: 0,
                      user_id: '',
                      created_at: '',
                      updated_at: ''
                    }))}
                    selectedTags={[]}
                    onTagSelect={() => {}}
                    showCount={false}
                  />
                </div>
                
                <div>
                  <h5 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Collections</h5>
                  <div className="space-y-1">
                    {selectedBook.collections.map((collection, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: collection.user_collections.color }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {collection.user_collections.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Toolbar */}
        {libraryView.selectedBooks.length > 0 && (
          <BulkActionsToolbar
            selectedCount={libraryView.selectedBooks.length}
            onAddToCollection={handleBulkAddToCollection}
            onAddTags={handleBulkAddTags}
            onRemoveTags={handleBulkRemoveTags}
            onToggleFavorite={handleBulkToggleFavorite}
            onArchive={handleBulkArchive}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onDetectDuplicates={handleBulkDetectDuplicates}
            onClearSelection={clearSelection}
          />
        )}

        {/* Collection assignment picker */}
        {showCollectionPicker && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div
              className="w-full max-w-md rounded-xl border shadow-xl"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Add to Collections
                </h2>
                <button
                  onClick={() => {
                    setShowCollectionPicker(false);
                    setCollectionPickerSelection([]);
                  }}
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-4 space-y-1">
                {flattenedCollections.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
                    No collections yet. Create one from the sidebar.
                  </p>
                )}
                {flattenedCollections.map(({ collection, depth }) => (
                  <label
                    key={collection.id}
                    className="flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={collectionPickerSelection.includes(collection.id)}
                      onChange={() => toggleCollectionSelection(collection.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm" style={{ paddingLeft: depth * 12 }}>
                      {collection.name}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => {
                    setShowCollectionPicker(false);
                    setCollectionPickerSelection([]);
                  }}
                  className="px-4 py-2 text-sm rounded-md border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCollectionAssignment}
                  disabled={collectionPickerSelection.length === 0}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move collection modal */}
        {showMoveCollectionModal && collectionToMove && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div
              className="w-full max-w-md rounded-xl border shadow-xl"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Move “{collectionToMove.name}”
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Choose a new parent collection
                  </p>
                </div>
                <button
                  onClick={handleCloseMoveCollectionModal}
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                  aria-label="Close move collection modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-4 space-y-2">
                <label
                  className="flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer"
                  style={{ color: 'var(--color-text-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="radio"
                    name="move-parent"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={moveCollectionParentId === null}
                    onChange={() => setMoveCollectionParentId(null)}
                  />
                  <span className="flex-1 text-sm">
                    Top level (no parent)
                  </span>
                </label>

                {availableMoveOptions.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
                    No other collections available.
                  </p>
                )}

                {availableMoveOptions.map(({ collection, depth }) => {
                  const isBlocked = blockedCollectionIds.has(collection.id);
                  return (
                    <label
                      key={collection.id}
                      className="flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer"
                      style={{
                        color: isBlocked ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                        opacity: isBlocked ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isBlocked) {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <input
                        type="radio"
                        name="move-parent"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={moveCollectionParentId === collection.id}
                        onChange={() => setMoveCollectionParentId(collection.id)}
                        disabled={isBlocked}
                      />
                      <span className="flex-1 text-sm" style={{ paddingLeft: depth * 12 }}>
                        {collection.name}
                      </span>
                      {isBlocked && (
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          (descendant)
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={handleCloseMoveCollectionModal}
                  className="px-4 py-2 text-sm rounded-md border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  disabled={isMovingCollection}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitMoveCollection}
                  disabled={isMovingCollection || !moveSelectionChanged}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isMovingCollection ? 'Moving…' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tag manager */}
        {tagManagerOpen && tagManagerMode && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div
              className="w-full max-w-md rounded-xl border shadow-xl"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {tagManagerMode === 'assign' ? 'Add Tags' : 'Remove Tags'}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {libraryView.selectedBooks.length} document(s) selected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTagManagerOpen(false);
                    setTagManagerMode(null);
                    setSelectedTagIds([]);
                  }}
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-4 space-y-1">
                {tags.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
                    No tags yet. Create one below.
                  </p>
                )}
                {tags.map(tag => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 px-2 py-1 rounded transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => toggleSelectedTag(tag.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm">{tag.name}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      ({tag.usage_count})
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => {
                    setShowCreateTag(true);
                    setTagManagerOpen(false);
                  }}
                  className="px-3 py-2 text-sm rounded-md border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  + New Tag
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTagManagerOpen(false);
                      setTagManagerMode(null);
                      setSelectedTagIds([]);
                    }}
                    className="px-4 py-2 text-sm rounded-md border"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyTags}
                    disabled={selectedTagIds.length === 0 || isApplyingTags}
                    className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isApplyingTags
                      ? 'Applying...'
                      : tagManagerMode === 'assign'
                        ? 'Add Tags'
                        : 'Remove Tags'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingCollectionDetails && (
          <CollectionDetailsDialog
            collection={editingCollectionDetails}
            open={!!editingCollectionDetails}
            saving={isSavingCollection}
            onClose={() => setEditingCollectionDetails(null)}
            onSave={handleSaveCollectionDetails}
          />
        )}
      </div>

      {/* Document Upload Modal */}
      {showUploadModal && (
        <DocumentUpload
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            setShowUploadModal(false);
            loadData();
          }}
          setAsCurrentDocument={false}
        />
      )}
    </div>,
    document.body
  );
};
