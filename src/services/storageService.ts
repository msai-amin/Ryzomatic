/**
 * Storage Service
 * Manages local storage and Google Drive sync for books, notes, and audio files
 */

import { googleAuthService } from './googleAuthService';
import { googleDriveService } from './googleDriveService';
import { getStorageKeys, safeConsole, isProduction } from '../utils/productionGuard';

export interface SavedBook {
  id: string;
  title: string;
  fileName: string;
  type: 'pdf' | 'text';
  savedAt: Date;
  lastReadPage?: number;
  totalPages?: number;
  fileData?: ArrayBuffer | string | Blob;
  pdfDataBase64?: string; // Base64 encoded PDF data for storage
  pageTexts?: string[]; // Add pageTexts for PDF documents
  notes?: Note[];
  googleDriveId?: string; // Google Drive file ID for sync
  syncedAt?: Date; // Last sync timestamp
}

export interface Note {
  id: string;
  bookId: string;
  bookName: string;
  content: string;
  pageNumber?: number;
  createdAt: Date;
  updatedAt?: Date;
  lastModified?: Date;
  selectedText?: string;
  googleDocId?: string;
  googleDocUrl?: string;
}

export interface SavedAudio {
  id: string;
  bookId: string;
  title: string;
  audioBlob: Blob;
  duration: number;
  pageRange: { start: number; end: number };
  voiceName: string;
  createdAt: Date;
  googleDriveId?: string; // Google Drive file ID for sync
  syncedAt?: Date; // Last sync timestamp
}

class StorageService {
  private readonly storageKeys = getStorageKeys();
  private readonly BOOKS_KEY = this.storageKeys.books;
  private readonly NOTES_KEY = this.storageKeys.notes;
  private readonly AUDIO_KEY = this.storageKeys.audio;
  private readonly MAX_STORAGE = 50 * 1024 * 1024; // 50MB limit for localStorage

  // Helper function to convert ArrayBuffer to base64 string
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Helper function to convert base64 string to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Clean up old books to free storage space
  private async cleanupOldBooks(): Promise<void> {
    try {
      const books = this.getAllBooks();
      if (books.length <= 1) return; // Keep at least one book
      
      // Sort by savedAt date (oldest first)
      const sortedBooks = books.sort((a, b) => 
        new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      );
      
      // Remove oldest 50% of books (more aggressive cleanup)
      const booksToRemove = Math.max(1, Math.floor(books.length * 0.5));
      const booksToKeep = sortedBooks.slice(booksToRemove);
      
      safeConsole.log(`Cleaning up ${booksToRemove} old books, keeping ${booksToKeep.length}`);
      
      // Save the remaining books
      localStorage.setItem(this.BOOKS_KEY, JSON.stringify(booksToKeep));
      
      // Also clean up old notes and audio
      this.cleanupOldNotes();
      this.cleanupOldAudio();
      
    } catch (error) {
      safeConsole.error('Error during cleanup:', error);
    }
  }

  private cleanupOldNotes(): void {
    try {
      const notes = this.getAllNotes();
      if (notes.length <= 10) return; // Keep at least 10 notes
      
      const sortedNotes = notes.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      const notesToRemove = Math.max(1, Math.floor(notes.length * 0.3));
      const notesToKeep = sortedNotes.slice(notesToRemove);
      
      localStorage.setItem(this.NOTES_KEY, JSON.stringify(notesToKeep));
      safeConsole.log(`Cleaned up ${notesToRemove} old notes`);
    } catch (error) {
      safeConsole.error('Error cleaning up notes:', error);
    }
  }

  private cleanupOldAudio(): void {
    try {
      // Audio cleanup would go here if needed
      // For now, just log that we're cleaning up
      safeConsole.log('Cleaning up old audio files...');
    } catch (error) {
      safeConsole.error('Error cleaning up audio:', error);
    }
  }

  // Clean up corrupted legacy books that can't be loaded
  cleanupCorruptedBooks(): void {
    try {
      const books = this.getAllBooks();
      const corruptedBooks: string[] = [];
      
      books.forEach(book => {
        if (book.type === 'pdf') {
          // Check if it's a corrupted legacy book
          if (book.fileData && 
              typeof book.fileData === 'object' && 
              !(book.fileData instanceof ArrayBuffer) && 
              !(book.fileData instanceof Uint8Array) && 
              !Array.isArray(book.fileData) &&
              !book.pdfDataBase64) {
            safeConsole.warn('Found corrupted legacy book:', book.id, book.title);
            corruptedBooks.push(book.id);
          }
        }
      });
      
      if (corruptedBooks.length > 0) {
        const validBooks = books.filter(book => !corruptedBooks.includes(book.id));
        localStorage.setItem(this.BOOKS_KEY, JSON.stringify(validBooks));
        safeConsole.log(`Removed ${corruptedBooks.length} corrupted legacy books from library`);
      }
    } catch (error) {
      safeConsole.error('Error cleaning up corrupted books:', error);
    }
  }

  // Check localStorage quota usage
  getStorageQuotaInfo(): { used: number; available: number; percentage: number } {
    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length;
        }
      }
      
      // Estimate available space (browsers typically allow 5-10MB)
      const estimatedTotal = 5 * 1024 * 1024; // 5MB estimate
      const available = Math.max(0, estimatedTotal - used);
      const percentage = (used / estimatedTotal) * 100;
      
      return {
        used,
        available,
        percentage: Math.min(percentage, 100)
      };
    } catch (error) {
      safeConsole.error('Error checking storage quota:', error);
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  // Check if storage is near quota limit
  isStorageNearLimit(): boolean {
    const quota = this.getStorageQuotaInfo();
    return quota.percentage > 80; // Consider "near limit" if over 80% used
  }

  // Books Management
  async saveBook(book: SavedBook): Promise<void> {
    try {
      // Check if storage is near limit before attempting to save
      if (this.isStorageNearLimit()) {
        safeConsole.warn('Storage is near limit, cleaning up old books...');
        await this.cleanupOldBooks();
      }

      const books = this.getAllBooks();
      const existingIndex = books.findIndex(b => b.id === book.id);
      
      // Convert ArrayBuffer to base64 for storage if it's a PDF
      const bookToSave = { ...book };
      if (book.type === 'pdf' && book.fileData instanceof ArrayBuffer) {
        safeConsole.log('Converting ArrayBuffer to base64 for storage:', {
          bookId: book.id,
          bookTitle: book.title,
          fileDataByteLength: book.fileData.byteLength,
          fileDataConstructor: book.fileData.constructor.name
        });
        
        bookToSave.pdfDataBase64 = this.arrayBufferToBase64(book.fileData);
        console.log('Base64 conversion successful:', {
          base64Length: bookToSave.pdfDataBase64.length,
          base64Preview: bookToSave.pdfDataBase64.substring(0, 50) + '...'
        });
        
        // Remove the ArrayBuffer as it can't be serialized
        delete bookToSave.fileData;
      }
      
      if (existingIndex >= 0) {
        books[existingIndex] = bookToSave;
      } else {
        books.push(bookToSave);
      }
      
      // Try to save, if quota exceeded, clean up old books
      try {
        localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
        console.log('Book saved to localStorage successfully');
      } catch (quotaError) {
        if (quotaError.name === 'QuotaExceededError') {
          console.warn('Storage quota exceeded, cleaning up old books...');
          await this.cleanupOldBooks();
          
          // Try saving again after cleanup
          try {
            localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
            console.log('Book saved to localStorage after cleanup');
          } catch (retryError) {
            console.error('Still unable to save after cleanup:', retryError);
            // Try one more time with even more aggressive cleanup
            try {
              const books = this.getAllBooks();
              if (books.length > 1) {
                // Keep only the most recent book
                const sortedBooks = books.sort((a, b) => 
                  new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
                );
                const singleBook = [sortedBooks[0]];
                localStorage.setItem(this.BOOKS_KEY, JSON.stringify(singleBook));
                console.log('Emergency cleanup: Kept only most recent book');
              }
            } catch (finalError) {
              console.error('Final cleanup attempt failed:', finalError);
              console.warn('localStorage backup completely failed, but this is not critical if Supabase succeeded');
            }
          }
        } else {
          throw quotaError;
        }
      }
    } catch (error) {
      console.error('Error saving book:', error);
      // Don't throw error for localStorage failures - it's just a backup
      if (error.message.includes('Storage is full') || error.message.includes('quota') || error.name === 'QuotaExceededError') {
        console.warn('localStorage backup failed, but this is not critical if Supabase succeeded');
        return; // Exit gracefully without throwing
      } else {
        throw new Error('Failed to save book. Storage may be full.');
      }
    }
  }

  getAllBooks(): SavedBook[] {
    try {
      const data = localStorage.getItem(this.BOOKS_KEY);
      console.log('StorageService: Getting all books from localStorage:', {
        hasData: !!data,
        dataLength: data ? data.length : 0,
        key: this.BOOKS_KEY
      });
      
      if (!data) {
        console.log('StorageService: No books data found in localStorage');
        return [];
      }
      
      const books = JSON.parse(data);
      console.log('StorageService: Parsed books from JSON:', {
        count: books.length,
        books: books.map((book: any) => ({
          id: book.id,
          title: book.title,
          type: book.type,
          savedAt: book.savedAt,
          hasFileData: !!book.fileData,
          hasPdfDataBase64: !!book.pdfDataBase64
        }))
      });
      
      return books.map((book: any) => {
        const savedBook = {
          ...book,
          savedAt: new Date(book.savedAt),
        };
        
        // Convert base64 back to ArrayBuffer for PDF files
        if (book.type === 'pdf' && book.pdfDataBase64) {
          console.log('Converting base64 to ArrayBuffer in getAllBooks:', {
            bookId: book.id,
            bookTitle: book.title,
            base64Length: book.pdfDataBase64.length,
            base64Preview: book.pdfDataBase64.substring(0, 50) + '...'
          });
          
          try {
            savedBook.fileData = this.base64ToArrayBuffer(book.pdfDataBase64);
            console.log('Conversion successful:', {
              byteLength: savedBook.fileData.byteLength,
              constructor: savedBook.fileData.constructor.name
            });
          } catch (error) {
            console.error('Error converting base64 to ArrayBuffer:', error);
            console.log('Base64 data preview:', book.pdfDataBase64.substring(0, 100));
          }
        }
        
        return savedBook;
      });
    } catch (error) {
      console.error('Error loading books:', error);
      return [];
    }
  }

  getBook(id: string): SavedBook | null {
    const books = this.getAllBooks();
    const book = books.find(b => b.id === id);
    
    if (book && book.type === 'pdf' && book.pdfDataBase64) {
      // Ensure ArrayBuffer is properly converted
      book.fileData = this.base64ToArrayBuffer(book.pdfDataBase64);
    }
    
    return book || null;
  }

  deleteBook(id: string): void {
    const books = this.getAllBooks().filter(b => b.id !== id);
    localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
    
    // Also delete related notes and audio
    this.deleteNotesByBook(id);
    this.deleteAudioByBook(id);
  }

  updateBookProgress(id: string, page: number): void {
    const books = this.getAllBooks();
    const book = books.find(b => b.id === id);
    if (book) {
      book.lastReadPage = page;
      localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
    }
  }

  // Notes Management
  saveNote(note: Note): void {
    try {
      const notes = this.getAllNotes();
      const existingIndex = notes.findIndex(n => n.id === note.id);
      
      if (existingIndex >= 0) {
        notes[existingIndex] = note;
      } else {
        notes.push(note);
      }
      
      localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error('Error saving note:', error);
      throw new Error('Failed to save note. Storage may be full.');
    }
  }

  getAllNotes(): Note[] {
    try {
      const data = localStorage.getItem(this.NOTES_KEY);
      if (!data) return [];
      
      const notes = JSON.parse(data);
      return notes.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  }

  getNotesByBook(bookId: string): Note[] {
    return this.getAllNotes().filter(n => n.bookId === bookId);
  }

  deleteNote(id: string): void {
    const notes = this.getAllNotes().filter(n => n.id !== id);
    localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
  }

  deleteNotesByBook(bookId: string): void {
    const notes = this.getAllNotes().filter(n => n.bookId !== bookId);
    localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
  }

  // Audio Management (using IndexedDB for larger files)
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SmartReaderAudio', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'id' });
        }
      };
    });
  }

  async saveAudio(audio: SavedAudio): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(['audio'], 'readwrite');
      const store = transaction.objectStore('audio');
      
      await new Promise((resolve, reject) => {
        const request = store.put(audio);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.error('Error saving audio:', error);
      throw new Error('Failed to save audio file.');
    }
  }

  async getAllAudio(): Promise<SavedAudio[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(['audio'], 'readonly');
      const store = transaction.objectStore('audio');
      
      const audio = await new Promise<SavedAudio[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      
      return audio.map(a => ({
        ...a,
        createdAt: new Date(a.createdAt),
      }));
    } catch (error) {
      console.error('Error loading audio:', error);
      return [];
    }
  }

  async getAudioByBook(bookId: string): Promise<SavedAudio[]> {
    const allAudio = await this.getAllAudio();
    return allAudio.filter(a => a.bookId === bookId);
  }

  async deleteAudio(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction(['audio'], 'readwrite');
      const store = transaction.objectStore('audio');
      
      await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
    } catch (error) {
      console.error('Error deleting audio:', error);
    }
  }

  async deleteAudioByBook(bookId: string): Promise<void> {
    const audio = await this.getAudioByBook(bookId);
    for (const a of audio) {
      await this.deleteAudio(a.id);
    }
  }

  // Storage Info
  getStorageInfo(): { used: number; max: number; percentage: number } {
    let used = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Convert to bytes (rough estimate)
    used = used * 2; // UTF-16 characters
    
    return {
      used,
      max: this.MAX_STORAGE,
      percentage: Math.round((used / this.MAX_STORAGE) * 100),
    };
  }

  // Clear all data
  clearAll(): void {
    localStorage.removeItem(this.BOOKS_KEY);
    localStorage.removeItem(this.NOTES_KEY);
    indexedDB.deleteDatabase('SmartReaderAudio');
  }

  // Export data
  exportData(): string {
    const data = {
      books: this.getAllBooks(),
      notes: this.getAllNotes(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  // Import data
  importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.books) {
        localStorage.setItem(this.BOOKS_KEY, JSON.stringify(data.books));
      }
      
      if (data.notes) {
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(data.notes));
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw new Error('Invalid import data format.');
    }
  }

  // Google Drive sync methods
  async syncToGoogleDrive(): Promise<void> {
    if (!googleAuthService.isSignedIn()) {
      throw new Error('User must be signed in to sync with Google Drive');
    }

    try {
      await googleDriveService.initialize();
      
      // Sync books
      const books = this.getAllBooks();
      for (const book of books) {
        if (!book.googleDriveId) {
          try {
            const driveFile = await googleDriveService.saveBook(book);
            book.googleDriveId = driveFile.id;
            book.syncedAt = new Date();
            await this.saveBook(book);
          } catch (error) {
            console.error(`Failed to sync book ${book.title}:`, error);
          }
        }
      }

      // Sync notes
      const notes = this.getAllNotes();
      if (notes.length > 0) {
        try {
          const driveFile = await googleDriveService.saveNotes(notes);
          // Store the notes file ID in localStorage for reference
          localStorage.setItem('smart_reader_notes_drive_id', driveFile.id);
        } catch (error) {
          console.error('Failed to sync notes:', error);
        }
      }

      // Sync audio files
      const audio = await this.getAllAudio();
      for (const audioFile of audio) {
        if (!audioFile.googleDriveId) {
          try {
            const driveFile = await googleDriveService.saveAudio(audioFile.audioBlob, {
              title: audioFile.title,
              bookId: audioFile.bookId,
              pageRange: audioFile.pageRange,
              voiceName: audioFile.voiceName,
            });
            audioFile.googleDriveId = driveFile.id;
            audioFile.syncedAt = new Date();
            await this.saveAudio(audioFile);
          } catch (error) {
            console.error(`Failed to sync audio ${audioFile.title}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing to Google Drive:', error);
      throw new Error('Failed to sync with Google Drive');
    }
  }

  async syncFromGoogleDrive(): Promise<void> {
    if (!googleAuthService.isSignedIn()) {
      throw new Error('User must be signed in to sync from Google Drive');
    }

    try {
      await googleDriveService.initialize();
      
      // Get all files from Google Drive
      const driveFiles = await googleDriveService.listAppFiles();
      
      for (const file of driveFiles) {
        try {
          if (file.name.endsWith('.json') && file.name !== 'notes.json') {
            // This is a book file
            const bookData = await googleDriveService.loadBook(file.id);
            
            // Check if book already exists locally
            const existingBook = this.getBook(bookData.id);
            if (!existingBook) {
              // Add new book
              bookData.googleDriveId = file.id;
              bookData.syncedAt = new Date();
              await this.saveBook(bookData);
            }
          } else if (file.name === 'notes.json') {
            // This is the notes file
            const notesData = await googleDriveService.loadNotes(file.id);
            
            // Merge with existing notes (avoid duplicates)
            const existingNotes = this.getAllNotes();
            const existingIds = new Set(existingNotes.map(n => n.id));
            const newNotes = notesData.filter(n => !existingIds.has(n.id));
            
            for (const note of newNotes) {
              this.saveNote(note);
            }
          } else if (file.mimeType.startsWith('audio/')) {
            // This is an audio file
            const audioBlob = await googleDriveService.loadAudio(file.id);
            
            // Create audio object (we need to reconstruct metadata)
            const audioData: SavedAudio = {
              id: crypto.randomUUID(),
              bookId: 'unknown', // We'll need to store this in metadata
              title: file.name.replace('.wav', ''),
              audioBlob,
              duration: 0,
              pageRange: { start: 1, end: 1 },
              voiceName: 'Unknown',
              createdAt: file.createdTime,
              googleDriveId: file.id,
              syncedAt: new Date(),
            };
            
            await this.saveAudio(audioData);
          }
        } catch (error) {
          console.error(`Failed to sync file ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing from Google Drive:', error);
      throw new Error('Failed to sync from Google Drive');
    }
  }

  async isGoogleDriveEnabled(): Promise<boolean> {
    return googleAuthService.isSignedIn();
  }

  async getSyncStatus(): Promise<{ lastSync: Date | null; isEnabled: boolean }> {
    const isEnabled = await this.isGoogleDriveEnabled();
    const lastSync = localStorage.getItem('smart_reader_last_sync');
    
    return {
      isEnabled,
      lastSync: lastSync ? new Date(lastSync) : null,
    };
  }

  async setLastSyncTime(): Promise<void> {
    localStorage.setItem('smart_reader_last_sync', new Date().toISOString());
  }
}

export const storageService = new StorageService();
