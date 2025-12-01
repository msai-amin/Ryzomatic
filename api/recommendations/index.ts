/**
 * OpenAlex Paper Recommendations API
 * Handles paper recommendations from OpenAlex citation graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENALEX_BASE_URL = 'https://api.openalex.org';

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.body?.action || req.query.action) as string;

  // If no action provided, return available actions
  if (!action) {
    return res.status(400).json({
      error: 'Action parameter required',
      validActions: ['get-recommendations', 'search', 'update-feedback'],
      usage: {
        'get-recommendations': 'POST /api/recommendations?action=get-recommendations',
        'search': 'POST /api/recommendations?action=search',
        'update-feedback': 'POST /api/recommendations?action=update-feedback',
      },
    });
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

  // Route based on action
  switch (action) {
    case 'get-recommendations':
      return handleGetRecommendations(req, res, user.id);
    case 'search':
      return handleSearch(req, res, user.id);
    case 'update-feedback':
      return handleUpdateFeedback(req, res, user.id);
    default:
      return res.status(400).json({
        error: 'Invalid action',
        validActions: ['get-recommendations', 'search', 'update-feedback'],
      });
  }
}

/**
 * Get recommendations for a document
 */
async function handleGetRecommendations(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sourceDocumentId = req.query.sourceDocumentId || req.body?.sourceDocumentId;
    const openAlexId = req.query.openAlexId || req.body?.openAlexId;
    const recommendationType = req.query.type || req.body?.type || 'related_works';
    const limit = parseInt(req.query.limit as string) || parseInt(req.body?.limit) || 20;
    const email = req.query.email || req.body?.email; // For polite pool

    if (!sourceDocumentId && !openAlexId) {
      return res.status(400).json({ error: 'sourceDocumentId or openAlexId required' });
    }

    // If we have a document ID, fetch full document data (including content)
    let document: any = null;
    let workId = openAlexId;
    
    if (sourceDocumentId) {
      // Fetch document with content
      const { data: docData } = await supabase
        .from('user_books')
        .select('custom_metadata, title, content')
        .eq('id', sourceDocumentId)
        .eq('user_id', userId)
        .single();

      document = docData;

      if (document?.custom_metadata?.openalex_id) {
        workId = document.custom_metadata.openalex_id;
      } else if (document?.custom_metadata?.doi) {
        workId = document.custom_metadata.doi;
      }

      // If no content in user_books, try document_content table
      if (!document?.content) {
        const { data: contentData } = await supabase
          .from('document_content')
          .select('content')
          .eq('book_id', sourceDocumentId)
          .eq('user_id', userId)
          .order('chunk_index', { ascending: true })
          .limit(3); // Get first 3 chunks (usually contains abstract/intro)

        if (contentData && contentData.length > 0) {
          document = {
            ...document,
            content: contentData.map(c => c.content).join(' '),
          };
        }
      }
    }

    // Fetch recommendations from OpenAlex
    let recommendations: any[] = [];

    // If we have a workId, use citation graph (related works)
    if (workId) {
      // Normalize OpenAlex ID (handle both full URL and ID)
      if (workId.startsWith('https://')) {
        workId = workId.split('/').pop() || workId;
      }

      if (recommendationType === 'related_works') {
        recommendations = await getRelatedWorks(workId, limit, email);
      } else if (recommendationType === 'cited_by') {
        recommendations = await getCitedBy(workId, limit, email);
      } else {
        recommendations = await getRelatedWorks(workId, limit, email);
      }
    } 
    // If no workId but we have document content, use content-based search
    else if (sourceDocumentId && document) {
      recommendations = await getContentBasedRecommendations(document, limit, email);
    } 
    else {
      return res.status(400).json({
        error: 'Could not determine OpenAlex work ID and no document content available for content-based search.',
      });
    }

    // Cache recommendations in database if we have a source document
    if (sourceDocumentId && recommendations.length > 0) {
      await cacheRecommendations(userId, sourceDocumentId, recommendations);
    }

    return res.status(200).json({
      recommendations,
      count: recommendations.length,
      sourceDocumentId,
      openAlexId: workId || null,
      recommendationMethod: workId ? 'citation_graph' : 'content_based',
    });
  } catch (error: any) {
    console.error('Error getting recommendations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Search papers
 */
async function handleSearch(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = req.query.q || req.query.query || req.body?.query;
    const limit = parseInt(req.query.limit as string) || parseInt(req.body?.limit) || 20;
    const email = req.query.email || req.body?.email;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    let url = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
    if (email) {
      url += `&mailto=${encodeURIComponent(email)}`;
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAlex API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      return res.status(200).json({
        results: [],
        count: 0,
        query,
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse search response:', responseText.substring(0, 200));
      return res.status(200).json({
        results: [],
        count: 0,
        query,
      });
    }

    const results = transformWorks(data.results || []);

    return res.status(200).json({
      results,
      count: results.length,
      query,
    });
  } catch (error: any) {
    console.error('Error searching papers:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Update user feedback on a recommendation
 */
async function handleUpdateFeedback(
  req: VercelRequest,
  res: VercelResponse,
  userId: string
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recommendationId, feedback, savedToLibrary } = req.body;

    if (!recommendationId || !feedback) {
      return res.status(400).json({ error: 'recommendationId and feedback required' });
    }

    const { data, error } = await supabase.rpc('update_paper_recommendation_feedback', {
      recommendation_id: recommendationId,
      user_id_param: userId,
      feedback,
      saved_to_library: savedToLibrary || false,
    });

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: data });
  } catch (error: any) {
    console.error('Error updating feedback:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Get recommendations based on document content (for drafts/unpublished papers)
 */
async function getContentBasedRecommendations(
  document: { title?: string; content?: string },
  limit: number,
  email?: string
): Promise<any[]> {
  // Extract search query from document
  let searchQuery = '';
  
  // Use title if available
  if (document.title && document.title.length > 10) {
    searchQuery = document.title;
  }
  
  // If we have content, extract key phrases (first 2000 chars usually contain abstract/intro)
  if (document.content && document.content.length > 100) {
    const contentPreview = document.content.substring(0, 2000);
    
    // Extract potential keywords (simple heuristic - can be improved with AI)
    const words = contentPreview
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4) // Filter short words
      .filter(w => !['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'which', 'their', 'there', 'these', 'those'].includes(w));
    
    // Get most common words (simple keyword extraction)
    const wordFreq: Record<string, number> = {};
    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    
    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    // Combine title and keywords for search
    if (searchQuery) {
      searchQuery = `${searchQuery} ${topKeywords.join(' ')}`;
    } else {
      searchQuery = topKeywords.join(' ');
    }
  }
  
  if (!searchQuery || searchQuery.length < 5) {
    return []; // Can't search with empty query
  }
  
  // Search OpenAlex
  let url = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(searchQuery)}&per-page=${limit}&sort=cited_by_count:desc`;
  if (email) {
    url += `&mailto=${encodeURIComponent(email)}`;
  }
  
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAlex API error: ${response.status} - ${errorText.substring(0, 100)}`);
  }
  
  const responseText = await response.text();
  if (!responseText || responseText.trim().length === 0) {
    return []; // Return empty array if no content
  }
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse OpenAlex response:', responseText.substring(0, 200));
    return []; // Return empty array on parse error
  }
  
  return transformWorks(data.results || [], 'semantic');
}

/**
 * Get related works from OpenAlex
 */
async function getRelatedWorks(workId: string, limit: number, email?: string): Promise<any[]> {
  // First get the seed work
  let seedUrl = `${OPENALEX_BASE_URL}/works/${workId}`;
  if (email) {
    seedUrl += `?mailto=${encodeURIComponent(email)}`;
  }

  const seedResponse = await fetch(seedUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!seedResponse.ok) {
    const errorText = await seedResponse.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch seed work: ${seedResponse.status} - ${errorText.substring(0, 100)}`);
  }

  const seedResponseText = await seedResponse.text();
  if (!seedResponseText || seedResponseText.trim().length === 0) {
    throw new Error('Empty response from OpenAlex');
  }

  let seedData;
  try {
    seedData = JSON.parse(seedResponseText);
  } catch (parseError) {
    console.error('Failed to parse seed work response:', seedResponseText.substring(0, 200));
    throw new Error('Invalid JSON response from OpenAlex');
  }
  const relatedWorks = seedData.related_works || [];

  if (relatedWorks.length === 0) {
    return [];
  }

  // Extract IDs
  const ids = relatedWorks
    .slice(0, Math.min(limit, 25))
    .map((url: string) => url.split('/').pop())
    .filter(Boolean);

  if (ids.length === 0) {
    return [];
  }

  // Fetch related works
  const filter = `ids.openalex:${ids.join('|')}`;
  const url = `${OPENALEX_BASE_URL}/works?filter=${filter}&per-page=${limit}`;
  const worksUrl = email ? `${url}&mailto=${encodeURIComponent(email)}` : url;

  const response = await fetch(worksUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch related works: ${response.status} - ${errorText.substring(0, 100)}`);
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim().length === 0) {
    return []; // Return empty array if no content
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse related works response:', responseText.substring(0, 200));
    return []; // Return empty array on parse error
  }

  return transformWorks(data.results || [], 'related_works');
}

/**
 * Get papers that cite the seed paper
 */
async function getCitedBy(workId: string, limit: number, email?: string): Promise<any[]> {
  const filter = `cites:${workId}`;
  const url = `${OPENALEX_BASE_URL}/works?filter=${filter}&per-page=${limit}&sort=cited_by_count:desc`;
  const worksUrl = email ? `${url}&mailto=${encodeURIComponent(email)}` : url;

  const response = await fetch(worksUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch cited by: ${response.status} - ${errorText.substring(0, 100)}`);
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim().length === 0) {
    return []; // Return empty array if no content
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse cited by response:', responseText.substring(0, 200));
    return []; // Return empty array on parse error
  }

  return transformWorks(data.results || [], 'cited_by');
}

/**
 * Transform OpenAlex works to our format
 */
function transformWorks(works: any[], recommendationType: string = 'semantic'): any[] {
  return works.map((work) => {
    const abstract = reconstructAbstract(work.abstract_inverted_index);
    const authors = (work.authorships || []).map((a: any) => ({
      display_name: a.author?.display_name || 'Unknown',
      id: a.author?.id,
      orcid: a.author?.orcid,
    }));

    // Calculate score
    let score = 50;
    if (work.cited_by_count > 0) {
      score += Math.min(30, Math.log10(work.cited_by_count + 1) * 10);
    }
    if (work.publication_year) {
      const yearsAgo = new Date().getFullYear() - work.publication_year;
      if (yearsAgo <= 2) score += 10;
      else if (yearsAgo <= 5) score += 5;
    }
    if (work.open_access?.is_oa) {
      score += 5;
    }
    score = Math.min(100, score);

    return {
      id: work.id?.split('/').pop() || work.id,
      openalex_id: work.id,
      title: work.title || 'Untitled',
      authors,
      abstract,
      publication_year: work.publication_year,
      cited_by_count: work.cited_by_count || 0,
      open_access_url: work.open_access?.oa_url,
      doi: work.doi,
      venue: work.primary_location?.source?.display_name,
      topics: work.topics || [],
      recommendation_type: recommendationType,
      recommendation_score: score,
      recommendation_reason: getRecommendationReason(recommendationType),
    };
  });
}

/**
 * Reconstruct abstract from inverted index
 */
function reconstructAbstract(invertedIndex?: Record<string, number[]>): string | null {
  if (!invertedIndex) return null;

  const words: string[] = [];
  Object.keys(invertedIndex).forEach((word) => {
    invertedIndex[word].forEach((position) => {
      words[position] = word;
    });
  });

  return words.filter((w) => w).join(' ');
}

/**
 * Get recommendation reason
 */
function getRecommendationReason(type: string): string {
  const reasons: Record<string, string> = {
    related_works: 'Related to this paper in the citation graph',
    cited_by: 'Cites this paper',
    co_citation: 'Frequently cited together',
    author: 'By the same authors',
    venue: 'Published in the same venue',
    semantic: 'Semantically similar',
    hybrid: 'Multiple relevance signals',
  };
  return reasons[type] || 'Recommended for you';
}

/**
 * Cache recommendations in database
 */
async function cacheRecommendations(
  userId: string,
  sourceDocumentId: string,
  recommendations: any[]
): Promise<void> {
  const inserts = recommendations.map((rec) => ({
    user_id: userId,
    source_document_id: sourceDocumentId,
    openalex_id: rec.openalex_id,
    title: rec.title,
    authors: rec.authors,
    abstract_inverted_index: rec.abstract ? createInvertedIndex(rec.abstract) : null,
    publication_year: rec.publication_year,
    cited_by_count: rec.cited_by_count,
    open_access_url: rec.open_access_url,
    doi: rec.doi,
    venue: rec.venue,
    topics: rec.topics,
    recommendation_type: rec.recommendation_type,
    recommendation_score: rec.recommendation_score,
    recommendation_reason: rec.recommendation_reason,
  }));

  if (inserts.length > 0) {
    await supabase.from('paper_recommendations').upsert(inserts, {
      onConflict: 'user_id,openalex_id,source_document_id',
      ignoreDuplicates: false,
    });
  }
}

/**
 * Simple inverted index creation
 */
function createInvertedIndex(text: string): Record<string, number[]> {
  const words = text.toLowerCase().split(/\s+/);
  const index: Record<string, number[]> = {};
  words.forEach((word, position) => {
    if (!index[word]) {
      index[word] = [];
    }
    index[word].push(position);
  });
  return index;
}
