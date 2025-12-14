/**
 * OpenAlex Paper Recommendations API
 * Handles paper recommendations from OpenAlex citation graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { userInterestProfileService } from '../../lib/userInterestProfileService';
import { embeddingService } from '../../lib/embeddingService';
import { paperEmbeddingService } from '../../lib/paperEmbeddingService';

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
  try {
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

    let user;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      user = authUser;
    } catch (authErr: any) {
      console.error('Authentication error:', authErr);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Route based on action
    try {
      switch (action) {
        case 'get-recommendations':
          return await handleGetRecommendations(req, res, user.id);
        case 'search':
          return await handleSearch(req, res, user.id);
        case 'update-feedback':
          return await handleUpdateFeedback(req, res, user.id);
        case 'track-view':
          return await handleTrackInteraction(req, res, user.id, 'view');
        case 'track-click':
          return await handleTrackInteraction(req, res, user.id, 'click');
        case 'track-save':
          return await handleTrackInteraction(req, res, user.id, 'save');
        default:
          return res.status(400).json({
            error: 'Invalid action',
            validActions: ['get-recommendations', 'search', 'update-feedback', 'track-view', 'track-click', 'track-save'],
          });
      }
    } catch (routeError: any) {
      console.error(`Error handling action ${action}:`, routeError);
      return res.status(500).json({
        error: 'Internal server error',
        message: routeError.message || 'An unexpected error occurred',
      });
    }
  } catch (error: any) {
    // Top-level error handler - catch any unhandled errors
    console.error('Unhandled error in recommendations API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
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
    let interestProfile: any = null;
    try {
      interestProfile = await userInterestProfileService.buildInterestProfile(userId, 30);
    } catch (error) {
      console.warn('Error building interest profile, continuing without it:', error);
      interestProfile = null;
    }

    // Get interest embedding vector if available
    let userInterestEmbedding: number[] | null = null;
    if (interestProfile?.interestVector) {
      userInterestEmbedding = interestProfile.interestVector;
    } else {
      // Try to get from database if not in profile
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_interest_profiles')
          .select('interest_embedding')
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle to avoid errors if no record found
        
        if (profileError) {
          console.warn('Error fetching interest profile from database:', profileError);
        } else if (profileData?.interest_embedding) {
          try {
            userInterestEmbedding = JSON.parse(profileData.interest_embedding);
          } catch (e) {
            console.warn('Failed to parse interest embedding:', e);
          }
        }
      } catch (error) {
        console.warn('Error getting interest embedding from database:', error);
      }
    }

    // If we have a document ID, fetch full document data (including content)
    let document: any = null;
    let workId = openAlexId;
    
    if (sourceDocumentId) {
      try {
        // Fetch document with content
        const { data: docData, error: docError } = await supabase
          .from('user_books')
          .select('custom_metadata, title, content')
          .eq('id', sourceDocumentId)
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle to avoid errors if no record found

        if (docError) {
          console.warn('Error fetching document:', docError);
        } else {
          document = docData;

          if (document?.custom_metadata?.openalex_id) {
            workId = document.custom_metadata.openalex_id;
          } else if (document?.custom_metadata?.doi) {
            workId = document.custom_metadata.doi;
          }

          // If no content in user_books, try document_content table
          if (!document?.content) {
            try {
              const { data: contentData, error: contentError } = await supabase
                .from('document_content')
                .select('content')
                .eq('book_id', sourceDocumentId)
                .eq('user_id', userId)
                .order('chunk_index', { ascending: true })
                .limit(3); // Get first 3 chunks (usually contains abstract/intro)

              if (contentError) {
                console.warn('Error fetching document content:', contentError);
              } else if (contentData && contentData.length > 0) {
                document = {
                  ...document,
                  content: contentData.map(c => c.content).join(' '),
                };
              }
            } catch (error) {
              console.warn('Error fetching document content chunks:', error);
            }
          }
        }
      } catch (error) {
        console.warn('Error fetching document data:', error);
      }
    }

    // Fetch recommendations from OpenAlex
    let recommendations: any[] = [];

    try {
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
        // Try vector search first if user has interest embedding
        if (userInterestEmbedding) {
          try {
            const vectorResults = await searchPapersByVectorSimilarity(userInterestEmbedding, limit * 2);
            if (vectorResults && vectorResults.length > 0) {
              recommendations = vectorResults;
            } else {
              // Fallback to content-based search
              recommendations = await getContentBasedRecommendations(document, limit, email, interestProfile, userInterestEmbedding);
            }
          } catch (vectorError) {
            console.warn('Error in vector similarity search, falling back to content-based:', vectorError);
            recommendations = await getContentBasedRecommendations(document, limit, email, interestProfile, userInterestEmbedding);
          }
        } else {
          recommendations = await getContentBasedRecommendations(document, limit, email, interestProfile, userInterestEmbedding);
        }
      } 
      else {
        return res.status(400).json({
          error: 'Could not determine OpenAlex work ID and no document content available for content-based search.',
        });
      }
    } catch (fetchError: any) {
      console.error('Error fetching recommendations from OpenAlex:', fetchError);
      // Return empty recommendations instead of failing completely
      recommendations = [];
      // If we have a document title, try a simple fallback search
      if (document?.title && document.title.length > 10) {
        try {
          const fallbackUrl = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(document.title)}&per-page=${limit}&sort=cited_by_count:desc${email ? `&mailto=${encodeURIComponent(email)}` : ''}`;
          const fallbackResponse = await fetch(fallbackUrl, { headers: { Accept: 'application/json' } });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            recommendations = transformWorks(fallbackData.results || [], 'semantic');
          }
        } catch (fallbackError) {
          console.warn('Fallback search also failed:', fallbackError);
        }
      }
    }

    // Enhance recommendations with interest-based scoring using embeddings
    try {
      if (userInterestEmbedding) {
        recommendations = await reRankWithEmbeddings(recommendations, userInterestEmbedding);
      } else if (interestProfile && interestProfile.topConcepts.length > 0) {
        // Fallback to text-based matching if no embedding available
        recommendations = enhanceRecommendationsWithInterest(recommendations, interestProfile);
      }
    } catch (error) {
      console.warn('Error enhancing recommendations with interest profile, using original recommendations:', error);
      // Continue with unenhanced recommendations
    }

    // Cache recommendations in database if we have a source document
    if (sourceDocumentId && recommendations.length > 0) {
      try {
        await cacheRecommendations(userId, sourceDocumentId, recommendations);
      } catch (error) {
        console.warn('Error caching recommendations:', error);
        // Continue even if caching fails
      }
    }

    // Track view for all recommended papers
    if (recommendations.length > 0) {
      try {
        const openalexIds = recommendations.map(r => r.openalex_id).filter(Boolean);
        await trackPaperViews(userId, openalexIds).catch(err => 
          console.warn('Failed to track paper views:', err)
        );
      } catch (error) {
        console.warn('Error tracking paper views:', error);
        // Continue even if tracking fails
      }
    }

    return res.status(200).json({
      recommendations,
      count: recommendations.length,
      sourceDocumentId,
      openAlexId: workId || null,
      recommendationMethod: workId ? 'citation_graph' : 'content_based',
      interestProfileUsed: !!interestProfile,
      embeddingReRankingUsed: !!userInterestEmbedding,
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

    // Track save if savedToLibrary is true
    if (savedToLibrary) {
      try {
        const { data: recData, error: recError } = await supabase
          .from('paper_recommendations')
          .select('openalex_id')
          .eq('id', recommendationId)
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle to avoid errors if no record found

        if (recError) {
          console.warn('Error fetching recommendation for tracking:', recError);
        } else if (recData?.openalex_id) {
          await trackPaperInteraction(userId, recData.openalex_id, 'save').catch(err =>
            console.warn('Failed to track save:', err)
          );
        }
      } catch (error) {
        console.warn('Error tracking save interaction:', error);
        // Don't fail the request if tracking fails
      }
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
 * Track paper interaction (view/click/save)
 */
async function handleTrackInteraction(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  interactionType: 'view' | 'click' | 'save'
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { openalexId } = req.body;

    if (!openalexId) {
      return res.status(400).json({ error: 'openalexId required' });
    }

    const success = await trackPaperInteraction(userId, openalexId, interactionType);

    return res.status(200).json({ success });
  } catch (error: any) {
    console.error(`Error tracking ${interactionType}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Track paper interaction in database
 */
async function trackPaperInteraction(
  userId: string,
  openalexId: string,
  interactionType: 'view' | 'click' | 'save'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('track_paper_interaction', {
      p_openalex_id: openalexId,
      p_user_id: userId,
      p_interaction_type: interactionType,
    });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error(`Error tracking ${interactionType} for paper ${openalexId}:`, error);
    return false;
  }
}

/**
 * Track views for multiple papers (batch)
 */
async function trackPaperViews(userId: string, openalexIds: string[]): Promise<void> {
  try {
    // Track views in batch
    await Promise.all(
      openalexIds.map(id => trackPaperInteraction(userId, id, 'view'))
    );
  } catch (error) {
    console.error('Error tracking paper views:', error);
  }
}

/**
 * Re-rank recommendations using vector similarity to user interest profile
 */
async function reRankWithEmbeddings(
  recommendations: any[],
  userInterestEmbedding: number[] | null
): Promise<any[]> {
  if (!userInterestEmbedding || recommendations.length === 0) {
    return recommendations;
  }

  try {
    const scored = await Promise.all(
      recommendations.map(async (rec) => {
        try {
          // Create text representation of paper
          const paperText = `${rec.title || ''} ${rec.abstract || ''}`.trim();
          
          if (!paperText || paperText.length < 10) {
            return { ...rec, embedding_similarity: 0 };
          }

          // Check if paper has pre-computed embedding
          // Skip embedding lookup entirely if openalex_id is missing or invalid
          if (!rec.openalex_id || typeof rec.openalex_id !== 'string' || rec.openalex_id.length === 0) {
            return { ...rec, embedding_similarity: 0 };
          }

          let paperEmbedding: number[] | null = null;
          
          // First, try to get embedding directly from database (faster and more reliable)
          try {
            const { data, error } = await supabase
              .from('paper_recommendations')
              .select('embedding')
              .eq('openalex_id', rec.openalex_id)
              .not('embedding', 'is', null)
              .limit(1)
              .maybeSingle(); // Use maybeSingle to avoid errors if no record found

            if (error) {
              console.warn(`Error fetching embedding for ${rec.openalex_id}:`, error);
            } else if (data?.embedding) {
              try {
                paperEmbedding = JSON.parse(data.embedding);
              } catch (e) {
                console.warn(`Failed to parse pre-computed embedding for ${rec.openalex_id}:`, e);
              }
            }
          } catch (error) {
            console.warn(`Error fetching embedding from database for ${rec.openalex_id}:`, error);
          }

          // Only use paperEmbeddingService as a last resort, and wrap it very carefully
          // Skip this to avoid potential issues with service initialization
          // if (!paperEmbedding) {
          //   try {
          //     paperEmbedding = await paperEmbeddingService.getEmbedding(rec.openalex_id, false);
          //   } catch (error) {
          //     console.warn(`Error getting embedding via service for ${rec.openalex_id}:`, error);
          //   }
          // }

          if (!paperEmbedding) {
            return { ...rec, embedding_similarity: 0 };
          }

          // Validate embeddings before calculating similarity
          if (!Array.isArray(paperEmbedding) || paperEmbedding.length === 0) {
            console.warn(`Invalid paper embedding for ${rec.openalex_id}`);
            return { ...rec, embedding_similarity: 0 };
          }

          if (!Array.isArray(userInterestEmbedding) || userInterestEmbedding.length === 0) {
            console.warn('Invalid user interest embedding');
            return { ...rec, embedding_similarity: 0 };
          }

          // Ensure embeddings have the same length
          if (paperEmbedding.length !== userInterestEmbedding.length) {
            console.warn(`Embedding dimension mismatch: paper=${paperEmbedding.length}, user=${userInterestEmbedding.length}`);
            return { ...rec, embedding_similarity: 0 };
          }

          // Calculate cosine similarity
          let similarity = 0;
          try {
            similarity = embeddingService.cosineSimilarity(
              userInterestEmbedding,
              paperEmbedding
            );
            
            // Validate similarity result
            if (isNaN(similarity) || !isFinite(similarity)) {
              console.warn(`Invalid similarity result for ${rec.openalex_id}: ${similarity}`);
              similarity = 0;
            }
          } catch (error) {
            console.warn(`Error calculating cosine similarity for ${rec.openalex_id}:`, error);
            similarity = 0;
          }

          // Combine original score with embedding similarity
          const originalScore = rec.recommendation_score || 50;
          const embeddingBoost = similarity * 100; // Convert 0-1 to 0-100
          
          // Weighted combination: 60% original, 40% embedding similarity
          const finalScore = (originalScore * 0.6) + (embeddingBoost * 0.4);

          return {
            ...rec,
            embedding_similarity: similarity,
            recommendation_score: Math.min(100, Math.max(0, finalScore)),
            recommendation_reason: similarity > 0.7 
              ? `${rec.recommendation_reason || 'Recommended'} (highly aligned with your interests)`
              : rec.recommendation_reason
          };
        } catch (error) {
          // If individual recommendation processing fails, return it unchanged
          console.warn(`Error processing recommendation ${rec.openalex_id}:`, error);
          return { ...rec, embedding_similarity: 0 };
        }
      })
    );

    // Sort by final score
    return scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
  } catch (error) {
    console.error('Error re-ranking with embeddings:', error);
    // Return original recommendations if embedding fails
    return recommendations;
  }
}

/**
 * Enhance recommendations with user interest profile (text-based fallback)
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
 * Search papers using vector similarity search in database
 */
async function searchPapersByVectorSimilarity(
  queryEmbedding: number[],
  limit: number = 20
): Promise<any[]> {
  try {
    const embeddingString = embeddingService.formatForPgVector(queryEmbedding);

    const { data, error } = await supabase.rpc('find_similar_papers_by_embedding', {
      query_embedding: embeddingString,
      similarity_threshold: 0.7,
      result_limit: limit,
    });

    if (error) {
      console.error('Error in vector similarity search:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

      // Transform to recommendation format
    return data.map((paper: any) => {
      // Reconstruct abstract from inverted index if needed
      let abstract = '';
      if (paper.abstract_inverted_index) {
        const words: string[] = [];
        Object.keys(paper.abstract_inverted_index).forEach((word: string) => {
          paper.abstract_inverted_index[word].forEach((position: number) => {
            words[position] = word;
          });
        });
        abstract = words.filter((w) => w).join(' ');
      }

      return {
        id: paper.openalex_id?.split('/').pop() || paper.openalex_id,
        openalex_id: paper.openalex_id,
        title: paper.title,
        authors: paper.authors || [],
        abstract,
        abstract_inverted_index: paper.abstract_inverted_index,
        publication_year: paper.publication_year,
        cited_by_count: paper.cited_by_count || 0,
        recommendation_type: 'semantic',
        recommendation_score: paper.recommendation_score || (paper.similarity_score * 100),
        recommendation_reason: `Semantically similar (${Math.round(paper.similarity_score * 100)}% match)`,
        embedding_similarity: paper.similarity_score,
      };
    });
  } catch (error) {
    console.error('Error searching papers by vector similarity:', error);
    return [];
  }
}

/**
 * Get recommendations based on document content using Gemini AI for intelligent analysis
 */
async function getContentBasedRecommendations(
  document: { title?: string; content?: string },
  limit: number,
  email?: string,
  interestProfile?: { topConcepts: Array<{ concept: string; importance: number }> } | null,
  userInterestEmbedding?: number[] | null
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

    // Sort by citation count first
    allResults.sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0));
    
    // Transform to our format
    let recommendations = transformWorks(allResults.slice(0, limit * 2), 'semantic'); // Get more for re-ranking
    
    // Re-rank using embeddings if available
    if (userInterestEmbedding) {
      recommendations = await reRankWithEmbeddings(recommendations, userInterestEmbedding);
    }
    
    return recommendations.slice(0, limit);
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
  try {
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
      console.warn(`Failed to fetch seed work: ${seedResponse.status} - ${errorText.substring(0, 100)}`);
      return [];
    }

    const seedResponseText = await seedResponse.text();
    if (!seedResponseText || seedResponseText.trim().length === 0) {
      console.warn('Empty response from OpenAlex for seed work');
      return [];
    }

    let seedData;
    try {
      seedData = JSON.parse(seedResponseText);
    } catch (parseError) {
      console.error('Failed to parse seed work response:', seedResponseText.substring(0, 200));
      return [];
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
      console.warn(`Failed to fetch related works: ${response.status} - ${errorText.substring(0, 100)}`);
      return [];
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
  } catch (error) {
    console.error('Error in getRelatedWorks:', error);
    return [];
  }
}

/**
 * Get papers that cite the seed paper
 */
async function getCitedBy(workId: string, limit: number, email?: string): Promise<any[]> {
  try {
    const filter = `cites:${workId}`;
    const url = `${OPENALEX_BASE_URL}/works?filter=${filter}&per-page=${limit}&sort=cited_by_count:desc`;
    const worksUrl = email ? `${url}&mailto=${encodeURIComponent(email)}` : url;

    const response = await fetch(worksUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`Failed to fetch cited by: ${response.status} - ${errorText.substring(0, 100)}`);
      return [];
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
  } catch (error) {
    console.error('Error in getCitedBy:', error);
    return [];
  }
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
  // Get openalex_ids to check for pre-computed embeddings
  const openalexIds = recommendations.map(rec => rec.openalex_id).filter(Boolean);
  
  // Fetch pre-computed embeddings for these papers (from any existing record)
  let embeddingMap = new Map<string, string>();
  if (openalexIds.length > 0) {
    const { data: existingEmbeddings } = await supabase
      .from('paper_recommendations')
      .select('openalex_id, embedding, precomputed_at')
      .in('openalex_id', openalexIds)
      .not('embedding', 'is', null)
      .limit(openalexIds.length);

    if (existingEmbeddings) {
      existingEmbeddings.forEach(rec => {
        if (rec.embedding && rec.openalex_id) {
          embeddingMap.set(rec.openalex_id, rec.embedding);
        }
      });
    }
  }

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
    // Copy pre-computed embedding if available
    embedding: embeddingMap.get(rec.openalex_id) || null,
    precomputed_at: embeddingMap.has(rec.openalex_id) ? new Date().toISOString() : null,
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
