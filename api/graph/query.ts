import type { NextApiRequest, NextApiResponse } from 'next';
import { unifiedGraphService } from '../../lib/unifiedGraphService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, documentId, noteId, concept, userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // Handle different query types
    if (documentId) {
      // Get document-centric graph
      const depth = parseInt(req.query.depth as string) || 2;
      const graph = await unifiedGraphService.getDocumentCentricGraph(
        documentId as string,
        userId as string,
        depth
      );
      return res.status(200).json({ data: graph });
    } else if (query) {
      // Search across graphs
      const limit = parseInt(req.query.limit as string) || 20;
      const results = await unifiedGraphService.searchAcrossGraphs(
        userId as string,
        query as string,
        limit
      );
      return res.status(200).json({ data: results, count: results.length });
    } else if (concept) {
      // Get timeline
      const timeline = await unifiedGraphService.getTimeline(
        concept as string,
        userId as string
      );
      return res.status(200).json({ data: timeline, count: timeline.length });
    } else if (noteId) {
      // Get note relationships
      const relationships = await unifiedGraphService.getNoteRelationships(
        noteId as string,
        userId as string
      );
      return res.status(200).json({ data: relationships, count: relationships.length });
    } else {
      return res.status(400).json({ error: 'Missing query parameter' });
    }
  } catch (error) {
    console.error('Error in graph query:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

