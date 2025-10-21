import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { bookId, pageNumber, includeOrphaned } = req.query;

    if (!bookId) {
      return res.status(400).json({ error: 'Missing bookId parameter' });
    }

    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('user_books')
      .select('id')
      .eq('id', bookId as string)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      return res.status(403).json({ error: 'Book not found or access denied' });
    }

    // Build query
    let query = supabase
      .from('user_highlights')
      .select('*')
      .eq('book_id', bookId as string)
      .eq('user_id', user.id);

    // Filter by page number if provided
    if (pageNumber) {
      query = query.eq('page_number', parseInt(pageNumber as string));
    }

    // Filter orphaned highlights if specified
    if (includeOrphaned === 'false') {
      query = query.eq('is_orphaned', false);
    }

    // Order by page and creation time
    query = query.order('page_number').order('created_at');

    const { data: highlights, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching highlights:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch highlights', details: fetchError.message });
    }

    return res.status(200).json({ success: true, highlights: highlights || [] });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

