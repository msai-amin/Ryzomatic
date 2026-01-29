/**
 * Shared types for Ryzomatic Chrome Extension
 */

// User and Authentication
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Documents
export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text';
  file_size?: number;
  total_pages?: number;
  created_at: string;
  updated_at: string;
  last_read_at?: string;
  reading_progress?: number;
  custom_metadata?: Record<string, unknown>;
}

export interface DocumentUploadRequest {
  file: File | Blob;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentUploadResponse {
  success: boolean;
  document?: Document;
  error?: string;
}

// Highlights
export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  highlighted_text: string;
  color_id: string;
  color_hex: string;
  position_data: PositionData;
  text_start_offset?: number;
  text_end_offset?: number;
  text_context_before?: string;
  text_context_after?: string;
  is_orphaned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PositionData {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex?: number;
}

export interface HighlightCreateRequest {
  bookId: string;
  pageNumber: number;
  highlightedText: string;
  colorId: string;
  colorHex: string;
  positionData: PositionData;
  textStartOffset?: number;
  textEndOffset?: number;
  textContextBefore?: string;
  textContextAfter?: string;
}

// Notes
export interface Note {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  content: string;
  position_x?: number;
  position_y?: number;
  created_at: string;
  updated_at: string;
}

export interface NoteCreateRequest {
  bookId: string;
  pageNumber: number;
  content: string;
  positionX?: number;
  positionY?: number;
}

// Page Content Extraction
export interface PageContent {
  url: string;
  title: string;
  text: string;
  html?: string;
  description?: string;
  author?: string;
  publishDate?: string;
  favicon?: string;
  ogImage?: string;
  isPdf: boolean;
}

// Message Types for Chrome Extension Communication
export type MessageType =
  | 'GET_AUTH_STATE'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'SAVE_PAGE'
  | 'SAVE_PDF'
  | 'SAVE_HIGHLIGHT'
  | 'SAVE_NOTE'
  | 'GET_PAGE_CONTENT'
  | 'GET_RECENT_DOCUMENTS'
  | 'SEARCH_LIBRARY'
  | 'OPEN_RYZOMATIC';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Highlight Colors (matching the main app)
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#fef08a', name: 'Yellow' },
  { id: 'green', hex: '#bbf7d0', name: 'Green' },
  { id: 'blue', hex: '#bfdbfe', name: 'Blue' },
  { id: 'pink', hex: '#fbcfe8', name: 'Pink' },
  { id: 'purple', hex: '#ddd6fe', name: 'Purple' },
  { id: 'orange', hex: '#fed7aa', name: 'Orange' },
] as const;

export type HighlightColorId = typeof HIGHLIGHT_COLORS[number]['id'];

// Storage Keys
export const STORAGE_KEYS = {
  SESSION: 'ryzomatic_session',
  USER: 'ryzomatic_user',
  RECENT_DOCUMENTS: 'ryzomatic_recent_docs',
  SETTINGS: 'ryzomatic_settings',
} as const;

// Settings
export interface ExtensionSettings {
  defaultHighlightColor: HighlightColorId;
  showSelectionToolbar: boolean;
  autoSaveHighlights: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultHighlightColor: 'yellow',
  showSelectionToolbar: true,
  autoSaveHighlights: false,
  notificationsEnabled: true,
};

