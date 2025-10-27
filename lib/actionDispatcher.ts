import { UserAction, HighlightAction, CreateNoteAction, SearchAction, ExportAction, TTSAction, QuestionAction, NavigationAction } from './actionSchemas';

export interface ActionDispatcherResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Action Dispatcher - Routes parsed actions to appropriate handlers
 * Integrates with existing features in the application
 */
export class ActionDispatcher {
  /**
   * Dispatch an action to the appropriate handler
   */
  async dispatch(action: UserAction, context?: {
    currentDocument?: any;
    currentPage?: number;
    userId?: string;
    documentId?: string;
  }): Promise<ActionDispatcherResult> {
    try {
      switch (action.type) {
        case 'highlight':
          return await this.handleHighlight(action, context);
        
        case 'create_note':
          return await this.handleCreateNote(action, context);
        
        case 'search_concept':
          return await this.handleSearchConcept(action, context);
        
        case 'export':
          return await this.handleExport(action, context);
        
        case 'tts_play':
          return await this.handleTTS(action, context);
        
        case 'question':
          return await this.handleQuestion(action, context);
        
        case 'navigate':
          return await this.handleNavigate(action, context);
        
        default:
          return {
            success: false,
            message: `Unknown action type: ${(action as any).type}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error dispatching action: ${error.message}`,
      };
    }
  }

  /**
   * Handle highlight action
   */
  private async handleHighlight(action: HighlightAction, context?: any): Promise<ActionDispatcherResult> {
    // This would integrate with the existing highlight system
    return {
      success: true,
      message: `Highlight action ready: ${action.text.substring(0, 50)}...`,
      data: {
        type: 'highlight',
        text: action.text,
        color: action.colorHex,
        page: action.pageNumber,
      },
    };
  }

  /**
   * Handle create note action
   */
  private async handleCreateNote(action: CreateNoteAction, context?: any): Promise<ActionDispatcherResult> {
    return {
      success: true,
      message: `Note creation ready: ${action.content.substring(0, 50)}...`,
      data: {
        type: 'create_note',
        content: action.content,
        pageNumber: action.pageNumber,
        noteType: action.noteType,
      },
    };
  }

  /**
   * Handle search concept action
   */
  private async handleSearchConcept(action: SearchAction, context?: any): Promise<ActionDispatcherResult> {
    // This would trigger semantic search across memories
    return {
      success: true,
      message: `Searching for: ${action.query} in ${action.scope} scope`,
      data: {
        type: 'search_concept',
        query: action.query,
        scope: action.scope,
      },
    };
  }

  /**
   * Handle export action
   */
  private async handleExport(action: ExportAction, context?: any): Promise<ActionDispatcherResult> {
    return {
      success: true,
      message: `Export ready: ${action.content} as ${action.format}`,
      data: {
        type: 'export',
        content: action.content,
        format: action.format,
      },
    };
  }

  /**
   * Handle TTS action
   */
  private async handleTTS(action: TTSAction, context?: any): Promise<ActionDispatcherResult> {
    return {
      success: true,
      message: `TTS play ready: ${action.mode} mode`,
      data: {
        type: 'tts_play',
        mode: action.mode,
      },
    };
  }

  /**
   * Handle question action
   */
  private async handleQuestion(action: QuestionAction, context?: any): Promise<ActionDispatcherResult> {
    return {
      success: true,
      message: `Question ready: ${action.query.substring(0, 50)}...`,
      data: {
        type: 'question',
        query: action.query,
        context: action.context,
      },
    };
  }

  /**
   * Handle navigation action
   */
  private async handleNavigate(action: NavigationAction, context?: any): Promise<ActionDispatcherResult> {
    return {
      success: true,
      message: `Navigate ready: ${action.target} -> ${action.value}`,
      data: {
        type: 'navigate',
        target: action.target,
        value: action.value,
      },
    };
  }

  /**
   * Batch dispatch multiple actions
   */
  async dispatchBatch(actions: UserAction[], context?: any): Promise<ActionDispatcherResult[]> {
    const results: ActionDispatcherResult[] = [];
    
    for (const action of actions) {
      const result = await this.dispatch(action, context);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Validate action before dispatching
   */
  validateAction(action: UserAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    switch (action.type) {
      case 'highlight':
        if (!action.text) errors.push('Text is required for highlight');
        if (!action.colorHex) errors.push('Color is required for highlight');
        break;
      
      case 'create_note':
        if (!action.content) errors.push('Content is required for note');
        if (!action.noteType) errors.push('Note type is required');
        break;
      
      case 'search_concept':
        if (!action.query) errors.push('Query is required for search');
        break;
      
      case 'export':
        if (!action.content) errors.push('Content type is required for export');
        if (!action.format) errors.push('Format is required for export');
        break;
      
      case 'tts_play':
        if (!action.mode) errors.push('Mode is required for TTS');
        break;
      
      case 'question':
        if (!action.query) errors.push('Query is required for question');
        break;
      
      case 'navigate':
        if (!action.target) errors.push('Target is required for navigation');
        if (action.value === undefined) errors.push('Value is required for navigation');
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const actionDispatcher = new ActionDispatcher();

