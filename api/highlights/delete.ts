import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
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

    const { highlightId, highlightIds } = req.body;

    // Support both single and bulk delete
    if (!highlightId && (!highlightIds || !Array.isArray(highlightIds) || highlightIds.length === 0)) {
      return res.status(400).json({ error: 'Missing highlightId or highlightIds array' });
    }

    let deletedCount = 0;

    if (highlightId) {
      // Single delete
      const { error: deleteError } = await supabase
        .from('user_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting highlight:', deleteError);
        return res.status(500).json({ error: 'Failed to delete highlight', details: deleteError.message });
      }

      deletedCount = 1;
    } else {
      // Bulk delete
      const { error: bulkDeleteError } = await supabase
        .from('user_highlights')
        .delete()
        .in('id', highlightIds)
        .eq('user_id', user.id);

      if (bulkDeleteError) {
        console.error('Error bulk deleting highlights:', bulkDeleteError);
        return res.status(500).json({ error: 'Failed to delete highlights', details: bulkDeleteError.message });
      }

      deletedCount = highlightIds.length;
    }

    return res.status(200).json({ success: true, deletedCount });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

