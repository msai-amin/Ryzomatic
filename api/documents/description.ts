import type { NextApiRequest, NextApiResponse } from 'next';
import { documentDescriptionService } from '../../lib/documentDescriptionService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
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

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
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

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
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

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
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

