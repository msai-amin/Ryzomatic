import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';
import { geminiService } from './gemini';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
}

export const memoryService = new MemoryService();

