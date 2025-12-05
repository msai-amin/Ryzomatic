import { supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { BookSeries } from '../../lib/supabase';

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
  is_smart?: boolean;
  smart_filter?: any;
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
  private ensuringDefaultsPromise: Promise<void> | null = null;

  // Initialize with current user
  setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
    logger.info('LibraryOrganizationService initialized', { userId });
    } else {
      logger.info('LibraryOrganizationService cleared user context', { userId: null });
      // Clear the promise when user changes
      this.ensuringDefaultsPromise = null;
    }
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

  // Clean up duplicate default collections - keep only the first one for each name
  private async cleanupDuplicateCollections(): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // Get all collections for the user
      const { data: allCollections, error: fetchError } = await supabase
        .from('user_collections')
        .select('id, name, created_at')
        .eq('user_id', this.currentUserId!)
        .order('created_at', { ascending: true });
      
      if (fetchError || !allCollections) {
        logger.warn('Failed to fetch collections for cleanup', { userId: this.currentUserId }, fetchError);
        return;
      }
      
      // Default collection names that should not have duplicates
      const defaultCollectionNames = ['In Progress', 'Recently Added', 'Needs Review', 'Completed', 'Unread', 'Trash'];
      
      // Find duplicates for default collections
      const collectionsByName = new Map<string, typeof allCollections>();
      
      for (const collection of allCollections) {
        if (defaultCollectionNames.includes(collection.name)) {
          if (!collectionsByName.has(collection.name)) {
            collectionsByName.set(collection.name, []);
          }
          collectionsByName.get(collection.name)!.push(collection);
        }
      }
      
      // Collect IDs of duplicate collections to delete (keep the oldest one)
      const duplicateIdsToDelete: string[] = [];
      
      for (const [name, collections] of collectionsByName.entries()) {
        if (collections.length > 1) {
          // Sort by created_at, keep the first (oldest), delete the rest
          const sorted = collections.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          // Delete all except the first one
          for (let i = 1; i < sorted.length; i++) {
            duplicateIdsToDelete.push(sorted[i].id);
          }
          
          logger.info(`Found ${collections.length} duplicates for collection "${name}", will delete ${sorted.length - 1}`, {
            userId: this.currentUserId,
            name,
            total: collections.length,
            keeping: sorted[0].id,
            deleting: sorted.slice(1).map(c => c.id)
          });
        }
      }
      
      // Delete duplicate collections
      if (duplicateIdsToDelete.length > 0) {
        // For each duplicate, migrate book-collection relationships to the kept collection
        for (const [name, collections] of collectionsByName.entries()) {
          if (collections.length > 1) {
            const sorted = collections.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            const keptCollectionId = sorted[0].id;
            const duplicateIds = sorted.slice(1).map(c => c.id);
            
            // Get all book-collection relationships for duplicates
            const { data: duplicateBookCollections } = await supabase
              .from('book_collections')
              .select('book_id')
              .in('collection_id', duplicateIds);
            
            if (duplicateBookCollections && duplicateBookCollections.length > 0) {
              // Get existing relationships for the kept collection
              const { data: existingBookCollections } = await supabase
                .from('book_collections')
                .select('book_id')
                .eq('collection_id', keptCollectionId);
              
              const existingBookIds = new Set((existingBookCollections || []).map(bc => bc.book_id));
              
              // Migrate relationships - only add books that aren't already in the kept collection
              const bookIdsToMigrate = Array.from(new Set(duplicateBookCollections.map(bc => bc.book_id)))
                .filter(bookId => !existingBookIds.has(bookId))
                .map(bookId => ({
                  book_id: bookId,
                  collection_id: keptCollectionId
                }));
              
              if (bookIdsToMigrate.length > 0) {
                await supabase
                  .from('book_collections')
                  .insert(bookIdsToMigrate);
              }
            }
          }
        }
        
        // Now remove book-collection relationships for duplicates (after migration)
        await supabase
          .from('book_collections')
          .delete()
          .in('collection_id', duplicateIdsToDelete);
        
        // Finally delete the duplicate collections
        const { error: deleteError } = await supabase
          .from('user_collections')
          .delete()
          .in('id', duplicateIdsToDelete);
        
        if (deleteError) {
          logger.warn('Failed to delete duplicate collections', { userId: this.currentUserId }, deleteError);
        } else {
          logger.info('Cleaned up duplicate collections', {
            userId: this.currentUserId,
            deletedCount: duplicateIdsToDelete.length
          });
        }
      }
    } catch (error) {
      logger.error('Error cleaning up duplicate collections', { userId: this.currentUserId }, error as Error);
      // Don't throw - this is a best-effort operation
    }
  }

  // Ensure default collections exist (smart collections and Trash)
  async ensureDefaultCollections(): Promise<void> {
    this.ensureAuthenticated();
    
    // If already ensuring defaults, wait for that to complete instead of starting a new one
    if (this.ensuringDefaultsPromise) {
      return this.ensuringDefaultsPromise;
    }
    
    // Create the promise and store it
    this.ensuringDefaultsPromise = (async () => {
      try {
        // First, clean up any existing duplicates
        await this.cleanupDuplicateCollections();
        
        // Check which default collections already exist
        const { data: existingCollections, error: checkError } = await supabase
          .from('user_collections')
          .select('id, name')
          .eq('user_id', this.currentUserId!);
        
        if (checkError) {
          logger.warn('Failed to check existing collections', { userId: this.currentUserId }, checkError);
          return; // Don't fail if check fails
        }
        
        const existingNames = new Set((existingCollections || []).map(c => c.name));
        
        // Default smart collections to create
        const defaultCollections = [
          {
            name: 'In Progress',
            description: 'Books you are currently reading',
            is_smart: true,
            smart_filter: { progress_min: 0.01, progress_max: 99.99 },
            color: '#F59E0B',
            icon: 'book-open',
            display_order: 1
          },
          {
            name: 'Recently Added',
            description: 'Books added in the last 30 days',
            is_smart: true,
            smart_filter: { uploaded_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
            color: '#3B82F6',
            icon: 'calendar',
            display_order: 2
          },
          {
            name: 'Needs Review',
            description: 'Books not read in the last 90 days',
            is_smart: true,
            smart_filter: { last_read_before: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
            color: '#EF4444',
            icon: 'alert-circle',
            display_order: 3
          },
          {
            name: 'Completed',
            description: 'Books you have finished reading',
            is_smart: true,
            smart_filter: { progress_min: 100, progress_max: 100 },
            color: '#10B981',
            icon: 'check-circle',
            display_order: 4
          },
          {
            name: 'Unread',
            description: 'Books you have not started',
            is_smart: true,
            smart_filter: { progress_min: 0, progress_max: 0 },
            color: '#6B7280',
            icon: 'book-marked',
            display_order: 5
          },
          {
            name: 'Trash',
            description: 'Deleted books',
            is_smart: false,
            smart_filter: {},
            color: '#6B7280',
            icon: 'trash-2',
            display_order: 9999
          }
        ];
        
        // Create missing collections
        const collectionsToCreate = defaultCollections.filter(c => !existingNames.has(c.name));
        
        if (collectionsToCreate.length > 0) {
          const insertData = collectionsToCreate.map(c => {
            const data: any = {
              user_id: this.currentUserId!,
              name: c.name,
              description: c.description,
              is_smart: c.is_smart,
              color: c.color,
              icon: c.icon,
              display_order: c.display_order,
              is_favorite: false
            };
            
            // Only include smart_filter for smart collections
            if (c.is_smart && c.smart_filter) {
              data.smart_filter = c.smart_filter;
            } else {
              data.smart_filter = {};
            }
            
            return data;
          });
          
          // Use a unique constraint check - only insert if name doesn't exist
          // This provides database-level protection against duplicates
          const { error: insertError } = await supabase
            .from('user_collections')
            .insert(insertData);
          
          if (insertError) {
            // If there's a unique constraint violation or similar, log it but don't fail
            logger.warn('Failed to create default collections (may already exist)', { 
              userId: this.currentUserId,
              error: insertError.message 
            });
          } else {
            logger.info('Default collections ensured', { 
              userId: this.currentUserId, 
              created: insertData.length,
              collections: insertData.map(c => c.name)
            });
          }
        }
      } finally {
        // Clear the promise so future calls can start fresh
        this.ensuringDefaultsPromise = null;
      }
    })();
    
    return this.ensuringDefaultsPromise;
  }

  async getCollections(): Promise<Collection[]> {
    this.ensureAuthenticated();
    
    try {
      // Ensure default collections exist first (this also runs cleanup)
      await this.ensureDefaultCollections();
      
      const start = Date.now();
      
      // Simple query without RPC functions
      const { data, error } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('display_order', { ascending: true });

      const collectionsData = error 
        ? (await supabase
            .from('user_collections')
            .select('*')
            .eq('user_id', this.currentUserId!)).data || []
        : (data || []);

      if (error && !collectionsData.length) {
        throw errorHandler.createError(
          `Failed to get collections: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getCollections', error: error.message }
        );
      }

      // Always deduplicate and clean up immediately before returning
      const deduplicated = await this.deduplicateAndCleanup(collectionsData);

      const durationMs = Date.now() - start;
      logger.info('Collections retrieved', { 
        userId: this.currentUserId, 
        durationMs,
        count: deduplicated.length,
        originalCount: collectionsData.length
      });

      return deduplicated;
    } catch (error) {
      logger.error('Error getting collections', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Deduplicate collections and clean up duplicates from database
  private async deduplicateAndCleanup(collections: Collection[]): Promise<Collection[]> {
    // Default collection names that should not have duplicates
    const defaultCollectionNames = ['In Progress', 'Recently Added', 'Needs Review', 'Completed', 'Unread', 'Trash'];
    
    // Group collections by name - separate default from user-created
    const defaultCollectionsByName = new Map<string, Collection[]>();
    const userCollectionsByName = new Map<string, Collection[]>();
    
    for (const collection of collections) {
      if (defaultCollectionNames.includes(collection.name)) {
        if (!defaultCollectionsByName.has(collection.name)) {
          defaultCollectionsByName.set(collection.name, []);
        }
        defaultCollectionsByName.get(collection.name)!.push(collection);
      } else {
        // For user-created collections, allow duplicates (users might want multiple with same name)
        // But we still deduplicate by ID to avoid showing exact duplicates
        userCollectionsByName.set(collection.id, [collection]);
      }
    }
    
    // Process default collections - find duplicates and clean them up
    const duplicatesToDelete: { id: string; keptCollectionId: string; name: string }[] = [];
    const finalCollections: Collection[] = [];
    const keptCollectionsMap = new Map<string, Collection>(); // Map of name -> kept collection
    
    for (const [name, dups] of defaultCollectionsByName.entries()) {
      if (dups.length > 1) {
        // Sort by created_at, keep the oldest
        const sorted = [...dups].sort((a, b) => 
          new Date(a.created_at || a.updated_at || 0).getTime() - 
          new Date(b.created_at || b.updated_at || 0).getTime()
        );
        
        const kept = sorted[0];
        keptCollectionsMap.set(name, kept);
        finalCollections.push(kept);
        
        // Mark the rest for deletion with reference to kept collection
        for (let i = 1; i < sorted.length; i++) {
          duplicatesToDelete.push({
            id: sorted[i].id,
            keptCollectionId: kept.id,
            name: name
          });
        }
        
        logger.info(`Found ${dups.length} duplicates for default collection "${name}", will delete ${sorted.length - 1}`, {
          userId: this.currentUserId,
          name,
          keeping: kept.id,
          deleting: sorted.slice(1).map(c => c.id)
        });
      } else {
        // No duplicates, just add it
        const kept = dups[0];
        keptCollectionsMap.set(name, kept);
        finalCollections.push(kept);
      }
    }
    
    // Add all user-created collections (no deduplication needed)
    for (const coll of collections) {
      if (!defaultCollectionNames.includes(coll.name)) {
        // Only add if we haven't already added it (in case of ID duplicates)
        if (!finalCollections.find(c => c.id === coll.id)) {
          finalCollections.push(coll);
        }
      }
    }
    
    // If we found duplicates, delete them from the database immediately
    if (duplicatesToDelete.length > 0) {
      try {
        // Migrate book-collection relationships first
        for (const duplicateInfo of duplicatesToDelete) {
          const keptCollectionId = duplicateInfo.keptCollectionId;
          
          // Get book-collection relationships for duplicate
          const { data: duplicateBookCollections } = await supabase
            .from('book_collections')
            .select('book_id')
            .eq('collection_id', duplicateInfo.id);
          
          if (duplicateBookCollections && duplicateBookCollections.length > 0) {
            // Get existing relationships for kept collection
            const { data: existingBookCollections } = await supabase
              .from('book_collections')
              .select('book_id')
              .eq('collection_id', keptCollectionId);
            
            const existingBookIds = new Set((existingBookCollections || []).map(bc => bc.book_id));
            
            // Migrate relationships
            const bookIdsToMigrate = duplicateBookCollections
              .map(bc => bc.book_id)
              .filter(bookId => !existingBookIds.has(bookId))
              .map(bookId => ({
                book_id: bookId,
                collection_id: keptCollectionId
              }));
            
            if (bookIdsToMigrate.length > 0) {
              await supabase
                .from('book_collections')
                .insert(bookIdsToMigrate);
            }
          }
        }
        
        // Delete book-collection relationships for duplicates
        const duplicateIds = duplicatesToDelete.map(d => d.id);
        await supabase
          .from('book_collections')
          .delete()
          .in('collection_id', duplicateIds);
        
        // Delete duplicate collections
        const { error: deleteError } = await supabase
          .from('user_collections')
          .delete()
          .in('id', duplicateIds);
        
        if (deleteError) {
          logger.warn('Failed to delete duplicate collections', { userId: this.currentUserId }, deleteError);
        } else {
          logger.info('Deleted duplicate collections immediately', {
            userId: this.currentUserId,
            deletedCount: duplicateIds.length,
            collections: duplicatesToDelete.map(d => d.name)
          });
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up duplicates immediately', { userId: this.currentUserId }, cleanupError as Error);
      }
    }
    
    return finalCollections.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
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
      const { error } = await supabase.rpc('bulk_assign_books_to_collection', {
        user_uuid: this.currentUserId,
        collection_uuid: collectionId,
        book_ids: bookIds
      });

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

      // Get Trash collection ID to filter out trash books
      const { data: trashCollection } = await supabase
        .from('user_collections')
        .select('id')
        .eq('user_id', this.currentUserId!)
        .eq('name', 'Trash')
        .maybeSingle();
      
      const trashCollectionId = trashCollection?.id;
      const isSearchingTrash = trashCollectionId && filters.collections?.includes(trashCollectionId);
      
      // Filter out Trash books unless explicitly searching for Trash collection
      const filteredData = (data || []).filter((book: any) => {
        if (!trashCollectionId) return true; // No Trash collection exists yet
        if (isSearchingTrash) return true; // Show all if searching Trash
        
        // Check if book is in Trash collection
        const bookCollections = book.book_collections || [];
        const isInTrash = bookCollections.some((bc: any) => bc.collection_id === trashCollectionId);
        return !isInTrash;
      });

      return filteredData;
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

  // Smart Collections
  async getSmartCollectionBooks(collectionId: string): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_smart_collection_books', { collection_id_param: collectionId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get smart collection books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSmartCollectionBooks', collectionId, error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting smart collection books', { collectionId }, error as Error);
      throw error;
    }
  }

  async createUserSmartCollection(
    name: string,
    description: string,
    smartFilter: any
  ): Promise<Collection> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .insert({
          user_id: this.currentUserId!,
          name,
          description,
          is_smart: true,
          smart_filter: smartFilter,
          color: '#8B5CF6',
          icon: 'sparkles'
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create smart collection: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createUserSmartCollection', error: error.message }
        );
      }

      logger.info('Smart collection created', { collectionId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating smart collection', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async reorderCollections(parentId: string | null, orderedIds: string[]): Promise<void> {
    this.ensureAuthenticated();

    if (orderedIds.length === 0) {
      return;
    }

    try {
      const { error } = await supabase.rpc('reorder_user_collections', {
        user_uuid: this.currentUserId,
        parent_uuid: parentId,
        ordered_ids: orderedIds
      });

      if (error) {
        throw errorHandler.createError(
          `Failed to reorder collections: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'reorderCollections', parentId, orderedIds, error: error.message }
        );
      }

      logger.info('Collections reordered', {
        parentId,
        orderedIds,
        userId: this.currentUserId
      });
    } catch (error) {
      logger.error('Error reordering collections', { parentId, orderedIds }, error as Error);
      throw error;
    }
  }

  // Enhanced Batch Operations
  async batchAddTags(bookIds: string[], tagIds: string[]): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const assignments = bookIds.flatMap(bookId =>
        tagIds.map(tagId => ({ book_id: bookId, tag_id: tagId }))
      );

      const { error } = await supabase
        .from('book_tag_assignments')
        .upsert(assignments, { onConflict: 'book_id,tag_id' });

      if (error) {
        throw errorHandler.createError(
          `Failed to batch add tags: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchAddTags', bookIds, tagIds, error: error.message }
        );
      }

      logger.info('Tags batch added', { bookCount: bookIds.length, tagCount: tagIds.length, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error batch adding tags', { bookIds, tagIds }, error as Error);
      throw error;
    }
  }

  async batchRemoveTags(bookIds: string[], tagIds: string[]): Promise<void> {
    this.ensureAuthenticated();

    if (bookIds.length === 0 || tagIds.length === 0) {
      return;
    }

    try {
      const { error } = await supabase
        .from('book_tag_assignments')
        .delete()
        .in('book_id', bookIds)
        .in('tag_id', tagIds);

      if (error) {
        throw errorHandler.createError(
          `Failed to batch remove tags: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchRemoveTags', bookIds, tagIds, error: error.message }
        );
      }

      logger.info('Tags batch removed', {
        bookCount: bookIds.length,
        tagCount: tagIds.length,
        userId: this.currentUserId
      });
    } catch (error) {
      logger.error('Error batch removing tags', { bookIds, tagIds }, error as Error);
      throw error;
    }
  }

  async batchDelete(bookIds: string[]): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // Get books to find S3 keys before deleting
      const { data: books } = await supabase
        .from('user_books')
        .select('id, s3_key')
        .in('id', bookIds)
        .eq('user_id', this.currentUserId!);

      // Delete from database
      const { error } = await supabase
        .from('user_books')
        .delete()
        .in('id', bookIds)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to batch delete books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchDelete', bookIds, error: error.message }
        );
      }

      // Clean up S3 files (non-blocking)
      if (books && books.length > 0) {
        const { bookStorageService } = await import('./bookStorageService');
        Promise.all(
          books
            .filter(b => b.s3_key)
            .map(b => bookStorageService.deleteBook(b.s3_key!, this.currentUserId!))
        ).catch(err => logger.warn('S3 cleanup failed in batch delete', { bookIds }, err));
      }

      logger.info('Books batch deleted', { bookCount: bookIds.length, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error batch deleting books', { bookIds }, error as Error);
      throw error;
    }
  }

  async batchToggleFavorite(bookIds: string[], isFavorite: boolean): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('user_books')
        .update({ is_favorite: isFavorite })
        .in('id', bookIds)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to batch toggle favorite: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchToggleFavorite', bookIds, isFavorite, error: error.message }
        );
      }

      logger.info('Books batch favorite toggled', { bookCount: bookIds.length, isFavorite, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error batch toggling favorite', { bookIds }, error as Error);
      throw error;
    }
  }

  async batchArchive(bookIds: string[]): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('user_books')
        .update({ archived_at: new Date().toISOString() })
        .in('id', bookIds)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to batch archive books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchArchive', bookIds, error: error.message }
        );
      }

      logger.info('Books batch archived', { bookCount: bookIds.length, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error batch archiving books', { bookIds }, error as Error);
      throw error;
    }
  }

  async batchExport(bookIds: string[]): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('user_books')
        .select('*, book_collections(*), book_tag_assignments(*)')
        .in('id', bookIds)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to batch export books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'batchExport', bookIds, error: error.message }
        );
      }

      return {
        books: data || [],
        exportedAt: new Date().toISOString(),
        format: 'json'
      };
    } catch (error) {
      logger.error('Error batch exporting books', { bookIds }, error as Error);
      throw error;
    }
  }

  async detectDuplicates(bookId: string): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      // Get the book to check
      const { data: book, error: bookError } = await supabase
        .from('user_books')
        .select('title, file_size_bytes')
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!)
        .single();

      if (bookError || !book) {
        return [];
      }

      // Find potential duplicates by title similarity and file size
      const { data: duplicates, error } = await supabase
        .from('user_books')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .neq('id', bookId)
        .eq('file_size_bytes', book.file_size_bytes);

      if (error) {
        logger.error('Error detecting duplicates', { bookId, error: error.message });
        return [];
      }

      return duplicates || [];
    } catch (error) {
      logger.error('Error detecting duplicates', { bookId }, error as Error);
      return [];
    }
  }

  async mergeDuplicates(primaryBookId: string, duplicateIds: string[]): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      // This is a complex operation that should be done via an RPC function
      // For now, we'll handle basic merging
      const { error } = await supabase
        .rpc('merge_books', { 
          primary_id: primaryBookId, 
          duplicate_ids: duplicateIds 
        });

      if (error) {
        // If RPC doesn't exist, handle gracefully
        logger.warn('Merge books RPC not available, skipping merge', { primaryBookId, duplicateIds });
        // Just delete the duplicates
        await this.batchDelete(duplicateIds);
      }

      logger.info('Books merged', { primaryBookId, duplicateCount: duplicateIds.length, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error merging books', { primaryBookId, duplicateIds }, error as Error);
      throw error;
    }
  }

  // Series Management
  async createSeries(series: Omit<BookSeries, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<BookSeries> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_series')
        .insert({
          user_id: this.currentUserId!,
          ...series
        })
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to create series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'createSeries', error: error.message }
        );
      }

      logger.info('Series created', { seriesId: data.id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error creating series', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async getSeries(): Promise<BookSeries[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_series')
        .select('*')
        .eq('user_id', this.currentUserId!)
        .order('display_order', { ascending: true });

      if (error) {
        throw errorHandler.createError(
          `Failed to get series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSeries', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting series', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async updateSeries(id: string, updates: Partial<BookSeries>): Promise<BookSeries> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('book_series')
        .update(updates)
        .eq('id', id)
        .eq('user_id', this.currentUserId!)
        .select()
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to update series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateSeries', seriesId: id, error: error.message }
        );
      }

      logger.info('Series updated', { seriesId: id, userId: this.currentUserId });
      return data;
    } catch (error) {
      logger.error('Error updating series', { seriesId: id }, error as Error);
      throw error;
    }
  }

  async deleteSeries(id: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('book_series')
        .delete()
        .eq('id', id)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to delete series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteSeries', seriesId: id, error: error.message }
        );
      }

      logger.info('Series deleted', { seriesId: id, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error deleting series', { seriesId: id }, error as Error);
      throw error;
    }
  }

  async addBookToSeries(bookId: string, seriesId: string, order?: number): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const updates: any = { series_id: seriesId };
      if (order !== undefined) {
        updates.series_order = order;
      }

      const { error } = await supabase
        .from('user_books')
        .update(updates)
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to add book to series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'addBookToSeries', bookId, seriesId, error: error.message }
        );
      }

      logger.info('Book added to series', { bookId, seriesId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error adding book to series', { bookId, seriesId }, error as Error);
      throw error;
    }
  }

  async removeBookFromSeries(bookId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('user_books')
        .update({ series_id: null, series_order: 0 })
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to remove book from series: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'removeBookFromSeries', bookId, error: error.message }
        );
      }

      logger.info('Book removed from series', { bookId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error removing book from series', { bookId }, error as Error);
      throw error;
    }
  }

  async getSeriesBooks(seriesId: string): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_series_books', { series_id_param: seriesId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get series books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSeriesBooks', seriesId, error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting series books', { seriesId }, error as Error);
      throw error;
    }
  }

  async getSeriesProgress(seriesId: string): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_series_progress', { series_id_param: seriesId });

      if (error) {
        throw errorHandler.createError(
          `Failed to get series progress: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getSeriesProgress', seriesId, error: error.message }
        );
      }

      return data?.[0] || null;
    } catch (error) {
      logger.error('Error getting series progress', { seriesId }, error as Error);
      throw error;
    }
  }

  // Archive Management
  async archiveBook(bookId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('archive_book', { book_id_param: bookId });

      if (error) {
        throw errorHandler.createError(
          `Failed to archive book: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'archiveBook', bookId, error: error.message }
        );
      }

      logger.info('Book archived', { bookId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error archiving book', { bookId }, error as Error);
      throw error;
    }
  }

  async restoreBook(bookId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .rpc('restore_book', { book_id_param: bookId });

      if (error) {
        throw errorHandler.createError(
          `Failed to restore book: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'restoreBook', bookId, error: error.message }
        );
      }

      logger.info('Book restored', { bookId, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error restoring book', { bookId }, error as Error);
      throw error;
    }
  }

  async getArchivedBooks(): Promise<any[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .rpc('get_archived_books', { user_id_param: this.currentUserId! });

      if (error) {
        throw errorHandler.createError(
          `Failed to get archived books: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getArchivedBooks', error: error.message }
        );
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting archived books', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }
}

export const libraryOrganizationService = new LibraryOrganizationService();
