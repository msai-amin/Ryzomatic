import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter.js';

const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) throw new Error('GEMINI_API_KEY is not set');

const genAI = new GoogleGenerativeAI(geminiKey);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
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
    const rateLimitResult = await checkRateLimit(user.id, 'embedding');
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

    const { text, texts } = req.body;
    const model = genAI.getGenerativeModel({ model: 'models/text-embedding-004' });
    if (typeof text === 'string') {
      const result = await model.embedContent(text);
      res.status(200).json({ embedding: result.embedding.values });
      return;
    }
    if (Array.isArray(texts)) {
      if (texts.length === 0) {
        res.status(400).json({ error: 'texts array must not be empty' });
        return;
      }
      const results = await Promise.all(texts.map((t: string) => model.embedContent(t)));
      res.status(200).json({ embeddings: results.map(r => r.embedding.values) });
      return;
    }
    res.status(400).json({ error: 'Must provide "text" (string) or "texts" (array)' });
  } catch (error: any) {
    console.error('Gemini embedding error:', error);
    res.status(500).json({ error: 'Embedding failed', details: error.message || error.toString() });
  }
}
