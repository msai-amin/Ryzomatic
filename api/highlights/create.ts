import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

    const {
      bookId,
      pageNumber,
      highlightedText,
      colorId,
      colorHex,
      positionData,
      textStartOffset,
      textEndOffset,
      textContextBefore,
      textContextAfter
    } = req.body;

    // Validate required fields
    if (!bookId || !pageNumber || !highlightedText || !colorId || !colorHex || !positionData) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['bookId', 'pageNumber', 'highlightedText', 'colorId', 'colorHex', 'positionData']
      });
    }

    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('user_books')
      .select('id')
      .eq('id', bookId)
      .eq('user_id', user.id)
      .single();

    if (bookError || !book) {
      return res.status(403).json({ error: 'Book not found or access denied' });
    }

    // Create highlight
    const { data: highlight, error: createError } = await supabase
      .from('user_highlights')
      .insert({
        user_id: user.id,
        book_id: bookId,
        page_number: pageNumber,
        highlighted_text: highlightedText,
        color_id: colorId,
        color_hex: colorHex,
        position_data: positionData,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset,
        text_context_before: textContextBefore,
        text_context_after: textContextAfter
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating highlight:', createError);
      return res.status(500).json({ error: 'Failed to create highlight', details: createError.message });
    }

    return res.status(200).json({ success: true, highlight });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

