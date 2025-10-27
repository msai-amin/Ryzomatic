// Notes Service for managing research notes with SQ3R framework
import { userNotes } from '../../lib/supabase';
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
   * Export notes in multiple formats
   */
  async exportNotes(
    notes: NoteWithMetadata[],
    format: 'markdown' | 'html' | 'json' | 'text',
    documentTitle?: string
  ): Promise<string> {
    switch (format) {
      case 'markdown':
        return this.exportAsMarkdown(notes, documentTitle);
      case 'html':
        return this.exportAsHTML(notes, documentTitle);
      case 'json':
        return this.exportAsJSON(notes);
      case 'text':
        return this.exportAsText(notes);
      default:
        return this.exportAsMarkdown(notes, documentTitle);
    }
  }

  /**
   * Export notes as Markdown
   */
  private exportAsMarkdown(notes: NoteWithMetadata[], documentTitle?: string): string {
    let markdown = `# Notes: ${documentTitle || 'Document'}\n\n`;
    markdown += `Exported: ${new Date().toLocaleString()}\n`;
    markdown += `Total Notes: ${notes.length}\n\n---\n\n`;
    
    notes.forEach((note, index) => {
      const date = new Date(note.created_at).toLocaleDateString();
      markdown += `## Note ${index + 1} - ${date} (Page ${note.page_number})\n\n`;
      markdown += `**Type:** ${note.note_type}${note.is_ai_generated ? ' (AI Generated)' : ''}\n\n`;
      markdown += `${note.content}\n\n---\n\n`;
    });
    
    return markdown;
  }

  /**
   * Export notes as HTML with embedded CSS
   */
  private exportAsHTML(notes: NoteWithMetadata[], documentTitle?: string): string {
    const stylesheet = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #1f2937; background: #f9fafb; }
      .header { border-bottom: 3px solid #6b7280; padding-bottom: 20px; margin-bottom: 30px; }
      h1 { color: #111827; margin: 0 0 10px 0; }
      .meta { color: #6b7280; font-size: 14px; }
      .note { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .note-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
      .note-title { font-weight: 600; color: #374151; }
      .note-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
      .badge-freeform { background: #f3f4f6; color: #374151; }
      .badge-cornell { background: #fef3c7; color: #92400e; }
      .badge-outline { background: #dbeafe; color: #1e40af; }
      .badge-mindmap { background: #d1fae5; color: #065f46; }
      .badge-chart { background: #fce7f3; color: #9f1239; }
      .badge-boxing { background: #e0e7ff; color: #3730a3; }
      .badge-ai { background: #fef3c7; color: #92400e; margin-left: 8px; }
      .note-content { color: #1f2937; white-space: pre-wrap; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 14px; }
    </style>
  `;
  
    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Notes: ${documentTitle || 'Document'}</title>${stylesheet}</head><body>`;
    
    html += `<div class="header">`;
    html += `<h1>Notes: ${documentTitle || 'Document'}</h1>`;
    html += `<div class="meta">Exported: ${new Date().toLocaleString()} | Total Notes: ${notes.length}</div>`;
    html += `</div>`;
    
    notes.forEach((note, index) => {
      const date = new Date(note.created_at).toLocaleDateString();
      html += `<div class="note">`;
      html += `<div class="note-header">`;
      html += `<div class="note-title">Note ${index + 1} - ${date} (Page ${note.page_number})</div>`;
      html += `<div>`;
      html += `<span class="note-badge badge-${note.note_type}">${note.note_type}</span>`;
      if (note.is_ai_generated) {
        html += `<span class="note-badge badge-ai">AI</span>`;
      }
      html += `</div></div>`;
      html += `<div class="note-content">${note.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
      html += `</div>`;
    });
    
    html += `<div class="footer">Generated by ryzomatic</div>`;
    html += `</body></html>`;
    
    return html;
  }

  /**
   * Export notes as JSON
   */
  private exportAsJSON(notes: NoteWithMetadata[]): string {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalNotes: notes.length,
      notes: notes.map(note => ({
        id: note.id,
        pageNumber: note.page_number,
        content: note.content,
        type: note.note_type,
        metadata: note.note_metadata,
        isAIGenerated: note.is_ai_generated,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export notes as Plain Text
   */
  private exportAsText(notes: NoteWithMetadata[]): string {
    let text = `NOTES\n`;
    text += `Exported: ${new Date().toLocaleString()}\n`;
    text += `Total Notes: ${notes.length}\n`;
    text += `${'='.repeat(60)}\n\n`;
    
    notes.forEach((note, index) => {
      const date = new Date(note.created_at).toLocaleDateString();
      text += `Note ${index + 1} - ${date} (Page ${note.page_number})\n`;
      text += `Type: ${note.note_type}${note.is_ai_generated ? ' (AI Generated)' : ''}\n`;
      text += `${'-'.repeat(60)}\n`;
      text += `${note.content}\n\n`;
      text += `${'='.repeat(60)}\n\n`;
    });
    
    return text;
  }
}

export const notesService = new NotesService();

