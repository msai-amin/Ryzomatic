import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';
import { geminiService } from './gemini';

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

export interface MemoryEntity {
  id?: string;
  user_id: string;
  conversation_id?: string;
  entity_type: 'concept' | 'question' | 'insight' | 'reference' | 'action' | 'document';
  entity_text: string;
  entity_metadata?: Record<string, any>;
  source_message_id?: string;
  document_id?: string;
  embedding?: string;
  created_at?: string;
}

export interface MemoryRelationship {
  id?: string;
  user_id: string;
  memory_from: string;
  memory_to: string;
  relationship_type: 'relates_to' | 'contradicts' | 'supports' | 'cites' | 'explains';
  strength?: number;
  metadata?: Record<string, any>;
  created_at?: string;
}

export class MemoryService {
  /**
   * Extract and store memory entities from a conversation
   */
  async extractAndStoreMemory(params: {
    conversationId: string;
    userId: string;
    messages: Array<{ role: string; content: string; id?: string }>;
    documentTitle?: string;
    documentId?: string;
  }): Promise<{ success: boolean; entitiesCreated: number; relationshipsCreated: number }> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
    }
    
    const { conversationId, userId, messages, documentTitle, documentId } = params;

    try {
      // Update extraction job status
      await supabase
        .from('memory_extraction_jobs')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          status: 'processing',
        });

      // Extract entities using Gemini
      const extraction = await geminiService.extractMemoryEntities({
        conversationMessages: messages,
        documentTitle,
      });

      // Generate embeddings for all entities
      const textsToEmbed = extraction.entities.map(e => e.text);
      const embeddings = await embeddingService.embedBatch(textsToEmbed);

      // Store entities
      const entitiesToInsert = extraction.entities.map((entity, idx) => ({
        user_id: userId,
        conversation_id: conversationId,
        entity_type: entity.type,
        entity_text: entity.text,
        entity_metadata: entity.metadata || {},
        source_message_id: entity.metadata?.sourceMessageIndex !== undefined 
          ? messages[entity.metadata.sourceMessageIndex]?.id : null,
        document_id: documentId,
        embedding: embeddingService.formatForPgVector(embeddings[idx]),
      }));

      const { data: insertedEntities, error: insertError } = await supabase
        .from('conversation_memories')
        .insert(entitiesToInsert)
        .select('id');

      if (insertError) {
        throw new Error(`Failed to insert entities: ${insertError.message}`);
      }

      // Store relationships if provided
      let relationshipsCreated = 0;
      if (extraction.relationships && insertedEntities && insertedEntities.length > 0) {
        const relationshipsToInsert = extraction.relationships.map(rel => {
          const fromEntity = insertedEntities[rel.from];
          const toEntity = insertedEntities[rel.to];
          
          if (!fromEntity || !toEntity) return null;

          return {
            user_id: userId,
            memory_from: fromEntity.id,
            memory_to: toEntity.id,
            relationship_type: rel.type,
            strength: rel.strength || 0.5,
          };
        }).filter(Boolean);

        if (relationshipsToInsert.length > 0) {
          const { error: relError } = await supabase
            .from('memory_relationships')
            .insert(relationshipsToInsert);

          if (!relError) {
            relationshipsCreated = relationshipsToInsert.length;
          }
        }
      }

      // Update extraction job as completed
      await supabase
        .from('memory_extraction_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            entitiesCreated: insertedEntities?.length || 0,
            relationshipsCreated,
          },
        })
        .eq('conversation_id', conversationId)
        .eq('status', 'processing');

      return {
        success: true,
        entitiesCreated: insertedEntities?.length || 0,
        relationshipsCreated,
      };
    } catch (error) {
      console.error('Error extracting memory:', error);

      // Update extraction job as failed
      await supabase
        .from('memory_extraction_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('conversation_id', conversationId)
        .eq('status', 'processing');

      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
      };
    }
  }

  /**
   * Search for similar memories
   */
  async searchMemories(params: {
    userId: string;
    query: string;
    limit?: number;
    entityTypes?: string[];
    documentId?: string;
    similarityThreshold?: number;
  }): Promise<MemoryEntity[]> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return [];
    }
    
    const {
      userId,
      query,
      limit = 10,
      entityTypes,
      documentId,
      similarityThreshold = 0.7,
    } = params;

    try {
      // Get embedding for query
      const queryEmbedding = await embeddingService.embed(query);

      // Build query
      let queryString = supabase
        .from('conversation_memories')
        .select('*')
        .eq('user_id', userId);

      // Apply filters
      if (entityTypes && entityTypes.length > 0) {
        queryString = queryString.in('entity_type', entityTypes);
      }

      if (documentId) {
        queryString = queryString.eq('document_id', documentId);
      }

      // Use vector similarity search
      const { data, error } = await queryString
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Get more than needed for filtering

      if (error) {
        throw error;
      }

      // Calculate similarity scores and filter
      const results = data
        ?.map(entity => {
          if (!entity.embedding) return null;
          
          const embeddingArray = JSON.parse(entity.embedding);
          const similarity = embeddingService.cosineSimilarity(queryEmbedding, embeddingArray);
          
          return { ...entity, similarity };
        })
        .filter(item => item && item.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ similarity, ...entity }) => entity) || [];

      return results as MemoryEntity[];
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  /**
   * Get memories for a specific conversation
   */
  async getConversationMemories(conversationId: string, userId: string): Promise<MemoryEntity[]> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return [];
    }
    
    const { data, error } = await supabase
      .from('conversation_memories')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error getting conversation memories:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get related memories (using the relationships)
   */
  async getRelatedMemories(memoryId: string, userId: string, limit: number = 10): Promise<{
    memory: MemoryEntity;
    related: Array<MemoryEntity & { relationshipType: string; strength: number }>;
  }> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      throw new Error('Supabase client not available');
    }
    
    // Get the memory
    const { data: memory } = await supabase
      .from('conversation_memories')
      .select('*')
      .eq('id', memoryId)
      .eq('user_id', userId)
      .single();

    if (!memory) {
      throw new Error('Memory not found');
    }

    // Get relationships
    const { data: relationships } = await supabase
      .from('memory_relationships')
      .select('*')
      .or(`memory_from.eq.${memoryId},memory_to.eq.${memoryId}`)
      .order('strength', { ascending: false })
      .limit(limit);

    // Get related memories
    const relatedMemoryIds = new Set<string>();
    relationships?.forEach(rel => {
      if (rel.memory_from !== memoryId) relatedMemoryIds.add(rel.memory_from);
      if (rel.memory_to !== memoryId) relatedMemoryIds.add(rel.memory_to);
    });

    if (relatedMemoryIds.size === 0) {
      return { memory: memory as MemoryEntity, related: [] };
    }

    const { data: relatedMemories } = await supabase
      .from('conversation_memories')
      .select('*')
      .in('id', Array.from(relatedMemoryIds));

    // Map relationships
    const mapped = (relatedMemories || []).map(relMem => {
      const rel = relationships?.find(
        r => (r.memory_from === relMem.id || r.memory_to === relMem.id)
      );
      return {
        ...relMem,
        relationshipType: rel?.relationship_type || 'relates_to',
        strength: rel?.strength || 0.5,
      };
    });

    return {
      memory: memory as MemoryEntity,
      related: mapped as any,
    };
  }

  /**
   * Aggregate memories across multiple conversations
   */
  async aggregateMemories(params: {
    userId: string;
    startDate?: string;
    endDate?: string;
    entityTypes?: string[];
    limit?: number;
  }): Promise<{
    topConcepts: Array<{ text: string; count: number }>;
    topQuestions: Array<{ text: string; count: number }>;
    topInsights: Array<{ text: string; count: number }>;
  }> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return {
        topConcepts: [],
        topQuestions: [],
        topInsights: [],
      };
    }
    
    const { userId, startDate, endDate, entityTypes, limit = 10 } = params;

    let query = supabase
      .from('conversation_memories')
      .select('entity_type, entity_text, created_at')
      .eq('user_id', userId);

    if (entityTypes && entityTypes.length > 0) {
      query = query.in('entity_type', entityTypes);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { topConcepts: [], topQuestions: [], topInsights: [] };
    }

    // Group and count by type
    const concepts = data
      .filter(m => m.entity_type === 'concept')
      .map(m => m.entity_text.toLowerCase())
      .reduce((acc, text) => {
        acc[text] = (acc[text] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const questions = data
      .filter(m => m.entity_type === 'question')
      .map(m => m.entity_text.toLowerCase())
      .reduce((acc, text) => {
        acc[text] = (acc[text] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const insights = data
      .filter(m => m.entity_type === 'insight')
      .map(m => m.entity_text.toLowerCase())
      .reduce((acc, text) => {
        acc[text] = (acc[text] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      topConcepts: Object.entries(concepts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, limit)
        .map(([text, count]) => ({ text, count: count as number })),
      topQuestions: Object.entries(questions)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, limit)
        .map(([text, count]) => ({ text, count: count as number })),
      topInsights: Object.entries(insights)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, limit)
        .map(([text, count]) => ({ text, count: count as number })),
    };
  }

  /**
   * Extract memory entities from notes
   */
  async extractFromNotes(params: {
    userId: string;
    noteIds?: string[];
    documentId?: string;
  }): Promise<{ success: boolean; entitiesCreated: number; relationshipsCreated: number }> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
    }
    
    const { userId, noteIds, documentId } = params;

    try {
      // Fetch notes
      let query = supabase
        .from('user_notes')
        .select('id, content, book_id, page_number, created_at')
        .eq('user_id', userId);

      if (noteIds && noteIds.length > 0) {
        query = query.in('id', noteIds);
      } else if (documentId) {
        query = query.eq('book_id', documentId);
      } else {
        return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
      }

      const { data: notes, error: notesError } = await query;

      if (notesError || !notes || notes.length === 0) {
        console.error('Error fetching notes for extraction:', notesError);
        return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
      }

      // Combine note contents for extraction
      const noteTexts = notes.map((note, idx) => 
        `Note ${idx + 1} (Page ${note.page_number}): ${note.content}`
      ).join('\n\n');

      // Extract entities using Gemini
      const extraction = await geminiService.extractMemoryEntities({
        conversationMessages: [
          { role: 'user', content: `Extract semantic entities from these notes:\n\n${noteTexts}` }
        ],
        documentTitle: documentId ? 'Document Notes' : undefined,
      });

      // Generate embeddings for all entities
      const textsToEmbed = extraction.entities.map(e => e.text);
      const embeddings = await embeddingService.embedBatch(textsToEmbed);

      // Store entities
      const entitiesToInsert = extraction.entities.map((entity, idx) => ({
        user_id: userId,
        entity_type: entity.type,
        entity_text: entity.text,
        entity_metadata: {
          ...entity.metadata,
          source: 'note',
          note_ids: notes.map(n => n.id),
          document_id: documentId || notes[0]?.book_id,
        },
        document_id: documentId || notes[0]?.book_id,
        embedding: embeddingService.formatForPgVector(embeddings[idx]),
      }));

      const { data: insertedEntities, error: insertError } = await supabase
        .from('conversation_memories')
        .insert(entitiesToInsert)
        .select('id');

      if (insertError) {
        throw new Error(`Failed to insert entities: ${insertError.message}`);
      }

      // Store relationships if provided
      let relationshipsCreated = 0;
      if (extraction.relationships && insertedEntities && insertedEntities.length > 0) {
        const relationshipsToInsert = extraction.relationships.map(rel => {
          const fromEntity = insertedEntities[rel.from];
          const toEntity = insertedEntities[rel.to];
          
          if (!fromEntity || !toEntity) return null;

          return {
            user_id: userId,
            memory_from: fromEntity.id,
            memory_to: toEntity.id,
            relationship_type: rel.type,
            strength: rel.strength || 0.5,
          };
        }).filter(Boolean);

        if (relationshipsToInsert.length > 0) {
          const { error: relError } = await supabase
            .from('memory_relationships')
            .insert(relationshipsToInsert);

          if (!relError) {
            relationshipsCreated = relationshipsToInsert.length;
          }
        }
      }

      return {
        success: true,
        entitiesCreated: insertedEntities?.length || 0,
        relationshipsCreated,
      };
    } catch (error) {
      console.error('Error extracting memory from notes:', error);
      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
      };
    }
  }

  /**
   * Extract memory entities from highlights
   */
  async extractFromHighlights(params: {
    userId: string;
    highlightIds?: string[];
    documentId?: string;
  }): Promise<{ success: boolean; entitiesCreated: number; relationshipsCreated: number }> {
    if (!supabase) {
      console.error('Supabase client not available (server-side only)');
      return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
    }
    
    const { userId, highlightIds, documentId } = params;

    try {
      // Fetch highlights
      let query = supabase
        .from('user_highlights')
        .select('id, highlighted_text, book_id, page_number, created_at')
        .eq('user_id', userId)
        .eq('is_orphaned', false);

      if (highlightIds && highlightIds.length > 0) {
        query = query.in('id', highlightIds);
      } else if (documentId) {
        query = query.eq('book_id', documentId);
      } else {
        return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
      }

      const { data: highlights, error: highlightsError } = await query;

      if (highlightsError || !highlights || highlights.length === 0) {
        console.error('Error fetching highlights for extraction:', highlightsError);
        return { success: false, entitiesCreated: 0, relationshipsCreated: 0 };
      }

      // Combine highlight texts for extraction
      const highlightTexts = highlights.map((hl, idx) => 
        `Highlight ${idx + 1} (Page ${hl.page_number}): "${hl.highlighted_text}"`
      ).join('\n\n');

      // Extract entities using Gemini
      const extraction = await geminiService.extractMemoryEntities({
        conversationMessages: [
          { role: 'user', content: `Extract semantic entities and concepts from these highlights:\n\n${highlightTexts}` }
        ],
        documentTitle: documentId ? 'Document Highlights' : undefined,
      });

      // Generate embeddings for all entities
      const textsToEmbed = extraction.entities.map(e => e.text);
      const embeddings = await embeddingService.embedBatch(textsToEmbed);

      // Store entities
      const entitiesToInsert = extraction.entities.map((entity, idx) => ({
        user_id: userId,
        entity_type: entity.type,
        entity_text: entity.text,
        entity_metadata: {
          ...entity.metadata,
          source: 'highlight',
          highlight_ids: highlights.map(h => h.id),
          document_id: documentId || highlights[0]?.book_id,
        },
        document_id: documentId || highlights[0]?.book_id,
        embedding: embeddingService.formatForPgVector(embeddings[idx]),
      }));

      const { data: insertedEntities, error: insertError } = await supabase
        .from('conversation_memories')
        .insert(entitiesToInsert)
        .select('id');

      if (insertError) {
        throw new Error(`Failed to insert entities: ${insertError.message}`);
      }

      // Store relationships if provided
      let relationshipsCreated = 0;
      if (extraction.relationships && insertedEntities && insertedEntities.length > 0) {
        const relationshipsToInsert = extraction.relationships.map(rel => {
          const fromEntity = insertedEntities[rel.from];
          const toEntity = insertedEntities[rel.to];
          
          if (!fromEntity || !toEntity) return null;

          return {
            user_id: userId,
            memory_from: fromEntity.id,
            memory_to: toEntity.id,
            relationship_type: rel.type,
            strength: rel.strength || 0.5,
          };
        }).filter(Boolean);

        if (relationshipsToInsert.length > 0) {
          const { error: relError } = await supabase
            .from('memory_relationships')
            .insert(relationshipsToInsert);

          if (!relError) {
            relationshipsCreated = relationshipsToInsert.length;
          }
        }
      }

      return {
        success: true,
        entitiesCreated: insertedEntities?.length || 0,
        relationshipsCreated,
      };
    } catch (error) {
      console.error('Error extracting memory from highlights:', error);
      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
      };
    }
  }

  /**
   * Extract memory entities from both notes and highlights for a document
   */
  async extractFromNotesAndHighlights(
    userId: string,
    documentId: string
  ): Promise<{ success: boolean; entitiesCreated: number; relationshipsCreated: number }> {
    try {
      // Extract from both sources in parallel
      const [notesResult, highlightsResult] = await Promise.all([
        this.extractFromNotes({ userId, documentId }),
        this.extractFromHighlights({ userId, documentId }),
      ]);

      return {
        success: notesResult.success || highlightsResult.success,
        entitiesCreated: notesResult.entitiesCreated + highlightsResult.entitiesCreated,
        relationshipsCreated: notesResult.relationshipsCreated + highlightsResult.relationshipsCreated,
      };
    } catch (error) {
      console.error('Error extracting from notes and highlights:', error);
      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
      };
    }
  }
}

export const memoryService = new MemoryService();

