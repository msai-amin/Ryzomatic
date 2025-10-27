import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { memoryService } from '../../lib/memoryService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Memory API - Combined handler for extract and query
 * POST /api/memory
 * 
 * For extraction:
 * Body: { action: 'extract', conversationId: string, documentId?: string }
 * 
 * For query:
 * Body: { action: 'query', query: string, documentId?: string, ... }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.body;

    // Authenticate user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Route to appropriate action
    if (action === 'extract') {
      return await handleExtract(req, res, user.id);
    } else if (action === 'query') {
      return await handleQuery(req, res, user.id);
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "extract" or "query"' });
    }
  } catch (error: any) {
    console.error('Memory API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Extract memories from a conversation
 */
async function handleExtract(req: VercelRequest, res: VercelResponse, userId: string) {
  const { conversationId, documentId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  // Get conversation details
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*, documents(*)')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (convError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Get messages
  const { data: messages, error: msgsError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgsError || !messages || messages.length === 0) {
    return res.status(404).json({ error: 'No messages found' });
  }

  // Get document title if available
  const documentTitle = conversation.documents?.title || conversation.title;

  // Extract memory
  const result = await memoryService.extractAndStoreMemory({
    conversationId,
    userId,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      id: m.id,
    })),
    documentTitle,
    documentId: documentId || conversation.document_id,
  });

  if (!result.success) {
    return res.status(500).json({
      error: 'Failed to extract memories',
      entitiesCreated: result.entitiesCreated,
      relationshipsCreated: result.relationshipsCreated,
    });
  }

  return res.status(200).json({
    success: true,
    conversationId,
    entitiesCreated: result.entitiesCreated,
    relationshipsCreated: result.relationshipsCreated,
  });
}

/**
 * Query memories with semantic search
 */
async function handleQuery(req: VercelRequest, res: VercelResponse, userId: string) {
  const {
    query,
    documentId,
    entityTypes,
    limit = 10,
    similarityThreshold = 0.7,
  } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  // Search memories
  const memories = await memoryService.searchMemories({
    userId,
    query,
    limit,
    entityTypes,
    documentId,
    similarityThreshold,
  });

  return res.status(200).json({
    success: true,
    query,
    memories,
    count: memories.length,
  });
}

