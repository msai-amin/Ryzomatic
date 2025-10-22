import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Settings, RefreshCw, Check, Trash2, Move, Share2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { librarySearchService, SearchResult } from '../services/librarySearchService';
import { libraryOrganizationService, Collection, Tag } from '../services/libraryOrganizationService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { BookCard } from './library/BookCard';
import { CollectionTree } from './library/CollectionTree';
import { TagChip, TagList, TagFilter } from './library/TagChip';
import { LibrarySearchBar } from './library/LibrarySearchBar';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  
  const {
    libraryView,
    setLibraryView,
    setSearchQuery,
    setLibraryFilters,
    setActiveCollection,
    setSelectedTags,
    toggleBookSelection,
    clearSelection
  } = useAppStore();

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, refreshTrigger]);

  // Search books when filters change
  useEffect(() => {
    if (isOpen) {
      searchBooks();
    }
  }, [libraryView.searchQuery, libraryView.filters, libraryView.sortBy, libraryView.sortOrder, isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load collections and tags in parallel
      const [collectionsData, tagsData] = await Promise.all([
        libraryOrganizationService.getCollections(),
        libraryOrganizationService.getTags()
      ]);
      
      setCollections(collectionsData);
      setTags(tagsData);
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
      const document = {
        id: bookData.id,
        name: bookData.title,
        content: (bookData.text_content || bookData.fileData || '') as string,
        type: bookData.type as 'text' | 'pdf',
        uploadedAt: bookData.savedAt,
        pdfData: bookData.type === 'pdf' ? bookData.fileData : undefined, // ArrayBuffer for PDFs
        totalPages: bookData.totalPages,
        lastReadPage: bookData.lastReadPage,
        pageTexts: sanitizePageTexts(bookData.pageTexts), // CRITICAL: Include pageTexts for TTS functionality
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
    if (confirm('Are you sure you want to delete this book?')) {
      try {
        await supabaseStorageService.deleteBook(bookId);
        setBooks(books.filter(b => b.id !== bookId));
        clearSelection();
      } catch (error) {
        console.error('Failed to delete book:', error);
        alert('Failed to delete book');
      }
    }
  }, [books, clearSelection]);

  const handleBulkAction = useCallback(async (action: string) => {
    if (libraryView.selectedBooks.length === 0) return;
    
    switch (action) {
      case 'delete':
        if (confirm(`Delete ${libraryView.selectedBooks.length} books?`)) {
          try {
            await Promise.all(libraryView.selectedBooks.map(id => supabaseStorageService.deleteBook(id)));
            setBooks(books.filter(b => !libraryView.selectedBooks.includes(b.id)));
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
    } catch (error) {
      console.error('Failed to create collection:', error);
      alert('Failed to create collection');
    }
  }, [collections]);

  const handleCreateTag = useCallback(async (name: string, color: string) => {
    try {
      const tag = await libraryOrganizationService.createTag({
        name,
        color,
        category: 'general'
      });
      
      setTags([...tags, tag]);
      setShowCreateTag(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag');
    }
  }, [tags]);

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
                  className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                >
                  Favorite
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            )}
            
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={`px-3 py-1 text-sm rounded ${
                bulkMode 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
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
          <LibrarySearchBar
            onSearch={handleSearch}
            onFiltersChange={handleFiltersChange}
            onSortChange={handleSortChange}
            onViewModeChange={handleViewModeChange}
          />
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
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <CollectionTree
                collections={collections}
                selectedCollectionId={libraryView.selectedCollectionId}
                onSelectCollection={handleCollectionSelect}
                onCreateCollection={handleCreateCollection}
                onEditCollection={(collection) => console.log('Edit collection:', collection)}
                onDeleteCollection={(id) => console.log('Delete collection:', id)}
                onToggleFavorite={(id, isFavorite) => console.log('Toggle favorite:', id, isFavorite)}
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
                  className="p-1 text-gray-400 hover:text-gray-600"
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
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
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
                <h3 className="font-medium text-gray-900">Book Details</h3>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedBook.title}</h4>
                  <p className="text-sm text-gray-500">{selectedBook.file_type.toUpperCase()}</p>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Progress</h5>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${selectedBook.reading_progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(selectedBook.reading_progress)}% complete
                  </p>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Tags</h5>
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
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Collections</h5>
                  <div className="space-y-1">
                    {selectedBook.collections.map((collection, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: collection.user_collections.color }}
                        />
                        <span className="text-sm text-gray-700">
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
      </div>
    </div>,
    document.body
  );
};
