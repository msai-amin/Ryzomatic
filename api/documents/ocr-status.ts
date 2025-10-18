import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get OCR Status Endpoint
 * GET /api/documents/ocr-status?documentId=xxx
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId } = req.query;

    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({ error: 'Document ID is required' });
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

    // Get document with OCR status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, ocr_status, ocr_metadata, content')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json({
      documentId: document.id,
      ocrStatus: document.ocr_status,
      ocrMetadata: document.ocr_metadata,
      content: document.ocr_status === 'completed' ? document.content : undefined,
    });

  } catch (error: any) {
    console.error('OCR status check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

