import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Optional service - loaded dynamically to avoid module loading errors
let documentDescriptionService: any = null;

async function getDocumentDescriptionService() {
  if (documentDescriptionService !== null) {
    return documentDescriptionService;
  }
  
  // Mark as attempted to avoid infinite loops
  if (documentDescriptionService === false) {
    return null;
  }
  
  try {
    // Try dynamic import - this will only execute when needed
    const module = await import('../../lib/documentDescriptionService');
    documentDescriptionService = module.documentDescriptionService;
    return documentDescriptionService;
  } catch (error) {
    // Mark as failed (false) so we don't retry
    documentDescriptionService = false;
    console.warn('DocumentDescriptionService not available:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Create Supabase client for serverless functions
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Use service role key if available, otherwise fall back to anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables in API context');
  console.error('URL:', supabaseUrl);
  console.error('Service Key present:', !!supabaseServiceKey);
  console.error('Anon Key present:', !!supabaseAnonKey);
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set JSON content type header
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    } else if (req.method === 'POST') {
      return await handlePost(req, res);
    } else if (req.method === 'PATCH') {
      return await handlePatch(req, res);
    } else if (req.method === 'DELETE') {
      return await handleDelete(req, res);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    // Catch any unhandled errors and return JSON
    console.error('Unhandled error in relationships handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage
    });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  try {
    const { sourceDocumentId, userId, bookId, action } = req.query;

    // Handle document description requests
    if (action === 'getDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.getDescription(
        bookId as string,
        userId as string
      );
      return res.status(200).json({ data: description });
    }

    // Handle document description by combined description
    if (action === 'getCombinedDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.getCombinedDescription(
        bookId as string,
        userId as string
      );
      return res.status(200).json({ data: { description } });
    }

    // Original functionality: Get related documents
    if (!sourceDocumentId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get related documents with details
    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    const { data, error } = await supabase.rpc('get_related_documents_with_details', {
      source_doc_id: sourceDocumentId as string
    });

    if (error) {
      console.error('Error fetching related documents:', error);
      return res.status(500).json({ error: 'Failed to fetch related documents' });
    }

    return res.status(200).json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Error in GET /api/documents/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('POST /api/documents/relationships - Request body:', req.body);
    
    const { sourceDocumentId, relatedDocumentId, relationshipDescription, userId, bookId, content, action } = req.body;

    // Handle document description generation
    if (action === 'generateDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.generateDescription(
        bookId,
        userId,
        content
      );
      if (!description) {
        return res.status(500).json({ error: 'Failed to generate description' });
      }
      return res.status(200).json({ data: description });
    }

    if (!sourceDocumentId || !relatedDocumentId || !userId) {
      console.log('Missing required fields:', { sourceDocumentId, relatedDocumentId, userId });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Authenticate user - get JWT token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    // Create authenticated Supabase client
    // Use service role key if available (bypasses RLS), otherwise use user's token with anon key
    let authenticatedSupabase = supabase;
    
    // If service role key exists, use it (bypasses RLS)
    if (supabaseServiceKey && supabaseUrl) {
      authenticatedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      // Verify user matches userId from request (if token provided)
      if (token) {
        const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser(token);
        if (authError || !user) {
          console.error('Auth error:', authError);
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Verify userId matches authenticated user
        if (user.id !== userId) {
          return res.status(403).json({ error: 'Access denied - userId mismatch' });
        }
      }
    } else if (token && supabaseUrl && supabaseAnonKey) {
      // Create client with user's token for RLS to work properly
      // CRITICAL: Set the session on the client so auth.uid() works in RLS policies
      authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      });
      
      // Set the session explicitly so RLS policies can access auth.uid()
      try {
        const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser(token);
        if (authError || !user) {
          console.error('Auth error:', authError);
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // Verify userId matches authenticated user
        if (user.id !== userId) {
          return res.status(403).json({ error: 'Access denied - userId mismatch' });
        }
        
        // For RLS to work, we need to ensure the client has the user context
        // The Authorization header in global headers should be sufficient
        // But we verify the user here to ensure security
      } catch (sessionError) {
        console.error('Error verifying user:', sessionError);
        return res.status(401).json({ error: 'Authentication failed' });
      }
    } else {
      // If no token and no service key, we can't authenticate
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if relationship already exists
    if (!authenticatedSupabase) {
      console.error('Supabase client not initialized');
      console.error('Environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey,
        supabaseServiceKey: !!supabaseServiceKey
      });
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    console.log('Checking for existing relationship...');
    const { data: existing, error: checkError } = await authenticatedSupabase
      .from('document_relationships')
      .select('id')
      .eq('source_document_id', sourceDocumentId)
      .eq('related_document_id', relatedDocumentId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing relationship:', checkError);
      return res.status(500).json({ error: 'Failed to check existing relationship' });
    }

    if (existing) {
      console.log('Relationship already exists');
      return res.status(409).json({ error: 'Relationship already exists' });
    }

    // Create new relationship
    console.log('Creating new relationship...');
    console.log('Using authenticated client:', {
      hasServiceKey: !!supabaseServiceKey,
      hasToken: !!token,
      userId
    });
    
    const insertData = {
      user_id: userId,
      source_document_id: sourceDocumentId,
      related_document_id: relatedDocumentId,
      relationship_description: relationshipDescription,
      relevance_calculation_status: 'pending'
    };
    console.log('Insert data:', insertData);
    
    // CRITICAL: Use the authenticated client for the insert
    // If service role key is used, RLS is bypassed
    // If anon key with token is used, RLS should work via auth.uid()
    const { data: relationship, error } = await authenticatedSupabase
      .from('document_relationships')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating relationship:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ 
        error: 'Failed to create relationship', 
        details: error.message,
        code: error.code
      });
    }
    
    console.log('Relationship created successfully:', relationship);

    return res.status(201).json({ 
      success: true, 
      data: relationship,
      message: 'Relationship created successfully. Relevance calculation will start in background.'
    });

  } catch (error) {
    console.error('Error in POST /api/documents/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  try {
    const { relationshipId, bookId, userId, userDescription, action } = req.query;

    // Handle document description update
    if (action === 'updateDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const body = req.body as any;
      const description = await service.updateDescription(
        bookId as string,
        userId as string,
        body.userDescription
      );
      if (!description) {
        return res.status(500).json({ error: 'Failed to update description' });
      }
      return res.status(200).json({ data: description });
    }

    // Original functionality: Update relationship
    const { relationshipDescription, relevancePercentage, aiGeneratedDescription, relevanceCalculationStatus } = req.body;

    if (!relationshipId) {
      return res.status(400).json({ error: 'Missing relationship ID' });
    }

    const updateData: any = {};
    if (relationshipDescription !== undefined) updateData.relationship_description = relationshipDescription;
    if (relevancePercentage !== undefined) updateData.relevance_percentage = relevancePercentage;
    if (aiGeneratedDescription !== undefined) updateData.ai_generated_description = aiGeneratedDescription;
    if (relevanceCalculationStatus !== undefined) updateData.relevance_calculation_status = relevanceCalculationStatus;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { data: relationship, error } = await supabase
      .from('document_relationships')
      .update(updateData)
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) {
      console.error('Error updating relationship:', error);
      return res.status(500).json({ error: 'Failed to update relationship' });
    }

    return res.status(200).json({ 
      success: true, 
      data: relationship,
      message: 'Relationship updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/documents/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const { relationshipId, bookId, userId, action } = req.query;

    // Handle document description deletion
    if (action === 'deleteDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const success = await service.deleteDescription(
        bookId as string,
        userId as string
      );
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete description' });
      }
      return res.status(200).json({ success: true });
    }

    // Original functionality: Delete relationship
    if (!relationshipId) {
      return res.status(400).json({ error: 'Missing relationship ID' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { error } = await supabase
      .from('document_relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      console.error('Error deleting relationship:', error);
      return res.status(500).json({ error: 'Failed to delete relationship' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Relationship deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/documents/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
