import { userBooks, userNotes, userAudio, UserBook, UserNote, UserAudio } from '../../lib/supabase';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

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
  notes?: Note[];
  googleDriveId?: string;
  syncedAt?: Date;
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

  // Books Management
  async saveBook(book: SavedBook): Promise<void> {
    this.ensureAuthenticated();
    
    try {
      const context = { bookId: book.id, userId: this.currentUserId };
      
      // Convert file data to base64 if it's an ArrayBuffer
      let pdfDataBase64: string | undefined;
      if (book.type === 'pdf' && book.fileData instanceof ArrayBuffer) {
        pdfDataBase64 = this.arrayBufferToBase64(book.fileData);
        logger.info('Converted PDF to base64 for Supabase storage', context, {
          originalSize: book.fileData.byteLength,
          base64Size: pdfDataBase64.length
        });
      }

      const userBook: Omit<UserBook, 'id' | 'created_at' | 'updated_at'> = {
        user_id: this.currentUserId!,
        title: book.title,
        file_name: book.fileName,
        file_type: book.type,
        file_size: book.fileData instanceof ArrayBuffer ? book.fileData.byteLength : 0,
        total_pages: book.totalPages,
        pdf_data_base64: pdfDataBase64,
        page_texts: book.pageTexts,
        text_content: book.type === 'text' ? (book.fileData as string) : undefined,
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

      const { data, error } = await userBooks.create(userBook);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to save book to Supabase: ${error.message}`,
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
            book_id: data.id, // Use the created book ID
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

      logger.info('Book saved to Supabase successfully', context, {
        bookId: data.id,
        title: data.title,
        type: data.file_type,
        hasPageTexts: !!data.page_texts?.length
      });

    } catch (error) {
      logger.error('Error saving book to Supabase', { bookId: book.id }, error as Error);
      throw error;
    }
  }

  async getAllBooks(): Promise<SavedBook[]> {
    this.ensureAuthenticated();
    
    try {
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
          pageTexts: book.page_texts,
          notes: [], // Will be loaded separately if needed
          syncedAt: new Date(book.updated_at)
        };

        // Convert base64 back to ArrayBuffer for PDF files
        if (book.file_type === 'pdf' && book.pdf_data_base64) {
          try {
            savedBook.fileData = this.base64ToArrayBuffer(book.pdf_data_base64);
            savedBook.pdfDataBase64 = book.pdf_data_base64;
          } catch (error) {
            logger.error('Error converting base64 to ArrayBuffer', { bookId: book.id }, error as Error);
          }
        } else if (book.file_type === 'text' && book.text_content) {
          savedBook.fileData = book.text_content;
        }

        return savedBook;
      });

      logger.info('Books loaded from Supabase', { userId: this.currentUserId }, {
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
      const { data, error } = await userBooks.get(id);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Book not found
        }
        throw errorHandler.createError(
          `Failed to load book from Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'getBook', bookId: id, error: error.message }
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
        pageTexts: data.page_texts,
        notes: [], // Will be loaded separately if needed
        syncedAt: new Date(data.updated_at)
      };

      // Convert base64 back to ArrayBuffer for PDF files
      if (data.file_type === 'pdf' && data.pdf_data_base64) {
        try {
          book.fileData = this.base64ToArrayBuffer(data.pdf_data_base64);
          book.pdfDataBase64 = data.pdf_data_base64;
        } catch (error) {
          logger.error('Error converting base64 to ArrayBuffer', { bookId: id }, error as Error);
        }
      } else if (data.file_type === 'text' && data.text_content) {
        book.fileData = data.text_content;
      }

      return book;

    } catch (error) {
      logger.error('Error loading book from Supabase', { bookId: id }, error as Error);
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
      if (updates.pageTexts) updateData.page_texts = updates.pageTexts;
      
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
      const { error } = await userBooks.delete(bookId);
      
      if (error) {
        throw errorHandler.createError(
          `Failed to delete book from Supabase: ${error.message}`,
          ErrorType.DATABASE,
          ErrorSeverity.HIGH,
          { context: 'deleteBook', bookId, error: error.message }
        );
      }

      logger.info('Book deleted from Supabase', { bookId, userId: this.currentUserId });

    } catch (error) {
      logger.error('Error deleting book from Supabase', { bookId }, error as Error);
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
        content: note.content,
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
}

export const supabaseStorageService = new SupabaseStorageService();
