import { create } from 'zustand'
import { authService, AuthUser } from '../services/supabaseAuthService'
import { DocumentRelationshipWithDetails } from '../../lib/supabase'
import { HighlightPosition as ServiceHighlightPosition, HighlightArea, SelectionData } from '../services/highlightService'

export interface TextAnchors {
  startIndex?: number
  endIndex?: number
  itemIds?: number[]
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  page_number: number
  highlighted_text: string
  color_id: string
  color_hex: string
  position_data: ServiceHighlightPosition
  text_start_offset?: number
  text_end_offset?: number
  text_context_before?: string
  text_context_after?: string
  text_anchors?: TextAnchors
  is_orphaned: boolean
  orphaned_reason?: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  name: string
  content: string
  type: 'text' | 'pdf' | 'epub'
  uploadedAt: Date
  // PDF-specific properties
  pdfData?: ArrayBuffer | string | Blob // Support ArrayBuffer, blob URL, and Blob
  epubData?: Blob
  totalPages?: number
  pageTexts?: string[]
  cleanedPageTexts?: string[] // Array of cleaned text for each page (for TTS in reading mode)
  currentPage?: number
  metadata?: Record<string, any>
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

export type CustomReadingWizardStep = 'welcome' | 'upload' | 'optimize' | 'complete'
export type CustomReadingWizardStatus = 'idle' | 'uploading' | 'optimizing' | 'ready' | 'error'
export type CustomReadingWizardSource = 'empty-state' | 'header'

export interface CustomReadingWizardState {
  isOpen: boolean
  step: CustomReadingWizardStep
  source: CustomReadingWizardSource | null
  documentId: string | null
  status: CustomReadingWizardStatus
  error: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type NewChatMessage = Omit<ChatMessage, 'id' | 'timestamp'> & Partial<Pick<ChatMessage, 'id' | 'timestamp'>>

export interface TypographySettings {
  fontFamily: 'serif' | 'sans' | 'mono'
  fontSize: number
  lineHeight: number
  maxWidth: number
  theme: 'light' | 'dark' | 'sepia' | 'reading'
  textAlign: 'left' | 'justify' | 'center'
  spacingMultiplier: number
  focusMode: boolean
  readingGuide: boolean
}

export interface ThemeSettings {
  currentTheme: 'default' | 'academic'
  isDarkMode: boolean
}

export interface PDFViewerSettings {
  currentPage: number
  numPages: number | null
  zoom: number
  scale: number
  rotation: number
  viewMode: 'text' | 'pdf' | 'split'
  scrollMode: 'single' | 'continuous'
  showPageNumbers: boolean
  showProgress: boolean
  readingMode: boolean
  darkMode: boolean
}

export interface LibraryFilters {
  searchQuery?: string
  fileType?: 'pdf' | 'text' | 'epub' | 'all'
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
  model?: string // Legacy field, not used with Azure TTS
}

export interface TTSPosition {
  page: number
  paragraphIndex: number
  timestamp: number
  mode: 'paragraph' | 'page' | 'continue'
  progressSeconds: number
}

export interface TTSSettings {
  isEnabled: boolean
  isPlaying: boolean
  isPaused: boolean
  provider: 'native' | 'azure'
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
  documentPositions: {
    [documentId: string]: TTSPosition
  }
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
  isEditorialMode: boolean
  reviewCitations: string[]
  reviewContent: string
  addReviewCitation: (citation: string) => void
  setReviewContent: (content: string) => void
  isRightSidebarOpen: boolean
  audioWidgetPosition: 'default' | 'header' | 'hidden'
  setAudioWidgetPosition: (position: 'default' | 'header' | 'hidden') => void
  rightSidebarTab: 'notes' | 'highlights'
  rightSidebarWidth: number
  chatWindowPosition: { top: number; left: number }
  chatWindowSize: { width: number; height: number }
  isNavRailExpanded: boolean
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
  
  // Library organization UI state
  collectionDragState: {
    activeId: string | null
    overId: string | null
  }
  tagManagerOpen: boolean
  pendingAssignmentTargets: {
    collectionIds: string[]
    tagIds: string[]
  }
  
  // Pomodoro state
  activePomodoroSessionId: string | null
  activePomodoroBookId: string | null
  pomodoroStartTime: number | null
  pomodoroTimeLeft: number | null
  pomodoroIsRunning: boolean
  pomodoroMode: 'work' | 'shortBreak' | 'longBreak'
  pomodoroTimerToggleRef: (() => void) | null
  
  // Feature tour state
  hasSeenPomodoroTour: boolean
  
  // Pomodoro widget state
  pomodoroWidgetPosition: { x: number; y: number }
  showPomodoroDashboard: boolean
  
  // Audio widget state
  audioWidgetPosition: { x: number; y: number }
  
  // Related Documents state
  relatedDocuments: DocumentRelationshipWithDetails[]
  relatedDocumentsRefreshTrigger: number
  
  // Recently Viewed Documents state
  recentlyViewedDocuments: Document[]
  maxRecentlyViewed: number
  
  // Study mode and notes state
  studyMode: boolean
  noteTemplateType: 'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | null

  // Customizable Reading wizard
  customReadingWizard: CustomReadingWizardState

  // Unsaved changes tracking
  hasUnsavedChanges: boolean
  
  // Actions
  setUser: (user: AuthUser | null) => void
  setAuthenticated: (authenticated: boolean) => void
  checkAuth: (sessionFromContext?: any) => Promise<void>
  logout: () => Promise<void>
  setCurrentDocument: (document: Document | null) => void
  addDocument: (document: Document, setAsCurrent?: boolean) => void
  updateDocument: (document: Document) => void
  removeDocument: (id: string) => void
  toggleChat: () => void
  setEditorialMode: (enabled: boolean) => void
  setIsRightSidebarOpen: (open: boolean) => void
  setRightSidebarTab: (tab: 'notes' | 'highlights') => void
  setRightSidebarWidth: (width: number) => void
  setChatWindowPosition: (position: { top: number; left: number }) => void
  setChatWindowSize: (size: { width: number; height: number }) => void
  setNavRailExpanded: (expanded: boolean) => void
  setLoading: (loading: boolean) => void
  updateTypography: (settings: Partial<TypographySettings>) => void
  updateTheme: (settings: Partial<ThemeSettings>) => void
  updatePDFViewer: (settings: Partial<PDFViewerSettings>) => void
  updateTTS: (settings: Partial<TTSSettings>) => void
  addChatMessage: (message: NewChatMessage) => void
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
  setCollectionDragState: (state: Partial<AppState['collectionDragState']>) => void
  setTagManagerOpen: (open: boolean) => void
  setPendingAssignmentTargets: (targets: Partial<AppState['pendingAssignmentTargets']>) => void
  
  setPomodoroSession: (sessionId: string | null, bookId: string | null, startTime: number | null) => void
  updatePomodoroTimer: (timeLeft: number | null, isRunning: boolean, mode: 'work' | 'shortBreak' | 'longBreak') => void
  stopPomodoroTimer: () => void
  startPomodoroTimer: () => void
  setPomodoroTimerToggleRef: (toggleRef: (() => void) | null) => void
  
  // Feature tour actions
  setHasSeenPomodoroTour: (seen: boolean) => void
  
  // Pomodoro widget actions
  setPomodoroWidgetPosition: (position: { x: number; y: number }) => void
  setShowPomodoroDashboard: (show: boolean) => void
  setAudioWidgetPosition: (position: { x: number; y: number }) => void
  
  // Text selection and AI mode actions
  setSelectedTextContext: (context: TextSelectionContext | null) => void
  setChatMode: (mode: 'general' | 'clarification' | 'further-reading') => void
  
  // Study mode and notes actions
  setStudyMode: (enabled: boolean) => void
  setNoteTemplateType: (type: 'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | null) => void
  
  // Related Documents actions
  setRelatedDocuments: (documents: DocumentRelationshipWithDetails[]) => void
  refreshRelatedDocuments: () => void
  
  // Recently Viewed Documents actions
  addToRecentlyViewed: (document: Document) => void
  clearRecentlyViewed: () => void
  
  // TTS position tracking actions
  saveTTSPosition: (documentId: string, position: TTSPosition) => void
  loadTTSPosition: (documentId: string) => TTSPosition | null
  openCustomReadingWizard: (source?: CustomReadingWizardSource) => void
  advanceCustomReadingWizard: (step: CustomReadingWizardStep, extra?: Partial<CustomReadingWizardState>) => void
  setCustomReadingWizardStatus: (status: CustomReadingWizardStatus, error?: string | null) => void
  closeCustomReadingWizard: () => void
}

const readBooleanPreference = (key: string, fallback: boolean): boolean => {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return fallback
}

const readRightSidebarTabPreference = (fallback: 'notes' | 'highlights'): 'notes' | 'highlights' => {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem('rightSidebarTab')
  if (stored === 'highlights') return 'highlights'
  return 'notes'
}

const readNumberPreference = (key: string, fallback: number): number => {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(key)
  if (!stored) return fallback
  const parsed = Number(stored)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  currentDocument: null,
  documents: [],
  isChatOpen: readBooleanPreference('chatWindowOpen', false),
  isRightSidebarOpen: false,
  rightSidebarTab: readRightSidebarTabPreference('notes'),
  rightSidebarWidth: readNumberPreference('rightSidebarWidth', 360),
  chatWindowPosition: {
    top: readNumberPreference('chatWindowTop', 120),
    left: readNumberPreference('chatWindowLeft', 80)
  },
  chatWindowSize: {
    width: readNumberPreference('chatWindowWidth', 420),
    height: readNumberPreference('chatWindowHeight', 600)
  },
  isNavRailExpanded: readBooleanPreference('navRailExpanded', false),
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
    readingGuide: false
  },
  theme: {
    currentTheme: 'default',
    isDarkMode: false
  },
  pdfViewer: {
    currentPage: 1,
    numPages: null,
    zoom: 1.4, // Set to 140% for optimal text quality on high-DPI displays
    scale: 1.4, // Set to 140% for optimal text quality on high-DPI displays
    rotation: 0,
    viewMode: 'pdf',
    scrollMode: 'continuous', // Default to Continuous Scrolling mode
    showPageNumbers: true,
    showProgress: true,
    readingMode: false,
    darkMode: false
  },
  tts: {
    isEnabled: false,
    isPlaying: false,
    isPaused: false,
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
    autoAdvanceParagraph: true,
    documentPositions: {}
  },
  chatMessages: [],
  isTyping: false,
  libraryRefreshTrigger: 0,
  
  // Text selection and AI context
  selectedTextContext: null,
  chatMode: 'general',
  
  // Library view settings
  libraryView: {
    viewMode: 'list',
    sortBy: 'last_read_at',
    sortOrder: 'desc',
    selectedCollectionId: null,
    selectedTags: [],
    searchQuery: '',
    filters: {},
    selectedBooks: []
  },
  collectionDragState: {
    activeId: null,
    overId: null
  },
  tagManagerOpen: false,
  pendingAssignmentTargets: {
    collectionIds: [],
    tagIds: []
  },
  
  // Pomodoro state
  activePomodoroSessionId: null,
  activePomodoroBookId: null,
  pomodoroStartTime: null,
  pomodoroTimeLeft: null,
  pomodoroIsRunning: false,
  pomodoroMode: 'work',
  pomodoroTimerToggleRef: null,
  
  // Feature tour state
  hasSeenPomodoroTour: false,
  
  // Pomodoro widget state
  pomodoroWidgetPosition: { x: 0, y: 0 },
  showPomodoroDashboard: false,
  
  // Audio widget state
  audioWidgetPosition: {
    x: readNumberPreference('audioWidgetX', 0),
    y: readNumberPreference('audioWidgetY', 0)
  },
  
  // Related Documents state
  relatedDocuments: [],
  relatedDocumentsRefreshTrigger: 0,
  
  // Recently Viewed Documents state
  recentlyViewedDocuments: [],
  maxRecentlyViewed: 8, // Best practice: 5-10 documents
  
  // Study mode and notes state
  studyMode: false,
  noteTemplateType: null,
  customReadingWizard: {
    isOpen: false,
    step: 'welcome',
    source: null,
    documentId: null,
    status: 'idle',
    error: null
  },
  
  // Unsaved changes tracking
  hasUnsavedChanges: false,
  
  // Authentication actions
  setUser: (user) => set({ user }),
  
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  
  checkAuth: async (sessionFromContext?: any) => {
    try {
      let user;
      
      // If session is provided from AuthContext, use it directly to avoid race condition
      if (sessionFromContext?.user) {
        user = sessionFromContext.user;
        console.log('Using session from AuthContext:', user.email);
      } else {
        // Otherwise, get user from auth service (fallback for backward compatibility)
        user = await authService.getCurrentUser();
      }
      
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
              credits: 200
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
              credits: 200
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
    if (document) {
      // Comprehensive sanitization of document data
      const sanitizedDocument = { ...document };
      
      // CRITICAL FIX: Initialize pageTexts to empty array if undefined/null
      // This prevents "Cannot read properties of undefined (reading 'length')" errors
      if (!sanitizedDocument.pageTexts || !Array.isArray(sanitizedDocument.pageTexts)) {
        sanitizedDocument.pageTexts = [];
      }
      
      // CRITICAL FIX: Initialize cleanedPageTexts to empty array if undefined/null
      if (!sanitizedDocument.cleanedPageTexts || !Array.isArray(sanitizedDocument.cleanedPageTexts)) {
        sanitizedDocument.cleanedPageTexts = [];
      }
      
      // Sanitize pageTexts array
      if (sanitizedDocument.pageTexts && sanitizedDocument.pageTexts.length > 0) {
        // Debug: Log the pageTexts before sanitization
        console.log('🔍 setCurrentDocument: Before sanitization:');
        console.log('  Document ID:', sanitizedDocument.id);
        console.log('  PageTexts Length:', sanitizedDocument.pageTexts.length);
        console.log('  PageTexts Types:', sanitizedDocument.pageTexts.map((text, i) => ({
          index: i,
          type: typeof text,
          isString: typeof text === 'string',
          value: (String(text).substring(0, 50) + (String(text).length > 50 ? '...' : ''))
        })));
        
        // Deep sanitization of pageTexts to ensure all elements are strings
        sanitizedDocument.pageTexts = sanitizedDocument.pageTexts.map((text, index) => {
          // Handle various data types that might be in the database
          if (text === null || text === undefined) {
            console.warn(`🔍 setCurrentDocument: PageText ${index} is null/undefined, converting to empty string`);
            return '';
          }
          
          if (typeof text === 'string') {
            return text;
          }
          
          if (typeof text === 'object') {
            console.warn(`🔍 setCurrentDocument: PageText ${index} is object, stringifying:`, {
              type: typeof text,
              constructor: (text as any)?.constructor?.name,
              keys: Object.keys(text || {}),
              value: JSON.stringify(text).substring(0, 100)
            });
            return JSON.stringify(text);
          }
          
          // For any other type, convert to string
          console.warn(`🔍 setCurrentDocument: PageText ${index} is ${typeof text}, converting to string`);
          return String(text);
        });
        
        // Debug: Log the pageTexts after sanitization
        console.log('🔍 setCurrentDocument: After sanitization:');
        console.log('  Document ID:', sanitizedDocument.id);
        console.log('  PageTexts Length:', sanitizedDocument.pageTexts.length);
        console.log('  PageTexts Types:', sanitizedDocument.pageTexts.map((text, i) => ({
          index: i,
          type: typeof text,
          isString: typeof text === 'string',
          value: (String(text).substring(0, 50) + (String(text).length > 50 ? '...' : ''))
        })));
      }
      
      // Sanitize cleanedPageTexts array if it exists and has content
      if (sanitizedDocument.cleanedPageTexts && sanitizedDocument.cleanedPageTexts.length > 0) {
        sanitizedDocument.cleanedPageTexts = sanitizedDocument.cleanedPageTexts.map((text, index) => {
          if (text === null || text === undefined) {
            return '';
          }
          if (typeof text === 'string') {
            return text;
          }
          if (typeof text === 'object') {
            try {
              return JSON.stringify(text);
            } catch {
              return String(text);
            }
          }
          return String(text);
        });
      }
      
      // Sanitize other text fields that might cause issues
      if (sanitizedDocument.content && typeof sanitizedDocument.content !== 'string') {
        console.warn('🔍 setCurrentDocument: Content is not a string, converting:', typeof sanitizedDocument.content);
        sanitizedDocument.content = String(sanitizedDocument.content);
      }
      
      if (sanitizedDocument.name && typeof sanitizedDocument.name !== 'string') {
        console.warn('🔍 setCurrentDocument: Name is not a string, converting:', typeof sanitizedDocument.name);
        sanitizedDocument.name = String(sanitizedDocument.name);
      }
      
      set({ currentDocument: sanitizedDocument });
      
      // Add to recently viewed documents
      get().addToRecentlyViewed(sanitizedDocument);
    } else {
      // CRITICAL: When setting to null, ensure we're not leaving any components with stale undefined arrays
      // This prevents race conditions during state transitions
      set({ currentDocument: document });
    }
  },
  
  addDocument: (document, setAsCurrent = true) => {
    console.log('AppStore: Adding document:', {
      id: document.id,
      name: document.name,
      type: document.type,
      setAsCurrent,
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
      // Only set as current document if explicitly requested (default: true for backward compatibility)
      ...(setAsCurrent && { currentDocument: document })
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
  
  toggleChat: () => set((state) => {
    const next = !state.isChatOpen
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chatWindowOpen', String(next))
    }
    return { isChatOpen: next }
  }),

  setEditorialMode: (enabled) => set({ isEditorialMode: enabled }),
  
  reviewCitations: [],
  reviewContent: '',
  addReviewCitation: (citation) => set((state) => ({ reviewCitations: [...state.reviewCitations, citation] })),
  setReviewContent: (content) => set({ reviewContent: content }),

  audioWidgetPosition: 'default',
  setAudioWidgetPosition: (position) => set({ audioWidgetPosition: position }),
  
  setIsRightSidebarOpen: (open) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rightSidebarOpen', String(open))
    }
    return { isRightSidebarOpen: open }
  }),
  setRightSidebarTab: (tab) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rightSidebarTab', tab)
    }
    return { rightSidebarTab: tab }
  }),
  setRightSidebarWidth: (width) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rightSidebarWidth', String(width))
    }
    return { rightSidebarWidth: width }
  }),
  setChatWindowPosition: (position) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chatWindowTop', String(position.top))
      window.localStorage.setItem('chatWindowLeft', String(position.left))
    }
    return { chatWindowPosition: position }
  }),
  setChatWindowSize: (size) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('chatWindowWidth', String(size.width))
      window.localStorage.setItem('chatWindowHeight', String(size.height))
    }
    return { chatWindowSize: size }
  }),
  setNavRailExpanded: (expanded) => set(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('navRailExpanded', String(expanded))
    }
    return { isNavRailExpanded: expanded }
  }),
  
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
    chatMessages: [
      ...state.chatMessages,
      {
        ...message,
        id: message.id || crypto.randomUUID(),
        timestamp: message.timestamp || new Date()
      }
    ]
  })),
  
  clearChat: () => set({ chatMessages: [] }),
  
  setTyping: (typing) => set({ isTyping: typing }),
  
  refreshLibrary: () => {
    console.log('AppStore: refreshLibrary() called, incrementing trigger')
    set((state) => ({ 
      libraryRefreshTrigger: state.libraryRefreshTrigger + 1 
    }))
  },
  
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
  
  stopPomodoroTimer: () => set({
    pomodoroTimeLeft: null,
    pomodoroIsRunning: false,
    pomodoroMode: 'work'
  }),
  
  startPomodoroTimer: () => {
    const { pomodoroTimerToggleRef } = get()
    if (pomodoroTimerToggleRef) {
      pomodoroTimerToggleRef()
    }
  },
  
  setPomodoroTimerToggleRef: (toggleRef) => set({ pomodoroTimerToggleRef: toggleRef }),
  
  // Feature tour actions
  setHasSeenPomodoroTour: (seen) => set({ hasSeenPomodoroTour: seen }),
  
  // Pomodoro widget actions
  setPomodoroWidgetPosition: (position) => set({ pomodoroWidgetPosition: position }),
  setShowPomodoroDashboard: (show) => set({ showPomodoroDashboard: show }),
  setAudioWidgetPosition: (position) => {
    const safePosition = {
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0
    }
    set({ audioWidgetPosition: safePosition })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('audioWidgetX', String(Math.round(safePosition.x)))
      window.localStorage.setItem('audioWidgetY', String(Math.round(safePosition.y)))
    }
  },
  
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

  setCollectionDragState: (dragState) => set((state) => ({
    collectionDragState: { ...state.collectionDragState, ...dragState }
  })),

  setTagManagerOpen: (open) => set({ tagManagerOpen: open }),

  setPendingAssignmentTargets: (targets) => set((state) => ({
    pendingAssignmentTargets: {
      collectionIds: targets.collectionIds ?? state.pendingAssignmentTargets.collectionIds,
      tagIds: targets.tagIds ?? state.pendingAssignmentTargets.tagIds
    }
  })),
  
  // Text selection and AI mode actions
  setSelectedTextContext: (context) => set({ selectedTextContext: context }),
  
  setChatMode: (mode) => set({ chatMode: mode }),
  
  // Study mode and notes actions
  setStudyMode: (enabled) => set({ studyMode: enabled }),
  setNoteTemplateType: (type) => set({ noteTemplateType: type }),

  // Custom Reading Wizard
  openCustomReadingWizard: (source?: CustomReadingWizardSource) => set({
    customReadingWizard: {
      isOpen: true,
      step: 'welcome',
      source: source || 'empty-state',
      documentId: null,
      status: 'idle',
      error: null
    }
  }),
  advanceCustomReadingWizard: (step: CustomReadingWizardStep, extra: Partial<CustomReadingWizardState> = {}) => set((state) => ({
    customReadingWizard: {
      ...state.customReadingWizard,
      step,
      ...extra
    }
  })),
  setCustomReadingWizardStatus: (status: CustomReadingWizardStatus, error: string | null = null) => set((state) => ({
    customReadingWizard: {
      ...state.customReadingWizard,
      status,
      error
    }
  })),
  closeCustomReadingWizard: () => set({
    customReadingWizard: {
      isOpen: false,
      step: 'welcome',
      source: null,
      documentId: null,
      status: 'idle',
      error: null
    }
  }),
  
  // Related Documents actions
  setRelatedDocuments: (documents) => set({ relatedDocuments: documents }),
  
  refreshRelatedDocuments: () => {
    console.log('AppStore: refreshRelatedDocuments() called, incrementing trigger')
    set((state) => ({
      relatedDocumentsRefreshTrigger: state.relatedDocumentsRefreshTrigger + 1
    }))
  },
  
  // Recently Viewed Documents actions
  addToRecentlyViewed: (document) => {
    set((state) => {
      const { recentlyViewedDocuments, maxRecentlyViewed } = state
      
      // Remove document if it already exists (to avoid duplicates)
      const filtered = recentlyViewedDocuments.filter(doc => doc.id !== document.id)
      
      // Add document to the beginning of the array
      const updated = [document, ...filtered]
      
      // Keep only the maximum number of recently viewed documents
      const limited = updated.slice(0, maxRecentlyViewed)
      
      console.log(`AppStore: Added document "${document.name}" to recently viewed. Total: ${limited.length}`)
      
      return { recentlyViewedDocuments: limited }
    })
  },
  
  clearRecentlyViewed: () => {
    console.log('AppStore: Clearing recently viewed documents')
    set({ recentlyViewedDocuments: [] })
  },
  
  // TTS position tracking actions
  saveTTSPosition: (documentId, position) => set((state) => ({
    tts: {
      ...state.tts,
      documentPositions: {
        ...state.tts.documentPositions,
        [documentId]: position
      }
    }
  })),
  
  loadTTSPosition: (documentId) => {
    const state = get()
    return state.tts.documentPositions[documentId] || null
  },
  
  // Unsaved changes tracking
  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
  
  closeDocumentWithoutSaving: () => {
    set({ 
      currentDocument: null,
      hasUnsavedChanges: false,
      chatMessages: [],
      selectedTextContext: null
    })
  }
}))


