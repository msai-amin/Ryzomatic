import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT' && req.method !== 'PATCH') {
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

    const { highlightId, updates } = req.body;

    if (!highlightId) {
      return res.status(400).json({ error: 'Missing highlightId' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Missing updates object' });
    }

    // Verify highlight ownership
    const { data: existingHighlight, error: fetchError } = await supabase
      .from('user_highlights')
      .select('id')
      .eq('id', highlightId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingHighlight) {
      return res.status(403).json({ error: 'Highlight not found or access denied' });
    }

    // Prepare update object (only allow specific fields)
    const allowedUpdates: any = {};
    const allowedFields = [
      'color_id',
      'color_hex',
      'position_data',
      'text_start_offset',
      'text_end_offset',
      'is_orphaned',
      'orphaned_reason'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        allowedUpdates[field] = updates[field];
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Update highlight
    const { data: highlight, error: updateError } = await supabase
      .from('user_highlights')
      .update(allowedUpdates)
      .eq('id', highlightId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating highlight:', updateError);
      return res.status(500).json({ error: 'Failed to update highlight', details: updateError.message });
    }

    return res.status(200).json({ success: true, highlight });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

