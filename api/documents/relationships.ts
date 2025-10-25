import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { documentRelevanceService } from '../../src/services/documentRelevanceService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'PATCH') {
    return handlePatch(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { sourceDocumentId, userId } = req.query;

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

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { sourceDocumentId, relatedDocumentId, relationshipDescription, userId } = req.body;

    if (!sourceDocumentId || !relatedDocumentId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if relationship already exists
    if (!supabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    const { data: existing, error: checkError } = await supabase
      .from('document_relationships')
      .select('id')
      .eq('source_document_id', sourceDocumentId)
      .eq('related_document_id', relatedDocumentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Relationship already exists' });
    }

    // Create new relationship
    const { data: relationship, error } = await supabase
      .from('document_relationships')
      .insert({
        user_id: userId,
        source_document_id: sourceDocumentId,
        related_document_id: relatedDocumentId,
        relationship_description: relationshipDescription,
        relevance_calculation_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating relationship:', error);
      return res.status(500).json({ error: 'Failed to create relationship' });
    }

    // Start background relevance calculation
    try {
      // Don't await this - let it run in background
      documentRelevanceService.calculateAndUpdateRelevance(relationship.id).catch(calcError => {
        console.error('Error in background relevance calculation:', calcError);
      });
    } catch (calcError) {
      console.error('Error starting relevance calculation:', calcError);
      // Don't fail the request if background calculation fails
    }

    return res.status(201).json({ 
      success: true, 
      data: relationship,
      message: 'Relationship created successfully. Relevance calculation started.'
    });

  } catch (error) {
    console.error('Error in POST /api/documents/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { relationshipId } = req.query;
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

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { relationshipId } = req.query;

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
