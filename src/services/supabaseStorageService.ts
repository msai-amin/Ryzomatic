import { userBooks, userNotes, userAudio, UserBook, UserNote, UserAudio, supabase } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import { bookStorageService } from './bookStorageService';
import { configurePDFWorker } from '../utils/pdfjsConfig';

export interface SavedBook {
  id: string;
  title: string;
  fileName: string;
  type: 'pdf' | 'text';
  savedAt: Date;
  lastReadPage?: number;
  totalPages?: number;
  fileData?: ArrayBuffer | string | Blob;
  pdfDataBase64?: string;
  pageTexts?: string[];
  cleanedPageTexts?: string[]; // Cleaned text for TTS in reading mode
  notes?: Note[];
  googleDriveId?: string;
  syncedAt?: Date;
  s3_key?: string;
  text_content?: string;
  reading_progress?: number;
}

export interface Note {
  id: string;
  content: string;
  pageNumber: number;
  bookId: string;
  bookName: string;
  position?: { x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedAudio {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  audioData: ArrayBuffer;
  audioBlob: Blob;
  duration: number;
  pageRange: { start: number; end: number };
  voiceName: string;
  voiceSettings: Record<string, any>;
  createdAt: Date;
}

class SupabaseStorageService {
  private currentUserId: string | null = null;

  // Initialize with current user
  setCurrentUser(userId: string) {
    this.currentUserId = userId;
    logger.info('SupabaseStorageService initialized', { userId });
  }

  // Check if user is authenticated
  private ensureAuthenticated() {
    if (!this.currentUserId) {
      throw errorHandler.createError(
        'User not authenticated',
        ErrorType.AUTHENTICATION,
        ErrorSeverity.HIGH,
        { context: 'SupabaseStorageService' }
      );
    }
  }

  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Sanitize text to remove problematic Unicode characters for PostgreSQL
  private sanitizeTextForPostgreSQL(text: string): string {
    if (!text) return text;
    
    return text
      // Remove or replace problematic Unicode characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, ' ') // Replace various spaces with regular space
      .replace(/[\uFEFF]/g, '') // Remove zero-width no-break space
      .replace(/[\uFFFD]/g, '?') // Replace replacement character with question mark
      // Handle Unicode escape sequences that cause PostgreSQL issues
      .replace(/\\u[0-9A-Fa-f]{4}/g, '?') // Replace Unicode escape sequences
      .replace(/\\x[0-9A-Fa-f]{2}/g, '?') // Replace hex escape sequences
      .replace(/\\[0-7]{1,3}/g, '?') // Replace octal escape sequences
      .replace(/\\/g, '\\\\') // Escape remaining backslashes
      .replace(/'/g, "''") // Escape single quotes for SQL
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/\0/g, '') // Remove null bytes
      .trim();
  }

  // Sanitize page texts array
  private sanitizePageTexts(pageTexts: string[]): string[] {
    if (!pageTexts || !Array.isArray(pageTexts)) return [];
    
    return pageTexts.map(text => this.sanitizeTextForPostgreSQL(text));
  }

  // Books Management
  async saveBook(book: SavedBook): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const context = { bookId: book.id, userId: this.currentUserId };
      
      // Size limit to prevent disk I/O issues: 5MB
      const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB
      const fileSize = book.fileData instanceof ArrayBuffer ? book.fileData.byteLength : 
                       book.fileData instanceof Blob ? book.fileData.size : 
                       typeof book.fileData === 'string' ? book.fileData.length : 0;
      
      if (book.type === 'pdf' && fileSize > MAX_PDF_SIZE) {
        logger.warn('PDF exceeds size limit', context, undefined, {
          fileSize: fileSize / 1024 / 1024 + 'MB',
          limit: MAX_PDF_SIZE / 1024 / 1024 + 'MB'
        });
        throw errorHandler.createError(
          `PDF file is too large (${(fileSize / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_PDF_SIZE / 1024 / 1024}MB. Please use a smaller file.`,
          ErrorType.VALIDATION,
          ErrorSeverity.MEDIUM,
          { context, fileSize, limit: MAX_PDF_SIZE }
        );
      }
      
      // NEW: Upload file to S3 instead of storing in database
      let s3Key: string | undefined;
      
      if (book.type === 'pdf' && book.fileData) {
        logger.info('Uploading PDF to S3', context, {
          fileSize: fileSize / 1024 / 1024 + 'MB'
        });

        // Convert to Blob if needed
        let fileBlob: Blob;
        if (book.fileData instanceof Blob) {
          fileBlob = book.fileData;
        } else if (book.fileData instanceof ArrayBuffer) {
          fileBlob = new Blob([book.fileData], { type: 'application/pdf' });
        } else {
          throw new Error('Unsupported file data format for PDF');
        }

        // Upload to S3
        const uploadResult = await bookStorageService.uploadBook(fileBlob, {
          userId: this.currentUserId!,
          bookId: book.id,
          title: book.title,
          fileName: book.fileName,
          fileType: book.type,
          fileSize: fileSize,
          totalPages: book.totalPages
        });

        s3Key = uploadResult.s3Key;
        
        logger.info('PDF uploaded to S3 successfully', context, {
          s3Key,
          fileSize: fileSize / 1024 / 1024 + 'MB'
        });
      }

      // Sanitize the book title
      const sanitizedTitle = this.sanitizeTextForPostgreSQL(book.title);
      const sanitizedFileName = this.sanitizeTextForPostgreSQL(book.fileName);
      
      logger.info('Saving book metadata to database', context, {
        title: sanitizedTitle,
        s3Key,
        hasS3Storage: !!s3Key
      });

      // Create database record with S3 key (no large data)
      const userBook: Partial<UserBook> = {
        id: book.id,  // CRITICAL: Use the same ID as the local document for highlights to work
        user_id: this.currentUserId!,
        title: sanitizedTitle,
        file_name: sanitizedFileName,
        file_type: book.type,
        file_size: fileSize,
        total_pages: book.totalPages,
        s3_key: s3Key,  // NEW: Store S3 path instead of file data
        text_content: book.type === 'text' && typeof book.fileData === 'string' 
          ? this.sanitizeTextForPostgreSQL(book.fileData) 
          : undefined,
        tts_metadata: {
          voiceSettings: {},
          lastUsedVoice: null,
          readingSpeed: 1.0
        },
        last_read_page: book.lastReadPage || 1,
        reading_progress: book.lastReadPage && book.totalPages 
          ? (book.lastReadPage / book.totalPages) * 100 
          : 0
      };

      const { data, error } = await userBooks.create(userBook as any);
      
      if (error) {
        // If database save fails, try to clean up S3 upload
        if (s3Key) {
          try {
            await bookStorageService.deleteBook(s3Key, this.currentUserId!);
            logger.info('Cleaned up S3 file after database error', context, { s3Key });
          } catch (cleanupError) {
            logger.error('Failed to cleanup S3 file', context, cleanupError as Error);
          }
        }
        
        logger.error('Database save error', context, error, {
          errorCode: error.code,
          errorMessage: error.message
        });
        
        throw errorHandler.createError(
          `Failed to save book: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context, error: error.message }
        );
      }

      // Save notes if any
      if (book.notes && book.notes.length > 0) {
        for (const note of book.notes) {
          const { error: noteError } = await userNotes.create({
            user_id: this.currentUserId!,
            book_id: data.id,
            page_number: note.pageNumber,
            content: note.content,
            position_x: note.position?.x,
            position_y: note.position?.y
          });
          if (noteError) {
            logger.warn('Failed to save note', context, noteError);
          }
        }
      }

      logger.info('Book saved successfully', context, {
        bookId: data.id,
        title: data.title,
        type: data.file_type,
        s3Key: data.s3_key,
        storageType: s3Key ? 'S3' : 'Database'
      });

    } catch (error) {
      logger.error('Error saving book', { bookId: book.id }, error as Error);
      throw error;
    }
  }

  async getAllBooks(): Promise<SavedBook[]> {
    this.ensureAuthenticated();
    
    try {
      // Only load metadata, not full PDF data (reduces disk I/O)
      const { data, error } = await userBooks.list(this.currentUserId!);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to load books from Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getAllBooks', error: error.message }
        );
      }

      const books: SavedBook[] = data.map(book => {
        const savedBook: SavedBook = {
          id: book.id,
          title: book.title,
          fileName: book.file_name,
          type: book.file_type,
          savedAt: new Date(book.created_at),
          lastReadPage: book.last_read_page,
          totalPages: book.total_pages,
          pageTexts: [], // Not loaded by default to save I/O
          notes: [],
          syncedAt: new Date(book.updated_at)
        };

        // NOTE: PDF data (pdf_data_base64 and page_texts) are NOT loaded here
        // to reduce disk I/O. They will be loaded only when opening a specific book.
        // This prevents the "Disk IO budget consumed" warning from Supabase.

        return savedBook;
      });

      logger.info('Books metadata loaded from Supabase (without PDF data)', { userId: this.currentUserId }, {
        count: books.length,
        books: books.map(b => ({ id: b.id, title: b.title, type: b.type }))
      });

      return books;

    } catch (error) {
      logger.error('Error loading books from Supabase', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async getBook(id: string): Promise<SavedBook | null> {
    this.ensureAuthenticated();
    
    try {
      const context = { bookId: id, userId: this.currentUserId };
      
      const { data, error } = await userBooks.get(id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Book not found
        }
        throw errorHandler.createError(
          `Failed to load book: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context, error: error.message }
        );
      }

      const book: SavedBook = {
        id: data.id,
        title: data.title,
        fileName: data.file_name,
        type: data.file_type,
        savedAt: new Date(data.created_at),
        lastReadPage: data.last_read_page,
        totalPages: data.total_pages,
        pageTexts: [],  // Not stored anymore
        notes: [],
        syncedAt: new Date(data.updated_at),
        s3_key: data.s3_key,
        text_content: data.text_content,
        reading_progress: data.reading_progress,
        cleanedPageTexts: data.page_texts_cleaned || undefined  // Include cleaned texts if available
      };

      // NEW: Download from S3 if s3_key exists
      if (data.file_type === 'pdf' && data.s3_key) {
        try {
          logger.info('Downloading PDF from S3', context, { s3Key: data.s3_key });
          
          book.fileData = await bookStorageService.downloadBook(
            data.s3_key,
            this.currentUserId!
          );
          
          logger.info('PDF downloaded from S3 successfully', context, {
            size: book.fileData.byteLength / 1024 / 1024 + 'MB'
          });

          // EXTRACT PAGETEXTS ON-DEMAND for TTS functionality
          // Since page_texts column was removed to save storage, extract them now
          try {
            logger.info('Extracting pageTexts for TTS functionality', context);
            const { extractStructuredText } = await import('../utils/pdfTextExtractor');
            
            // Import PDF.js dynamically
            const pdfjsLib = await import('pdfjs-dist');
            configurePDFWorker(pdfjsLib);
            
            // CRITICAL: Create a copy of the ArrayBuffer to prevent detachment
            // The original ArrayBuffer will be used by PDFViewer, so we need a copy for text extraction
            const pdfDataCopy = book.fileData.slice(0);
            
            // Load PDF and extract text using the copy
            const pdf = await pdfjsLib.getDocument({ data: pdfDataCopy }).promise;
            const pageTexts: string[] = [];
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = extractStructuredText(textContent.items);
                // Ensure pageText is always a string
                const safePageText = typeof pageText === 'string' ? pageText : String(pageText || '');
                pageTexts.push(safePageText);
              } catch (pageError) {
                logger.warn(`Error extracting text from page ${pageNum}`, context, pageError as Error);
                pageTexts.push(''); // Empty string for failed pages
              }
            }
            
            // Comprehensive sanitization of pageTexts to ensure they are strings
            const sanitizedPageTexts = pageTexts.map((text, index) => {
              if (text === null || text === undefined) {
                logger.warn(`PageText ${index} is null/undefined, converting to empty string`, context);
                return '';
              }
              
              if (typeof text === 'string') {
                return text;
              }
              
              if (typeof text === 'object') {
                console.warn(`PageText ${index} is object, stringifying:`, {
                  textType: typeof text,
                  constructor: (text as any)?.constructor?.name,
                  keys: Object.keys(text || {}),
                  value: JSON.stringify(text).substring(0, 100)
                });
                return JSON.stringify(text);
              }
              
              logger.warn(`PageText ${index} is ${typeof text}, converting to string`, context);
              return String(text);
            });
            book.pageTexts = sanitizedPageTexts;
            logger.info('PageTexts extracted successfully', context, {
              totalPages: pdf.numPages,
              extractedPages: pageTexts.length,
              totalTextLength: pageTexts.map(text => typeof text === 'string' ? text : String(text || '')).join('').length,
              originalArrayBufferSize: book.fileData.byteLength,
              copyArrayBufferSize: pdfDataCopy.byteLength
            });
            
            // Clean up the PDF document to free memory
            pdf.destroy();
            
          } catch (extractError) {
            logger.warn('Failed to extract pageTexts, TTS will not be available', context, extractError as Error);
            book.pageTexts = []; // Empty array if extraction fails
          }
          
        } catch (error) {
          logger.error('Error downloading PDF from S3', context, error as Error);
          throw errorHandler.createError(
            'Failed to download book file. Please try again.',
            ErrorType.STORAGE,
            ErrorSeverity.HIGH,
            context
          );
        }
      } else if (data.file_type === 'text' && data.text_content) {
        book.fileData = data.text_content;
        // For text files, create a single pageTexts entry with sanitization
        const sanitizedTextContent = typeof data.text_content === 'string' 
          ? data.text_content 
          : String(data.text_content || '');
        book.pageTexts = [sanitizedTextContent];
      } else if (data.file_type === 'pdf' && !data.s3_key) {
        logger.error('PDF book has no S3 key', context);
        throw errorHandler.createError(
          'Book file not found. Please re-upload the book.',
          ErrorType.STORAGE,
          ErrorSeverity.HIGH,
          context
        );
      }

      return book;

    } catch (error) {
      logger.error('Error loading book', { bookId: id }, error as Error);
      throw error;
    }
  }

  async updateBook(bookId: string, updates: Partial<SavedBook>): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const updateData: Partial<UserBook> = {};
      
      if (updates.title) updateData.title = updates.title;
      if (updates.lastReadPage !== undefined) updateData.last_read_page = updates.lastReadPage;
      if (updates.totalPages !== undefined) updateData.total_pages = updates.totalPages;
      // Note: pageTexts no longer stored in database (moved to S3)
      
      // Update reading progress
      if (updates.lastReadPage && updates.totalPages) {
        await userBooks.updateReadingProgress(bookId, updates.lastReadPage, updates.totalPages);
      }

      const { error } = await userBooks.update(bookId, updateData);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to update book in Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateBook', bookId, error: error.message }
        );
      }

      logger.info('Book updated in Supabase', { bookId, userId: this.currentUserId });

    } catch (error) {
      logger.error('Error updating book in Supabase', { bookId }, error as Error);
      throw error;
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const context = { bookId, userId: this.currentUserId };
      
      // First, get book to find S3 key (optional - continue even if this fails)
      let book: any = null;
      let s3Key: string | undefined;
      
      try {
        const { data, error } = await userBooks.get(bookId);
        if (error) {
          logger.warn('Could not fetch book before deletion (will continue anyway)', context, error as Error);
        } else {
          book = data;
          s3Key = book?.s3_key;
        }
      } catch (getError) {
        logger.warn('Error fetching book before deletion (will continue anyway)', context, getError as Error);
      }
      
      // Delete from database first
      logger.info('Attempting to delete book from database', context);
      const { data: deleteData, error: deleteError } = await userBooks.delete(bookId);
      
      logger.info('Delete operation completed', context, undefined, {
        hasError: !!deleteError,
        errorMessage: deleteError?.message,
        deleteData: deleteData
      });
      
      if (deleteError) {
        logger.error('Failed to delete book from database', context, deleteError as Error);
        throw errorHandler.createError(
          `Failed to delete book: ${deleteError.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context, error: deleteError.message }
        );
      }

      logger.info('Book deleted from database successfully', context, undefined, {
        deletedRows: deleteData
      });

      // Then delete from S3 if s3_key exists
      if (s3Key) {
        try {
          await bookStorageService.deleteBook(s3Key, this.currentUserId!);
          logger.info('Book file deleted from S3', context, { s3Key });
        } catch (s3Error) {
          // Log but don't fail - database record is already deleted
          logger.error('Failed to delete file from S3 (non-critical)', context, s3Error as Error);
        }
      } else {
        logger.info('No S3 key found, skipping S3 deletion', context);
      }

    } catch (error) {
      logger.error('Error deleting book', { bookId }, error as Error);
      throw error;
    }
  }

  // Notes Management
  async getAllNotes(): Promise<Note[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await userNotes.list(this.currentUserId!);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to load notes from Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getAllNotes', error: error.message }
        );
      }

      const notes: Note[] = data.map(note => ({
        id: note.id,
        content: note.content,
        pageNumber: note.page_number,
        bookId: note.book_id,
        bookName: 'Unknown Book', // Will be populated if needed
        position: note.position_x && note.position_y ? { x: note.position_x, y: note.position_y } : undefined,
        createdAt: new Date(note.created_at),
        updatedAt: new Date(note.updated_at)
      }));

      return notes;

    } catch (error) {
      logger.error('Error loading notes from Supabase', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await userNotes.create({
        user_id: this.currentUserId!,
        book_id: '', // This should be passed from the calling context
        page_number: note.pageNumber,
        content: this.sanitizeTextForPostgreSQL(note.content),
        position_x: note.position?.x,
        position_y: note.position?.y
      });

      if (error) {
        throw errorHandler.createError(
          `Failed to save note to Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'saveNote', error: error.message }
        );
      }

      const savedNote: Note = {
        id: data.id,
        content: data.content,
        pageNumber: data.page_number,
        bookId: data.book_id,
        bookName: 'Unknown Book', // Will be populated if needed
        position: data.position_x && data.position_y ? { x: data.position_x, y: data.position_y } : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return savedNote;

    } catch (error) {
      logger.error('Error saving note to Supabase', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Audio Management
  async getAllAudio(): Promise<SavedAudio[]> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await userAudio.list(this.currentUserId!);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to load audio from Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getAllAudio', error: error.message }
        );
      }

      const audio: SavedAudio[] = data.map(audio => ({
        id: audio.id,
        bookId: audio.book_id,
        pageNumber: audio.page_number,
        title: `Page ${audio.page_number} Audio`,
        audioData: this.base64ToArrayBuffer(audio.audio_data_base64),
        audioBlob: new Blob([this.base64ToArrayBuffer(audio.audio_data_base64)]),
        duration: audio.duration_seconds || 0,
        pageRange: { start: audio.page_number, end: audio.page_number },
        voiceName: audio.voice_settings?.voiceName || 'Unknown',
        voiceSettings: audio.voice_settings,
        createdAt: new Date(audio.created_at)
      }));

      return audio;

    } catch (error) {
      logger.error('Error loading audio from Supabase', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  async saveAudio(audio: Omit<SavedAudio, 'id' | 'createdAt'>): Promise<SavedAudio> {
    this.ensureAuthenticated();
    
    try {
      const audioDataBase64 = this.arrayBufferToBase64(audio.audioData);
      
      const { data, error } = await userAudio.create({
        user_id: this.currentUserId!,
        book_id: audio.bookId,
        page_number: audio.pageNumber,
        audio_data_base64: audioDataBase64,
        duration_seconds: audio.duration,
        voice_settings: audio.voiceSettings
      });

      if (error) {
        throw errorHandler.createError(
          `Failed to save audio to Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'saveAudio', error: error.message }
        );
      }

      const savedAudio: SavedAudio = {
        id: data.id,
        bookId: data.book_id,
        pageNumber: data.page_number,
        title: `Page ${data.page_number} Audio`,
        audioData: this.base64ToArrayBuffer(data.audio_data_base64),
        audioBlob: new Blob([this.base64ToArrayBuffer(data.audio_data_base64)]),
        duration: data.duration_seconds || 0,
        pageRange: { start: data.page_number, end: data.page_number },
        voiceName: data.voice_settings?.voiceName || 'Unknown',
        voiceSettings: data.voice_settings,
        createdAt: new Date(data.created_at)
      };

      return savedAudio;

    } catch (error) {
      logger.error('Error saving audio to Supabase', { userId: this.currentUserId }, error as Error);
      throw error;
    }
  }

  // Storage info
  getStorageInfo() {
    // For Supabase, we don't have local storage limits
    return {
      used: 0,
      max: 0,
      percentage: 0
    };
  }

  // Google Drive integration (placeholder)
  async isGoogleDriveEnabled(): Promise<boolean> {
    return false; // Not implemented yet
  }

  async getSyncStatus() {
    return {
      lastSync: null,
      isEnabled: false
    };
  }

  // Enhanced metadata methods for library organization
  async getBookWithMetadata(bookId: string): Promise<any> {
    this.ensureAuthenticated();
    
    try {
      const { data, error } = await supabase
        .from('user_books')
        .select(`
          *,
          book_collections!inner(
            collection_id,
            user_collections!inner(
              id,
              name,
              color,
              icon,
              parent_id
            )
          ),
          book_tag_assignments!inner(
            tag_id,
            book_tags!inner(
              id,
              name,
              color,
              category
            )
          )
        `)
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!)
        .single();

      if (error) {
        throw errorHandler.createError(
          `Failed to get book with metadata: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getBookWithMetadata', bookId, error: error.message }
        );
      }

      return data;
    } catch (error) {
      logger.error('Error getting book with metadata', { bookId }, error as Error);
      throw error;
    }
  }

  async updateBookMetadata(bookId: string, metadata: {
    is_favorite?: boolean;
    custom_metadata?: Record<string, any>;
    notes_count?: number;
    pomodoro_sessions_count?: number;
  }): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const { error } = await supabase
        .from('user_books')
        .update(metadata)
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to update book metadata: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateBookMetadata', bookId, error: error.message }
        );
      }

      logger.info('Book metadata updated', { bookId, metadata, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error updating book metadata', { bookId, metadata }, error as Error);
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

  async searchLibrary(
    searchQuery: string,
    filters: {
      fileType?: 'pdf' | 'text' | 'all';
      collections?: string[];
      tags?: string[];
      isFavorite?: boolean;
      hasNotes?: boolean;
      hasAudio?: boolean;
    } = {},
    sort: {
      field: 'title' | 'created_at' | 'last_read_at' | 'reading_progress' | 'file_size_bytes' | 'notes_count' | 'pomodoro_sessions_count';
      order: 'asc' | 'desc';
    } = { field: 'last_read_at', order: 'desc' },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ results: any[]; total: number }> {
    this.ensureAuthenticated();
    
    try {
      let query = supabase
        .from('user_books')
        .select(`
          *,
          book_collections!inner(
            collection_id,
            user_collections!inner(
              name,
              color,
              icon
            )
          ),
          book_tag_assignments!inner(
            tag_id,
            book_tags!inner(
              name,
              color,
              category
            )
          )
        `)
        .eq('user_id', this.currentUserId!);

      // Apply search query
      if (searchQuery && searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,file_name.ilike.%${searchQuery}%`);
      }

      // Apply filters
      if (filters.fileType && filters.fileType !== 'all') {
        query = query.eq('file_type', filters.fileType);
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

      if (filters.collections && filters.collections.length > 0) {
        query = query.in('book_collections.collection_id', filters.collections);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.in('book_tag_assignments.tag_id', filters.tags);
      }

      // Apply sorting
      const sortField = this.getSortField(sort.field);
      query = query.order(sortField, { ascending: sort.order === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw errorHandler.createError(
          `Failed to search library: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'searchLibrary', error: error.message }
        );
      }

      return {
        results: data || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('Error searching library', { searchQuery, filters }, error as Error);
      throw error;
    }
  }

  // Helper method to convert sort field to database column
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

  // Update book counts when notes or audio are added/removed
  async updateBookCounts(bookId: string, type: 'notes' | 'audio', delta: number): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const updateField = type === 'notes' ? 'notes_count' : 'pomodoro_sessions_count';
      
      // First get the current value
      const { data: currentData, error: fetchError } = await supabase
        .from('user_books')
        .select(updateField)
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Then update with new value
      const currentValue = (currentData as any)?.[updateField] || 0;
      const { error } = await supabase
        .from('user_books')
        .update({
          [updateField]: currentValue + delta
        })
        .eq('id', bookId)
        .eq('user_id', this.currentUserId!);

      if (error) {
        throw errorHandler.createError(
          `Failed to update book counts: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'updateBookCounts', bookId, type, delta, error: error.message }
        );
      }

      logger.info('Book counts updated', { bookId, type, delta, userId: this.currentUserId });
    } catch (error) {
      logger.error('Error updating book counts', { bookId, type, delta }, error as Error);
      throw error;
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
