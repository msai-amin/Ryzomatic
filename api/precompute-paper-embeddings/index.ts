/**
 * Pre-computation API for Paper Embeddings
 * Admin/service role endpoint to trigger embedding pre-computation
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { paperEmbeddingService } from '../../../lib/paperEmbeddingService';
import { paperPopularityService } from '../../../lib/paperPopularityService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // Authenticate - require service role or admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - token required' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    // Check if it's a service role key
    if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Service role access allowed
    } else {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  const action = (req.body?.action || req.query.action) as string;

  if (!action) {
    return res.status(400).json({
      error: 'Action parameter required',
      validActions: ['identify-popular', 'precompute', 'precompute-from-popular', 'status'],
      usage: {
        'identify-popular': 'POST /api/precompute-paper-embeddings?action=identify-popular',
        'precompute': 'POST /api/precompute-paper-embeddings?action=precompute',
        'precompute-from-popular': 'POST /api/precompute-paper-embeddings?action=precompute-from-popular',
        'status': 'GET /api/precompute-paper-embeddings?action=status',
      },
    });
  }

  try {
    switch (action) {
      case 'identify-popular':
        return handleIdentifyPopular(req, res);
      case 'precompute':
        return handlePrecompute(req, res);
      case 'precompute-from-popular':
        return handlePrecomputeFromPopular(req, res);
      case 'status':
        return handleStatus(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          validActions: ['identify-popular', 'precompute', 'precompute-from-popular', 'status'],
        });
    }
  } catch (error: any) {
    console.error('Error in pre-computation API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Identify popular papers and store in database
 */
async function handleIdentifyPopular(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.body?.limit || req.query.limit as string) || 50000;
    const email = req.body?.email || req.query.email;

    console.log(`Identifying ${limit} popular papers...`);

    // Identify popular papers
    const popularPapers = await paperPopularityService.identifyPopularPapers(limit, email);

    // Store in database
    await paperPopularityService.storePopularPapers(popularPapers);

    return res.status(200).json({
      success: true,
      papersIdentified: popularPapers.length,
      papers: popularPapers.slice(0, 10).map(p => ({
        openalex_id: p.openalex_id,
        title: p.title,
        popularity_score: p.popularity_score,
        discovery_method: p.discovery_method,
      })),
      message: `Identified ${popularPapers.length} popular papers and stored in database`,
    });
  } catch (error: any) {
    console.error('Error identifying popular papers:', error);
    return res.status(500).json({
      error: 'Failed to identify popular papers',
      message: error.message,
    });
  }
}

/**
 * Pre-compute embeddings for specific paper IDs
 */
async function handlePrecompute(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const paperIds = req.body?.paperIds || req.query.paperIds;
    const batchSize = parseInt(req.body?.batchSize || req.query.batchSize as string) || 100;

    if (!paperIds || !Array.isArray(paperIds) || paperIds.length === 0) {
      return res.status(400).json({ error: 'paperIds array required' });
    }

    console.log(`Pre-computing embeddings for ${paperIds.length} papers...`);

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('paper_embedding_jobs')
      .insert({
        job_type: 'batch_precompute',
        status: 'processing',
        papers_total: paperIds.length,
        papers_processed: 0,
        parameters: { batchSize },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
    }

    // Start pre-computation (async - don't wait for completion)
    paperEmbeddingService.batchPrecompute(paperIds, batchSize, async (progress) => {
      // Update job progress
      if (job) {
        await supabase
          .from('paper_embedding_jobs')
          .update({
            papers_processed: progress.processed,
            papers_failed: progress.failed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }).then(async (finalProgress) => {
      // Mark job as completed
      if (job) {
        await supabase
          .from('paper_embedding_jobs')
          .update({
            status: 'completed',
            papers_processed: finalProgress.processed,
            papers_failed: finalProgress.failed,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }).catch(async (error) => {
      // Mark job as failed
      if (job) {
        await supabase
          .from('paper_embedding_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    });

    return res.status(202).json({
      success: true,
      message: 'Pre-computation started',
      jobId: job?.id,
      totalPapers: paperIds.length,
      batchSize,
    });
  } catch (error: any) {
    console.error('Error starting pre-computation:', error);
    return res.status(500).json({
      error: 'Failed to start pre-computation',
      message: error.message,
    });
  }
}

/**
 * Pre-compute embeddings from popular_papers table
 */
async function handlePrecomputeFromPopular(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.body?.limit || req.query.limit as string) || 10000;
    const batchSize = parseInt(req.body?.batchSize || req.query.batchSize as string) || 100;

    console.log(`Pre-computing embeddings from popular papers (limit: ${limit})...`);

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('paper_embedding_jobs')
      .insert({
        job_type: 'popular_papers_update',
        status: 'processing',
        papers_total: limit,
        papers_processed: 0,
        parameters: { limit, batchSize },
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
    }

    // Start pre-computation (async)
    paperEmbeddingService.precomputeFromPopularPapers(limit, batchSize).then(async (finalProgress) => {
      if (job) {
        await supabase
          .from('paper_embedding_jobs')
          .update({
            status: 'completed',
            papers_processed: finalProgress.processed,
            papers_failed: finalProgress.failed,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }).catch(async (error) => {
      if (job) {
        await supabase
          .from('paper_embedding_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    });

    return res.status(202).json({
      success: true,
      message: 'Pre-computation from popular papers started',
      jobId: job?.id,
      limit,
      batchSize,
    });
  } catch (error: any) {
    console.error('Error starting pre-computation from popular papers:', error);
    return res.status(500).json({
      error: 'Failed to start pre-computation',
      message: error.message,
    });
  }
}

/**
 * Get status of pre-computation jobs
 */
async function handleStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get recent jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('paper_embedding_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) throw jobsError;

    // Get coverage stats
    const { data: stats, error: statsError } = await supabase.rpc('get_embedding_coverage_stats');

    if (statsError) throw statsError;

    return res.status(200).json({
      success: true,
      recentJobs: jobs || [],
      coverageStats: stats || null,
    });
  } catch (error: any) {
    console.error('Error getting status:', error);
    return res.status(500).json({
      error: 'Failed to get status',
      message: error.message,
    });
  }
}

