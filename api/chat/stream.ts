import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { geminiService } from '../../lib/gemini';
import { contextBuilder } from '../../lib/contextBuilder';
import { memoryService } from '../../lib/memoryService';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Chat with streaming response using Gemini
 * POST /api/chat/stream
 * 
 * Body: {
 *   message: string,
 *   conversationId?: string,
 *   documentId?: string
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationId, documentId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Authenticate user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'chat');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    
    // Set rate limit headers in response
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit: rateLimitResult.limit,
        remaining: 0,
        reset_at: rateLimitResult.resetAt?.toISOString(),
      });
    }

    // Get user profile for tier and credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check credits
    if (profile.credits < 1) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        credits: profile.credits,
      });
    }

    // Get document content if documentId provided
    // Using user_books instead of documents (consolidated in migration 026)
    let documentContent: string | undefined;
    if (documentId) {
      const { data: document, error: docError } = await supabase
        .from('user_books')
        .select('content')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      documentContent = document.content;
    }

  // Get conversation history if conversationId provided
  // Using chat schema after migration 031
  let conversationHistory: Array<{ role: string; content: string }> = [];
  let enhancedContext = '';
  
  if (conversationId) {
    const { data: messages, error: messagesError } = await supabase
      .from('chat.messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10); // Last 10 messages for context

      if (!messagesError && messages) {
        conversationHistory = messages;
      }

      // Check if we should use intelligent memory context
      const { data: profile_tier } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      const tier = profile_tier?.tier || 'free';
      
      // For pro+ tiers, use intelligent context builder
      if (['pro', 'premium', 'enterprise'].includes(tier)) {
        try {
          const shouldUseMemory = contextBuilder.shouldUseMemoryContext(message);
          
          if (shouldUseMemory) {
            const contextResult = await contextBuilder.buildContext({
              userId: user.id,
              query: message,
              conversationId,
              documentId,
              limit: 20,
            });

            enhancedContext = contextResult.structuredContext.relevantMemories
              .map(m => `- ${m.type}: ${m.text}`)
              .join('\n');

            console.log(`[Context Builder] Enhanced context with ${contextResult.structuredContext.relevantMemories.length} memories, ${contextResult.tokenEstimate} tokens`);
          }
        } catch (error) {
          console.error('Error building context:', error);
          // Fallback to simple history if context building fails
        }
      }
    }

    // Set up Server-Sent Events for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    let fullResponse = '';
    const startTime = Date.now();

    // Stream the response
    try {
      // Augment message with enhanced context if available
      const messageWithContext = enhancedContext 
        ? `Previous conversation context:\n${enhancedContext}\n\nUser: ${message}\n\nRespond with fresh insights building on this context.`
        : message;

      for await (const chunk of geminiService.chatStream({
        message: messageWithContext,
        documentContent,
        history: conversationHistory,
        tier: profile.tier,
      })) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    } catch (streamError: any) {
      console.error('Streaming error:', streamError);
      res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const responseTime = Date.now() - startTime;
    const model = profile.tier === 'free' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-pro';

    // Save conversation and messages
    let finalConversationId = conversationId;

    if (!conversationId) {
      // Create new conversation (using chat schema after migration 031)
      const { data: newConversation, error: convError } = await supabase
        .from('chat.conversations')
        .insert({
          user_id: user.id,
          document_id: documentId,
          title: message.substring(0, 50),
        })
        .select('id')
        .single();

      if (!convError && newConversation) {
        finalConversationId = newConversation.id;
      }
    }

    if (finalConversationId) {
      // Save messages (using chat schema after migration 031)
      await supabase.from('chat.messages').insert([
        {
          conversation_id: finalConversationId,
          role: 'user',
          content: message,
        },
        {
          conversation_id: finalConversationId,
          role: 'assistant',
          content: fullResponse,
          model,
          metadata: { responseTime, tokenCount: fullResponse.length },
        },
      ]);

      // Update conversation's updated_at
      await supabase
        .from('chat.conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', finalConversationId);
    }

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', user.id);

    // Track usage
    await supabase.from('usage_records').insert({
      user_id: user.id,
      action_type: 'ai_query',
      credits_used: 1,
      metadata: {
        model,
        responseTime,
        documentId,
        conversationId: finalConversationId,
        usedMemoryContext: !!enhancedContext,
      },
    });

    // Trigger background memory extraction for this conversation (async)
    if (finalConversationId && conversationHistory.length >= 4) {
      // Check if already extracted
      const { data: existingJob } = await supabase
        .from('memory_extraction_jobs')
        .select('*')
        .eq('conversation_id', finalConversationId)
        .eq('status', 'completed')
        .limit(1);

      if (!existingJob || existingJob.length === 0) {
        // Trigger extraction (don't wait for completion)
        memoryService.extractAndStoreMemory({
          conversationId: finalConversationId,
          userId: user.id,
          messages: [
            ...conversationHistory,
            { role: 'user', content: message },
            { role: 'assistant', content: fullResponse },
          ],
          documentTitle: documentId ? 'Document' : undefined,
          documentId,
        }).catch(err => {
          console.error('Background memory extraction failed:', err);
        });
      }
    }

    // Send completion event with conversation ID
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      conversationId: finalConversationId,
      responseTime,
      creditsRemaining: profile.credits - 1,
    })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('Chat stream error:', error);
    
    // Try to send error through stream if possible
    try {
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch {
      // If we can't write to stream, return JSON error
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}

