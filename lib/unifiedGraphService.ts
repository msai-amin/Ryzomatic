import { createClient } from '@supabase/supabase-js';
import { MemoryGraphService, MemoryNode, MemoryEdge, MemoryGraph } from './memoryGraph';
import { embeddingService } from './embeddingService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface UnifiedNode {
  id: string;
  node_type: 'document' | 'note' | 'memory';
  content: string;
  metadata?: Record<string, any>;
}

export interface UnifiedEdge {
  from: string;
  to: string;
  relationship_type: string;
  similarity_score?: number;
  depth: number;
}

export interface UnifiedGraph {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
}

export interface TimelineItem {
  timestamp: string;
  item_type: 'document' | 'note' | 'memory';
  item_id: string;
  content: string;
  related_items: string[];
}

export class UnifiedGraphService extends MemoryGraphService {
  /**
   * Get document-centric graph (document + notes + related docs + memories)
   */
  async getDocumentCentricGraph(
    documentId: string,
    userId: string,
    maxDepth: number = 2
  ): Promise<UnifiedGraph> {
    try {
      const nodes: Map<string, UnifiedNode> = new Map();
      const edges: UnifiedEdge[] = [];
      const processed = new Set<string>([`doc:${documentId}`]);
      const queue: Array<{ id: string; type: string; depth: number }> = [
        { id: documentId, type: 'document', depth: 0 }
      ];

      while (queue.length > 0) {
        const { id: currentId, type: currentType, depth: currentDepth } = queue.shift()!;

        if (currentDepth > maxDepth) continue;

        // Get document description
        if (currentType === 'document' && currentDepth === 0) {
          const { data: description } = await supabase
            .from('document_descriptions')
            .select('*')
            .eq('book_id', currentId)
            .eq('user_id', userId)
            .single();

          if (description) {
            const content = description.user_entered_description || description.ai_generated_description || '';
            nodes.set(`doc:${currentId}`, {
              id: `doc:${currentId}`,
              node_type: 'document',
              content,
              metadata: { book_id: currentId, ...description }
            });

            // Get related documents
            const { data: relatedDocs } = await supabase
              .from('document_relationships')
              .select('*, related_document_id:document_descriptions(*)')
              .eq('source_document_id', currentId)
              .eq('user_id', userId);

            if (relatedDocs) {
              for (const rel of relatedDocs) {
                if (!processed.has(`doc:${rel.related_document_id}`) && currentDepth < maxDepth) {
                  processed.add(`doc:${rel.related_document_id}`);
                  queue.push({ id: rel.related_document_id, type: 'document', depth: currentDepth + 1 });

                  edges.push({
                    from: `doc:${currentId}`,
                    to: `doc:${rel.related_document_id}`,
                    relationship_type: rel.relationship_description || 'related',
                    similarity_score: rel.relevance_percentage ? rel.relevance_percentage / 100 : undefined,
                    depth: currentDepth + 1
                  });
                }
              }
            }

            // Get notes for this document
            const { data: notes } = await supabase
              .from('user_notes')
              .select('*')
              .eq('book_id', currentId)
              .eq('user_id', userId)
              .limit(20);

            if (notes) {
              for (const note of notes) {
                const noteKey = `note:${note.id}`;
                if (!processed.has(noteKey)) {
                  processed.add(noteKey);
                  nodes.set(noteKey, {
                    id: noteKey,
                    node_type: 'note',
                    content: note.content,
                    metadata: { page_number: note.page_number, note_type: note.note_type }
                  });

                  edges.push({
                    from: `doc:${currentId}`,
                    to: noteKey,
                    relationship_type: 'contains',
                    depth: currentDepth + 1
                  });

                  // Get note relationships if needed
                  if (currentDepth < maxDepth) {
                    const { data: noteRels } = await supabase
                      .from('note_relationships')
                      .select('*')
                      .eq('note_id', note.id)
                      .eq('user_id', userId);

                    if (noteRels) {
                      for (const rel of noteRels) {
                        if (rel.related_type === 'document' && !processed.has(`doc:${rel.related_id}`)) {
                          queue.push({ id: rel.related_id, type: 'document', depth: currentDepth + 1 });
                        } else if (rel.related_type === 'memory' && !processed.has(`mem:${rel.related_id}`)) {
                          processed.add(`mem:${rel.related_id}`);
                          queue.push({ id: rel.related_id, type: 'memory', depth: currentDepth + 1 });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Get related memories
        if (currentType === 'document') {
          const { data: memories } = await supabase
            .from('conversation_memories')
            .select('*')
            .eq('document_id', currentId)
            .eq('user_id', userId)
            .limit(20);

          if (memories) {
            for (const memory of memories) {
              const memKey = `mem:${memory.id}`;
              if (!processed.has(memKey) && currentDepth < maxDepth) {
                processed.add(memKey);
                nodes.set(memKey, {
                  id: memKey,
                  node_type: 'memory',
                  content: memory.entity_text,
                  metadata: { entity_type: memory.entity_type }
                });

                edges.push({
                  from: `doc:${currentId}`,
                  to: memKey,
                  relationship_type: 'extracted_from',
                  depth: currentDepth + 1
                });
              }
            }
          }
        }
      }

      return {
        nodes: Array.from(nodes.values()),
        edges
      };
    } catch (error) {
      console.error('Error getting document-centric graph:', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Search across all graphs (documents, notes, memories)
   */
  async searchAcrossGraphs(userId: string, query: string, limit: number = 20): Promise<UnifiedNode[]> {
    try {
      // Get query embedding
      const queryEmbedding = await embeddingService.embed(query);
      
      const results: Array<{ node: UnifiedNode; score: number }> = [];

      // 1. Search document descriptions
      const { data: docs } = await supabase
        .from('document_descriptions')
        .select('*, book_id')
        .eq('user_id', userId)
        .not('description_embedding', 'is', null)
        .limit(50);

      if (docs) {
        for (const doc of docs) {
          if (!doc.description_embedding) continue;
          const embeddingArray = JSON.parse(doc.description_embedding);
          const similarity = embeddingService.cosineSimilarity(queryEmbedding, embeddingArray);

          if (similarity >= 0.70) {
            results.push({
              node: {
                id: `doc:${doc.book_id}`,
                node_type: 'document',
                content: doc.user_entered_description || doc.ai_generated_description || '',
                metadata: { book_id: doc.book_id }
              },
              score: similarity
            });
          }
        }
      }

      // 2. Search memories
      const { data: memories } = await supabase
        .from('conversation_memories')
        .select('*')
        .eq('user_id', userId)
        .not('embedding', 'is', null)
        .limit(50);

      if (memories) {
        for (const memory of memories) {
          if (!memory.embedding) continue;
          const embeddingArray = JSON.parse(memory.embedding);
          const similarity = embeddingService.cosineSimilarity(queryEmbedding, embeddingArray);

          if (similarity >= 0.70) {
            results.push({
              node: {
                id: `mem:${memory.id}`,
                node_type: 'memory',
                content: memory.entity_text,
                metadata: { entity_type: memory.entity_type }
              },
              score: similarity
            });
          }
        }
      }

      // 3. Search notes (limited to recent/popular)
      const { data: notes } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .limit(100);

      if (notes) {
        for (const note of notes) {
          const noteEmbedding = await embeddingService.embed(note.content);
          const similarity = embeddingService.cosineSimilarity(queryEmbedding, noteEmbedding);

          if (similarity >= 0.70) {
            results.push({
              node: {
                id: `note:${note.id}`,
                node_type: 'note',
                content: note.content,
                metadata: { page_number: note.page_number, note_type: note.note_type }
              },
              score: similarity
            });
          }
        }
      }

      // Sort by score and return top results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(r => r.node);
    } catch (error) {
      console.error('Error searching across graphs:', error);
      return [];
    }
  }

  /**
   * Get timeline for a concept across all items
   */
  async getTimeline(concept: string, userId: string): Promise<TimelineItem[]> {
    try {
      const timeline: TimelineItem[] = [];

      // Search for concept across all items
      const results = await this.searchAcrossGraphs(userId, concept, 100);

      // Group by timestamp and build timeline
      for (const node of results) {
        let timestamp = '';
        let relatedItems: string[] = [];

        if (node.node_type === 'document') {
          const { data: doc } = await supabase
            .from('user_books')
            .select('created_at')
            .eq('id', node.metadata?.book_id)
            .single();

          timestamp = doc?.created_at || '';
        } else if (node.node_type === 'note') {
          const { data: note } = await supabase
            .from('user_notes')
            .select('created_at, book_id')
            .eq('id', node.id.split(':')[1])
            .single();

          timestamp = note?.created_at || '';
        } else if (node.node_type === 'memory') {
          const { data: mem } = await supabase
            .from('conversation_memories')
            .select('created_at, conversation_id')
            .eq('id', node.id.split(':')[1])
            .single();

          timestamp = mem?.created_at || '';
        }

        if (timestamp) {
          timeline.push({
            timestamp,
            item_type: node.node_type as 'document' | 'note' | 'memory',
            item_id: node.id,
            content: node.content,
            related_items: relatedItems
          });
        }
      }

      // Sort by timestamp
      return timeline.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      console.error('Error getting timeline:', error);
      return [];
    }
  }

  /**
   * Get note relationships with details
   */
  async getNoteRelationships(noteId: string, userId: string): Promise<Array<UnifiedNode & { relationshipType: string; score?: number }>> {
    try {
      const { data: relationships } = await supabase
        .from('note_relationships')
        .select('*')
        .eq('note_id', noteId)
        .eq('user_id', userId);

      if (!relationships) return [];

      const results: Array<UnifiedNode & { relationshipType: string; score?: number }> = [];

      for (const rel of relationships) {
        let node: UnifiedNode | null = null;

        if (rel.related_type === 'document') {
          const { data: desc } = await supabase
            .from('document_descriptions')
            .select('*')
            .eq('book_id', rel.related_id)
            .single();

          if (desc) {
            node = {
              id: `doc:${rel.related_id}`,
              node_type: 'document',
              content: desc.user_entered_description || desc.ai_generated_description || ''
            };
          }
        } else if (rel.related_type === 'note') {
          const { data: note } = await supabase
            .from('user_notes')
            .select('*')
            .eq('id', rel.related_id)
            .single();

          if (note) {
            node = {
              id: `note:${rel.related_id}`,
              node_type: 'note',
              content: note.content
            };
          }
        } else if (rel.related_type === 'memory') {
          const { data: memory } = await supabase
            .from('conversation_memories')
            .select('*')
            .eq('id', rel.related_id)
            .single();

          if (memory) {
            node = {
              id: `mem:${rel.related_id}`,
              node_type: 'memory',
              content: memory.entity_text
            };
          }
        }

        if (node) {
          results.push({
            ...node,
            relationshipType: rel.relationship_type,
            score: rel.similarity_score
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting note relationships:', error);
      return [];
    }
  }
}

export const unifiedGraphService = new UnifiedGraphService();

