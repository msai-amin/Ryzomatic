/**
 * OpenAlex Paper Recommendations API
 * Handles paper recommendations from OpenAlex citation graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { userInterestProfileService } from '../../lib/userInterestProfileService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OPENALEX_BASE_URL = 'https://api.openalex.org';

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

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

    // Get user interest profile to enhance recommendations
    const interestProfile = await userInterestProfileService.buildInterestProfile(userId, 30);

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
      recommendations = await getContentBasedRecommendations(document, limit, email, interestProfile);
    } 
    else {
      return res.status(400).json({
        error: 'Could not determine OpenAlex work ID and no document content available for content-based search.',
      });
    }

    // Enhance recommendations with interest-based scoring
    if (interestProfile && interestProfile.topConcepts.length > 0) {
      recommendations = enhanceRecommendationsWithInterest(recommendations, interestProfile);
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
      interestProfileUsed: !!interestProfile,
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
 * Enhance recommendations with user interest profile
 */
function enhanceRecommendationsWithInterest(
  recommendations: any[],
  interestProfile: { topConcepts: Array<{ concept: string; importance: number }> }
): any[] {
  const topConcepts = interestProfile.topConcepts.slice(0, 10).map(c => c.concept.toLowerCase());
  
  return recommendations.map(rec => {
    let interestScore = 0;
    const titleLower = (rec.title || '').toLowerCase();
    const abstractLower = (rec.abstract || '').toLowerCase();
    
    // Check if recommendation matches user's top concepts
    topConcepts.forEach((concept, idx) => {
      const importance = interestProfile.topConcepts[idx]?.importance || 0;
      if (titleLower.includes(concept) || abstractLower.includes(concept)) {
        interestScore += importance * 10; // Boost score based on importance
      }
    });

    // Add interest-based boost to recommendation score
    rec.recommendation_score = Math.min(100, (rec.recommendation_score || 50) + interestScore);
    
    if (interestScore > 0) {
      rec.recommendation_reason = `${rec.recommendation_reason || 'Recommended'} (matches your interests)`;
    }

    return rec;
  }).sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
}

/**
 * Get recommendations based on document content using Gemini AI for intelligent analysis
 */
async function getContentBasedRecommendations(
  document: { title?: string; content?: string },
  limit: number,
  email?: string,
  interestProfile?: { topConcepts: Array<{ concept: string; importance: number }> } | null
): Promise<any[]> {
  try {
    // Use Gemini to intelligently extract search queries from the document
    const geminiClient = getGeminiClient();
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare document content for analysis (first 10000 chars for context)
    const contentPreview = document.content
      ? document.content.substring(0, 10000)
      : '';

    const title = document.title || 'Untitled Document';

    // Build prompt with user interest context
    let interestContext = '';
    if (interestProfile && interestProfile.topConcepts.length > 0) {
      const topConcepts = interestProfile.topConcepts.slice(0, 5).map(c => c.concept).join(', ');
      interestContext = `\n\nUser's research interests (from notes/highlights): ${topConcepts}\nConsider these interests when generating search queries to find papers that align with the user's focus areas.`;
    }

    const prompt = `You are an expert academic research assistant. Analyze the following document and extract the most important search terms and concepts for finding related academic papers.

Document Title: ${title}

Document Content (preview):
${contentPreview}${interestContext}

Based on this document${interestContext ? ' and the user\'s research interests' : ''}, generate 3-5 optimized search queries for finding related academic papers. Focus on:
1. Core research concepts and methodologies
2. Key technical terms and domain-specific vocabulary
3. Research questions or problems addressed
4. Important theoretical frameworks or models mentioned${interestContext ? '\n5. Concepts that align with the user\'s highlighted interests' : ''}

Return ONLY a JSON array of search query strings, like this:
["query 1", "query 2", "query 3"]

Each query should be 3-10 words and optimized for academic paper search.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON array from Gemini's response
    let searchQueries: string[] = [];
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        searchQueries = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try to parse the whole response
        searchQueries = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      // Fallback to simple keyword extraction
      if (title && title.length > 10) {
        searchQueries = [title];
      } else if (contentPreview) {
        const words = contentPreview
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 5);
        searchQueries = [words.join(' ')];
      }
    }

    if (!searchQueries || searchQueries.length === 0) {
      return [];
    }

    // Search OpenAlex with each query and combine results
    const allResults: any[] = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries to avoid too many API calls
      if (!query || query.length < 5) continue;

      let url = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(query)}&per-page=${Math.ceil(limit / searchQueries.length)}&sort=cited_by_count:desc`;
      if (email) {
        url += `&mailto=${encodeURIComponent(email)}`;
      }

      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          console.error(`OpenAlex API error for query "${query}": ${response.status}`);
          continue;
        }

        const responseText = await response.text();
        if (!responseText || responseText.trim().length === 0) {
          continue;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse OpenAlex response:', responseText.substring(0, 200));
          continue;
        }

        // Add results, avoiding duplicates
        if (data.results) {
          for (const work of data.results) {
            const workId = work.id?.split('/').pop() || work.id;
            if (workId && !seenIds.has(workId)) {
              seenIds.add(workId);
              allResults.push(work);
            }
          }
        }
      } catch (error) {
        console.error(`Error searching OpenAlex with query "${query}":`, error);
        continue;
      }
    }

    // Sort by citation count and limit results
    allResults.sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0));

    return transformWorks(allResults.slice(0, limit), 'semantic');
  } catch (error: any) {
    console.error('Error in Gemini-based recommendations:', error);
    // Fallback to simple search if Gemini fails
    if (document.title && document.title.length > 10) {
      const url = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(document.title)}&per-page=${limit}&sort=cited_by_count:desc${email ? `&mailto=${encodeURIComponent(email)}` : ''}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        return transformWorks(data.results || [], 'semantic');
      }
    }
    return [];
  }
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
