import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SynthesisRequest {
  documentIds: string[];
  query: string;
  model?: string;
}

/**
 * LOTUS Document Synthesis API
 * POST /api/lotus/synthesis
 * 
 * Body: {
 *   documentIds: string[],
 *   query: string,
 *   model?: string
 * }
 * 
 * This endpoint:
 * 1. Authenticates the user
 * 2. Fetches full content for each document
 * 3. Calls the Python LOTUS service for synthesis
 * 4. Returns the synthesized result
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentIds, query, model } = req.body as SynthesisRequest;

    // Validate request
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds array is required and must not be empty' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query string is required' });
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
    const rateLimitResult = await checkRateLimit(user.id, 'lotus_synthesis');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    
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

    // Fetch documents with metadata
    const { data: books, error: booksError } = await supabase
      .from('user_books')
      .select('id, title')
      .in('id', documentIds)
      .eq('user_id', user.id);

    if (booksError || !books) {
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    if (books.length !== documentIds.length) {
      return res.status(404).json({ 
        error: 'Some documents not found or access denied',
        found: books.length,
        requested: documentIds.length
      });
    }

    // Fetch full content for each document
    const documents = await Promise.all(
      books.map(async (book) => {
        // Try to get content from document_content table first
        const { data: contentChunks, error: chunksError } = await supabase
          .from('document_content')
          .select('content, chunk_index')
          .eq('book_id', book.id)
          .eq('user_id', user.id)
          .order('chunk_index', { ascending: true });

        let content = '';
        
        if (!chunksError && contentChunks && contentChunks.length > 0) {
          // Concatenate chunks
          content = contentChunks.map(c => c.content).join('\n\n');
        } else {
          // Fallback: try RPC function
          const { data: fullContent, error: rpcError } = await supabase
            .rpc('get_full_document_content', { book_uuid: book.id });

          if (!rpcError && fullContent) {
            content = fullContent;
          } else {
            // Last resort: try user_books.content field
            const { data: bookData } = await supabase
              .from('user_books')
              .select('content')
              .eq('id', book.id)
              .eq('user_id', user.id)
              .single();

            content = bookData?.content || '';
          }
        }

        return {
          id: book.id,
          title: book.title || `Document ${book.id.substring(0, 8)}`,
          content: content.substring(0, 50000), // Limit to 50K chars per doc to avoid token limits
        };
      })
    );

    // Filter out documents with no content
    const documentsWithContent = documents.filter(doc => doc.content && doc.content.length > 0);

    if (documentsWithContent.length === 0) {
      return res.status(400).json({ 
        error: 'No document content found. Documents may not be processed yet.' 
      });
    }

    // Call LOTUS service: external URL if set, otherwise same-origin (Python function excluded on Vercel due to bundle size)
    const lotusUrl = process.env.LOTUS_API_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/lotus` : 'http://localhost:3000/api/lotus');

    try {
      const lotusResponse = await fetch(lotusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documents: documentsWithContent,
          query,
          model: model || 'gpt-4o-mini',
        }),
      });

      if (!lotusResponse.ok) {
        const errorText = await lotusResponse.text();
        console.error('LOTUS service error:', errorText);
        // 404/502 when Python function is not deployed (excluded via .vercelignore)
        if (lotusResponse.status === 404 || lotusResponse.status === 502) {
          return res.status(503).json({
            error: 'LOTUS synthesis backend is not deployed on this environment. Set LOTUS_API_URL to an external LOTUS service, or run synthesis locally.',
            code: 'LOTUS_NOT_AVAILABLE',
          });
        }
        return res.status(500).json({
          error: 'LOTUS synthesis failed',
          details: errorText.substring(0, 200),
        });
      }

      const lotusResult = await lotusResponse.json();

      // Track usage
      await supabase.from('usage_records').insert({
        user_id: user.id,
        action_type: 'lotus_synthesis',
        credits_used: 1,
        metadata: {
          document_count: documentsWithContent.length,
          query_length: query.length,
          model: model || 'gpt-4o-mini',
        },
      });

      return res.status(200).json({
        success: true,
        synthesis: lotusResult.synthesis,
        model: lotusResult.model,
        document_count: documentsWithContent.length,
        documents_used: documentsWithContent.map(d => ({ id: d.id, title: d.title })),
      });

    } catch (fetchError: any) {
      console.error('Error calling LOTUS service:', fetchError);
      return res.status(503).json({
        error: 'LOTUS synthesis backend is not available. Set LOTUS_API_URL to an external LOTUS service, or run synthesis locally.',
        code: 'LOTUS_NOT_AVAILABLE',
        message: fetchError.message,
      });
    }

  } catch (error: any) {
    console.error('LOTUS synthesis API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
