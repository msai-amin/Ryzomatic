import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Book, FileText, Music, Trash2, Download, Upload, HardDrive, Cloud, CloudOff, RefreshCw, Star, LayoutList, LayoutGrid, Rows, Plus, Edit3, Loader2 } from 'lucide-react';
import { storageService, SavedBook, Note, SavedAudio } from '../services/storageService'
import { supabaseStorageService } from '../services/supabaseStorageService';
import { useAppStore } from '../store/appStore';
import { googleAuthService } from '../services/googleAuthService';
import { simpleGoogleAuth } from '../services/simpleGoogleAuth';
import { libraryOrganizationService, Collection } from '../services/libraryOrganizationService';
import { CollectionTree } from './library/CollectionTree';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number; // Add refresh trigger
}

export function LibraryModal({ isOpen, onClose, refreshTrigger }: LibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'documents' | 'notes' | 'audio'>('documents');
  const [books, setBooks] = useState<EnhancedSavedBook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audio, setAudio] = useState<SavedAudio[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, max: 0, percentage: 0 });
  const [isGoogleDriveEnabled, setIsGoogleDriveEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ lastSync: Date | null; isEnabled: boolean }>({ lastSync: null, isEnabled: false });
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'comfortable'>('list');
  const [isSupabaseData, setIsSupabaseData] = useState(false);
  const [favoriteBusyIds, setFavoriteBusyIds] = useState<string[]>([]);
  const [renameBusyIds, setRenameBusyIds] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionActionBusyId, setCollectionActionBusyId] = useState<string | null>(null);
  const { /* setCurrentDocument, */ addDocument, user } = useAppStore();
  const viewModes: Array<{ key: 'list' | 'grid' | 'comfortable'; label: string; icon: typeof LayoutList }> = [
    { key: 'list', label: 'List', icon: LayoutList },
    { key: 'grid', label: 'Grid', icon: LayoutGrid },
    { key: 'comfortable', label: 'Focus', icon: Rows }
  ];
  const normalizeBook = (book: EnhancedSavedBook): EnhancedSavedBook => {
    const normalizedFavorite =
      book.isFavorite ??
      book.is_favorite ??
      ((book as { isFavorite?: boolean; is_favorite?: boolean }).isFavorite ??
        (book as { is_favorite?: boolean }).is_favorite) ??
      false;
    return {
      ...book,
      isFavorite: Boolean(normalizedFavorite),
    };
  };

  const formatBookSize = (book: EnhancedSavedBook): string => {
    const metadataSize =
      book.fileSize ??
      book.file_size ??
      (book as { fileSize?: number; file_size?: number }).fileSize ??
      (book as { file_size?: number }).file_size;

    if (typeof metadataSize === 'number' && !Number.isNaN(metadataSize) && metadataSize > 0) {
      return `${(metadataSize / 1024 / 1024).toFixed(2)} MB`;
    }

    const fileData = book.fileData;
    if (fileData instanceof Blob) {
      return `${(fileData.size / 1024 / 1024).toFixed(2)} MB`;
    }
    if (fileData instanceof ArrayBuffer) {
      return `${(fileData.byteLength / 1024 / 1024).toFixed(2)} MB`;
    }

    return '—';
  };

  useEffect(() => {
    if (user?.id) {
      try {
        supabaseStorageService.setCurrentUser(user.id);
      } catch (serviceError) {
        console.warn('LibraryModal: failed to initialize supabaseStorageService user', serviceError);
      }
      try {
        libraryOrganizationService.setCurrentUser(user.id);
      } catch (serviceError) {
        console.warn('LibraryModal: failed to initialize libraryOrganizationService user', serviceError);
      }
    }
  }, [user?.id]);

  const fetchCollections = useCallback(async () => {
    if (!user?.id) {
      setCollections([]);
      return;
    }

    setIsLoadingCollections(true);
    setCollectionError(null);

    try {
      libraryOrganizationService.setCurrentUser(user.id);
      const data = await libraryOrganizationService.getCollections();
      setCollections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('LibraryModal: unable to load collections', error);
      setCollectionError('Unable to load folders right now.');
    } finally {
      setIsLoadingCollections(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen, fetchCollections]);

  useEffect(() => {
    if (isOpen) {
      // Initialize supabaseStorageService with current user
      if (user?.id) {
        console.log('LibraryModal: Initializing supabaseStorageService with user:', user.id)
        supabaseStorageService.setCurrentUser(user.id)
      } else {
        console.warn('LibraryModal: No user ID available')
        supabaseStorageService.setCurrentUser(null)
      }
      loadData();
    }
  }, [isOpen, activeTab, refreshTrigger, user?.id]);

  const loadData = async () => {
    console.log('LibraryModal: Loading data...');
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      supabaseStorageService.setCurrentUser(user.id);

      // Try to load from Supabase first (primary storage)
      const supabaseBooks = await supabaseStorageService.getAllBooks();
      console.log('LibraryModal: Loaded books from Supabase:', {
        count: supabaseBooks.length,
        books: supabaseBooks.map(book => ({
          id: book.id,
          title: book.title,
          type: book.type,
          savedAt: book.savedAt,
          hasFileData: !!book.fileData,
          hasPdfDataBase64: !!book.pdfDataBase64,
          hasPageTexts: !!book.pageTexts?.length
        }))
      });
      
      setIsSupabaseData(true);
      const normalizedBooks = (supabaseBooks as EnhancedSavedBook[]).map(normalizeBook);
      setBooks(normalizedBooks);
      
      // Load notes and audio from Supabase
      const supabaseNotes = await supabaseStorageService.getAllNotes();
      let supabaseAudio: SavedAudio[] = [];
      try {
        supabaseAudio = await supabaseStorageService.getAllAudio();
      } catch (audioError) {
        console.warn('LibraryModal: Unable to load audio from Supabase, continuing without audio data.', audioError);
        supabaseAudio = [];
      }
      
      setNotes(supabaseNotes);
      setAudio(supabaseAudio);
      
      // Use Supabase storage info
      setStorageInfo(supabaseStorageService.getStorageInfo());
      
      // Check Google Drive status
      const isEnabled = await supabaseStorageService.isGoogleDriveEnabled();
      setIsGoogleDriveEnabled(isEnabled);
      
      const status = await supabaseStorageService.getSyncStatus();
      setSyncStatus(status);
      
      console.log('LibraryModal: Data loading completed from Supabase');
      
    } catch (error) {
      console.error('LibraryModal: Error loading from Supabase, falling back to localStorage:', error);
      
      // Fallback to localStorage if Supabase fails
      storageService.cleanupCorruptedBooks();
      
      const allBooks = storageService.getAllBooks();
      console.log('LibraryModal: Loaded books from localStorage (fallback):', {
        count: allBooks.length,
        books: allBooks.map(book => ({
          id: book.id,
          title: book.title,
          type: book.type,
          savedAt: book.savedAt,
          hasFileData: !!book.fileData,
          hasPdfDataBase64: !!book.pdfDataBase64
        }))
      });
      
      setIsSupabaseData(false);
      const normalizedBooks = (allBooks as EnhancedSavedBook[]).map(normalizeBook);
      setBooks(normalizedBooks);
      setNotes(storageService.getAllNotes());
      setAudio(await storageService.getAllAudio());
      setStorageInfo(storageService.getStorageInfo());
      
      // Check Google Drive status
      const isEnabled = await storageService.isGoogleDriveEnabled();
      setIsGoogleDriveEnabled(isEnabled);
      
      const status = await storageService.getSyncStatus();
      setSyncStatus(status);
      
      console.log('LibraryModal: Data loading completed from localStorage (fallback)');
    }
  };

  const handleSelectCollection = useCallback((collectionId: string | null) => {
    setSelectedCollectionId(prev => (prev === collectionId ? null : collectionId));
  }, []);

  const handleCreateCollection = useCallback(async (parentId?: string) => {
    if (!user?.id) {
      alert('You need to be signed in to create folders.');
      return;
    }

    const defaultName = parentId ? 'New subfolder' : 'New folder';
    const value = window.prompt('Folder name', defaultName);
    if (value === null) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      alert('Folder name cannot be empty.');
      return;
    }

    setIsCreatingCollection(true);
    try {
      libraryOrganizationService.setCurrentUser(user.id);
      const siblings = collections.filter(
        (collection) => (collection.parent_id ?? null) === (parentId ?? null)
      );
      const newCollection = await libraryOrganizationService.createCollection({
        name: trimmed,
        parent_id: parentId ?? null,
        color: '#3B82F6',
        icon: 'folder',
        is_favorite: false,
        display_order: siblings.length,
      });
      setSelectedCollectionId(newCollection.id);
      await fetchCollections();
    } catch (error) {
      console.error('LibraryModal: failed to create collection', error);
      alert('Unable to create folder. Please try again.');
    } finally {
      setIsCreatingCollection(false);
    }
  }, [collections, fetchCollections, user?.id]);

  const handleRenameCollection = useCallback(async (collectionId: string, name: string) => {
    if (!user?.id) {
      alert('You need to be signed in to rename folders.');
      return;
    }

    setCollectionActionBusyId(collectionId);
    try {
      libraryOrganizationService.setCurrentUser(user.id);
      await libraryOrganizationService.updateCollection(collectionId, { name });
      setCollections(prev =>
        prev.map(collection =>
          collection.id === collectionId ? { ...collection, name } : collection
        )
      );
    } catch (error) {
      console.error('LibraryModal: failed to rename collection', error);
      alert('Unable to rename folder. Showing the latest data.');
      await fetchCollections();
    } finally {
      setCollectionActionBusyId(null);
    }
  }, [fetchCollections, user?.id]);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!user?.id) {
      alert('You need to be signed in to delete folders.');
      return;
    }
    const confirmed = window.confirm('Delete this folder? Documents inside will stay in your library.');
    if (!confirmed) {
      return;
    }

    setCollectionActionBusyId(collectionId);
    try {
      libraryOrganizationService.setCurrentUser(user.id);
      await libraryOrganizationService.deleteCollection(collectionId);
      setCollections(prev => prev.filter(collection => collection.id !== collectionId));
      if (selectedCollectionId === collectionId) {
        setSelectedCollectionId(null);
      }
    } catch (error) {
      console.error('LibraryModal: failed to delete collection', error);
      alert('Unable to delete folder. Please try again.');
      await fetchCollections();
    } finally {
      setCollectionActionBusyId(null);
    }
  }, [fetchCollections, selectedCollectionId, user?.id]);

  const handleToggleCollectionFavorite = useCallback(async (collectionId: string, isFavorite: boolean) => {
    if (!user?.id) {
      alert('You need to be signed in to favorite folders.');
      return;
    }

    setCollectionActionBusyId(collectionId);
    try {
      libraryOrganizationService.setCurrentUser(user.id);
      await libraryOrganizationService.updateCollection(collectionId, { is_favorite: isFavorite });
      setCollections(prev =>
        prev.map(collection =>
          collection.id === collectionId ? { ...collection, is_favorite: isFavorite } : collection
        )
      );
    } catch (error) {
      console.error('LibraryModal: failed to update favorite state', error);
      alert('Unable to update folder favorite state.');
      await fetchCollections();
    } finally {
      setCollectionActionBusyId(null);
    }
  }, [fetchCollections, user?.id]);

  const handleReorderCollections = useCallback(async (parentId: string | null, orderedIds: string[]) => {
    if (!user?.id) {
      return;
    }

    try {
      libraryOrganizationService.setCurrentUser(user.id);
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
      console.error('LibraryModal: failed to reorder collections', error);
      await fetchCollections();
    }
  }, [fetchCollections, user?.id]);

  const handleMoveCollection = useCallback(async (collectionId: string) => {
    if (!user?.id) {
      alert('You need to be signed in to move folders.');
      return;
    }

    const options = collections
      .filter(collection => collection.id !== collectionId)
      .map(collection => collection.name)
      .join(', ');
    const message = options
      ? `Move into which folder? Type the exact name.\nAvailable: ${options}\nLeave blank for root.`
      : 'Move into which folder? Leave blank for root.';
    const target = window.prompt(message, '');
    if (target === null) {
      return;
    }
    const trimmed = target.trim();
    const newParentId =
      trimmed.length === 0
        ? null
        : collections.find(collection => collection.name.toLowerCase() === trimmed.toLowerCase())?.id ?? null;

    if (trimmed.length > 0 && !newParentId) {
      alert('No folder matched that name.');
      return;
    }

    setCollectionActionBusyId(collectionId);
    try {
      libraryOrganizationService.setCurrentUser(user.id);
      await libraryOrganizationService.moveCollection(collectionId, newParentId);
      await fetchCollections();
    } catch (error) {
      console.error('LibraryModal: failed to move collection', error);
      alert('Unable to move folder. Please try again.');
    } finally {
      setCollectionActionBusyId(null);
    }
  }, [collections, fetchCollections, user?.id]);

  const handleOpenCollectionDetails = useCallback((collection: Collection) => {
    alert(`Folder details\nName: ${collection.name}`);
  }, []);

  const displayedBooks = useMemo(() => {
    if (!selectedCollectionId) {
      return books;
    }
    // TODO: connect documents to folders once metadata is available so we can filter by selection.
    return books;
  }, [books, selectedCollectionId]);

  const totalDocuments = displayedBooks.length;

  // Helper function to sanitize pageTexts arrays
  const sanitizePageTexts = (pageTexts: any[] | undefined): string[] => {
    if (!pageTexts || !Array.isArray(pageTexts)) return [];
    return pageTexts.map(text => typeof text === 'string' ? text : String(text || ''));
  };

  const getDocumentProgress = (book: EnhancedSavedBook): number => {
    if (typeof book.readingProgress === 'number' && !Number.isNaN(book.readingProgress)) {
      const normalized =
        book.readingProgress <= 1
          ? book.readingProgress * 100
          : book.readingProgress;
      return Math.max(0, Math.min(100, Math.round(normalized)));
    }

    if (
      typeof book.totalPages === 'number' &&
      book.totalPages > 0 &&
      typeof book.lastReadPage === 'number'
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round((book.lastReadPage / Math.max(book.totalPages, 1)) * 100)
        )
      );
    }

    return 0;
  };

  const renderProgressBar = (progress: number) => (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between text-xs"
        style={{ color: 'rgba(203,213,225,0.7)' }}
      >
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(148,163,184,0.18)' }}
      >
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #60a5fa 0%, #8b5cf6 45%, #ec4899 100%)',
            boxShadow: '0 0 12px rgba(129,140,248,0.35)'
          }}
        ></div>
      </div>
    </div>
  );

  const handleRenameDocument = async (book: EnhancedSavedBook) => {
    if (renameBusyIds.includes(book.id)) {
      return;
    }

    const value = window.prompt('Rename document', book.title);
    if (value === null) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed === book.title) {
      return;
    }

    setRenameBusyIds(prev => [...prev, book.id]);
    try {
      if (isSupabaseData) {
        if (!user?.id) {
          throw new Error('User not authenticated.');
        }
        supabaseStorageService.setCurrentUser(user.id);
        await supabaseStorageService.updateBook(book.id, { title: trimmed });
        await loadData();
      } else {
        await storageService.saveBook({ ...book, title: trimmed });
        setBooks(prev => prev.map(existing => (existing.id === book.id ? { ...existing, title: trimmed } : existing)));
      }
    } catch (error) {
      console.error('LibraryModal: failed to rename document', error);
      alert('Unable to rename document. Please try again.');
    } finally {
      setRenameBusyIds(prev => prev.filter(id => id !== book.id));
    }
  };

  const handleToggleFavorite = async (book: EnhancedSavedBook) => {
    if (favoriteBusyIds.includes(book.id)) return;

    const updatedBook = { ...book, isFavorite: !book.isFavorite };
    setFavoriteBusyIds((prev) => [...prev, book.id]);
    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? updatedBook : b))
    );

    try {
      if (isSupabaseData) {
        await supabaseStorageService.updateBookMetadata(book.id, {
          is_favorite: updatedBook.isFavorite,
        });
      } else {
        await storageService.saveBook(updatedBook);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? book : b))
      );
      alert('Failed to update favorite status. Please try again.');
    } finally {
      setFavoriteBusyIds((prev) => prev.filter((id) => id !== book.id));
    }
  };

  const renderFavoriteButton = (book: EnhancedSavedBook, options: { compact?: boolean } = {}) => {
    const isBusy = favoriteBusyIds.includes(book.id);
    const isFavorite = !!book.isFavorite;
    const paddingClass = options.compact ? 'p-1.5' : 'p-2';

    return (
      <button
        onClick={() => handleToggleFavorite(book)}
        disabled={isBusy}
        className={`${paddingClass} rounded transition-colors`}
        style={{
          color: isFavorite ? '#f59e0b' : 'var(--color-text-secondary)',
          opacity: isBusy ? 0.6 : 1,
        }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className="w-4 h-4"
          fill={isFavorite ? '#f59e0b' : 'transparent'}
        />
      </button>
    );
  };

  const handleOpenBook = async (book: EnhancedSavedBook) => {
    try {
      let workingBook: EnhancedSavedBook = { ...book };

      console.log('Opening book from Library:', {
        id: workingBook.id,
        title: workingBook.title,
        type: workingBook.type,
        hasFileData: !!workingBook.fileData,
        hasPdfDataBase64: !!workingBook.pdfDataBase64,
        fileDataType: typeof workingBook.fileData,
        fileDataConstructor: workingBook.fileData?.constructor?.name,
        fileDataLength: workingBook.fileData ? (workingBook.fileData as any).byteLength || (workingBook.fileData as any).length : 0
      });

      // If the book was loaded from Supabase metadata and the binary data isn't loaded yet, fetch it now.
      if (
        isSupabaseData &&
        (workingBook.type === 'pdf' || workingBook.type === 'epub') &&
        !workingBook.fileData
      ) {
        try {
          console.log('Fetching full book data from Supabase for', workingBook.id);
          const fullBook = await supabaseStorageService.getBook(workingBook.id);
          if (fullBook?.fileData) {
            workingBook = {
              ...workingBook,
              fileData: fullBook.fileData,
              pageTexts: fullBook.pageTexts?.length ? fullBook.pageTexts : workingBook.pageTexts,
              cleanedPageTexts: fullBook.cleanedPageTexts ?? workingBook.cleanedPageTexts,
              totalPages: fullBook.totalPages ?? workingBook.totalPages,
              pdfDataBase64: fullBook.pdfDataBase64 ?? workingBook.pdfDataBase64,
              text_content: fullBook.text_content ?? workingBook.text_content,
            };
            console.log('Supabase book data loaded:', {
              byteLength: fullBook.fileData.byteLength,
              totalPages: fullBook.totalPages,
              hasPageTexts: !!fullBook.pageTexts?.length
            });
          } else {
            console.warn('Supabase book data missing binary payload', { bookId: workingBook.id });
          }
        } catch (fetchError) {
          console.error('Failed to load book data from Supabase', fetchError);
          alert('Failed to load book file from storage. Please try again.');
          return;
        }
      }

    // Ensure binary data is properly loaded for PDF/EPUB books
    if (workingBook.type === 'pdf' || workingBook.type === 'epub') {
      const isPdf = workingBook.type === 'pdf';
      const formatLabel = isPdf ? 'PDF' : 'EPUB';

      if (!workingBook.fileData && workingBook.pdfDataBase64) {
        console.log('Converting base64 to ArrayBuffer...');
        try {
          // Convert base64 to ArrayBuffer if needed
          const binary = atob(workingBook.pdfDataBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          workingBook.fileData = bytes.buffer as ArrayBuffer;
          console.log('Converted to ArrayBuffer:', {
            byteLength: workingBook.fileData.byteLength,
            constructor: workingBook.fileData.constructor.name
          });
        } catch (error) {
          console.error('Error converting base64 to ArrayBuffer:', error);
          throw new Error(`Failed to load ${formatLabel} data from library`);
        }
      } else if (!workingBook.fileData && !workingBook.pdfDataBase64) {
        console.error(`${formatLabel} book has no data:`, {
          id: workingBook.id,
          title: workingBook.title,
          hasFileData: !!workingBook.fileData,
          hasPdfDataBase64: !!workingBook.pdfDataBase64
        });
        throw new Error(`${formatLabel} data is missing from library. Please re-upload the file.`);
      } else if (workingBook.fileData && !(workingBook.fileData instanceof ArrayBuffer)) {
        console.log('FileData is not ArrayBuffer, attempting conversion...');
        try {
          // If it's a Uint8Array or similar, convert to ArrayBuffer
          if (workingBook.fileData instanceof Uint8Array) {
            workingBook.fileData = workingBook.fileData.buffer as ArrayBuffer;
          } else if (Array.isArray(workingBook.fileData)) {
            // If it's an array of numbers, convert to ArrayBuffer
            const bytes = new Uint8Array(workingBook.fileData);
            workingBook.fileData = bytes.buffer as ArrayBuffer;
          } else if (typeof workingBook.fileData === 'object' && workingBook.fileData !== null) {
            // Handle legacy data format - this is likely corrupted data from before base64 conversion
            console.warn(`Legacy ${formatLabel} data detected, this book may need to be re-uploaded:`, {
              fileDataType: typeof workingBook.fileData,
              fileDataConstructor: workingBook.fileData.constructor?.name,
              fileDataKeys: Object.keys(workingBook.fileData),
              hasPdfDataBase64: !!workingBook.pdfDataBase64
            });
            throw new Error(`This ${formatLabel} was saved in an old format and cannot be loaded. Please re-upload the file.`);
          } else {
            console.error('Unknown fileData type:', typeof book.fileData, book.fileData?.constructor?.name);
            throw new Error(`Invalid ${formatLabel} data format in library`);
          }
          console.log('Conversion successful:', {
            byteLength: workingBook.fileData.byteLength,
            constructor: workingBook.fileData.constructor.name
          });
        } catch (error) {
          console.error('Error converting fileData to ArrayBuffer:', error);
          throw new Error(`Failed to convert ${formatLabel} data to proper format`);
        }
      }
      
      // Final validation
      if (!workingBook.fileData || !(workingBook.fileData instanceof ArrayBuffer)) {
        console.error(`${formatLabel} data validation failed:`, {
          hasFileData: !!workingBook.fileData,
          fileDataType: typeof workingBook.fileData,
          fileDataConstructor: workingBook.fileData?.constructor?.name,
          hasPdfDataBase64: !!workingBook.pdfDataBase64,
          pdfDataBase64Length: workingBook.pdfDataBase64?.length || 0,
          pdfDataBase64Preview: workingBook.pdfDataBase64?.substring(0, 50) + '...' || 'N/A'
        });
        
        // Try to provide a more helpful error message
        if (workingBook.pdfDataBase64) {
          throw new Error(`${formatLabel} data conversion failed. The file may be corrupted. Please try re-uploading.`);
        } else {
          throw new Error(`${formatLabel} data is missing. Please try re-uploading the file.`);
        }
      }
    }

    // Persist hydrated data back into state so future openings don't need another fetch
    setBooks(prev =>
      prev.map(existing =>
        existing.id === workingBook.id
          ? {
              ...existing,
              fileData: workingBook.fileData,
              pageTexts: workingBook.pageTexts,
              cleanedPageTexts: workingBook.cleanedPageTexts,
              totalPages: workingBook.totalPages,
              pdfDataBase64: workingBook.pdfDataBase64,
              text_content: workingBook.text_content,
            }
          : existing
      )
    );

    const cleanedPageTexts = sanitizePageTexts(workingBook.pageTexts);
    const legacyTextContent = (workingBook as { text_content?: string }).text_content;
    const combinedContent =
      cleanedPageTexts.length > 0
        ? cleanedPageTexts.join('\n\n')
        : typeof workingBook.fileData === 'string'
          ? workingBook.fileData
          : legacyTextContent || '';

    const doc = {
      id: workingBook.id,
      name: workingBook.title,
      content: combinedContent,
      type: workingBook.type,
      uploadedAt: workingBook.savedAt,
      pdfData: (() => {
        // CRITICAL: Clone ArrayBuffer and convert to Blob to prevent detachment issues
        // Blobs are safer than ArrayBuffers because they can't be detached by workers
        if (workingBook.type === 'pdf' && workingBook.fileData instanceof ArrayBuffer) {
          try {
            // Check if ArrayBuffer is already detached
            new Uint8Array(workingBook.fileData, 0, 1);
            // Not detached - clone it and convert to Blob for safety
            const clonedBuffer = workingBook.fileData.slice(0);
            const blob = new Blob([clonedBuffer], { type: 'application/pdf' });
            console.log('LibraryModal: Cloned PDF ArrayBuffer and converted to Blob:', {
              originalSize: workingBook.fileData.byteLength,
              clonedSize: clonedBuffer.byteLength,
              blobSize: blob.size
            });
            return blob;
          } catch (error) {
            // Already detached - this shouldn't happen if cloning in supabaseStorageService worked
            console.error('LibraryModal: ArrayBuffer is detached, cannot clone:', error);
            throw new Error('PDF data is corrupted. Please try re-opening the document.');
          }
        }
        return undefined;
      })(),
      epubData:
        workingBook.type === 'epub' && workingBook.fileData instanceof ArrayBuffer
          ? new Blob([workingBook.fileData instanceof ArrayBuffer ? workingBook.fileData.slice(0) : workingBook.fileData], { type: 'application/epub+zip' })
          : undefined,
      totalPages: workingBook.totalPages,
      lastReadPage: workingBook.lastReadPage,
      pageTexts: cleanedPageTexts,
      cleanedPageTexts
    };

      console.log('Document created for app store:', {
        id: doc.id,
        type: doc.type,
        hasPdfData: !!doc.pdfData,
        pdfDataType: doc.pdfData ? doc.pdfData.constructor.name : 'undefined',
        pdfDataLength: doc.pdfData ? doc.pdfData.byteLength : 0,
        hasPageTexts: !!doc.pageTexts,
        pageTextsLength: doc.pageTexts?.length || 0,
        pageTextsPreview: doc.pageTexts?.slice(0, 2).map((text, i) => {
          const safeText = typeof text === 'string' ? text : String(text || '')
          return {
            page: i + 1,
            textLength: safeText.length,
            textPreview: safeText.substring(0, 30) + (safeText.length > 30 ? '...' : '')
          }
        }) || []
      });

      useAppStore.getState().setCurrentDocument(doc as any);
      onClose();
    } catch (error) {
      console.error('Failed to open book:', error);
      alert('Failed to open book. Please try again.');
    }
  };

  const handleDeleteBook = async (id: string) => {
    console.log('handleDeleteBook called with id:', id);
    const confirmed = window.confirm('Are you sure you want to move this book to trash?');
    console.log('Confirmation result:', confirmed);
    
    if (confirmed) {
      try {
        console.log('Starting deletion process for book:', id);
        
        // Move to trash in Supabase (primary storage)
        await supabaseStorageService.deleteBook(id);
        console.log('Book moved to trash in Supabase:', id);
        
        // Also delete from localStorage as backup
        try {
          storageService.deleteBook(id);
          console.log('Book deleted from localStorage:', id);
        } catch (localError) {
          console.warn('Failed to delete from localStorage (non-critical):', localError);
        }
        
        // Reload the library
        console.log('Reloading library data...');
        await loadData();
        console.log('Library data reloaded successfully');
        
        alert('File removed to trash');
      } catch (error) {
        console.error('Error deleting book:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        alert(`Failed to move book to trash: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteAudio = async (id: string) => {
    if (confirm('Delete this audio file?')) {
      await storageService.deleteAudio(id);
      loadData();
    }
  };

  const handleExportData = () => {
    const data = storageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ryzomatic-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result as string;
          storageService.importData(data);
          loadData();
          alert('Data imported successfully!');
        } catch (error) {
          alert('Failed to import data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePlayAudio = (audio: SavedAudio) => {
    const url = URL.createObjectURL(audio.audioBlob);
    const audioElement = new Audio(url);
    audioElement.play();
  };

  const handleDownloadAudio = (audio: SavedAudio) => {
    const url = URL.createObjectURL(audio.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${audio.title}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnableGoogleDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const granted = await googleAuthService.ensureDriveAccess({ forcePrompt: true });

      if (granted) {
        const user = googleAuthService.getCurrentUser();
        if (user) {
          simpleGoogleAuth.syncFromGoogleAuth(user);
        }
        await loadData();
        alert('Google Drive sync is now enabled.');
      } else {
        alert('Google Drive access was not granted. Please try again if you want to enable sync.');
      }
    } catch (error) {
      console.error('Failed to enable Google Drive sync', error);
      alert('Could not enable Google Drive sync. Please try again later.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleSyncToGoogleDrive = async () => {
    if (!isGoogleDriveEnabled) {
      alert('Please sign in to Google first');
      return;
    }

    setIsSyncing(true);
    try {
      await storageService.syncToGoogleDrive();
      await storageService.setLastSyncTime();
      await loadData(); // Refresh data
      alert('Successfully synced to Google Drive!');
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromGoogleDrive = async () => {
    if (!isGoogleDriveEnabled) {
      alert('Please sign in to Google first');
      return;
    }

    setIsSyncing(true);
    try {
      await storageService.syncFromGoogleDrive();
      await storageService.setLastSyncTime();
      await loadData(); // Refresh data
      alert('Successfully synced from Google Drive!');
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const modalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!modalRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 pb-12 px-4 md:px-6 overflow-y-auto"
      style={{
        background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.28), rgba(17, 24, 39, 0.86))',
        backdropFilter: 'blur(18px)'
      }}
    >
      <div
        className="w-full max-w-5xl my-auto overflow-hidden text-left align-middle transition-all transform rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.45)] animate-scale-in border"
        style={{
          background: 'linear-gradient(145deg, rgba(15,23,42,0.94), rgba(30,41,59,0.94))',
          borderColor: 'rgba(148,163,184,0.15)'
        }}
      >
        <div className="relative">
            <button 
              onClick={onClose} 
            className="absolute top-6 right-6 p-2 rounded-xl transition-colors"
            style={{
              color: 'var(--color-text-tertiary)',
              backgroundColor: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.12)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.18)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.08)';
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
            }}
            aria-label="Close library"
            >
            <X className="w-5 h-5" />
            </button>

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'rgba(148,163,184,0.12)' }}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%)',
                      boxShadow: '0 20px 40px rgba(99,102,241,0.35)'
                    }}
                  >
                    <Book className="w-7 h-7 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                      My Library
                    </h2>
                    <p className="text-sm md:text-base" style={{ color: 'var(--color-text-tertiary)' }}>
                      Organise your documents, notes, and audio clips.
                    </p>
                  </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: 'rgba(148,163,184,0.12)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid rgba(148,163,184,0.16)'
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: isSupabaseData ? '#34d399' : '#fbbf24' }}
                    ></span>
                    <span>{isSupabaseData ? 'Supabase Sync' : 'Local Workspace'}</span>
                  </div>
                  {syncStatus.lastSync && (
                    <div
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        backgroundColor: 'rgba(59,130,246,0.12)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59,130,246,0.25)'
                      }}
                    >
                      Last sync · {syncStatus.lastSync.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs md:text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }}>
                  <HardDrive className="w-3 h-3" />
                  Storage: {(storageInfo.used / 1024 / 1024).toFixed(2)} MB of{' '}
                  {storageInfo.max ? `${(storageInfo.max / 1024 / 1024).toFixed(0)} MB` : '∞'}
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }}>
                  <Star className="w-3 h-3" />
                  Favorites: {books.filter((b) => b.isFavorite).length}
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }}>
                  <FileText className="w-3 h-3" />
                  Total Items: {books.length + notes.length + audio.length}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-8 pt-4">
            <div
              className="flex items-center gap-2 rounded-full p-1"
              style={{
                backgroundColor: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.14)'
              }}
            >
              {[
                { key: 'documents', label: 'Documents', count: books.length, icon: Book },
                { key: 'notes', label: 'Notes', count: notes.length, icon: FileText },
                { key: 'audio', label: 'Audio', count: audio.length, icon: Music }
              ].map(({ key, label, count, icon: Icon }) => {
                const active = activeTab === key;
                return (
            <button
                    key={key}
                    onClick={() => setActiveTab(key as typeof activeTab)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all"
              style={{
                      background: active
                        ? 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))'
                        : 'transparent',
                      color: active ? '#ffffff' : 'var(--color-text-secondary)',
                      boxShadow: active ? '0 12px 22px rgba(99,102,241,0.35)' : 'none',
                      border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent'
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>
                      {label}{' '}
                      <span
                        className="ml-1 rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(148,163,184,0.18)',
                          color: active ? '#ffffff' : 'var(--color-text-secondary)'
              }}
                      >
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
            {activeTab === 'documents' && (
              <div className="flex flex-col gap-4 lg:flex-row">
                <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0">
                  <div
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: 'rgba(148,163,184,0.16)',
                      backgroundColor: 'rgba(15,23,42,0.6)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                        Folders
                      </h3>
                      <button
                        onClick={() => handleCreateCollection()}
                        disabled={isCreatingCollection || !user?.id}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all"
                        style={{
                          color: '#818cf8',
                          backgroundColor: 'rgba(129,140,248,0.12)',
                          opacity: isCreatingCollection || !user?.id ? 0.5 : 1
                        }}
                        title={user?.id ? 'New folder' : 'Sign in to create folders'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New
                      </button>
              </div>
                    {collectionError && (
                      <p className="text-xs mb-3" style={{ color: '#fda4af' }}>
                        {collectionError}
                      </p>
                    )}
                    {isLoadingCollections ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#818cf8' }} />
                      </div>
                    ) : collections.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        No folders yet. Create one to start organizing documents.
                      </p>
                    ) : (
                      <CollectionTree
                        collections={collections}
                        selectedCollectionId={selectedCollectionId}
                        onSelectCollection={handleSelectCollection}
                        onCreateCollection={handleCreateCollection}
                        onRenameCollection={handleRenameCollection}
                        onOpenCollectionDetails={handleOpenCollectionDetails}
                        onDeleteCollection={handleDeleteCollection}
                        onToggleFavorite={handleToggleCollectionFavorite}
                        onReorderCollections={handleReorderCollections}
                        onMoveCollection={handleMoveCollection}
                        className="max-h-[420px] overflow-y-auto pr-1"
                      />
                    )}
                  </div>
                </aside>

                <div className="flex-1 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
                      Showing <span style={{ color: 'var(--color-text-primary)' }}>{totalDocuments}</span>{' '}
                      {totalDocuments === 1 ? 'document' : 'documents'}
                    </p>
                    <div
                      className="flex items-center gap-1 rounded-full px-1.5 py-1.5"
                      style={{
                        backgroundColor: 'rgba(148,163,184,0.08)',
                        border: '1px solid rgba(148,163,184,0.16)'
                      }}
                    >
                      {viewModes.map(({ key, label, icon: Icon }) => {
                        const active = viewMode === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setViewMode(key)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-all"
                            style={{
                              background: active
                                ? 'linear-gradient(135deg, rgba(59,130,246,0.85), rgba(129,140,248,0.85))'
                                : 'transparent',
                              color: active ? '#ffffff' : 'var(--color-text-secondary)',
                              boxShadow: active ? '0 12px 20px rgba(59,130,246,0.3)' : 'none',
                              border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent'
                            }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
            </button>
                        );
                      })}
                    </div>
                  </div>

                  {totalDocuments === 0 ? (
                    <div
                      className="rounded-2xl border text-center py-14"
                      style={{
                        borderColor: 'rgba(148,163,184,0.12)',
                        background: 'linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.65))'
                      }}
                    >
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'rgba(129,140,248,0.9)' }}>
                        <FileText className="w-7 h-7" />
                      </div>
                      <p className="mt-4 text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>Your shelf is waiting</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Upload a PDF or note to populate this space with your reading adventures.
                      </p>
                    </div>
                  ) : viewMode === 'list' ? (
                    <div className="space-y-4">
                      {displayedBooks.map(book => {
                      const progress = getDocumentProgress(book);
                        const isRenaming = renameBusyIds.includes(book.id);
                      return (
                        <div
                          key={book.id}
                          className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_25px_50px_rgba(15,23,42,0.45)]"
                          style={{
                            borderColor: 'rgba(148,163,184,0.14)',
                            background: 'linear-gradient(145deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92))'
                          }}
                        >
                          <div
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                              background:
                                'radial-gradient(120% 140% at 0% 0%, rgba(99,102,241,0.12), rgba(15,23,42,0))'
                            }}
                          />
                          <div className="relative space-y-4 p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div
                                className="flex-1 cursor-pointer space-y-2"
                                onClick={() => handleOpenBook(book)}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
                                    style={{
                                      backgroundColor: 'rgba(148,163,184,0.12)',
                                      color: 'var(--color-text-secondary)'
                                    }}
                                  >
                                    {book.type.toUpperCase()}
                                  </span>
                                  {book.isFavorite && (
                                    <span
                                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                                      style={{
                                        backgroundColor: 'rgba(250,204,21,0.18)',
                                        color: '#facc15'
                                      }}
                                    >
                                      <Star className="w-3 h-3 fill-current" /> Favourite
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-lg font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
                                  {book.title}
                                </h3>
                                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                                  {book.totalPages ? `${book.totalPages} pages` : 'Text file'}
                                  {book.lastReadPage ? ` • Last read page ${book.lastReadPage}` : ''}
                                  {' • Saved '}
                                  {new Date(book.savedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderFavoriteButton(book)}
            <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleRenameDocument(book);
                                  }}
                                  disabled={isRenaming}
                                  className="rounded-xl p-2 transition-all duration-300"
              style={{
                                    color: isRenaming ? 'var(--color-text-tertiary)' : '#a855f7',
                                    backgroundColor: 'rgba(168,85,247,0.12)',
                                    opacity: isRenaming ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                                    if (!isRenaming) {
                                      e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.12)';
              }}
            >
                                  <Edit3 className="w-4 h-4" />
            </button>
            <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteBook(book.id);
                                  }}
                                  className="rounded-xl p-2 transition-all duration-300"
              style={{
                                    color: '#f87171',
                                    backgroundColor: 'rgba(248,113,113,0.12)'
              }}
              onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.22)';
              }}
              onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
              }}
            >
                                  <Trash2 className="w-4 h-4" />
            </button>
          </div>
                            </div>
                            {renderProgressBar(progress)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {displayedBooks.map(book => {
                      const progress = getDocumentProgress(book);
                      const isRenaming = renameBusyIds.includes(book.id);
                    return (
                      <div
                        key={book.id}
                          className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.45)]"
                        style={{
                            borderColor: 'rgba(148,163,184,0.14)',
                            background: 'linear-gradient(145deg, rgba(30,41,59,0.92), rgba(17,24,39,0.92))'
                          }}
                        >
                          <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(99,102,241,0.28), rgba(15,23,42,0))'
                            }}
                          />
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => handleOpenBook(book)}
                            >
                              <h3 className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {book.title}
                              </h3>
                              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                {book.type.toUpperCase()} • {book.totalPages ? `${book.totalPages} pages` : 'Text file'}
                              </p>
                              {book.lastReadPage && (
                                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                  Last read: Page {book.lastReadPage}
                                </p>
                              )}
                            </div>
                            {renderFavoriteButton(book, { compact: true })}
                          </div>
                          <div className="mt-4">
                            {renderProgressBar(progress)}
                          </div>
                          <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            <span>Saved {new Date(book.savedAt).toLocaleDateString()}</span>
                            <button
                              onClick={() => handleRenameDocument(book)}
                              disabled={isRenaming}
                              className="rounded-xl p-1.5 transition-all"
                              style={{
                                color: isRenaming ? 'var(--color-text-tertiary)' : '#a855f7',
                                backgroundColor: 'rgba(168,85,247,0.12)',
                                opacity: isRenaming ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                                if (!isRenaming) {
                                  e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.22)';
                                }
                        }}
                        onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.12)';
                              }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBook(book.id)}
                              className="rounded-xl p-1.5 transition-all"
                              style={{
                                color: '#f87171',
                                backgroundColor: 'rgba(248,113,113,0.12)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.22)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
                        }}
                      >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {displayedBooks.map(book => {
                      const progress = getDocumentProgress(book);
                      const snippet =
                        book.pageTexts && book.pageTexts.length > 0
                          ? book.pageTexts[0]
                          : undefined;
                      const isRenaming = renameBusyIds.includes(book.id);
                      return (
                        <div
                          key={book.id}
                          className="group relative overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_25px_50px_rgba(15,23,42,0.5)]"
                          style={{
                            borderColor: 'rgba(148,163,184,0.14)',
                            background: 'linear-gradient(155deg, rgba(30,41,59,0.94), rgba(17,24,39,0.94))'
                          }}
                        >
                          <div
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                              background:
                                'radial-gradient(120% 140% at 10% -20%, rgba(236,72,153,0.2), rgba(15,23,42,0))'
                            }}
                          />
                          <div className="relative flex flex-col gap-5 p-7">
                            <div className="flex items-start justify-between gap-4">
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => handleOpenBook(book)}
                              >
                                <h3 className="text-xl font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                                  {book.title}
                                </h3>
                                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {book.type.toUpperCase()} • {book.totalPages ? `${book.totalPages} pages` : 'Text file'}
                        </p>
                                <p className="mt-2 text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                          Saved {new Date(book.savedAt).toLocaleDateString()}
                                  {book.lastReadPage && ` • Last read page ${book.lastReadPage}`}
                        </p>
                      </div>
                              <div className="flex items-center gap-2">
                                {renderFavoriteButton(book)}
                      <button
                                  onClick={() => handleRenameDocument(book)}
                                  disabled={isRenaming}
                                  className="rounded-xl px-3 py-2 text-xs font-medium transition-all"
                                  style={{
                                    color: isRenaming ? 'var(--color-text-tertiary)' : '#a855f7',
                                    backgroundColor: 'rgba(168,85,247,0.12)',
                                    border: '1px solid rgba(168,85,247,0.24)',
                                    opacity: isRenaming ? 0.5 : 1
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isRenaming) {
                                      e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.22)';
                          }
                        }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(168,85,247,0.12)';
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleDeleteBook(book.id)}
                                  className="rounded-xl px-3 py-2 text-xs font-medium transition-all"
                        style={{ 
                                    color: '#f87171',
                                    backgroundColor: 'rgba(248,113,113,0.12)',
                                    border: '1px solid rgba(248,113,113,0.24)'
                        }}
                        onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.22)';
                        }}
                        onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                              </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-3">
                              <div className="space-y-4 md:col-span-2">
                                {snippet && (
                                  <div
                                    className="rounded-2xl border p-4"
                                    style={{
                                      borderColor: 'rgba(148,163,184,0.14)',
                                      backgroundColor: 'rgba(148,163,184,0.08)'
                                    }}
                                  >
                                    <p className="mb-2 text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                                      First page preview
                                    </p>
                                    <p className="text-sm leading-relaxed line-clamp-4" style={{ color: 'var(--color-text-secondary)' }}>
                                      {snippet}
                                    </p>
                                  </div>
                                )}
                                <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                                  {renderProgressBar(progress)}
                                </div>
                              </div>
                              <div
                                className="space-y-3 rounded-2xl border p-4"
                                style={{
                                  borderColor: 'rgba(148,163,184,0.14)',
                                  backgroundColor: 'rgba(148,163,184,0.06)'
                                }}
                              >
                                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                                  Details
                                </p>
                                <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                  <li>Source: {isSupabaseData ? 'Supabase' : 'Local storage'}</li>
                                  <li>Size: {formatBookSize(book)}</li>
                                  <li>Favourite: {book.isFavorite ? 'Yes' : 'No'}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                    </div>
                  );
                    })}
                  </div>
                )}
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                {notes.length === 0 ? (
                  <div
                    className="rounded-2xl border text-center py-12"
                    style={{
                      borderColor: 'rgba(148,163,184,0.12)',
                      background: 'linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.65))'
                    }}
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: 'rgba(96,165,250,0.9)' }}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="mt-3 text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>No notes yet</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Highlight passages or jot down ideas to see them appear here.
                    </p>
                  </div>
                ) : (
                  notes.map(note => (
                    <div
                      key={note.id}
                      className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_18px_35px_rgba(15,23,42,0.4)]"
                      style={{
                        borderColor: 'rgba(148,163,184,0.14)',
                        background: 'linear-gradient(155deg, rgba(30,41,59,0.94), rgba(17,24,39,0.94))'
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background:
                            'radial-gradient(120% 140% at 10% -20%, rgba(59,130,246,0.18), rgba(15,23,42,0))'
                        }}
                      />
                      <div className="relative flex items-start justify-between gap-4 p-6">
                        <div className="flex-1 space-y-3">
                          {note.selectedText && (
                            <p className="text-sm italic leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                              “{note.selectedText}”
                            </p>
                          )}
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                            {note.content}
                          </p>
                          <div className="flex items-center gap-3 text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                            {note.pageNumber && <span>Page {note.pageNumber}</span>}
                            <span>•</span>
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="rounded-xl p-2 transition-all"
                          style={{
                            color: '#f87171',
                            backgroundColor: 'rgba(248,113,113,0.12)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.22)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-4">
                {audio.length === 0 ? (
                  <div
                    className="rounded-2xl border text-center py-12"
                    style={{
                      borderColor: 'rgba(148,163,184,0.12)',
                      background: 'linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.65))'
                    }}
                  >
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'rgba(45,212,191,0.12)', color: 'rgba(45,212,191,0.9)' }}>
                      <Music className="w-6 h-6" />
                    </div>
                    <p className="mt-3 text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>No audio yet</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Generate speech snippets to review your favourite sections hands-free.
                    </p>
                  </div>
                ) : (
                  audio.map(item => (
                    <div
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_18px_35px_rgba(15,23,42,0.4)]"
                      style={{
                        borderColor: 'rgba(148,163,184,0.14)',
                        background: 'linear-gradient(155deg, rgba(30,41,59,0.94), rgba(17,24,39,0.94))'
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background:
                            'radial-gradient(120% 140% at 10% -20%, rgba(16,185,129,0.18), rgba(15,23,42,0))'
                        }}
                      />
                      <div className="relative flex items-center justify-between gap-4 p-6">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.title}</h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Pages {item.pageRange.start}-{item.pageRange.end} • {item.voiceName}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(item)}
                            className="rounded-xl p-2 transition-all"
                            style={{
                              color: '#60a5fa',
                              backgroundColor: 'rgba(96,165,250,0.12)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.22)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.12)';
                            }}
                          >
                            <Music className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadAudio(item)}
                            className="rounded-xl p-2 transition-all"
                            style={{
                              color: '#34d399',
                              backgroundColor: 'rgba(52,211,153,0.12)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(52,211,153,0.22)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(52,211,153,0.12)';
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAudio(item.id)}
                            className="rounded-xl p-2 transition-all"
                            style={{
                              color: '#f87171',
                              backgroundColor: 'rgba(248,113,113,0.12)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.22)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.12)';
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-8 py-6 border-t"
            style={{
              borderColor: 'rgba(148,163,184,0.12)',
              background: 'linear-gradient(135deg, rgba(17,24,39,0.82), rgba(15,23,42,0.9))'
            }}
          >
            <div className="grid gap-4 md:grid-cols-[2fr_3fr] md:items-center">
              <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="w-4 h-4" style={{ color: 'rgba(148,163,184,0.9)' }} />
                  <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Storage usage {storageInfo.percentage.toFixed(0)}%
                </span>
              </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(148,163,184,0.18)' }}>
              <div
                    className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(storageInfo.percentage, 100)}%`,
                      background: 'linear-gradient(90deg, #60a5fa 0%, #a855f7 50%, #ec4899 100%)',
                      boxShadow: '0 0 14px rgba(129,140,248,0.35)'
                }}
                  />
            </div>
                  </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {isGoogleDriveEnabled ? (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
                    style={{
                      borderColor: 'rgba(16,185,129,0.28)',
                      backgroundColor: 'rgba(16,185,129,0.12)',
                      color: '#34d399'
                    }}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span className="font-medium">Drive sync enabled</span>
                  {syncStatus.lastSync && (
                      <span style={{ color: 'rgba(16,185,129,0.8)' }}>
                        · Last sync {syncStatus.lastSync.toLocaleDateString()}
                    </span>
                  )}
                    <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncToGoogleDrive}
                    disabled={isSyncing}
                        className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 transition-all disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        Upload
                  </button>
                  <button
                    onClick={handleSyncFromGoogleDrive}
                    disabled={isSyncing}
                        className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 transition-all disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        Download
                  </button>
                </div>
              </div>
                ) : (
                  <div
                    className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
                    style={{
                      borderColor: 'rgba(148,163,184,0.18)',
                      backgroundColor: 'rgba(148,163,184,0.08)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>Connect Google Drive to sync between devices.</span>
                    <button
                      onClick={handleEnableGoogleDrive}
                      disabled={isConnectingDrive}
                      className="rounded-full bg-white/10 px-3 py-1 font-medium text-[11px] uppercase tracking-wide transition-all disabled:opacity-60"
                    >
                      {isConnectingDrive ? 'Connecting…' : 'Enable'}
                    </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleExportData}
                    className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all"
                style={{
                      borderColor: 'rgba(148,163,184,0.16)',
                  color: 'var(--color-text-primary)',
                      backgroundColor: 'rgba(148,163,184,0.08)'
                }}
                onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.18)';
                }}
                onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.08)';
                }}
              >
                <Download className="w-4 h-4" />
                    Export
              </button>
              <label 
                    className="flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all"
                style={{
                      borderColor: 'rgba(148,163,184,0.16)',
                  color: 'var(--color-text-primary)',
                      backgroundColor: 'rgba(148,163,184,0.08)'
                }}
                onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.18)';
                }}
                onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(148,163,184,0.08)';
                }}
              >
                <Upload className="w-4 h-4" />
                    Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
      </div>
    </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
}
// Ensure correct version
