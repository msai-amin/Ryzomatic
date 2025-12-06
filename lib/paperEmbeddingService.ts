import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';
import { openAlexPopularPaperService, OpenAlexPaper } from './openAlexPopularPaperService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PrecomputeProgress {
  total: number;
  processed: number;
  failed: number;
  percentage: number;
  currentPaper?: string;
}

export class PaperEmbeddingService {
  private readonly DEFAULT_BATCH_SIZE = 100;
  // Rate limits: Check if using paid tier (higher limits) or free tier
  // Paid tier: 100 req/min, 30K tokens/min, 1,000 req/day (standard)
  // Free tier: 15 req/min, 1,500 req/day
  private readonly MAX_CONCURRENT = this.isPaidTier() ? 10 : 5; // Paid: 10 (100 req/min), Free: 5
  private readonly REQUEST_DELAY_MS = this.isPaidTier() ? 600 : 5000; // Paid: 600ms (100 req/min), Free: 5s (15 req/min)
  private readonly DAILY_LIMIT = this.isPaidTier() ? 1000 : 1500; // Paid: 1,000 req/day (API limit), Free: 1,500
  private lastRequestTime = 0;

  /**
   * Check if using paid Gemini API tier (has higher rate limits)
   * Paid tiers typically have much higher quotas
   */
  private isPaidTier(): boolean {
    // Check environment variable or API key characteristics
    // For now, assume paid tier if we have the key (user can override)
    // You can set GEMINI_TIER=paid in env to force paid tier settings
    return process.env.GEMINI_TIER === 'paid' || process.env.GEMINI_TIER === 'pro';
  }

  /**
   * Generate embedding for a single paper
   */
  async generateEmbeddingForPaper(openalexId: string): Promise<boolean> {
    try {
      // Fetch paper from OpenAlex
      const paper = await openAlexPopularPaperService.fetchPaperById(openalexId);
      if (!paper) {
        console.warn(`Paper not found: ${openalexId}`);
        return false;
      }

      // Create text representation
      const abstract = openAlexPopularPaperService.reconstructAbstract(paper.abstract_inverted_index);
      let text = `${paper.title} ${abstract || ''}`.trim();

      if (!text || text.length < 10) {
        console.warn(`Paper ${openalexId} has insufficient text for embedding`);
        return false;
      }

      // Sanitize text: remove special characters that might cause API errors
      // Limit length to 2000 characters to avoid token limit issues
      // Gemini embedding API has limits, so we'll use title + first part of abstract
      text = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Replace non-ASCII with space
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // If text is too long, prioritize title and truncate abstract
      if (text.length > 2000) {
        const titlePart = paper.title.substring(0, 200);
        const abstractPart = (abstract || '').substring(0, 1800);
        text = `${titlePart} ${abstractPart}`.trim();
      }

      if (text.length < 10) {
        console.warn(`Paper ${openalexId} has insufficient text after sanitization`);
        return false;
      }

      // Generate embedding using Gemini API directly (server-side)
      const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      // Rate limiting: ensure we don't exceed free tier limits
      // Free tier typically: 15 requests/minute, 1,500 requests/day
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
        const waitTime = this.REQUEST_DELAY_MS - timeSinceLastRequest;
        // Show waiting indicator
        process.stdout.write(`\r⏳ Rate limiting: waiting ${Math.ceil(waitTime/1000)}s...     `);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      this.lastRequestTime = Date.now();

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      
      // Pass text directly as string (not in object with content property)
      // The API expects the text as the first parameter
      const result = await model.embedContent(text, {
        outputDimensionality: 768
      } as any);
      
      const embedding = result.embedding.values;
      const embeddingString = embeddingService.formatForPgVector(embedding);

      // Store in database
      // Update ALL existing paper_recommendations entries for this paper
      // This ensures embeddings are available for all users who have this paper recommended
      const { data: existing, error: selectError } = await supabase
        .from('paper_recommendations')
        .select('id, user_id')
        .eq('openalex_id', openalexId);

      if (selectError) throw selectError;

      if (existing && existing.length > 0) {
        // Update all existing entries for this paper
        const { error: updateError } = await supabase
          .from('paper_recommendations')
          .update({
            embedding: embeddingString,
            precomputed_at: new Date().toISOString(),
            // Also update paper metadata if it's missing
            title: paper.title,
            authors: paper.authorships || [],
            abstract_inverted_index: paper.abstract_inverted_index || null,
            publication_year: paper.publication_year,
            cited_by_count: paper.cited_by_count || 0,
            open_access_url: paper.open_access?.oa_url,
            doi: paper.doi,
            venue: paper.primary_location?.source?.display_name,
            topics: paper.topics || [],
          })
          .eq('openalex_id', openalexId);

        if (updateError) throw updateError;
      } else {
        // No existing records - this paper hasn't been recommended yet
        // We'll store the embedding in popular_papers table instead
        // When a user gets this paper recommended, the embedding will be copied over
        console.log(`No existing records for ${openalexId}, embedding stored in popular_papers only`);
      }

      // Update popular_papers table to mark as precomputed
      // Note: We don't store the actual embedding here, only the flag
      // The embedding is stored in paper_recommendations when papers are recommended
      await supabase
        .from('popular_papers')
        .update({
          precomputed: true,
          precomputed_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        })
        .eq('openalex_id', openalexId);

      // Show success indicator
      process.stdout.write(`\r✅ Generated embedding for: ${openalexId.split('/').pop()}     `);
      
      return true;
    } catch (error: any) {
      // Show error indicator (briefly)
      const errorMsg = error.message?.substring(0, 30) || 'Error';
      process.stdout.write(`\r❌ Failed: ${openalexId.split('/').pop()} (${errorMsg}...)     `);
      // Don't spam console with full errors, just log to file if needed
      return false;
    }
  }

  /**
   * Batch pre-compute embeddings for multiple papers
   */
  async batchPrecompute(
    paperIds: string[],
    batchSize: number = this.DEFAULT_BATCH_SIZE,
    onProgress?: (progress: PrecomputeProgress) => void
  ): Promise<PrecomputeProgress> {
    const total = paperIds.length;
    let processed = 0;
    let failed = 0;

    console.log(`\n🚀 Starting batch pre-computation for ${total} papers (batch size: ${batchSize})...`);
    console.log(`📊 Rate limit: ${Math.round(60000 / this.REQUEST_DELAY_MS)} requests/minute`);
    console.log(`⏱️  Estimated time: ~${Math.ceil(total * this.REQUEST_DELAY_MS / 1000 / 60)} minutes\n`);

    // Process in batches
    for (let i = 0; i < paperIds.length; i += batchSize) {
      const batch = paperIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(total / batchSize);
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} papers)...`);

      // Process batch with concurrency limit
      const batchResults = await this.processBatchWithConcurrency(
        batch,
        this.MAX_CONCURRENT
      );

      // Count results
      batchResults.forEach(success => {
        if (success) {
          processed++;
        } else {
          failed++;
        }
      });

      // Report progress
      const progress: PrecomputeProgress = {
        total,
        processed,
        failed,
        percentage: Math.round((processed / total) * 100),
        currentPaper: batch[batch.length - 1],
      };

      if (onProgress) {
        onProgress(progress);
      }

      // Display progress bar
      this.displayProgressBar(processed, total, failed, progress.percentage);

      // Delay between batches to respect rate limits (free tier)
      if (i + batchSize < paperIds.length) {
        await this.delay(this.REQUEST_DELAY_MS);
      }
    }

    const finalProgress: PrecomputeProgress = {
      total,
      processed,
      failed,
      percentage: Math.round((processed / total) * 100),
    };

    // Final progress bar
    this.displayProgressBar(processed, total, failed, Math.round((processed / total) * 100));
    console.log(`\n✅ Batch pre-computation complete: ${processed}/${total} successful, ${failed} failed`);
    return finalProgress;
  }

  /**
   * Process batch with concurrency limit
   */
  private async processBatchWithConcurrency(
    paperIds: string[],
    maxConcurrent: number
  ): Promise<boolean[]> {
    const results: boolean[] = [];
    const executing: Promise<void>[] = [];

    for (let index = 0; index < paperIds.length; index++) {
      const paperId = paperIds[index];
      const promise = this.generateEmbeddingForPaper(paperId)
        .then(success => {
          results.push(success);
        })
        .catch(() => {
          results.push(false);
        });

      executing.push(promise);

      // Limit concurrency (reduced for free tier)
      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
      
      // Additional delay between requests for free tier
      if (index < paperIds.length - 1 && index % maxConcurrent === 0) {
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY_MS));
      }
    }

    // Wait for remaining promises
    await Promise.all(executing);

    return results;
  }

  /**
   * Pre-compute embeddings for popular papers
   * Main entry point for pre-computation
   */
  async precomputePaperEmbeddings(
    paperIds: string[],
    batchSize: number = this.DEFAULT_BATCH_SIZE
  ): Promise<PrecomputeProgress> {
    return this.batchPrecompute(paperIds, batchSize);
  }

  /**
   * Pre-compute embeddings from popular_papers table
   */
  async precomputeFromPopularPapers(
    limit?: number,
    batchSize: number = this.DEFAULT_BATCH_SIZE,
    respectDailyLimit: boolean = true
  ): Promise<PrecomputeProgress> {
    try {
      const { data, error } = await supabase
        .from('popular_papers')
        .select('openalex_id')
        .eq('precomputed', false)
        .order('popularity_score', { ascending: false })
        .limit(limit || 10000);

      if (error) throw error;
      if (!data || data.length === 0) {
        console.log('No papers to pre-compute');
        return {
          total: 0,
          processed: 0,
          failed: 0,
          percentage: 100,
        };
      }

      const paperIds = data.map(p => p.openalex_id);
      
      // For free tier, limit to daily quota if enabled
      if (respectDailyLimit && paperIds.length > this.DAILY_LIMIT) {
        console.log(`⚠️  Free tier daily limit: ${this.DAILY_LIMIT} requests`);
        console.log(`   Limiting to first ${this.DAILY_LIMIT} papers`);
        console.log(`   Remaining papers will be processed in subsequent runs`);
        console.log(`   Estimated time: ${Math.ceil(this.DAILY_LIMIT * this.REQUEST_DELAY_MS / 1000 / 60)} minutes`);
        return this.batchPrecompute(paperIds.slice(0, this.DAILY_LIMIT), batchSize);
      }
      
      return this.batchPrecompute(paperIds, batchSize);
    } catch (error) {
      console.error('Error pre-computing from popular papers:', error);
      throw error;
    }
  }

  /**
   * Check if paper has pre-computed embedding
   */
  async hasPrecomputedEmbedding(openalexId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('paper_recommendations')
        .select('embedding')
        .eq('openalex_id', openalexId)
        .not('embedding', 'is', null)
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0) || false;
    } catch (error) {
      console.error(`Error checking embedding for ${openalexId}:`, error);
      return false;
    }
  }

  /**
   * Get embedding for a paper (from pre-computed or generate on-demand)
   */
  async getEmbedding(openalexId: string, generateIfMissing: boolean = false): Promise<number[] | null> {
    try {
      // Check for pre-computed embedding (any record for this paper will have the same embedding)
      const { data, error } = await supabase
        .from('paper_recommendations')
        .select('embedding')
        .eq('openalex_id', openalexId)
        .not('embedding', 'is', null)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0 && data[0].embedding) {
        try {
          return JSON.parse(data[0].embedding);
        } catch (parseError) {
          console.warn(`Failed to parse embedding for ${openalexId}:`, parseError);
        }
      }

      // Generate on-demand if requested
      if (generateIfMissing) {
        const success = await this.generateEmbeddingForPaper(openalexId);
        if (success) {
          // Recursively fetch the newly generated embedding
          return this.getEmbedding(openalexId, false);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting embedding for ${openalexId}:`, error);
      return null;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Display a progress bar for embedding generation
   */
  private displayProgressBar(processed: number, total: number, failed: number, percentage: number): void {
    const barWidth = 50;
    const filled = Math.round((percentage / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    // Calculate ETA (rough estimate)
    const successRate = processed > 0 ? (processed - failed) / processed : 1;
    const avgTimePerPaper = 5; // seconds (rough estimate with rate limiting)
    const remaining = total - processed;
    const estimatedSeconds = remaining * avgTimePerPaper;
    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    const eta = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // Clear previous line and print progress
    process.stdout.write(`\r📊 Progress: [${bar}] ${percentage}% | ${processed}/${total} processed | ${failed} failed | ETA: ${eta}     `);
    
    // If complete, add newline
    if (processed >= total) {
      process.stdout.write('\n');
    }
  }
}

export const paperEmbeddingService = new PaperEmbeddingService();

