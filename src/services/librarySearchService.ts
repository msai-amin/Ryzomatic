import { libraryOrganizationService, LibraryFilters, SortOptions } from './libraryOrganizationService';
import { supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface SearchResult {
  id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text' | 'epub';
  file_size_bytes: number;
  total_pages?: number;
  reading_progress: number;
  last_read_page: number;
  last_read_at?: string;
  is_favorite: boolean;
  notes_count: number;
  pomodoro_sessions_count: number;
  created_at: string;
  updated_at: string;
  collections: Array<{
    collection_id: string;
    user_collections: {
      name: string;
      color: string;
      icon: string;
    };
  }>;
  tags: Array<{
    tag_id: string;
    book_tags: {
      name: string;
      color: string;
      category: string;
    };
  }>;
}

export interface SearchSuggestions {
  recentSearches: string[];
  popularTags: Array<{ name: string; count: number; color: string }>;
  collections: Array<{ name: string; count: number; color: string }>;
}

export interface SearchMetadata {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters: LibraryFilters;
  sort: SortOptions;
  cursor?: Cursor | null;
}

export interface Cursor {
  last_read_at?: string;
  created_at?: string;
  id: string;
}

class LibrarySearchService {
  private currentUserId: string | null = null;
  private searchCache = new Map<string, { data: SearchResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Initialize with current user
  setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
    logger.info('LibrarySearchService initialized', { userId });
    } else {
      logger.info('LibrarySearchService cleared user context', { userId: null });
    }
  }

  // Check if user is authenticated
  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'LibrarySearchService' }
      );
    }
  }

  // Generate cache key for search parameters
  private getCacheKey(filters: LibraryFilters, sort: SortOptions, limit: number, offset: number): string {
    return JSON.stringify({ filters, sort, limit, offset, userId: this.currentUserId });
  }

  // Check if cached data is still valid
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  // Advanced search with caching
  async searchBooks(
    filters: LibraryFilters = {},
    sort: SortOptions = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    this.ensureAuthenticated();

    const cacheKey = this.getCacheKey(filters, sort, limit, (cursor ? 1 : 0));
    const cached = this.searchCache.get(cacheKey);

    // Return cached data if valid
    if (cached && this.isCacheValid(cached.timestamp)) {
      logger.debug('Returning cached search results', { cacheKey });
      
      // Cache hit - no need to log performance (RPC function doesn't exist yet)
      // This would be logged in a future enhancement
      
      return {
        results: cached.data,
        metadata: {
          total: cached.data.length,
          page: 1,
          limit,
          hasMore: cached.data.length === limit,
          filters,
          sort,
          cursor: cached.data.length > 0 ? this.buildNextCursor(cached.data, sort) : null
        }
      };
    }

    try {
      const start = Date.now();
      const context = { filters, sort, limit, cursor, userId: this.currentUserId };

      // Build RPC inputs
      const sortField = this.getSortField(sort.field);
      const sortOrder = sort.order;

      // Convert filters to JSONB-friendly shape for RPC
      const rpcFilters: Record<string, any> = {};
      if (filters.fileType && filters.fileType !== 'all') rpcFilters.fileType = filters.fileType;
      if (filters.readingProgress) rpcFilters.readingProgress = filters.readingProgress;
      if (filters.isFavorite !== undefined) rpcFilters.isFavorite = filters.isFavorite;
      if (filters.hasNotes !== undefined) rpcFilters.hasNotes = filters.hasNotes;
      if (filters.hasAudio !== undefined) rpcFilters.hasAudio = filters.hasAudio;
      if (filters.fileSizeRange) rpcFilters.fileSizeRange = filters.fileSizeRange;
      if (filters.dateRange) rpcFilters.dateRange = {
        start: filters.dateRange.start.toISOString(),
        end: filters.dateRange.end.toISOString()
      };
      if (filters.collections && filters.collections.length > 0) rpcFilters.collections = filters.collections;
      if (filters.tags && filters.tags.length > 0) rpcFilters.tags = filters.tags;

      const { data, error } = await supabase.rpc('search_user_books', {
        user_uuid: this.currentUserId!,
        q: (filters.searchQuery || '').trim() || null,
        filters: rpcFilters,
        sort_field: sortField,
        sort_order: sortOrder,
        after: cursor || null,
        page_limit: limit
      });

      if (error) {
        throw errorHandler.createError(
          `Failed to search books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context, error: error.message }
        );
      }

      const baseResults = (data || []) as any[];

      // Fetch badges (collections and tags) in lightweight queries
      const bookIds = baseResults.map(b => b.id);
      let collectionsMap: Record<string, SearchResult['collections']> = {};
      let tagsMap: Record<string, SearchResult['tags']> = {};

      if (bookIds.length > 0) {
        const [collectionsResp, tagsResp] = await Promise.all([
          supabase
            .from('book_collections')
            .select('book_id, collection_id, user_collections(name, color, icon)')
            .in('book_id', bookIds),
          supabase
            .from('book_tag_assignments')
            .select('book_id, tag_id, book_tags(name, color, category)')
            .in('book_id', bookIds)
        ]);

        const collectionsData = collectionsResp.data || [];
        const tagsData = tagsResp.data || [];

        for (const c of collectionsData as any[]) {
          const list = collectionsMap[c.book_id] || [];
          list.push({
            collection_id: c.collection_id,
            user_collections: {
              name: c.user_collections?.name,
              color: c.user_collections?.color,
              icon: c.user_collections?.icon
            }
          });
          collectionsMap[c.book_id] = list;
        }

        for (const t of tagsData as any[]) {
          const list = tagsMap[t.book_id] || [];
          list.push({
            tag_id: t.tag_id,
            book_tags: {
              name: t.book_tags?.name,
              color: t.book_tags?.color,
              category: t.book_tags?.category
            }
          });
          tagsMap[t.book_id] = list;
        }
      }

      const results: SearchResult[] = baseResults.map((item: any) => ({
        ...item,
        collections: collectionsMap[item.id] || [],
        tags: tagsMap[item.id] || []
      }));

      // Get Trash collection ID to filter out trash books
      const { data: trashCollection } = await supabase
        .from('user_collections')
        .select('id, name')
        .eq('user_id', this.currentUserId!)
        .eq('name', 'Trash')
        .maybeSingle();
      
      const trashCollectionId = trashCollection?.id;
      const isSearchingTrash = trashCollectionId && filters.collections?.includes(trashCollectionId);
      
      // Filter out Trash books unless explicitly searching for Trash collection
      const filteredResults = results.filter(book => {
        if (!trashCollectionId) return true; // No Trash collection exists yet
        const isInTrash = book.collections.some(coll => coll.collection_id === trashCollectionId);
        // Only show Trash books if explicitly searching for Trash collection
        return !isInTrash || isSearchingTrash;
      });

      // Cache the results
      this.searchCache.set(cacheKey, {
        data: filteredResults,
        timestamp: Date.now()
      });

      // Clean up old cache entries
      this.cleanupCache();

      const durationMs = Date.now() - start;
      
      // Performance logging would go here (RPC function doesn't exist yet)
      // This would be implemented in a future enhancement
      logger.debug('Search completed', { durationMs, resultCount: results.length });
      
      logger.info('Search completed', {
        ...context,
        resultCount: filteredResults.length,
        durationMs,
        cacheKey,
        filteredOutTrash: results.length - filteredResults.length
      });

      return {
        results: filteredResults,
        metadata: {
          total: filteredResults.length,
          page: 1,
          limit,
          hasMore: filteredResults.length === limit,
          filters,
          sort,
          cursor: filteredResults.length > 0 ? this.buildNextCursor(filteredResults, sort) : null
        }
      };

    } catch (error) {
      logger.error('Error searching books', { filters, sort }, error as Error);
      throw error;
    }
  }

  // Get search suggestions
  async getSearchSuggestions(): Promise<SearchSuggestions> {
    this.ensureAuthenticated();

    try {
      // Get recent searches from localStorage
      const recentSearches = this.getRecentSearches();

      // Get popular tags
      const { data: popularTags } = await supabase
        .from('book_tags')
        .select('name, usage_count, color')
        .eq('user_id', this.currentUserId!)
        .gt('usage_count', 0)
        .order('usage_count', { ascending: false })
        .limit(10);

      // Get collections with book counts
      const { data: collections } = await supabase
        .from('user_collections')
        .select(`
          name,
          color,
          book_collections(count)
        `)
        .eq('user_id', this.currentUserId!)
        .order('name');

      return {
        recentSearches,
        popularTags: (popularTags || []).map(tag => ({
          name: tag.name,
          count: tag.usage_count,
          color: tag.color
        })),
        collections: (collections || []).map(collection => ({
          name: collection.name,
          count: collection.book_collections?.[0]?.count || 0,
          color: collection.color
        }))
      };

    } catch (error) {
      logger.error('Error getting search suggestions', { userId: this.currentUserId }, error as Error);
      return {
        recentSearches: [],
        popularTags: [],
        collections: []
      };
    }
  }

  // Save search to recent searches
  saveSearchQuery(query: string): void {
    if (!query.trim()) return;

    try {
      const recentSearches = this.getRecentSearches();
      const newSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
      
      localStorage.setItem(`recent_searches_${this.currentUserId}`, JSON.stringify(newSearches));
    } catch (error) {
      logger.warn('Failed to save search query', { query }, error as Error);
    }
  }

  // Get recent searches from localStorage
  private getRecentSearches(): string[] {
    try {
      const stored = localStorage.getItem(`recent_searches_${this.currentUserId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.warn('Failed to get recent searches', { userId: this.currentUserId }, error as Error);
      return [];
    }
  }

  // Clear search cache
  clearCache(): void {
    this.searchCache.clear();
    logger.info('Search cache cleared', { userId: this.currentUserId });
  }

  // Clean up old cache entries
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (!this.isCacheValid(value.timestamp)) {
        this.searchCache.delete(key);
      }
    }
  }

  // Convert sort field to database column
  private getSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      'title': 'title',
      'created_at': 'created_at',
      'last_read_at': 'last_read_at',
      'reading_progress': 'reading_progress',
      'file_size_bytes': 'file_size_bytes',
      'notes_count': 'notes_count',
      'pomodoro_sessions_count': 'pomodoro_sessions_count'
    };

    return fieldMap[field] || 'last_read_at';
  }

  // Check if feature is enabled for current user
  private async isFeatureEnabled(featureName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_feature_enabled', {
        feature_name: featureName,
        user_uuid: this.currentUserId!,
        environment_param: 'production'
      });
      
      if (error) {
        logger.warn('Failed to check feature flag', { featureName, error: error.message });
        return false; // Default to disabled on error
      }
      
      return data || false;
    } catch (error) {
      logger.warn('Error checking feature flag', { featureName }, error as Error);
      return false;
    }
  }

  // Get performance summary for current user
  async getPerformanceSummary(daysBack: number = 7): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase.rpc('get_user_performance_summary', {
        user_uuid: this.currentUserId!,
        days_back: daysBack
      });
      
      if (error) {
        throw errorHandler.createError(
          `Failed to get performance summary: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.MEDIUM,
          { context: 'getPerformanceSummary', error: error.message }
        );
      }
      
      return data?.[0] || {};
    } catch (error) {
      logger.error('Error getting performance summary', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Build cursor for keyset pagination based on sort
  private buildNextCursor(results: SearchResult[], sort: SortOptions): Cursor | null {
    if (results.length === 0) return null;
    const last = results[results.length - 1];
    if (sort.field === 'last_read_at') {
      return { last_read_at: last.last_read_at || last.created_at, id: last.id };
    }
    if (sort.field === 'created_at') {
      return { created_at: last.created_at, id: last.id };
    }
    // Default to created_at as stable fallback
    return { created_at: last.created_at, id: last.id };
  }

  // Get autocomplete suggestions
  async getAutocompleteSuggestions(query: string, limit: number = 5): Promise<string[]> {
    this.ensureAuthenticated();

    if (!query.trim()) return [];

    try {
      const { data, error } = await supabase
        .from('user_books')
        .select('title')
        .eq('user_id', this.currentUserId!)
        .ilike('title', `%${query}%`)
        .limit(limit);

      if (error) {
        logger.warn('Error getting autocomplete suggestions', { query }, error as Error);
        return [];
      }

      return (data || []).map(book => book.title);

    } catch (error) {
      logger.warn('Error getting autocomplete suggestions', { query }, error as Error);
      return [];
    }
  }

  // Search with filters applied
  async searchWithFilters(
    searchQuery: string,
    filters: Omit<LibraryFilters, 'searchQuery'> = {},
    sort: SortOptions = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    const fullFilters: LibraryFilters = {
      ...filters,
      searchQuery
    };

    // Save search query
    this.saveSearchQuery(searchQuery);

    return this.searchBooks(fullFilters, sort, limit, cursor);
  }

  // Get books by collection
  async getBooksByCollection(
    collectionId: string,
    sort: SortOptions = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return this.searchBooks({ collections: [collectionId] }, sort, limit, cursor);
  }

  // Get books by tag
  async getBooksByTag(
    tagId: string,
    sort: SortOptions = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return this.searchBooks({ tags: [tagId] }, sort, limit, cursor);
  }

  // Get favorite books
  async getFavoriteBooks(
    sort: SortOptions = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return this.searchBooks({ isFavorite: true }, sort, limit, cursor);
  }

  // Get recently read books
  async getRecentlyReadBooks(
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return this.searchBooks({}, { field: 'last_read_at', order: 'desc' }, limit, cursor);
  }

  // Get recently added books
  async getRecentlyAddedBooks(
    limit: number = 50,
    cursor?: Cursor | null
  ): Promise<{ results: SearchResult[]; metadata: SearchMetadata }> {
    return this.searchBooks({}, { field: 'created_at', order: 'desc' }, limit, cursor);
  }
}

export const librarySearchService = new LibrarySearchService();
