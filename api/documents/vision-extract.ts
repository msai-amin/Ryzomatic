/**
 * Vision Extraction API Endpoint
 * 
 * Server-side endpoint for processing PDF pages with Gemini Vision fallback
 * Used when PDF.js extraction produces poor quality results
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { extractPagesWithVision, estimateVisionCost, isVisionConfigured } from '../../lib/geminiVision';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Vision extraction limits by tier
const VISION_LIMITS = {
  free: { monthly: 20, maxPages: 10 },
  pro: { monthly: 200, maxPages: 30 },
  premium: { monthly: 1000, maxPages: 50 },
  enterprise: { monthly: -1, maxPages: -1 } // unlimited
};

// Credit cost per vision page
const CREDITS_PER_PAGE = 0.1;

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Check and auto-reset monthly vision counters if needed
 */
async function checkAndResetVisionCounters(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('vision_last_reset')
    .eq('id', userId)
    .single();

  if (profile) {
    const lastReset = new Date(profile.vision_last_reset);
    const now = new Date();
    const monthsSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsSinceReset >= 1) {
      await supabase
        .from('profiles')
        .update({
          vision_pages_monthly: 0,
          vision_last_reset: now.toISOString()
        })
        .eq('id', userId);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verify Gemini Vision is configured
    if (!isVisionConfigured()) {
      return res.status(503).json({ 
        error: 'Vision extraction service not configured',
        code: 'VISION_NOT_CONFIGURED'
      });
    }

    // 2. Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 3. Parse request body
    const { documentId, pageNumbers, s3Key } = req.body as {
      documentId: string;
      pageNumbers: number[];
      s3Key: string;
    };

    if (!documentId || !pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid required fields: documentId, pageNumbers' 
      });
    }

    if (!s3Key) {
      return res.status(400).json({ error: 'Missing s3Key' });
    }

    // 4. Get user profile and tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, credits, vision_pages_monthly')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const tier = profile.tier || 'free';
    const limits = VISION_LIMITS[tier as keyof typeof VISION_LIMITS] || VISION_LIMITS.free;

    // 5. Auto-reset monthly counters if needed
    await checkAndResetVisionCounters(user.id);

    // Refresh profile after potential reset
    const { data: refreshedProfile } = await supabase
      .from('profiles')
      .select('vision_pages_monthly, credits')
      .eq('id', user.id)
      .single();

    const currentVisionCount = refreshedProfile?.vision_pages_monthly || 0;
    const currentCredits = refreshedProfile?.credits || 0;

    // 6. Check vision limits
    if (limits.monthly !== -1 && currentVisionCount + pageNumbers.length > limits.monthly) {
      return res.status(403).json({ 
        error: 'Monthly vision extraction limit exceeded',
        code: 'VISION_LIMIT_EXCEEDED',
        current: currentVisionCount,
        limit: limits.monthly,
        tier
      });
    }

    if (limits.maxPages !== -1 && pageNumbers.length > limits.maxPages) {
      return res.status(403).json({ 
        error: `Too many pages in single request. Maximum: ${limits.maxPages}`,
        code: 'TOO_MANY_PAGES',
        requested: pageNumbers.length,
        limit: limits.maxPages
      });
    }

    // 7. Check credits (enterprise tier doesn't need credits)
    const creditsNeeded = tier === 'enterprise' ? 0 : pageNumbers.length * CREDITS_PER_PAGE;
    if (tier !== 'enterprise' && currentCredits < creditsNeeded) {
      return res.status(403).json({ 
        error: 'Insufficient credits for vision extraction',
        code: 'INSUFFICIENT_CREDITS',
        required: creditsNeeded,
        available: currentCredits
      });
    }

    // 8. Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, s3_key, file_name, vision_pages')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document || document.s3_key !== s3Key) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // 9. Download PDF from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(getObjectCommand);
    
    if (!s3Response.Body) {
      throw new Error('Failed to download PDF from S3');
    }

    const pdfBuffer = await streamToBuffer(s3Response.Body as Readable);

    // 10. Render PDF pages to images
    // Note: In a serverless environment, we'd use a separate service or library
    // For now, this is a placeholder - actual implementation would use pdf-lib or similar
    const pageImages = new Map<number, string>();
    
    // TODO: Implement PDF page rendering to base64 images
    // This would typically use pdf-lib or a serverless-compatible PDF rendering service
    // For MVP, we can skip this and rely on client-side rendering + upload
    // Or use a third-party service like Cloudinary or similar
    
    // Temporary: Return error indicating feature needs additional setup
    return res.status(501).json({
      error: 'Vision extraction requires PDF rendering service setup',
      code: 'NOT_IMPLEMENTED',
      message: 'Server-side PDF rendering is not yet configured. Please ensure pdf-lib or similar is properly set up.'
    });

    // 11. Perform vision extraction (commented out until rendering is implemented)
    /*
    const extractionResults = await extractPagesWithVision(
      pageImages,
      { maxImageWidth: 1024, timeout: 30000 }
    );

    // 12. Process results
    const successfulExtractions: { [pageNumber: number]: string } = {};
    const failedPages: number[] = [];
    let totalTokensUsed = 0;

    extractionResults.forEach((result, pageNumber) => {
      if (result.success && result.extractedText) {
        successfulExtractions[pageNumber] = result.extractedText;
        totalTokensUsed += result.metadata.tokensUsed;
      } else {
        failedPages.push(pageNumber);
      }
    });

    const successCount = Object.keys(successfulExtractions).length;

    // 13. Update document with vision page tracking
    const existingVisionPages = (document.vision_pages as number[]) || [];
    const updatedVisionPages = Array.from(
      new Set([...existingVisionPages, ...pageNumbers])
    ).sort((a, b) => a - b);

    await supabase
      .from('documents')
      .update({ 
        vision_pages: updatedVisionPages,
        extraction_method: updatedVisionPages.length > 0 ? 'hybrid' : 'pdfjs'
      })
      .eq('id', documentId);

    // 14. Deduct credits and update vision counter (only for successful pages)
    if (successCount > 0 && tier !== 'enterprise') {
      const creditsToDeduct = successCount * CREDITS_PER_PAGE;
      
      await supabase
        .from('profiles')
        .update({ 
          credits: currentCredits - creditsToDeduct,
          vision_pages_monthly: currentVisionCount + successCount
        })
        .eq('id', user.id);

      // 15. Log usage
      await supabase
        .from('usage_records')
        .insert({
          user_id: user.id,
          feature: 'vision_extraction',
          credits_used: creditsToDeduct,
          metadata: {
            documentId,
            pageNumbers,
            successCount,
            failedCount: failedPages.length,
            tokensUsed: totalTokensUsed,
            estimatedCost: estimateVisionCost(successCount)
          }
        });
    } else if (successCount > 0 && tier === 'enterprise') {
      // Update counter for enterprise (no credit deduction)
      await supabase
        .from('profiles')
        .update({ 
          vision_pages_monthly: currentVisionCount + successCount
        })
        .eq('id', user.id);
    }

    // 16. Return results
    return res.status(200).json({
      success: true,
      extractedPages: successfulExtractions,
      failedPages,
      metadata: {
        successCount,
        failedCount: failedPages.length,
        tokensUsed: totalTokensUsed,
        creditsUsed: tier === 'enterprise' ? 0 : successCount * CREDITS_PER_PAGE,
        estimatedCost: estimateVisionCost(successCount)
      }
    });
    */

  } catch (error) {
    console.error('Vision extraction error:', error);
    return res.status(500).json({ 
      error: 'Vision extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

