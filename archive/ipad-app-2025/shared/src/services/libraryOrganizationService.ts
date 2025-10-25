import { supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  color: string;
  icon: string;
  is_favorite: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  book_count?: number;
  level?: number;
  path?: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  category: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface BookCollection {
  book_id: string;
  collection_id: string;
  added_at: string;
  display_order: number;
}

export interface BookTagAssignment {
  book_id: string;
  tag_id: string;
  assigned_at: string;
}

export interface LibraryFilters {
  searchQuery?: string;
  fileType?: 'pdf' | 'text' | 'all';
  readingProgress?: { min: number; max: number };
  dateRange?: { start: Date; end: Date };
  collections?: string[];
  tags?: string[];
  isFavorite?: boolean;
  hasNotes?: boolean;
  hasAudio?: boolean;
  fileSizeRange?: { min: number; max: number };
}

export interface SortOptions {
  field: 'title' | 'created_at' | 'last_read_at' | 'reading_progress' | 'file_size_bytes' | 'notes_count' | 'pomodoro_sessions_count';
  order: 'asc' | 'desc';
}

class LibraryOrganizationService {
  private currentUserId: string | null = null;

  // Initialize with current user
  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('LibraryOrganizationService initialized', { userId });
  }

  // Check if user is authenticated
  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'LibraryOrganizationService' }
      );
    }
  }

  // Collections Management
  async createCollection(collection: Omit<Collection, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'book_count' | 'level' | 'path'>): Promise<Collection> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .insert({
          user_id: this.currentUserId!,
          ...collection
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createCollection', error: error.message }
        );
      }

      logger.info('Collection created', { collectionId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating collection', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async getCollections(): Promise<Collection[]> {
    this.ensureAuthenticated();
    
    try {
      const start = Date.now();
      
      // Simple query without RPC functions
      const { data, error } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('display_order', { ascending: true });

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_collections')
          .select('*')
          .eq('user_id', this.currentUserId!);

        if (fallbackError) {
          throw errorHandler.createError(
            `Failed to get collections: ${fallbackError.message}`,
            ErrorType.DATABASE,
            ErrorSeverity.HIGH,
            { context: 'getCollections', error: fallbackError.message }
          );
        }

        const durationMs = Date.now() - start;
        logger.info('Collections retrieved (fallback)', { 
          userId: this.currentUserId, 
          durationMs,
          count: fallbackData?.length || 0
        });
        
        return fallbackData || [];
      }

      const durationMs = Date.now() - start;
      logger.info('Collections retrieved (cached)', { 
        userId: this.currentUserId, 
        durationMs,
        count: data?.length || 0
      });

      return data || [];
    } catch (error) {
      logger.error('Error getting collections', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .update(updates)
        .eq('id', id)
        .eq('user_id', this.currentUserId!)
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to update collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateCollection', collectionId: id, error: error.message }
        );
      }

      logger.info('Collection updated', { collectionId: id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error updating collection', { collectionId: id }, error as Error);
      throw error;
    }
  }

  async deleteCollection(id: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // First check if collection has children
      const { data: children } = await supabase
        .from('user_collections')
        .select('id')
        .eq('parent_id', id)
        .eq('user_id', this.currentUserId!);

      if (children && children.length > 0) {
        throw errorHandler.createError(
          'Cannot delete collection with subcollections. Please move or delete subcollections first.',
          ErrorType.VALIDATION,
          ErrorSeverity.MEDIUM,
          { context: 'deleteCollection', collectionId: id }
        );
      }

      // Remove all book-collection relationships
      await supabase
        .from('book_collections')
        .delete()
        .eq('collection_id', id);

      // Delete the collection
      const { error } = await supabase
        .from('user_collections')
        .delete()
        .eq('id', id)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteCollection', collectionId: id, error: error.message }
        );
      }

      logger.info('Collection deleted', { collectionId: id, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting collection', { collectionId: id }, error as Error);
      throw error;
    }
  }

  async moveCollection(id: string, newParentId: string | null): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // Prevent moving collection into itself or its descendants
      if (newParentId) {
        const { data: descendants } = await supabase
          .rpc('get_collection_hierarchy', { user_uuid: this.currentUserId!, root_id: id });
        
        if (descendants?.some((d: Collection) => d.id === newParentId)) {
          throw errorHandler.createError(
            'Cannot move collection into its own subcollection',
            ErrorType.VALIDATION,
            ErrorSeverity.MEDIUM,
            { context: 'moveCollection', collectionId: id, newParentId }
          );
        }
      }

      const { error } = await supabase
        .from('user_collections')
        .update({ parent_id: newParentId })
        .eq('id', id)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to move collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'moveCollection', collectionId: id, error: error.message }
        );
      }

      logger.info('Collection moved', { collectionId: id, newParentId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error moving collection', { collectionId: id }, error as Error);
      throw error;
    }
  }

  // Tags Management
  async createTag(tag: Omit<Tag, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<Tag> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_tags')
        .insert({
          user_id: this.currentUserId!,
          ...tag,
          usage_count: 0
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create tag: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createTag', error: error.message }
        );
      }

      logger.info('Tag created', { tagId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating tag', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async getTags(): Promise<Tag[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_tags')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('usage_count', { ascending: false })
        .order('name');

      if (error) {
        throw errorHandler.createError(
          `Failed to get tags: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getTags', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting tags', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_tags')
        .update(updates)
        .eq('id', id)
        .eq('user_id', this.currentUserId!)
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to update tag: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateTag', tagId: id, error: error.message }
        );
      }

      logger.info('Tag updated', { tagId: id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error updating tag', { tagId: id }, error as Error);
      throw error;
    }
  }

  async deleteTag(id: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // Remove all book-tag assignments
      await supabase
        .from('book_tag_assignments')
        .delete()
        .eq('tag_id', id);

      // Delete the tag
      const { error } = await supabase
        .from('book_tags')
        .delete()
        .eq('id', id)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete tag: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteTag', tagId: id, error: error.message }
        );
      }

      logger.info('Tag deleted', { tagId: id, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting tag', { tagId: id }, error as Error);
      throw error;
    }
  }

  // Book-Collection Operations
  async addBookToCollection(bookId: string, collectionId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('book_collections')
        .insert({
          book_id: bookId,
          collection_id: collectionId
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to add book to collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'addBookToCollection', bookId, collectionId, error: error.message }
        );
      }

      logger.info('Book added to collection', { bookId, collectionId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error adding book to collection', { bookId, collectionId }, error as Error);
      throw error;
    }
  }

  async removeBookFromCollection(bookId: string, collectionId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('book_collections')
        .delete()
        .eq('book_id', bookId)
        .eq('collection_id', collectionId);

      if (error) {
        throw errorHandler.createError(
          `Failed to remove book from collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'removeBookFromCollection', bookId, collectionId, error: error.message }
        );
      }

      logger.info('Book removed from collection', { bookId, collectionId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error removing book from collection', { bookId, collectionId }, error as Error);
      throw error;
    }
  }

  async moveBookBetweenCollections(bookId: string, fromCollectionId: string, toCollectionId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // Remove from old collection
      await this.removeBookFromCollection(bookId, fromCollectionId);
      
      // Add to new collection
      await this.addBookToCollection(bookId, toCollectionId);

      logger.info('Book moved between collections', { bookId, fromCollectionId, toCollectionId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error moving book between collections', { bookId, fromCollectionId, toCollectionId }, error as Error);
      throw error;
    }
  }

  // Book-Tag Operations
  async assignTag(bookId: string, tagId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('book_tag_assignments')
        .insert({
          book_id: bookId,
          tag_id: tagId
        });

      if (error) {
        throw errorHandler.createError(
          `Failed to assign tag: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'assignTag', bookId, tagId, error: error.message }
        );
      }

      logger.info('Tag assigned to book', { bookId, tagId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error assigning tag', { bookId, tagId }, error as Error);
      throw error;
    }
  }

  async removeTag(bookId: string, tagId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('book_tag_assignments')
        .delete()
        .eq('book_id', bookId)
        .eq('tag_id', tagId);

      if (error) {
        throw errorHandler.createError(
          `Failed to remove tag: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'removeTag', bookId, tagId, error: error.message }
        );
      }

      logger.info('Tag removed from book', { bookId, tagId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error removing tag', { bookId, tagId }, error as Error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkAddToCollection(bookIds: string[], collectionId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const assignments = bookIds.map(bookId => ({
        book_id: bookId,
        collection_id: collectionId
      }));

      const { error } = await supabase
        .from('book_collections')
        .insert(assignments);

      if (error) {
        throw errorHandler.createError(
          `Failed to bulk add books to collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'bulkAddToCollection', bookIds, collectionId, error: error.message }
        );
      }

      logger.info('Books bulk added to collection', { bookCount: bookIds.length, collectionId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error bulk adding books to collection', { bookIds, collectionId }, error as Error);
      throw error;
    }
  }

  async bulkTag(bookIds: string[], tagId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const assignments = bookIds.map(bookId => ({
        book_id: bookId,
        tag_id: tagId
      }));

      const { error } = await supabase
        .from('book_tag_assignments')
        .insert(assignments);

      if (error) {
        throw errorHandler.createError(
          `Failed to bulk tag books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'bulkTag', bookIds, tagId, error: error.message }
        );
      }

      logger.info('Books bulk tagged', { bookCount: bookIds.length, tagId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error bulk tagging books', { bookIds, tagId }, error as Error);
      throw error;
    }
  }

  // Search and Filter
  async searchBooks(filters: LibraryFilters, sort: SortOptions, limit: number = 50, offset: number = 0): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      let query = supabase
        .from('user_books')
        .select(`
          *,
          book_collections!inner(collection_id, user_collections(name, color, icon)),
          book_tag_assignments!inner(tag_id, book_tags(name, color, category))
        `)
        .eq('user_id', this.currentUserId!);

      // Apply filters
      if (filters.searchQuery) {
        query = query.textSearch('title', filters.searchQuery);
      }

      if (filters.fileType && filters.fileType !== 'all') {
        query = query.eq('file_type', filters.fileType);
      }

      if (filters.readingProgress) {
        query = query
          .gte('reading_progress', filters.readingProgress.min)
          .lte('reading_progress', filters.readingProgress.max);
      }

      if (filters.isFavorite !== undefined) {
        query = query.eq('is_favorite', filters.isFavorite);
      }

      if (filters.hasNotes !== undefined) {
        if (filters.hasNotes) {
          query = query.gt('notes_count', 0);
        } else {
          query = query.eq('notes_count', 0);
        }
      }

      if (filters.hasAudio !== undefined) {
        if (filters.hasAudio) {
          query = query.gt('pomodoro_sessions_count', 0);
        } else {
          query = query.eq('pomodoro_sessions_count', 0);
        }
      }

      if (filters.fileSizeRange) {
        query = query
          .gte('file_size_bytes', filters.fileSizeRange.min)
          .lte('file_size_bytes', filters.fileSizeRange.max);
      }

      if (filters.collections && filters.collections.length > 0) {
        query = query.in('book_collections.collection_id', filters.collections);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.in('book_tag_assignments.tag_id', filters.tags);
      }

      // Apply sorting
      query = query.order(sort.field, { ascending: sort.order === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw errorHandler.createError(
          `Failed to search books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'searchBooks', filters, error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error searching books', { filters }, error as Error);
      throw error;
    }
  }

  async getLibraryStats(): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_library_stats', { user_uuid: this.currentUserId! });

      if (error) {
        throw errorHandler.createError(
          `Failed to get library stats: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getLibraryStats', error: error.message }
        );
      }

      return data?.[0] || {};
    } catch (error) {
      logger.error('Error getting library stats', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }
}

export const libraryOrganizationService = new LibraryOrganizationService();
