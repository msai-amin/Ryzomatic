import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';

// Lazy-load Supabase client to prevent errors when imported on client side
const getSupabaseClient = () => {
  if (typeof window !== 'undefined') {
    return null; // Client-side, don't create server-side client
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl.trim() === '' || supabaseKey.trim() === '') {
    return null;
  }
  
  try {
    return createClient(supabaseUrl.trim(), supabaseKey.trim());
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
};

const supabase = getSupabaseClient();

export interface RelatedNote {
  id: string;
  content: string;
  bookId: string;
  pageNumber: number;
  similarity: number;
}

export interface NoteRelationship {
  noteId1: string;
  noteId2: string;
  relationshipType: string;
  similarityScore: number;
}

export class NoteRelationshipService {
  /**
   * Find related notes using semantic similarity
   */
  async findRelatedNotes(
    noteId: string,
    userId: string,
    threshold: number = 0.75
  ): Promise<RelatedNote[]> {
    try {
      // Get the source note
      const { data: sourceNote, error: sourceError } = await supabase
        .from('user_notes')
        .select('id, content, book_id, embedding')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (sourceError || !sourceNote || !sourceNote.embedding) {
        console.error('Error fetching source note:', sourceError);
        return [];
      }

      const sourceEmbedding = JSON.parse(sourceNote.embedding);
      const queryEmbedding = embeddingService.formatForPgVector(sourceEmbedding);

      // Find similar notes using vector search
      const { data: similarNotes, error } = await supabase.rpc('find_similar_notes', {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        p_book_id: null, // Search across all documents
        similarity_threshold: threshold,
        result_limit: 20,
      });

      if (error) {
        console.error('Error finding similar notes:', error);
        return [];
      }

      // Filter out the source note and format results
      return (similarNotes || [])
        .filter((note: any) => note.id !== noteId)
        .map((note: any) => ({
          id: note.id,
          content: note.content,
          bookId: '', // Will be fetched if needed
          pageNumber: note.page_number,
          similarity: note.similarity,
        }));
    } catch (error) {
      console.error('Error finding related notes:', error);
      return [];
    }
  }

  /**
   * Create a note relationship
   */
  async createNoteRelationship(
    noteId1: string,
    noteId2: string,
    relationshipType: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('note_relationships')
        .insert({
          user_id: userId,
          note_id: noteId1,
          related_type: 'note',
          related_id: noteId2,
          relationship_type: relationshipType,
          is_auto_detected: false,
        });

      if (error) {
        console.error('Error creating note relationship:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error creating note relationship:', error);
      return false;
    }
  }

  /**
   * Auto-detect and create relationships based on similarity
   */
  async autoDetectRelationships(
    noteId: string,
    userId: string,
    threshold: number = 0.75
  ): Promise<number> {
    try {
      const relatedNotes = await this.findRelatedNotes(noteId, userId, threshold);

      let created = 0;
      for (const relatedNote of relatedNotes) {
        const success = await this.createNoteRelationship(
          noteId,
          relatedNote.id,
          'relates_to',
          userId
        );
        if (success) created++;
      }

      return created;
    } catch (error) {
      console.error('Error auto-detecting relationships:', error);
      return 0;
    }
  }

  /**
   * Get cross-document connections (notes that connect multiple documents)
   */
  async getCrossDocumentConnections(userId: string): Promise<NoteRelationship[]> {
    try {
      // Get all note relationships
      const { data: relationships, error } = await supabase
        .from('note_relationships')
        .select('note_id, related_id, relationship_type, similarity_score')
        .eq('user_id', userId)
        .eq('related_type', 'note');

      if (error || !relationships) {
        console.error('Error fetching note relationships:', error);
        return [];
      }

      // Fetch book_ids for all notes
      const noteIds = new Set<string>();
      relationships.forEach(rel => {
        noteIds.add(rel.note_id);
        noteIds.add(rel.related_id);
      });

      const { data: notes } = await supabase
        .from('user_notes')
        .select('id, book_id')
        .in('id', Array.from(noteIds));

      const noteBookMap = new Map(notes?.map(n => [n.id, n.book_id]) || []);

      // Filter to only cross-document relationships
      const crossDocument: NoteRelationship[] = [];
      relationships.forEach(rel => {
        const book1 = noteBookMap.get(rel.note_id);
        const book2 = noteBookMap.get(rel.related_id);
        if (book1 && book2 && book1 !== book2) {
          crossDocument.push({
            noteId1: rel.note_id,
            noteId2: rel.related_id,
            relationshipType: rel.relationship_type,
            similarityScore: rel.similarity_score || 0,
          });
        }
      });

      return crossDocument;
    } catch (error) {
      console.error('Error getting cross-document connections:', error);
      return [];
    }
  }

  /**
   * Get note relationship graph for visualization
   */
  async getNoteRelationshipGraph(
    userId: string,
    documentId?: string
  ): Promise<{
    nodes: Array<{ id: string; content: string; bookId: string }>;
    edges: Array<{ from: string; to: string; type: string; score: number }>;
  }> {
    try {
      let query = supabase
        .from('note_relationships')
        .select('note_id, related_id, relationship_type, similarity_score')
        .eq('user_id', userId)
        .eq('related_type', 'note');

      if (documentId) {
        // Get notes for this document
        const { data: documentNotes } = await supabase
          .from('user_notes')
          .select('id')
          .eq('book_id', documentId)
          .eq('user_id', userId);

        const noteIds = documentNotes?.map(n => n.id) || [];
        if (noteIds.length > 0) {
          query = query.in('note_id', noteIds);
        }
      }

      const { data: relationships, error } = await query;

      if (error || !relationships) {
        return { nodes: [], edges: [] };
      }

      // Get all unique note IDs
      const noteIds = new Set<string>();
      relationships.forEach(rel => {
        noteIds.add(rel.note_id);
        noteIds.add(rel.related_id);
      });

      // Fetch note details
      const { data: notes } = await supabase
        .from('user_notes')
        .select('id, content, book_id')
        .in('id', Array.from(noteIds))
        .eq('user_id', userId);

      const nodes = (notes || []).map(note => ({
        id: note.id,
        content: note.content.substring(0, 100),
        bookId: note.book_id,
      }));

      const edges = relationships.map(rel => ({
        from: rel.note_id,
        to: rel.related_id,
        type: rel.relationship_type,
        score: rel.similarity_score || 0,
      }));

      return { nodes, edges };
    } catch (error) {
      console.error('Error getting note relationship graph:', error);
      return { nodes: [], edges: [] };
    }
  }
}

export const noteRelationshipService = new NoteRelationshipService();

