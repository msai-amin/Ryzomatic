/**
 * OpenAlex Paper Recommendations API
 * Handles paper recommendations from OpenAlex citation graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { userInterestProfileService } from '../../lib/userInterestProfileService';
import { embeddingService } from '../../lib/embeddingService';
// Note: paperEmbeddingService removed - not used in this endpoint (only in commented code)

// Initialize Supabase client with error handling
let supabase: ReturnType<typeof createClient>;
let supabaseInitialized = false;

try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables - Supabase operations will fail');
    // Create a dummy client to prevent crashes, but operations will fail gracefully
    supabase = createClient('https://dummy.supabase.co', 'dummy-key');
    supabaseInitialized = false;
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
    supabaseInitialized = true;
  }
} catch (error: any) {
  console.error('Failed to initialize Supabase client:', {
    errorCode: error.code || 'SUPABASE_INIT_ERROR',
    errorMessage: error.message,
  });
  // Create a dummy client to prevent crashes, but operations will fail gracefully
  supabase = createClient('https://dummy.supabase.co', 'dummy-key');
  supabaseInitialized = false;
}

const OPENALEX_BASE_URL = 'https://api.openalex.org';

/**
 * Initialize Gemini client
 * Returns null if API key is missing or initialization fails
 */
function getGeminiClient(): GoogleGenerativeAI | null {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API key not configured, skipping Gemini-based recommendations');
      return null;
    }
    return new GoogleGenerativeAI(apiKey);
  } catch (error) {
    console.error('Failed to initialize Gemini client:', error);
    return null;
  }
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
      if (!supabaseInitialized) {
        console.error('Supabase not initialized - cannot authenticate');
        return res.status(500).json({ 
          error: 'Service configuration error',
          errorCode: 'SUPABASE_NOT_INITIALIZED',
        });
      }
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        const errorCode = authError?.code || 'AUTH_ERROR';
        console.warn('Authentication failed:', {
          errorCode,
          errorMessage: authError?.message || 'Invalid token',
        });
        return res.status(401).json({ 
          error: 'Invalid token',
          errorCode,
        });
      }
      user = authUser;
    } catch (authErr: any) {
      const errorCode = authErr.code || 'AUTH_EXCEPTION';
      console.error('Authentication error:', {
        errorCode,
        errorMessage: authErr.message,
      });
      return res.status(401).json({ 
        error: 'Authentication failed',
        errorCode,
      });
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
      const errorCode = routeError.code || 'ROUTE_HANDLER_ERROR';
      console.error(`Error handling action ${action}:`, {
        action,
        errorCode,
        errorMessage: routeError.message,
        errorStack: routeError.stack?.substring(0, 500),
        userId: user?.id,
      });
      return res.status(500).json({
        error: 'Internal server error',
        message: routeError.message || 'An unexpected error occurred',
        errorCode,
      });
    }
  } catch (error: any) {
    // Top-level error handler - catch any unhandled errors
    const errorCode = error.code || 'TOP_LEVEL_ERROR';
    console.error('Unhandled error in recommendations API:', {
      errorCode,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500),
      action: req.body?.action || req.query.action,
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      errorCode,
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

  const startTime = Date.now();
  // Vercel Hobby functions can time out at ~10s; keep a conservative budget so we can
  // return partial results instead of hitting FUNCTION_INVOCATION_FAILED.
  const MAX_EXECUTION_TIME = 8000; // 8 seconds safety budget
  
  // Helper function to check if we're approaching timeout
  const checkTimeout = (): boolean => {
    const elapsed = Date.now() - startTime;
    return elapsed > MAX_EXECUTION_TIME;
  };

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
    const profileStartTime = Date.now();
    try {
      interestProfile = await userInterestProfileService.buildInterestProfile(userId, 30);
      const profileTime = Date.now() - profileStartTime;
      if (profileTime > 5000) {
        console.warn('Interest profile building took longer than expected', {
          userId,
          executionTimeMs: profileTime,
        });
      }
    } catch (error: any) {
      const profileTime = Date.now() - profileStartTime;
      console.warn('Error building interest profile, continuing without it:', {
        userId,
        errorCode: error.code || 'INTEREST_PROFILE_ERROR',
        errorMessage: error.message,
        executionTimeMs: profileTime,
      });
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
      const fetchTime = Date.now() - startTime;
      const errorCode = fetchError.code || fetchError.name || 'OPENALEX_FETCH_ERROR';
      console.error('Error fetching recommendations from OpenAlex:', {
        userId,
        sourceDocumentId,
        openAlexId: workId,
        recommendationType,
        errorCode,
        errorMessage: fetchError.message,
        executionTimeMs: fetchTime,
        isTimeout: fetchError.name === 'AbortError',
      });
      // Return empty recommendations instead of failing completely
      recommendations = [];
      // If we have a document title, try a simple fallback search
      if (document?.title && document.title.length > 10) {
        try {
          const fallbackUrl = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(document.title)}&per-page=${limit}&sort=cited_by_count:desc${email ? `&mailto=${encodeURIComponent(email)}` : ''}`;
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 5000);
          
          try {
            const fallbackResponse = await fetch(fallbackUrl, {
              headers: { Accept: 'application/json' },
              signal: fallbackController.signal,
            });
            clearTimeout(fallbackTimeoutId);
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              recommendations = transformWorks(fallbackData.results || [], 'semantic');
            }
          } catch (fetchError: any) {
            clearTimeout(fallbackTimeoutId);
            if (fetchError.name === 'AbortError') {
              console.warn('Fallback search timed out');
            } else {
              throw fetchError;
            }
          }
        } catch (fallbackError) {
          console.warn('Fallback search also failed:', fallbackError);
        }
      }
    }

    // Check timeout before expensive operations
    if (checkTimeout()) {
      console.warn('Approaching timeout, skipping enhancement and returning basic recommendations');
      return res.status(200).json({
        recommendations: recommendations.slice(0, limit),
        count: recommendations.length,
        sourceDocumentId,
        openAlexId: workId || null,
        recommendationMethod: workId ? 'citation_graph' : 'content_based',
        interestProfileUsed: false,
        embeddingReRankingUsed: false,
        timeoutWarning: true,
      });
    }

    // Enhance recommendations with interest-based scoring using embeddings
    try {
      if (userInterestEmbedding && !checkTimeout()) {
        recommendations = await reRankWithEmbeddings(recommendations, userInterestEmbedding);
      } else if (interestProfile && interestProfile.topConcepts.length > 0 && !checkTimeout()) {
        // Fallback to text-based matching if no embedding available
        recommendations = enhanceRecommendationsWithInterest(recommendations, interestProfile);
      }
    } catch (error) {
      console.warn('Error enhancing recommendations with interest profile, using original recommendations:', error);
      // Continue with unenhanced recommendations
    }

    // Cache recommendations in database if we have a source document (skip if timeout approaching)
    if (sourceDocumentId && recommendations.length > 0 && !checkTimeout()) {
      try {
        await cacheRecommendations(userId, sourceDocumentId, recommendations);
      } catch (error) {
        console.warn('Error caching recommendations:', error);
        // Continue even if caching fails
      }
    }

    // Track view for all recommended papers (skip if timeout approaching)
    if (recommendations.length > 0 && !checkTimeout()) {
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

    const executionTime = Date.now() - startTime;
    return res.status(200).json({
      recommendations: recommendations.slice(0, limit),
      count: recommendations.length,
      sourceDocumentId,
      openAlexId: workId || null,
      recommendationMethod: workId ? 'citation_graph' : 'content_based',
      interestProfileUsed: !!interestProfile,
      embeddingReRankingUsed: !!userInterestEmbedding,
      executionTimeMs: executionTime,
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorContext = {
      userId,
      sourceDocumentId,
      openAlexId,
      recommendationType,
      executionTimeMs: executionTime,
      errorCode,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500), // Limit stack trace length
    };
    
    console.error('Error getting recommendations:', {
      ...errorContext,
      error: error.message,
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      errorCode,
      executionTimeMs: executionTime,
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('OpenAlex API timeout');
      }
      throw fetchError;
    }

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
      const errorCode = error.code || 'UPDATE_FEEDBACK_ERROR';
      console.error('Error updating feedback:', {
        errorCode,
        errorMessage: error.message,
        userId,
        recommendationId,
      });
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
    const errorCode = error.code || 'UPDATE_FEEDBACK_HANDLER_ERROR';
    console.error('Error updating feedback:', {
      errorCode,
      errorMessage: error.message,
      userId,
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to update feedback',
      errorCode,
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

    if (error) {
      const errorCode = error.code || 'TRACK_INTERACTION_ERROR';
      console.warn(`Error tracking ${interactionType} for paper ${openalexId}:`, {
        errorCode,
        errorMessage: error.message,
        userId,
        openalexId,
        interactionType,
      });
      return false;
    }
    return data || false;
  } catch (error: any) {
    const errorCode = error.code || 'TRACK_INTERACTION_EXCEPTION';
    console.error(`Error tracking ${interactionType} for paper ${openalexId}:`, {
      errorCode,
      errorMessage: error.message,
      userId,
      openalexId,
      interactionType,
    });
    return false;
  }
}

/**
 * Track views for multiple papers (batch)
 */
async function trackPaperViews(userId: string, openalexIds: string[]): Promise<void> {
  try {
    // Track views in batch using Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      openalexIds.map(id => trackPaperInteraction(userId, id, 'view'))
    );
    
    // Log any failures but don't throw
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to track view for paper ${openalexIds[index]}:`, result.reason);
      }
    });
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

  // Limit the number of recommendations processed to avoid timeout
  const maxRecommendations = 50;
  const recommendationsToProcess = recommendations.slice(0, maxRecommendations);
  
  try {
    // Use Promise.allSettled to handle partial failures gracefully
    const scoredResults = await Promise.allSettled(
      recommendationsToProcess.map(async (rec) => {
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

          // Note: paperEmbeddingService removed from imports - using direct DB queries only

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

    // Extract successful results and handle failures
    const scored = scoredResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If promise was rejected, return the original recommendation with default similarity
        console.warn(`Failed to process recommendation at index ${index}:`, result.reason);
        return { ...recommendationsToProcess[index], embedding_similarity: 0 };
      }
    });

    // Sort by final score and combine with unprocessed recommendations
    const sortedScored = scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
    
    // Add back any recommendations that weren't processed (with default similarity)
    const unprocessed = recommendations.slice(maxRecommendations).map(rec => ({
      ...rec,
      embedding_similarity: 0
    }));
    
    return [...sortedScored, ...unprocessed];
  } catch (error: any) {
    const errorCode = error.code || 'EMBEDDING_RERANK_ERROR';
    console.error('Error re-ranking with embeddings:', {
      errorCode,
      errorMessage: error.message,
      recommendationsCount: recommendations.length,
      hasUserEmbedding: !!userInterestEmbedding,
    });
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
      const errorCode = error.code || 'VECTOR_SIMILARITY_SEARCH_ERROR';
      console.error('Error in vector similarity search:', {
        errorCode,
        errorMessage: error.message,
        limit,
        hasQueryEmbedding: !!queryEmbedding,
      });
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
  } catch (error: any) {
    const errorCode = error.code || 'VECTOR_SIMILARITY_SEARCH_ERROR';
    console.error('Error searching papers by vector similarity:', {
      errorCode,
      errorMessage: error.message,
      limit,
      hasQueryEmbedding: !!queryEmbedding,
    });
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
    if (!geminiClient) {
      // Skip Gemini, use simple keyword extraction
      return getSimpleKeywordRecommendations(document, limit, email);
    }
    
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare document content for analysis (keep small for latency)
    const contentPreview = document.content
      ? document.content.substring(0, 6000)
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

    // Add timeout protection for Gemini API call (keep under Vercel Hobby limits)
    let result;
    try {
      const geminiPromise = model.generateContent(prompt);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout after 6 seconds')), 6000)
      );
      
      result = await Promise.race([geminiPromise, timeoutPromise]);
    } catch (timeoutError: any) {
      if (timeoutError.message?.includes('timeout')) {
        console.warn('Gemini API call timed out, falling back to simple keyword extraction');
        return getSimpleKeywordRecommendations(document, limit, email);
      }
      throw timeoutError;
    }
    
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`OpenAlex API timeout for query "${query}"`);
        } else {
          console.error(`Error searching OpenAlex with query "${query}":`, error);
        }
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
    const errorCode = error.code || error.name || 'GEMINI_RECOMMENDATIONS_ERROR';
    console.error('Error in Gemini-based recommendations:', {
      errorCode,
      errorMessage: error.message,
      isTimeout: error.message?.includes('timeout'),
      documentTitle: document.title?.substring(0, 100),
      hasContent: !!document.content,
    });
    // Fallback to simple keyword extraction
    return getSimpleKeywordRecommendations(document, limit, email);
  }
}

/**
 * Get recommendations using simple keyword extraction (fallback when Gemini is unavailable)
 */
async function getSimpleKeywordRecommendations(
  document: { title?: string; content?: string },
  limit: number,
  email?: string
): Promise<any[]> {
  try {
    // Extract keywords from title and content
    const title = document.title || '';
    const content = document.content || '';
    
    // Simple keyword extraction: use title if available, otherwise extract from content
    let searchQuery = '';
    if (title && title.length > 10) {
      // Use title as primary search query
      searchQuery = title;
    } else if (content && content.length > 50) {
      // Extract first meaningful words from content
      const words = content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 5);
      searchQuery = words.join(' ');
    } else {
      // Not enough content to generate search query
      return [];
    }

    if (!searchQuery || searchQuery.length < 5) {
      return [];
    }

    // Search OpenAlex with the extracted query
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      let url = `${OPENALEX_BASE_URL}/works?search=${encodeURIComponent(searchQuery)}&per-page=${limit}&sort=cited_by_count:desc`;
      if (email) {
        url += `&mailto=${encodeURIComponent(email)}`;
      }

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`OpenAlex API error for simple keyword search: ${response.status}`);
        return [];
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        return [];
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse OpenAlex response:', responseText.substring(0, 200));
        return [];
      }

      return transformWorks(data.results || [], 'semantic');
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.warn('OpenAlex API timeout for simple keyword search');
      } else {
        console.error('Error in simple keyword search:', fetchError);
      }
      return [];
    }
  } catch (error: any) {
    const errorCode = error.code || error.name || 'SIMPLE_KEYWORD_SEARCH_ERROR';
    console.error('Error in getSimpleKeywordRecommendations:', {
      errorCode,
      errorMessage: error.message,
      isTimeout: error.name === 'AbortError',
      hasTitle: !!document.title,
      hasContent: !!document.content,
    });
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

    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 5000); // 5 second timeout
    
    let seedResponse;
    try {
      seedResponse = await fetch(seedUrl, {
        headers: { Accept: 'application/json' },
        signal: controller1.signal,
      });
      clearTimeout(timeoutId1);
    } catch (fetchError: any) {
      clearTimeout(timeoutId1);
      if (fetchError.name === 'AbortError') {
        console.warn('OpenAlex API timeout while fetching seed work');
      } else {
        console.warn('Error fetching seed work:', fetchError);
      }
      return [];
    }

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

    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000); // 5 second timeout
    
    let response;
    try {
      response = await fetch(worksUrl, {
        headers: { Accept: 'application/json' },
        signal: controller2.signal,
      });
      clearTimeout(timeoutId2);
    } catch (fetchError: any) {
      clearTimeout(timeoutId2);
      if (fetchError.name === 'AbortError') {
        console.warn('OpenAlex API timeout while fetching related works');
      } else {
        console.warn('Error fetching related works:', fetchError);
      }
      return [];
    }

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
  } catch (error: any) {
    const errorCode = error.code || error.name || 'GET_RELATED_WORKS_ERROR';
    console.error('Error in getRelatedWorks:', {
      errorCode,
      errorMessage: error.message,
      workId,
      isTimeout: error.name === 'AbortError',
    });
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    let response;
    try {
      response = await fetch(worksUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.warn('OpenAlex API timeout while fetching cited by papers');
      } else {
        console.warn('Error fetching cited by papers:', fetchError);
      }
      return [];
    }

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
  } catch (error: any) {
    const errorCode = error.code || error.name || 'GET_CITED_BY_ERROR';
    console.error('Error in getCitedBy:', {
      errorCode,
      errorMessage: error.message,
      workId,
      isTimeout: error.name === 'AbortError',
    });
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
  try {
    // Get openalex_ids to check for pre-computed embeddings
    const openalexIds = recommendations.map(rec => rec.openalex_id).filter(Boolean);
    
    // Fetch pre-computed embeddings for these papers (from any existing record)
    let embeddingMap = new Map<string, string>();
    if (openalexIds.length > 0) {
      try {
        const { data: existingEmbeddings, error: embeddingError } = await supabase
          .from('paper_recommendations')
          .select('openalex_id, embedding, precomputed_at')
          .in('openalex_id', openalexIds)
          .not('embedding', 'is', null)
          .limit(openalexIds.length);

        if (embeddingError) {
          console.warn('Error fetching existing embeddings for cache:', {
            errorCode: embeddingError.code || 'EMBEDDING_FETCH_ERROR',
            errorMessage: embeddingError.message,
          });
        } else if (existingEmbeddings) {
          existingEmbeddings.forEach(rec => {
            if (rec.embedding && rec.openalex_id) {
              embeddingMap.set(rec.openalex_id, rec.embedding);
            }
          });
        }
      } catch (error: any) {
        console.warn('Error fetching embeddings in cacheRecommendations:', {
          errorCode: error.code || 'EMBEDDING_FETCH_EXCEPTION',
          errorMessage: error.message,
        });
        // Continue without embeddings
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
      try {
        const { error: upsertError } = await supabase.from('paper_recommendations').upsert(inserts, {
          onConflict: 'user_id,openalex_id,source_document_id',
          ignoreDuplicates: false,
        });

        if (upsertError) {
          console.warn('Error upserting recommendations to cache:', {
            errorCode: upsertError.code || 'UPSERT_ERROR',
            errorMessage: upsertError.message,
            insertsCount: inserts.length,
          });
        }
      } catch (error: any) {
        console.warn('Error in cache upsert operation:', {
          errorCode: error.code || 'CACHE_UPSERT_ERROR',
          errorMessage: error.message,
        });
        // Don't throw - caching is non-critical
      }
    }
  } catch (error: any) {
    console.error('Error in cacheRecommendations:', {
      errorCode: error.code || 'CACHE_RECOMMENDATIONS_ERROR',
      errorMessage: error.message,
      userId,
      sourceDocumentId,
      recommendationsCount: recommendations.length,
    });
    // Don't throw - caching is non-critical, function should continue
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
