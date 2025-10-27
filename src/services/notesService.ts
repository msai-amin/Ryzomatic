// Notes Service for managing research notes with SQ3R framework
import { userNotes } from '../lib/supabase';
import { sendMessageToAI } from './aiService';
import { Document } from '../store/appStore';

export interface NoteMetadata {
  cueColumn?: string;
  notesArea?: string;
  summary?: string;
  branches?: Array<{ level: number; text: string }>;
  // Add other template-specific metadata as needed
}

export interface NoteWithMetadata {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  content: string;
  position_x?: number;
  position_y?: number;
  note_type: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | 'freeform';
  note_metadata?: NoteMetadata;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

class NotesService {
  /**
   * Create a new note
   */
  async createNote(
    userId: string,
    bookId: string,
    pageNumber: number,
    content: string,
    noteType: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | 'freeform',
    metadata?: NoteMetadata,
    isAIGenerated: boolean = false,
    position?: { x: number; y: number }
  ): Promise<{ data: NoteWithMetadata | null; error: Error | null }> {
    try {
      const { data, error } = await userNotes.create({
        user_id: userId,
        book_id: bookId,
        page_number: pageNumber,
        content,
        position_x: position?.x,
        position_y: position?.y,
        note_type: noteType,
        note_metadata: metadata || {},
        is_ai_generated: isAIGenerated,
      });

      if (error) {
        console.error('NotesService: Error creating note:', error);
        return { data: null, error: error as Error };
      }

      return { data: data as NoteWithMetadata, error: null };
    } catch (error) {
      console.error('NotesService: Exception creating note:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update an existing note
   */
  async updateNote(
    noteId: string,
    updates: {
      content?: string;
      note_metadata?: NoteMetadata;
      position?: { x: number; y: number };
    }
  ): Promise<{ data: NoteWithMetadata | null; error: Error | null }> {
    try {
      const updateData: any = {};

      if (updates.content !== undefined) {
        updateData.content = updates.content;
      }

      if (updates.note_metadata !== undefined) {
        updateData.note_metadata = updates.note_metadata;
      }

      if (updates.position) {
        updateData.position_x = updates.position.x;
        updateData.position_y = updates.position.y;
      }

      const { data, error } = await userNotes.update(noteId, updateData);

      if (error) {
        console.error('NotesService: Error updating note:', error);
        return { data: null, error: error as Error };
      }

      return { data: data as NoteWithMetadata, error: null };
    } catch (error) {
      console.error('NotesService: Exception updating note:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get notes by type for a specific book
   */
  async getNotesByType(
    userId: string,
    bookId: string,
    noteType: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | 'freeform'
  ): Promise<{ data: NoteWithMetadata[] | null; error: Error | null }> {
    try {
      const { data, error } = await userNotes.list(userId, bookId);

      if (error) {
        console.error('NotesService: Error listing notes:', error);
        return { data: null, error: error as Error };
      }

      // Filter by note_type
      const filteredNotes = data?.filter((note: any) => note.note_type === noteType) || [];

      return { data: filteredNotes as NoteWithMetadata[], error: null };
    } catch (error) {
      console.error('NotesService: Exception listing notes by type:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Get all notes for a book
   */
  async getNotesForBook(
    userId: string,
    bookId: string
  ): Promise<{ data: NoteWithMetadata[] | null; error: Error | null }> {
    try {
      const { data, error } = await userNotes.list(userId, bookId);

      if (error) {
        console.error('NotesService: Error listing notes:', error);
        return { data: null, error: error as Error };
      }

      return { data: data as NoteWithMetadata[], error: null };
    } catch (error) {
      console.error('NotesService: Exception listing notes:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await userNotes.delete(noteId);

      if (error) {
        console.error('NotesService: Error deleting note:', error);
        return { error: error as Error };
      }

      return { error: null };
    } catch (error) {
      console.error('NotesService: Exception deleting note:', error);
      return { error: error as Error };
    }
  }

  /**
   * Generate AI note using SQ3R framework
   */
  async generateAINote(
    document: Document,
    noteType: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing',
    userGoal: string,
    userId: string,
    tier: 'free' | 'pro' | 'premium' | 'enterprise' = 'free'
  ): Promise<{ data: string | null; error: Error | null }> {
    try {
      console.log('NotesService: Generating AI note with type:', noteType);

      // Extract document content
      const documentContent = document.pageTexts?.join('\n\n') || document.content || '';

      // Construct the prompt based on note type
      let noteTypeInstructions = '';
      switch (noteType) {
        case 'cornell':
          noteTypeInstructions = `Generate Cornell notes with:
- Cue Column (keywords and questions)
- Notes Area (main ideas and details)
- Summary Area (2-3 sentence summary)`;
          break;
        case 'outline':
          noteTypeInstructions = `Generate an outline with hierarchical structure (I, A, 1, a, i):`;
          break;
        case 'mindmap':
          noteTypeInstructions = `Generate a mind map with:
- Central topic at the top
- Main branches (2-4 key themes)
- Sub-branches with details
Use indented bullets to show hierarchy:`;
          break;
        case 'chart':
          noteTypeInstructions = `Generate a comparison chart with:
- Row headers (categories)
- Column headers (items being compared)
- Fill in cells with specific details`;
          break;
        case 'boxing':
          noteTypeInstructions = `Generate boxed notes with:
- 3-4 distinct concepts
- Each in its own "box" (heading + bullet points)
- Use clear headings and horizontal rules:`;
          break;
      }

      const prompt = `Please follow the SQ3R framework to generate ${noteType} notes for this document.

User's Goal: ${userGoal}

Note Type: ${noteType}
${noteTypeInstructions}

Document Content:
${documentContent.substring(0, 8000)}

Please generate comprehensive notes following the requested format:`;

      const response = await sendMessageToAI(prompt, documentContent, tier, 'study');

      return { data: response, error: null };
    } catch (error) {
      console.error('NotesService: Error generating AI note:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Export notes to markdown
   */
  async exportNotes(
    notes: NoteWithMetadata[],
    format: 'markdown' | 'text' = 'markdown'
  ): Promise<string> {
    if (format === 'markdown') {
      return notes
        .map((note) => {
          const date = new Date(note.created_at).toLocaleDateString();
          return `## Note - ${date} (Page ${note.page_number})\n\n${note.content}\n\n---\n`;
        })
        .join('\n');
    } else {
      return notes.map((note) => note.content).join('\n\n---\n\n');
    }
  }
}

export const notesService = new NotesService();

