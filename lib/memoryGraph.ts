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

export interface MemoryNode {
  id: string;
  entity_type: string;
  entity_text: string;
  metadata: Record<string, any>;
}

export interface MemoryEdge {
  from: string;
  to: string;
  relationship_type: string;
  strength: number;
}

export interface MemoryGraph {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export class MemoryGraphService {
  /**
   * Get related memories for a given memory (traverse graph)
   */
  async getRelatedMemories(memoryId: string, userId: string, depth: number = 1): Promise<MemoryGraph> {
    const nodes = new Map<string, MemoryNode>();
    const edges: MemoryEdge[] = [];
    const processed = new Set<string>([memoryId]);
    const queue = [{ id: memoryId, depth: 0 }];

    while (queue.length > 0 && queue[0].depth < depth) {
      const { id: currentId, depth: currentDepth } = queue.shift()!;

      // Get the memory node
      const { data: memory } = await supabase
        .from('conversation_memories')
        .select('*')
        .eq('id', currentId)
        .eq('user_id', userId)
        .single();

      if (memory) {
        nodes.set(memory.id, {
          id: memory.id,
          entity_type: memory.entity_type,
          entity_text: memory.entity_text,
          metadata: memory.entity_metadata || {},
        });

        // Get relationships
        const { data: relationships } = await supabase
          .from('memory_relationships')
          .select('*')
          .or(`memory_from.eq.${currentId},memory_to.eq.${currentId}`)
          .eq('user_id', userId);

        if (relationships) {
          for (const rel of relationships) {
            const relatedId = rel.memory_from === currentId ? rel.memory_to : rel.memory_from;
            
            edges.push({
              from: rel.memory_from,
              to: rel.memory_to,
              relationship_type: rel.relationship_type,
              strength: rel.strength || 0.5,
            });

            if (!processed.has(relatedId) && currentDepth + 1 < depth) {
              processed.add(relatedId);
              queue.push({ id: relatedId, depth: currentDepth + 1 });
            }
          }
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  /**
   * Find paths between two memories
   */
  async findPath(fromMemoryId: string, toMemoryId: string, userId: string): Promise<MemoryEdge[]> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: MemoryEdge[] }> = [{ id: fromMemoryId, path: [] }];

    while (queue.length > 0) {
      const { id: currentId, path } = queue.shift()!;
      
      if (currentId === toMemoryId) {
        return path;
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Get relationships
      const { data: relationships } = await supabase
        .from('memory_relationships')
        .select('*')
        .or(`memory_from.eq.${currentId},memory_to.eq.${currentId}`)
        .eq('user_id', userId);

      if (relationships) {
        for (const rel of relationships) {
          const nextId = rel.memory_from === currentId ? rel.memory_to : rel.memory_from;
          
          queue.push({
            id: nextId,
            path: [...path, {
              from: rel.memory_from,
              to: rel.memory_to,
              relationship_type: rel.relationship_type,
              strength: rel.strength || 0.5,
            }],
          });
        }
      }
    }

    return [];
  }

  /**
   * Cluster memories by similarity
   */
  async clusterMemories(userId: string, threshold: number = 0.8): Promise<Map<string, string[]>> {
    const { data: memories } = await supabase
      .from('conversation_memories')
      .select('id, entity_text, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null);

    if (!memories) return new Map();

    const clusters = new Map<string, string[]>();
    const clustered = new Set<string>();

    for (const memory of memories) {
      if (clustered.has(memory.id)) continue;

      const cluster: string[] = [memory.id];
      const embedding = JSON.parse(memory.embedding);

      for (const other of memories) {
        if (clustered.has(other.id) || other.id === memory.id) continue;

        const otherEmbedding = JSON.parse(other.embedding);
        const similarity = embeddingService.cosineSimilarity(embedding, otherEmbedding);

        if (similarity >= threshold) {
          cluster.push(other.id);
          clustered.add(other.id);
        }
      }

      clusters.set(memory.id, cluster);
      clustered.add(memory.id);
    }

    return clusters;
  }

  /**
   * Get central memories (highest connection count)
   */
  async getCentralMemories(userId: string, limit: number = 10): Promise<MemoryNode[]> {
    const { data: memories } = await supabase
      .from('conversation_memories')
      .select('id, entity_type, entity_text, entity_metadata')
      .eq('user_id', userId);

    if (!memories) return [];

    // Count connections for each memory
    const connectionCounts = new Map<string, number>();

    for (const memory of memories) {
      const { count } = await supabase
        .from('memory_relationships')
        .select('*', { count: 'exact', head: true })
        .or(`memory_from.eq.${memory.id},memory_to.eq.${memory.id}`);

      connectionCounts.set(memory.id, count || 0);
    }

    // Sort by connection count and return top memories
    const sorted = Array.from(memories)
      .sort((a, b) => (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0))
      .slice(0, limit);

    return sorted.map(m => ({
      id: m.id,
      entity_type: m.entity_type,
      entity_text: m.entity_text,
      metadata: m.entity_metadata || {},
    }));
  }
}

export const memoryGraphService = new MemoryGraphService();

