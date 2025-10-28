import type { NextApiRequest, NextApiResponse } from 'next';
import { autoRelationshipService } from '../../lib/autoRelationshipService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { noteId, userId } = req.query;

    if (!noteId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const relationships = await autoRelationshipService.getNoteRelationships(
      noteId as string,
      userId as string
    );

    return res.status(200).json({ data: relationships, count: relationships.length });
  } catch (error) {
    console.error('Error getting note relationships:', error);
    return res.status(500).json({ error: 'Failed to get note relationships' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { noteId, userId, action } = req.body;

    if (!noteId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Handle different actions
    if (action === 'auto-detect') {
      const count = await autoRelationshipService.detectNoteRelationships(noteId, userId);
      return res.status(200).json({ success: true, relationshipsCreated: count });
    } else if (action === 'create') {
      const { relationship } = req.body;
      if (!relationship) {
        return res.status(400).json({ error: 'Missing relationship data' });
      }

      const success = await autoRelationshipService.createRelationship(relationship);
      if (!success) {
        return res.status(500).json({ error: 'Failed to create relationship' });
      }

      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in POST /api/notes/relationships:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { relationshipId, userId } = req.query;

    if (!relationshipId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const success = await autoRelationshipService.deleteRelationship(
      relationshipId as string,
      userId as string
    );

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete relationship' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return res.status(500).json({ error: 'Failed to delete relationship' });
  }
}

