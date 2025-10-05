import { create } from 'zustand'
import { authService, AuthUser } from '../services/supabaseAuthService'

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

export interface TTSSettings {
  isEnabled: boolean
  isPlaying: boolean
  rate: number
  pitch: number
  volume: number
  voiceName: string | null
  highlightCurrentWord: boolean
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
  
  // Typography settings
  typography: TypographySettings
  
  // PDF viewer settings
  pdfViewer: PDFViewerSettings
  
  // TTS settings
  tts: TTSSettings
  
  // Chat state
  chatMessages: ChatMessage[]
  isTyping: boolean
  
  // Actions
  setUser: (user: AuthUser | null) => void
  setAuthenticated: (authenticated: boolean) => void
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  setCurrentDocument: (document: Document | null) => void
  addDocument: (document: Document) => void
  removeDocument: (id: string) => void
  toggleChat: () => void
  setLoading: (loading: boolean) => void
  updateTypography: (settings: Partial<TypographySettings>) => void
  updatePDFViewer: (settings: Partial<PDFViewerSettings>) => void
  updateTTS: (settings: Partial<TTSSettings>) => void
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChat: () => void
  setTyping: (typing: boolean) => void
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
    theme: 'light'
  },
  pdfViewer: {
    currentPage: 1,
    zoom: 1.0,
    scale: 1.0,
    rotation: 0,
    viewMode: 'pdf',
    scrollMode: 'single',
    showPageNumbers: true,
    showProgress: true,
    readingMode: false
  },
  tts: {
    isEnabled: false,
    isPlaying: false,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voiceName: null,
    highlightCurrentWord: true
  },
  chatMessages: [],
  isTyping: false,
  
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
  setCurrentDocument: (document) => set({ currentDocument: document }),
  
  addDocument: (document) => set((state) => ({
    documents: [...state.documents, document],
    currentDocument: document
  })),
  
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter(doc => doc.id !== id),
    currentDocument: state.currentDocument?.id === id ? null : state.currentDocument
  })),
  
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  updateTypography: (settings) => set((state) => ({
    typography: { ...state.typography, ...settings }
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
  
  setTyping: (typing) => set({ isTyping: typing })
}))


