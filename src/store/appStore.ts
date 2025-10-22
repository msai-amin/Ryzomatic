import { create } from 'zustand'
import { authService, AuthUser } from '../services/supabaseAuthService'

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  page_number: number
  highlighted_text: string
  color_id: string
  color_hex: string
  position_data: {
    x: number
    y: number
    width: number
    height: number
  }
  text_start_offset?: number
  text_end_offset?: number
  text_context_before?: string
  text_context_after?: string
  is_orphaned: boolean
  orphaned_reason?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  name: string
  content: string
  type: 'text' | 'pdf'
  uploadedAt: Date
  // PDF-specific properties
  pdfData?: ArrayBuffer | string | Blob // Support ArrayBuffer, blob URL, and Blob
  totalPages?: number
  pageTexts?: string[]
  // OCR properties
  needsOCR?: boolean
  ocrStatus?: 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined'
  ocrMetadata?: {
    completedAt?: string
    tokensUsed?: number
    processingTime?: number
    confidence?: number
    pagesProcessed?: number
    error?: string
  }
  // Highlights
  highlights?: Highlight[]
  highlightsLoaded?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface TypographySettings {
  fontFamily: 'serif' | 'sans' | 'mono'
  fontSize: number
  lineHeight: number
  maxWidth: number
  theme: 'light' | 'dark' | 'sepia'
  textAlign: 'left' | 'justify' | 'center'
  spacingMultiplier: number
  focusMode: boolean
  readingGuide: boolean
  renderFormulas: boolean
}

export interface ThemeSettings {
  currentTheme: 'default' | 'academic'
  isDarkMode: boolean
}

export interface PDFViewerSettings {
  currentPage: number
  zoom: number
  scale: number
  rotation: number
  viewMode: 'text' | 'pdf' | 'split'
  scrollMode: 'single' | 'continuous'
  showPageNumbers: boolean
  showProgress: boolean
  readingMode: boolean
}

export interface LibraryFilters {
  searchQuery?: string
  fileType?: 'pdf' | 'text' | 'all'
  readingProgress?: { min: number; max: number }
  dateRange?: { start: Date; end: Date }
  collections?: string[]
  tags?: string[]
  isFavorite?: boolean
  hasNotes?: boolean
  hasAudio?: boolean
  fileSizeRange?: { min: number; max: number }
}

export interface LibraryViewSettings {
  viewMode: 'grid' | 'list' | 'comfortable'
  sortBy: 'title' | 'created_at' | 'last_read_at' | 'reading_progress' | 'file_size_bytes' | 'notes_count' | 'pomodoro_sessions_count'
  sortOrder: 'asc' | 'desc'
  selectedCollectionId: string | null
  selectedTags: string[]
  searchQuery: string
  filters: LibraryFilters
  selectedBooks: string[] // for bulk operations
}

export interface TextSelectionContext {
  selectedText: string
  beforeContext: string
  afterContext: string
  pageNumber?: number
  fullContext: string
}

export interface Voice {
  name: string
  languageCode: string
  gender: string
  type?: string
  model?: string // Required for some Google Cloud TTS voices
}

export interface TTSSettings {
  isEnabled: boolean
  isPlaying: boolean
  provider: 'native' | 'google-cloud'
  rate: number
  pitch: number
  volume: number
  voiceName: string | null
  voice: Voice | null
  highlightCurrentWord: boolean
  currentWordIndex: number | null
  currentParagraphIndex: number | null
  paragraphs: string[]
  autoAdvanceParagraph: boolean
}

interface AppState {
  // Authentication
  isAuthenticated: boolean
  user: AuthUser | null
  
  // Document state
  currentDocument: Document | null
  documents: Document[]
  
  // UI state
  isChatOpen: boolean
  isLoading: boolean
  
  // Text selection and AI context
  selectedTextContext: TextSelectionContext | null
  chatMode: 'general' | 'clarification' | 'further-reading'
  
  // Typography settings
  typography: TypographySettings
  
  // Theme settings
  theme: ThemeSettings
  
  // PDF viewer settings
  pdfViewer: PDFViewerSettings
  
  // TTS settings
  tts: TTSSettings
  
  // Chat state
  chatMessages: ChatMessage[]
  isTyping: boolean
  
  // Library refresh
  libraryRefreshTrigger: number
  
  // Library view settings
  libraryView: LibraryViewSettings
  
  // Pomodoro state
  activePomodoroSessionId: string | null
  activePomodoroBookId: string | null
  pomodoroStartTime: number | null
  pomodoroTimeLeft: number | null
  pomodoroIsRunning: boolean
  pomodoroMode: 'work' | 'shortBreak' | 'longBreak'
  
  // Actions
  setUser: (user: AuthUser | null) => void
  setAuthenticated: (authenticated: boolean) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  setCurrentDocument: (document: Document | null) => void
  addDocument: (document: Document) => void
  updateDocument: (document: Document) => void
  removeDocument: (id: string) => void
  toggleChat: () => void
  setLoading: (loading: boolean) => void
  updateTypography: (settings: Partial<TypographySettings>) => void
  updateTheme: (settings: Partial<ThemeSettings>) => void
  updatePDFViewer: (settings: Partial<PDFViewerSettings>) => void
  updateTTS: (settings: Partial<TTSSettings>) => void
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChat: () => void
  setTyping: (typing: boolean) => void
  refreshLibrary: () => void
  
  // Library view actions
  setLibraryView: (settings: Partial<LibraryViewSettings>) => void
  setLibrarySort: (sortBy: LibraryViewSettings['sortBy'], sortOrder: LibraryViewSettings['sortOrder']) => void
  setLibraryFilters: (filters: Partial<LibraryFilters>) => void
  setSearchQuery: (query: string) => void
  setActiveCollection: (collectionId: string | null) => void
  setSelectedTags: (tags: string[]) => void
  toggleBookSelection: (bookId: string) => void
  clearSelection: () => void
  selectAllBooks: (bookIds: string[]) => void
  
  setPomodoroSession: (sessionId: string | null, bookId: string | null, startTime: number | null) => void
  updatePomodoroTimer: (timeLeft: number | null, isRunning: boolean, mode: 'work' | 'shortBreak' | 'longBreak') => void
  
  // Text selection and AI mode actions
  setSelectedTextContext: (context: TextSelectionContext | null) => void
  setChatMode: (mode: 'general' | 'clarification' | 'further-reading') => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  currentDocument: null,
  documents: [],
  isChatOpen: false,
  isLoading: false,
  typography: {
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.75,
    maxWidth: 800,
    theme: 'light',
    textAlign: 'left',
    spacingMultiplier: 1.0,
    focusMode: false,
    readingGuide: false,
    renderFormulas: true
  },
  theme: {
    currentTheme: 'default',
    isDarkMode: false
  },
  pdfViewer: {
    currentPage: 1,
    zoom: 1.0,
    scale: 1.0,
    rotation: 0,
    viewMode: 'pdf',
    scrollMode: 'single', // Default to One Page mode
    showPageNumbers: true,
    showProgress: true,
    readingMode: false
  },
  tts: {
    isEnabled: false,
    isPlaying: false,
    provider: 'native', // Use native TTS for development (supports word boundaries and progress tracking)
    rate: 0.9, // Slightly slower for more natural speech
    pitch: 1.1, // Slightly higher pitch for more natural sound
    volume: 0.8, // Slightly lower volume for comfort
    voiceName: null,
    voice: null,
    highlightCurrentWord: true,
    currentWordIndex: null,
    currentParagraphIndex: null,
    paragraphs: [],
    autoAdvanceParagraph: true
  },
  chatMessages: [],
  isTyping: false,
  libraryRefreshTrigger: 0,
  
  // Text selection and AI context
  selectedTextContext: null,
  chatMode: 'general',
  
  // Library view settings
  libraryView: {
    viewMode: 'grid',
    sortBy: 'last_read_at',
    sortOrder: 'desc',
    selectedCollectionId: null,
    selectedTags: [],
    searchQuery: '',
    filters: {},
    selectedBooks: []
  },
  
  // Pomodoro state
  activePomodoroSessionId: null,
  activePomodoroBookId: null,
  pomodoroStartTime: null,
  pomodoroTimeLeft: null,
  pomodoroIsRunning: false,
  pomodoroMode: 'work',
  
  // Authentication actions
  setUser: (user) => set({ user }),
  
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  
  checkAuth: async () => {
    try {
      const user = await authService.getCurrentUser();
      
      if (user) {
        console.log('User authenticated:', user.email);
        
        // Try to get user profile
        let profile = await authService.getUserProfile(user.id);
        
        // If profile doesn't exist, create it (fallback in case trigger didn't fire)
        if (!profile) {
          console.log('Profile not found, creating one...');
          try {
            profile = await authService.createUserProfile({
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
              tier: 'free',
              credits: 100
            });
            console.log('Profile created successfully');
          } catch (createError) {
            console.error('Failed to create profile:', createError);
            // If profile creation fails, use basic auth data
            profile = {
              id: user.id,
              email: user.email || '',
              full_name: user.user_metadata?.full_name || user.user_metadata?.name,
              tier: 'free',
              credits: 100
            } as AuthUser;
          }
        }
        
        set({ 
          isAuthenticated: true, 
          user: profile 
        });
      } else {
        console.log('No authenticated user found');
        set({ 
          isAuthenticated: false, 
          user: null 
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ 
        isAuthenticated: false, 
        user: null 
      });
    }
  },
  
  logout: async () => {
    try {
      await authService.signOut();
      set({ 
        isAuthenticated: false, 
        user: null,
        documents: [],
        currentDocument: null,
        chatMessages: []
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },
  
  // Actions
  setCurrentDocument: (document) => {
    if (document && document.pageTexts) {
      // Debug: Log the pageTexts before sanitization
      console.log('🔍 setCurrentDocument: Before sanitization:');
      console.log('  Document ID:', document.id);
      console.log('  PageTexts Length:', document.pageTexts.length);
      console.log('  PageTexts Types:', document.pageTexts.map((text, i) => ({
        index: i,
        type: typeof text,
        isString: typeof text === 'string',
        value: text
      })));
      
      // Sanitize pageTexts to ensure all elements are strings
      document.pageTexts = document.pageTexts.map(text => 
        typeof text === 'string' ? text : String(text || '')
      );
      
      // Debug: Log the pageTexts after sanitization
      console.log('🔍 setCurrentDocument: After sanitization:');
      console.log('  Document ID:', document.id);
      console.log('  PageTexts Length:', document.pageTexts.length);
      console.log('  PageTexts Types:', document.pageTexts.map((text, i) => ({
        index: i,
        type: typeof text,
        isString: typeof text === 'string',
        value: text
      })));
    }
    set({ currentDocument: document });
  },
  
  addDocument: (document) => {
    console.log('AppStore: Adding document:', {
      id: document.id,
      name: document.name,
      type: document.type,
      hasPageTexts: !!document.pageTexts,
      pageTextsLength: document.pageTexts?.length || 0,
      pageTextsPreview: document.pageTexts?.slice(0, 2).map((text, i) => {
        const safeText = typeof text === 'string' ? text : String(text || '')
        return {
          page: i + 1,
          textLength: safeText.length,
          textPreview: safeText.substring(0, 30) + (safeText.length > 30 ? '...' : '')
        }
      }) || []
    });
    set((state) => ({
      documents: [...state.documents, document],
      currentDocument: document
    }));
  },
  
  updateDocument: (document) => {
    console.log('AppStore: Updating document:', {
      id: document.id,
      name: document.name,
      type: document.type,
      hasPageTexts: !!document.pageTexts,
      pageTextsLength: document.pageTexts?.length || 0,
      pageTextsPreview: document.pageTexts?.slice(0, 2).map((text, i) => {
        const safeText = typeof text === 'string' ? text : String(text || '')
        return {
          page: i + 1,
          textLength: safeText.length,
          textPreview: safeText.substring(0, 30) + (safeText.length > 30 ? '...' : '')
        }
      }) || []
    });
    set((state) => ({
      documents: state.documents.map(doc => doc.id === document.id ? document : doc),
      currentDocument: state.currentDocument?.id === document.id ? document : state.currentDocument
    }));
  },
  
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter(doc => doc.id !== id),
    currentDocument: state.currentDocument?.id === id ? null : state.currentDocument
  })),
  
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  updateTypography: (settings) => set((state) => ({
    typography: { ...state.typography, ...settings }
  })),
  
  updateTheme: (settings) => set((state) => ({
    theme: { ...state.theme, ...settings }
  })),
  
  updatePDFViewer: (settings) => set((state) => ({
    pdfViewer: { ...state.pdfViewer, ...settings }
  })),
  
  updateTTS: (settings) => set((state) => ({
    tts: { ...state.tts, ...settings }
  })),
  
  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }]
  })),
  
  clearChat: () => set({ chatMessages: [] }),
  
  setTyping: (typing) => set({ isTyping: typing }),
  
  refreshLibrary: () => set((state) => ({ 
    libraryRefreshTrigger: state.libraryRefreshTrigger + 1 
  })),
  
  setPomodoroSession: (sessionId, bookId, startTime) => set({
    activePomodoroSessionId: sessionId,
    activePomodoroBookId: bookId,
    pomodoroStartTime: startTime
  }),
  
  updatePomodoroTimer: (timeLeft, isRunning, mode) => set({
    pomodoroTimeLeft: timeLeft,
    pomodoroIsRunning: isRunning,
    pomodoroMode: mode
  }),
  
  // Library view actions
  setLibraryView: (settings) => set((state) => ({
    libraryView: { ...state.libraryView, ...settings }
  })),
  
  setLibrarySort: (sortBy, sortOrder) => set((state) => ({
    libraryView: { ...state.libraryView, sortBy, sortOrder }
  })),
  
  setLibraryFilters: (filters) => set((state) => ({
    libraryView: { 
      ...state.libraryView, 
      filters: { ...state.libraryView.filters, ...filters }
    }
  })),
  
  setSearchQuery: (query) => set((state) => ({
    libraryView: { ...state.libraryView, searchQuery: query }
  })),
  
  setActiveCollection: (collectionId) => set((state) => ({
    libraryView: { ...state.libraryView, selectedCollectionId: collectionId }
  })),
  
  setSelectedTags: (tags) => set((state) => ({
    libraryView: { ...state.libraryView, selectedTags: tags }
  })),
  
  toggleBookSelection: (bookId) => set((state) => {
    const selectedBooks = state.libraryView.selectedBooks.includes(bookId)
      ? state.libraryView.selectedBooks.filter(id => id !== bookId)
      : [...state.libraryView.selectedBooks, bookId];
    
    return {
      libraryView: { ...state.libraryView, selectedBooks }
    };
  }),
  
  clearSelection: () => set((state) => ({
    libraryView: { ...state.libraryView, selectedBooks: [] }
  })),
  
  selectAllBooks: (bookIds) => set((state) => ({
    libraryView: { ...state.libraryView, selectedBooks: bookIds }
  })),
  
  // Text selection and AI mode actions
  setSelectedTextContext: (context) => set({ selectedTextContext: context }),
  
  setChatMode: (mode) => set({ chatMode: mode })
}))


