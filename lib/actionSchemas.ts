/**
 * TypeChat-inspired action schemas for natural language → structured actions
 */

export type UserAction =
  | HighlightAction
  | CreateNoteAction
  | SearchAction
  | ExportAction
  | TTSAction
  | QuestionAction
  | NavigationAction;

export interface HighlightAction {
  type: 'highlight';
  text: string;
  colorId: string;
  colorHex: string;
  pageNumber: number;
  positionData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  metadata?: {
    contextBefore?: string;
    contextAfter?: string;
  };
}

export interface CreateNoteAction {
  type: 'create_note';
  content: string;
  pageNumber: number;
  noteType: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | 'freeform';
  position?: {
    x: number;
    y: number;
  };
  metadata?: Record<string, any>;
}

export interface SearchAction {
  type: 'search_concept';
  query: string;
  scope: 'current' | 'library' | 'memory' | 'all';
  filters?: {
    documentIds?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
    entityTypes?: string[];
  };
}

export interface ExportAction {
  type: 'export';
  format: 'markdown' | 'json' | 'pdf' | 'docx';
  content: 'notes' | 'highlights' | 'annotations' | 'all';
  filters?: {
    documentIds?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
  outputPath?: string;
}

export interface TTSAction {
  type: 'tts_play';
  mode: 'page' | 'to_end' | 'selection';
  pageNumber?: number;
  settings?: {
    speed?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
  };
}

export interface QuestionAction {
  type: 'question';
  query: string;
  context: 'document' | 'memory' | 'both';
  mode?: 'study' | 'general' | 'notes';
}

export interface NavigationAction {
  type: 'navigate';
  target: 'page' | 'section' | 'bookmark' | 'highlight';
  value: string | number;
}

/**
 * Action schema for natural language translation
 */
export interface ActionTranslation {
  actions: UserAction[];
  confidence: number; // 0.0 to 1.0
  reasoning?: string;
}

/**
 * Validate action schema
 */
export function validateAction(action: any): action is UserAction {
  if (!action || typeof action !== 'object' || !action.type) {
    return false;
  }

  switch (action.type) {
    case 'highlight':
      return (
        typeof action.text === 'string' &&
        typeof action.colorId === 'string' &&
        typeof action.colorHex === 'string' &&
        typeof action.pageNumber === 'number' &&
        typeof action.positionData === 'object'
      );
    
    case 'create_note':
      return (
        typeof action.content === 'string' &&
        typeof action.pageNumber === 'number' &&
        ['cornell', 'outline', 'mindmap', 'chart', 'boxing', 'freeform'].includes(action.noteType)
      );
    
    case 'search_concept':
      return (
        typeof action.query === 'string' &&
        ['current', 'library', 'memory', 'all'].includes(action.scope)
      );
    
    case 'export':
      return (
        ['markdown', 'json', 'pdf', 'docx'].includes(action.format) &&
        ['notes', 'highlights', 'annotations', 'all'].includes(action.content)
      );
    
    case 'tts_play':
      return ['page', 'to_end', 'selection'].includes(action.mode);
    
    case 'question':
      return (
        typeof action.query === 'string' &&
        ['document', 'memory', 'both'].includes(action.context)
      );
    
    case 'navigate':
      return ['page', 'section', 'bookmark', 'highlight'].includes(action.target);
    
    default:
      return false;
  }
}

/**
 * Extract action metadata for caching
 */
export function extractActionMetadata(action: UserAction): {
  type: string;
  summary: string;
  keyTerms: string[];
} {
  const keyTerms: string[] = [];

  switch (action.type) {
    case 'highlight':
      return {
        type: 'highlight',
        summary: `Highlight ${action.colorId} on page ${action.pageNumber}`,
        keyTerms: [action.text.substring(0, 50), action.colorId, `page-${action.pageNumber}`],
      };
    
    case 'create_note':
      return {
        type: 'create_note',
        summary: `Create ${action.noteType} note on page ${action.pageNumber}`,
        keyTerms: [action.content.substring(0, 50), action.noteType, `page-${action.pageNumber}`],
      };
    
    case 'search_concept':
      return {
        type: 'search_concept',
        summary: `Search ${action.scope} for: ${action.query}`,
        keyTerms: [action.query, action.scope],
      };
    
    case 'export':
      return {
        type: 'export',
        summary: `Export ${action.content} as ${action.format}`,
        keyTerms: [action.content, action.format],
      };
    
    case 'tts_play':
      return {
        type: 'tts_play',
        summary: `Play TTS ${action.mode}`,
        keyTerms: ['tts', action.mode],
      };
    
    case 'question':
      return {
        type: 'question',
        summary: `Question in ${action.context} context`,
        keyTerms: [action.query.substring(0, 50), action.context],
      };
    
    case 'navigate':
      return {
        type: 'navigate',
        summary: `Navigate to ${action.target}: ${action.value}`,
        keyTerms: [action.target, String(action.value)],
      };
  }
}

