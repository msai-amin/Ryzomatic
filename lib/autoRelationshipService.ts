import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface NoteRelationship {
  id?: string;
  user_id: string;
  note_id: string;
  related_type: 'document' | 'memory' | 'note';
  related_id: string;
  relationship_type: 'references' | 'illustrates' | 'contradicts' | 'complements' | 'exemplifies' | 'defines';
  similarity_score?: number;
  is_auto_detected?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
}

export class AutoRelationshipService {
  private readonly SIMILARITY_THRESHOLD = 0.75;

  /**
   * Detect and create relationships for a note
   */
  async detectNoteRelationships(noteId: string, userId: string): Promise<number> {
    try {
      // Get the note
      const { data: note, error: noteError } = await supabase
        .from('user_notes')
        .select('*')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (noteError || !note) {
        throw new Error('Note not found');
      }

      // Get embedding for note content
      const noteEmbedding = await embeddingService.embed(note.content);
      const noteEmbeddingString = embeddingService.formatForPgVector(noteEmbedding);

      let relationshipsCreated = 0;

      // 1. Find similar document descriptions
      const docRelationships = await this.findSimilarDocuments(noteEmbedding, userId, noteId);
      
      // 2. Find similar memories
      const memoryRelationships = await this.findSimilarMemories(noteEmbedding, userId, noteId);
      
      // 3. Find similar notes
      const noteRelationships = await this.findSimilarNotes(noteEmbedding, userId, noteId);

      // Store detected relationships
      const allRelationships = [
        ...docRelationships,
        ...memoryRelationships,
        ...noteRelationships
      ];

      if (allRelationships.length > 0) {
        const { error: insertError } = await supabase
          .from('note_relationships')
          .insert(allRelationships);

        if (!insertError) {
          relationshipsCreated = allRelationships.length;
        }
      }

      return relationshipsCreated;
    } catch (error) {
      console.error('Error detecting note relationships:', error);
      return 0;
    }
  }

  /**
   * Find similar document descriptions
   */
  private async findSimilarDocuments(
    noteEmbedding: number[],
    userId: string,
    noteId: string
  ): Promise<NoteRelationship[]> {
    try {
      // Get all document descriptions for this user
      const { data: descriptions, error } = await supabase
        .from('document_descriptions')
        .select('id, book_id, description_embedding')
        .eq('user_id', userId)
        .not('description_embedding', 'is', null);

      if (error || !descriptions) {
        return [];
      }

      const relationships: NoteRelationship[] = [];

      for (const desc of descriptions) {
        if (!desc.description_embedding) continue;

        try {
          const embeddingArray = JSON.parse(desc.description_embedding);
          const similarity = embeddingService.cosineSimilarity(noteEmbedding, embeddingArray);

          if (similarity >= this.SIMILARITY_THRESHOLD) {
            // Determine relationship type based on similarity
            const relationshipType = similarity >= 0.90 
              ? 'references' 
              : similarity >= 0.85 
              ? 'illustrates' 
              : 'complements';

            relationships.push({
              user_id: userId,
              note_id: noteId,
              related_type: 'document',
              related_id: desc.book_id,
              relationship_type: relationshipType,
              similarity_score: Math.round(similarity * 10000) / 10000, // 4 decimal precision
              is_auto_detected: true
            });
          }
        } catch (parseError) {
          console.error('Error parsing embedding:', parseError);
          continue;
        }
      }

      return relationships;
    } catch (error) {
      console.error('Error finding similar documents:', error);
      return [];
    }
  }

  /**
   * Find similar memories
   */
  private async findSimilarMemories(
    noteEmbedding: number[],
    userId: string,
    noteId: string
  ): Promise<NoteRelationship[]> {
    try {
      // Get all memories for this user with embeddings
      const { data: memories, error } = await supabase
        .from('conversation_memories')
        .select('id, embedding')
        .eq('user_id', userId)
        .not('embedding', 'is', null)
        .limit(100); // Limit to avoid performance issues

      if (error || !memories) {
        return [];
      }

      const relationships: NoteRelationship[] = [];

      for (const memory of memories) {
        if (!memory.embedding) continue;

        try {
          const embeddingArray = JSON.parse(memory.embedding);
          const similarity = embeddingService.cosineSimilarity(noteEmbedding, embeddingArray);

          if (similarity >= this.SIMILARITY_THRESHOLD) {
            const relationshipType = similarity >= 0.90 
              ? 'references' 
              : similarity >= 0.85 
              ? 'illustrates' 
              : 'exemplifies';

            relationships.push({
              user_id: userId,
              note_id: noteId,
              related_type: 'memory',
              related_id: memory.id!,
              relationship_type: relationshipType,
              similarity_score: Math.round(similarity * 10000) / 10000,
              is_auto_detected: true
            });
          }
        } catch (parseError) {
          console.error('Error parsing memory embedding:', parseError);
          continue;
        }
      }

      return relationships;
    } catch (error) {
      console.error('Error finding similar memories:', error);
      return [];
    }
  }

  /**
   * Find similar notes (excluding the current note)
   */
  private async findSimilarNotes(
    noteEmbedding: number[],
    userId: string,
    currentNoteId: string
  ): Promise<NoteRelationship[]> {
    try {
      // Get all notes for this user (without the current note)
      const { data: notes, error } = await supabase
        .from('user_notes')
        .select('id, content')
        .eq('user_id', userId)
        .neq('id', currentNoteId)
        .limit(50); // Limit to recent/important notes

      if (error || !notes) {
        return [];
      }

      const relationships: NoteRelationship[] = [];

      for (const note of notes) {
        try {
          // Get embedding for this note (we'll compute on-the-fly or cache)
          const noteEmbeddingOther = await embeddingService.embed(note.content);
          const similarity = embeddingService.cosineSimilarity(noteEmbedding, noteEmbeddingOther);

          if (similarity >= this.SIMILARITY_THRESHOLD) {
            const relationshipType = similarity >= 0.90 
              ? 'complements' 
              : 'references';

            relationships.push({
              user_id: userId,
              note_id: currentNoteId,
              related_type: 'note',
              related_id: note.id,
              relationship_type: relationshipType,
              similarity_score: Math.round(similarity * 10000) / 10000,
              is_auto_detected: true
            });
          }
        } catch (error) {
          console.error('Error processing note similarity:', error);
          continue;
        }
      }

      return relationships;
    } catch (error) {
      console.error('Error finding similar notes:', error);
      return [];
    }
  }

  /**
   * Get all relationships for a note
   */
  async getNoteRelationships(noteId: string, userId: string): Promise<NoteRelationship[]> {
    try {
      const { data, error } = await supabase
        .from('note_relationships')
        .select('*')
        .eq('note_id', noteId)
        .eq('user_id', userId)
        .order('similarity_score', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting note relationships:', error);
      return [];
    }
  }

  /**
   * Manually create a relationship
   */
  async createRelationship(relationship: NoteRelationship): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('note_relationships')
        .insert({
          ...relationship,
          is_auto_detected: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating relationship:', error);
      return false;
    }
  }

  /**
   * Delete a relationship
   */
  async deleteRelationship(relationshipId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('note_relationships')
        .delete()
        .eq('id', relationshipId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting relationship:', error);
      return false;
    }
  }

  /**
   * Trigger auto-detection for all notes without relationships
   */
  async detectAllNoteRelationships(userId: string): Promise<number> {
    try {
      // Get all notes without relationships
      const { data: notes, error } = await supabase
        .from('user_notes')
        .select('id')
        .eq('user_id', userId)
        .not('id', 'in', supabase
          .from('note_relationships')
          .select('note_id')
          .eq('user_id', userId)
        );

      if (error || !notes) {
        return 0;
      }

      let totalCreated = 0;
      for (const note of notes) {
        const created = await this.detectNoteRelationships(note.id, userId);
        totalCreated += created;
      }

      return totalCreated;
    } catch (error) {
      console.error('Error detecting all note relationships:', error);
      return 0;
    }
  }
}

export const autoRelationshipService = new AutoRelationshipService();

