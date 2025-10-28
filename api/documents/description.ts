import type { VercelRequest, VercelResponse } from '@vercel/node';
import { documentDescriptionService } from '../../lib/documentDescriptionService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'PUT') {
    return handlePut(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  try {
    const { bookId, userId } = req.query;

    if (!bookId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const description = await documentDescriptionService.getDescription(
      bookId as string,
      userId as string
    );

    return res.status(200).json({ data: description });
  } catch (error) {
    console.error('Error getting description:', error);
    return res.status(500).json({ error: 'Failed to get description' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    const { bookId, userId, content } = req.body;

    if (!bookId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const description = await documentDescriptionService.generateDescription(
      bookId,
      userId,
      content
    );

    if (!description) {
      return res.status(500).json({ error: 'Failed to generate description' });
    }

    return res.status(200).json({ data: description });
  } catch (error) {
    console.error('Error generating description:', error);
    return res.status(500).json({ error: 'Failed to generate description' });
  }
}

async function handlePut(req: VercelRequest, res: VercelResponse) {
  try {
    const { bookId, userId, userDescription } = req.body;

    if (!bookId || !userId || !userDescription) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const description = await documentDescriptionService.updateDescription(
      bookId,
      userId,
      userDescription
    );

    if (!description) {
      return res.status(500).json({ error: 'Failed to update description' });
    }

    return res.status(200).json({ data: description });
  } catch (error) {
    console.error('Error updating description:', error);
    return res.status(500).json({ error: 'Failed to update description' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    const { bookId, userId } = req.query;

    if (!bookId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const success = await documentDescriptionService.deleteDescription(
      bookId as string,
      userId as string
    );

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete description' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting description:', error);
    return res.status(500).json({ error: 'Failed to delete description' });
  }
}

