import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Clock, 
  Filter, 
  SortAsc, 
  SortDesc,
  Grid3X3,
  List,
  LayoutGrid
} from 'lucide-react';
import { librarySearchService, SearchSuggestions } from '../../services/librarySearchService';
import { useAppStore } from '../../store/appStore';
import { LibraryFilters } from '../../store/appStore';

interface LibrarySearchBarProps {
  onSearch: (query: string, filters: LibraryFilters) => void;
  onFiltersChange: (filters: LibraryFilters) => void;
  onSortChange: (field: string, order: 'asc' | 'desc') => void;
  onViewModeChange: (mode: 'grid' | 'list' | 'comfortable') => void;
  className?: string;
}

export const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({
  onSearch,
  onFiltersChange,
  onSortChange,
  onViewModeChange,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestions>({
    recentSearches: [],
    popularTags: [],
    collections: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const { 
    libraryView, 
    setSearchQuery, 
    setLibrarySort, 
    setLibraryView,
    isAuthenticated
  } = useAppStore();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== libraryView.searchQuery) {
        setSearchQuery(query);
        onSearch(query, libraryView.filters);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, libraryView.filters, onSearch, setSearchQuery, libraryView.searchQuery]);

  // Load suggestions when component mounts and user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      return; // Don't load suggestions if user is not authenticated
    }

    const loadSuggestions = async () => {
      try {
        const data = await librarySearchService.getSearchSuggestions();
        setSuggestions(data);
      } catch (error) {
        console.error('Failed to load search suggestions:', error);
      }
    };

    loadSuggestions();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleFocusRequest = () => {
      if (searchRef.current) {
        searchRef.current.focus();
        requestAnimationFrame(() => searchRef.current?.select());
      }
    };

    window.addEventListener('library:focus-search', handleFocusRequest);
    return () => window.removeEventListener('library:focus-search', handleFocusRequest);
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion, libraryView.filters);
  };

  const handleClearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    onSearch('', libraryView.filters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      searchRef.current?.blur();
    }
  };

  const sortOptions = [
    { value: 'last_read_at', label: 'Recently Read', icon: Clock },
    { value: 'created_at', label: 'Recently Added' },
    { value: 'title', label: 'Title A-Z' },
    { value: 'reading_progress', label: 'Reading Progress' },
    { value: 'file_size_bytes', label: 'File Size' },
    { value: 'notes_count', label: 'Most Notes' },
    { value: 'pomodoro_sessions_count', label: 'Study Time' }
  ];

  const viewModeOptions = [
    { value: 'grid', label: 'Grid', icon: Grid3X3 },
    { value: 'list', label: 'List', icon: List },
    { value: 'comfortable', label: 'Comfortable', icon: LayoutGrid }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search bar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search books, tags, collections..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(query.length > 0)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search suggestions */}
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {/* Recent searches */}
            {suggestions.recentSearches.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-gray-500 mb-2">Recent Searches</div>
                {suggestions.recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(search)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <Clock className="w-3 h-3 text-gray-400" />
                    {search}
                  </button>
                ))}
              </div>
            )}

            {/* Popular tags */}
            {suggestions.popularTags.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-2">Popular Tags</div>
                {suggestions.popularTags.map((tag, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(`tag:${tag.name}`)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name} ({tag.count})
                  </button>
                ))}
              </div>
            )}

            {/* Collections */}
            {suggestions.collections.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-2">Collections</div>
                {suggestions.collections.map((collection, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(`collection:${collection.name}`)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: collection.color }}
                    />
                    {collection.name} ({collection.count})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between">
        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={libraryView.sortBy}
            onChange={(e) => {
              const field = e.target.value;
              setLibrarySort(field as any, libraryView.sortOrder);
              onSortChange(field, libraryView.sortOrder);
            }}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Sort order toggle */}
          <button
            onClick={() => {
              const newOrder = libraryView.sortOrder === 'asc' ? 'desc' : 'asc';
              setLibrarySort(libraryView.sortBy, newOrder);
              onSortChange(libraryView.sortBy, newOrder);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title={`Sort ${libraryView.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {libraryView.sortOrder === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          {viewModeOptions.map(option => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setLibraryView({ viewMode: option.value as any });
                  onViewModeChange(option.value as any);
                }}
                className="p-2 rounded-md transition-colors"
                style={{
                  backgroundColor: libraryView.viewMode === option.value ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: libraryView.viewMode === option.value ? '#3b82f6' : 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => libraryView.viewMode !== option.value && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                onMouseLeave={(e) => libraryView.viewMode !== option.value && (e.currentTarget.style.backgroundColor = 'transparent')}
                title={option.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
          style={{
            backgroundColor: showFilters ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: showFilters ? '#3b82f6' : 'var(--color-text-primary)',
          }}
          onMouseEnter={(e) => !showFilters && (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => !showFilters && (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div 
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <LibraryFiltersPanel
            filters={libraryView.filters}
            onFiltersChange={(newFilters) => {
              onFiltersChange(newFilters);
              onSearch(query, newFilters);
            }}
          />
        </div>
      )}
    </div>
  );
};

interface LibraryFiltersProps {
  filters: LibraryFilters;
  onFiltersChange: (filters: LibraryFilters) => void;
}

const LibraryFiltersPanel: React.FC<LibraryFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const updateFilter = (key: keyof LibraryFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* File type filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
        <select
          value={filters.fileType || 'all'}
          onChange={(e) => updateFilter('fileType', e.target.value === 'all' ? undefined : e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="pdf">PDF</option>
          <option value="text">Text</option>
        </select>
      </div>

      {/* Reading progress filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reading Progress: {filters.readingProgress?.min || 0}% - {filters.readingProgress?.max || 100}%
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={filters.readingProgress?.min || 0}
            onChange={(e) => updateFilter('readingProgress', {
              ...filters.readingProgress,
              min: parseInt(e.target.value)
            })}
            className="flex-1"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={filters.readingProgress?.max || 100}
            onChange={(e) => updateFilter('readingProgress', {
              ...filters.readingProgress,
              max: parseInt(e.target.value)
            })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Favorites filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Favorites</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.isFavorite === true}
              onChange={(e) => updateFilter('isFavorite', e.target.checked ? true : undefined)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Favorites only</span>
          </label>
        </div>
      </div>

      {/* Has notes filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasNotes === true}
              onChange={(e) => updateFilter('hasNotes', e.target.checked ? true : undefined)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Has notes</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasAudio === true}
              onChange={(e) => updateFilter('hasAudio', e.target.checked ? true : undefined)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Has audio</span>
          </label>
        </div>
      </div>

      {/* Clear filters */}
      <div className="flex items-end">
        <button
          onClick={() => onFiltersChange({})}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
};
