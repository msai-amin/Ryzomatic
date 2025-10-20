import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GPT5NanoService } from '../../lib/gpt5nano';
import { OCR_LIMITS } from '../../src/utils/ocrUtils';
import { Readable } from 'stream';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Convert S3 stream to buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Consolidated OCR Endpoint
 * POST /api/documents/ocr - Process OCR
 * GET /api/documents/ocr?documentId=xxx - Get OCR status
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle GET request for OCR status
  if (req.method === 'GET') {
    try {
      const { documentId } = req.query;

      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'Document ID is required' });
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

      // Get document with OCR status
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, ocr_status, ocr_metadata, content')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      return res.status(200).json({
        documentId: document.id,
        ocrStatus: document.ocr_status,
        ocrMetadata: document.ocr_metadata,
        content: document.ocr_status === 'completed' ? document.content : undefined,
      });

    } catch (error: any) {
      console.error('OCR status check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle POST request for OCR processing
  if (req.method === 'POST') {
    try {
      const { documentId, s3Key, pageCount, options = {} } = req.body;

      // Validate required fields
      if (!documentId || !s3Key || !pageCount) {
        return res.status(400).json({ 
          error: 'Missing required fields: documentId, s3Key, pageCount' 
        });
      }

      // 1. Authenticate user
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // 2. Get user profile for tier and credits
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tier, credits, ocr_count_monthly, ocr_last_reset')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // 3. Check if monthly reset is needed
      if (GPT5NanoService.needsMonthlyReset(new Date(profile.ocr_last_reset))) {
        await supabase
          .from('profiles')
          .update({ 
            ocr_count_monthly: 0, 
            ocr_last_reset: new Date().toISOString() 
          })
          .eq('id', user.id);
        
        profile.ocr_count_monthly = 0;
      }

      // 4. Check OCR limits for user tier
      const canOCR = GPT5NanoService.canPerformOCR(
        profile.ocr_count_monthly,
        profile.tier,
        pageCount
      );

      if (!canOCR.allowed) {
        return res.status(403).json({ 
          error: 'OCR limit reached',
          reason: canOCR.reason,
          currentCount: profile.ocr_count_monthly,
          limit: OCR_LIMITS[profile.tier as keyof typeof OCR_LIMITS]?.monthlyOCR || 5,
        });
      }

      // 5. Calculate credit cost
      const creditsNeeded = GPT5NanoService.calculateOCRCredits(pageCount, profile.tier);

      // Check if user has enough credits (enterprise tier doesn't need credits)
      if (profile.tier !== 'enterprise' && profile.credits < creditsNeeded) {
        return res.status(403).json({ 
          error: 'Insufficient credits',
          required: creditsNeeded,
          available: profile.credits,
        });
      }

      // 6. Verify document ownership
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, s3_key, file_name')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !document || document.s3_key !== s3Key) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }

      // 7. Update document status to 'processing'
      await supabase
        .from('documents')
        .update({ 
          ocr_status: 'processing',
          ocr_metadata: { 
            startedAt: new Date().toISOString(),
            pageCount 
          }
        })
        .eq('id', documentId);

      // 8. Download PDF from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
      });

      const s3Response = await s3Client.send(getObjectCommand);
      
      if (!s3Response.Body) {
        throw new Error('Failed to download PDF from S3');
      }

      const pdfBuffer = await streamToBuffer(s3Response.Body as Readable);

      // 9. Perform OCR using GPT-5 Nano
      const ocrResult = await GPT5NanoService.ocrDocument(
        pdfBuffer,
        pageCount,
        options
      );

      if (!ocrResult.success) {
        // OCR failed - update status and refund credits if deducted
        await supabase
          .from('documents')
          .update({ 
            ocr_status: 'failed',
            ocr_metadata: { 
              error: ocrResult.error,
              failedAt: new Date().toISOString(),
              canRetry: true
            }
          })
          .eq('id', documentId);

        // Refund credits if this was a paid tier (not enterprise)
        if (profile.tier !== 'enterprise' && creditsNeeded > 0) {
          console.log(`Refunding ${creditsNeeded} credits to user ${user.id} due to OCR failure`);
          
          // Note: Credits weren't deducted yet since we do it after success
          // But if we change the flow, this is where we'd refund
        }

        return res.status(500).json({ 
          error: 'OCR processing failed',
          details: ocrResult.error,
          canRetry: true,
          creditsRefunded: 0, // We deduct after success, so nothing to refund
        });
      }

      // 10. Update document with OCR results
      await supabase
        .from('documents')
        .update({ 
          content: ocrResult.extractedText,
          ocr_status: 'completed',
          ocr_metadata: {
            completedAt: new Date().toISOString(),
            tokensUsed: ocrResult.metadata.tokensUsed,
            processingTime: ocrResult.metadata.processingTime,
            confidence: ocrResult.metadata.confidence,
            pagesProcessed: ocrResult.metadata.pagesProcessed,
          }
        })
        .eq('id', documentId);

      // 11. Deduct credits (unless enterprise)
      if (profile.tier !== 'enterprise') {
        await supabase
          .from('profiles')
          .update({ 
            credits: profile.credits - creditsNeeded,
            ocr_count_monthly: profile.ocr_count_monthly + 1,
          })
          .eq('id', user.id);
      } else {
        // Just increment count for enterprise
        await supabase
          .from('profiles')
          .update({ 
            ocr_count_monthly: profile.ocr_count_monthly + 1,
          })
          .eq('id', user.id);
      }

      // 12. Track usage
      await supabase.from('usage_records').insert({
        user_id: user.id,
        action_type: 'ocr_processing',
        credits_used: creditsNeeded,
        metadata: {
          document_id: documentId,
          page_count: pageCount,
          tokens_used: ocrResult.metadata.tokensUsed,
          processing_time: ocrResult.metadata.processingTime,
          tier: profile.tier,
        },
      });

      // 13. Return success response
      return res.status(200).json({
        success: true,
        extractedText: ocrResult.extractedText,
        pageTexts: ocrResult.pageTexts,
        metadata: {
          ...ocrResult.metadata,
          creditsRemaining: profile.tier === 'enterprise' 
            ? 'unlimited' 
            : profile.credits - creditsNeeded,
          ocrCountRemaining: OCR_LIMITS[profile.tier as keyof typeof OCR_LIMITS].monthlyOCR 
            - profile.ocr_count_monthly - 1,
        },
      });

    } catch (error: any) {
      console.error('OCR endpoint error:', error);
      
      // Try to update document status to failed with retry option
      if (req.body?.documentId) {
        try {
          await supabase
            .from('documents')
            .update({ 
              ocr_status: 'failed',
              ocr_metadata: { 
                error: error.message,
                failedAt: new Date().toISOString(),
                canRetry: true,
                errorType: error.code || 'UNKNOWN_ERROR'
              }
            })
            .eq('id', req.body.documentId);
        } catch (updateError) {
          console.error('Failed to update document status:', updateError);
        }
      }

      // Determine if error is retryable
      const retryableErrors = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'rate_limit_exceeded'];
      const canRetry = retryableErrors.some(code => error.code?.includes(code) || error.message?.includes(code));

      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message,
        canRetry,
        errorCode: error.code || 'UNKNOWN_ERROR',
      });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}