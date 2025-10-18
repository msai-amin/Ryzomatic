import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GPT5NanoService, OCR_LIMITS } from '../../lib/gpt5nano';
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
 * OCR Processing Endpoint
 * POST /api/documents/ocr
 * 
 * Body: {
 *   documentId: string,
 *   s3Key: string,
 *   pageCount: number,
 *   options?: { extractTables, preserveFormatting }
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
            failedAt: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      return res.status(500).json({ 
        error: 'OCR processing failed',
        details: ocrResult.error,
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
    
    // Try to update document status to failed
    if (req.body?.documentId) {
      try {
        await supabase
          .from('documents')
          .update({ 
            ocr_status: 'failed',
            ocr_metadata: { 
              error: error.message,
              failedAt: new Date().toISOString()
            }
          })
          .eq('id', req.body.documentId);
      } catch (updateError) {
        console.error('Failed to update document status:', updateError);
      }
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
    });
  }
}

