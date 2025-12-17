/**
 * Consolidated Documents API
 * Handles all document-related operations in a single endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { uploadFile, generateDocumentKey } from '../../lib/s3.js';
import { GPT5NanoService, OCR_LIMITS } from '../../lib/gpt5nano.js';
import { geminiService } from '../../lib/gemini.js';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter.js';
import formidable from 'formidable';
import fs from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';

// Disable body parser for file uploads when needed
export const config = {
  api: {
    bodyParser: false,
  },
};

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

// Tier limits
const TIER_LIMITS = {
  free: { documents: 50, maxFileSize: 50 * 1024 * 1024 },
  custom: { documents: Infinity, maxFileSize: 500 * 1024 * 1024 },
};

/**
 * Main handler - routes to appropriate operation based on action
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.body?.action || req.query.action) as string;

  // Route based on action
  switch (action) {
    case 'upload':
      return handleUpload(req, res);
    case 'ocr-process':
      return handleOCRProcess(req, res);
    case 'ocr-status':
      return handleOCRStatus(req, res);
    default:
      // Handle relationship actions and document description actions
      return handleRelationshipActions(req, res);
  }
}

/**
 * Handle document upload
 */
async function handleUpload(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'upload');
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    
    // Set rate limit headers in response
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        limit: rateLimitResult.limit,
        remaining: 0,
        reset_at: rateLimitResult.resetAt?.toISOString(),
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check document count limit
    // Using user_books instead of documents (consolidated in migration 026)
    const { count: documentCount } = await supabase
      .from('user_books')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const tierLimit = TIER_LIMITS[profile.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    if ((documentCount || 0) >= tierLimit.documents) {
      return res.status(403).json({
        error: 'Document limit reached',
        limit: tierLimit.documents,
        current: documentCount,
        tier: profile.tier,
      });
    }

    // Parse multipart form data
    const form = formidable({
      maxFileSize: tierLimit.maxFileSize,
      maxFiles: 1,
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => {
        form.parse(req as any, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      }
    );

    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({
        error: 'Unsupported file type',
        supportedTypes: allowedTypes,
        receivedType: file.mimetype,
      });
    }

    // Extract text content
    const mimeType = file.mimetype || 'text/plain';
    const content = await extractTextContent(file.filepath, mimeType);

    const normalizedFileType: 'pdf' | 'text' = (() => {
      switch (mimeType) {
        case 'application/pdf':
          return 'pdf';
        default:
          return 'text';
      }
    })();

    // Check content moderation
    if (content) {
      const moderation = await geminiService.moderateContent(content);
      if (!moderation.safe) {
        return res.status(400).json({
          error: 'Content failed moderation',
          reason: moderation.reason,
        });
      }
    }

    // Upload file to S3
    const fileBuffer = await fs.readFile(file.filepath);
    const s3Key = generateDocumentKey(user.id, file.originalFilename || 'document');
    
    await uploadFile({
      key: s3Key,
      body: fileBuffer,
      contentType: file.mimetype || 'application/octet-stream',
      metadata: {
        userId: user.id,
        originalName: file.originalFilename || 'unknown',
      },
    });

    // Extract metadata using Gemini
    let metadata = {};
    if (content && content.length > 100) {
      try {
        metadata = await geminiService.extractMetadata(content, profile.tier);
      } catch (error) {
        console.error('Metadata extraction failed:', error);
      }
    }

    // Create document record (using user_books table after consolidation)
    const title = (fields.title?.[0] as string) || 
                  (metadata as any).title || 
                  file.originalFilename || 
                  'Untitled Document';

    const { data: document, error: docError } = await supabase
      .from('user_books')
      .insert({
        user_id: user.id,
        title,
        file_name: file.originalFilename || 'unknown',
        file_size_bytes: file.size,
        file_type: normalizedFileType,
        s3_key: s3Key,
        content,
        embedding_status: 'pending',
        custom_metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          originalName: file.originalFilename,
        },
      })
      .select()
      .single();

    if (docError) {
      console.error('Database error:', docError);
      return res.status(500).json({ error: 'Failed to create document record' });
    }

    // Track usage
    await supabase.from('usage_records').insert({
      user_id: user.id,
      action_type: 'document_upload',
      credits_used: 0,
      metadata: {
        documentId: document.id,
        fileSize: file.size,
        fileType: normalizedFileType,
      },
    });

    // Generate document description (async)
    if (content && content.length > 100) {
      getDocumentDescriptionService()
        .then(service => {
          if (service) {
            return service.generateDescription(document.id, user.id, content);
          }
        })
        .catch(err => console.error('Error generating description:', err));
    }

    return res.status(201).json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        fileName: document.file_name,
        fileSize: document.file_size,
        fileType: document.file_type,
        embeddingStatus: document.embedding_status,
        metadata: document.metadata,
        createdAt: document.created_at,
      },
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle OCR processing
 */
async function handleOCRProcess(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { documentId, s3Key, pageCount, options = {} } = req.body;

    if (!documentId || !s3Key || !pageCount) {
      return res.status(400).json({ 
        error: 'Missing required fields: documentId, s3Key, pageCount' 
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, credits, ocr_count_monthly, ocr_last_reset')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check OCR limits
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

    // Calculate credit cost
    const creditsNeeded = GPT5NanoService.calculateOCRCredits(pageCount, profile.tier);

    if (profile.tier !== 'custom' && profile.credits < creditsNeeded) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        required: creditsNeeded,
        available: profile.credits,
      });
    }

    // Verify document ownership (using user_books after consolidation)
    const { data: document, error: docError } = await supabase
      .from('user_books')
      .select('id, s3_key, file_name')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document || document.s3_key !== s3Key) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Update document status (using user_books after consolidation)
    await supabase
      .from('user_books')
      .update({ 
        ocr_status: 'processing',
        ocr_metadata: { 
          startedAt: new Date().toISOString(),
          pageCount 
        }
      })
      .eq('id', documentId);

    // Download PDF from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(getObjectCommand);
    
    if (!s3Response.Body) {
      throw new Error('Failed to download PDF from S3');
    }

    const pdfBuffer = await streamToBuffer(s3Response.Body as Readable);

    // Perform OCR using Gemini 2.5 flash-lite (preferred). Fallback to GPT5 if needed.
    let ocrResult = await geminiService.ocrDocument(pdfBuffer, pageCount, options, profile.tier);
    if (!ocrResult.success) {
      console.warn('Gemini OCR failed, falling back to GPT5NanoService:', ocrResult.error);
      ocrResult = await GPT5NanoService.ocrDocument(pdfBuffer, pageCount, options);
    }

    if (!ocrResult.success) {
      await supabase
        .from('user_books')
        .update({ 
          ocr_status: 'failed',
          ocr_metadata: { 
            error: ocrResult.error,
            failedAt: new Date().toISOString(),
            canRetry: true
          }
        })
        .eq('id', documentId);

      return res.status(500).json({ 
        error: 'OCR processing failed',
        details: ocrResult.error,
        canRetry: true,
      });
    }

    // Update document with OCR results (using user_books after consolidation)
    await supabase
      .from('user_books')
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

    // Deduct credits
    if (profile.tier !== 'custom') {
      await supabase
        .from('profiles')
        .update({ 
          credits: profile.credits - creditsNeeded,
          ocr_count_monthly: profile.ocr_count_monthly + 1,
        })
        .eq('id', user.id);
    } else {
      await supabase
        .from('profiles')
        .update({ 
          ocr_count_monthly: profile.ocr_count_monthly + 1,
        })
        .eq('id', user.id);
    }

    // Track usage
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

    return res.status(200).json({
      success: true,
      extractedText: ocrResult.extractedText,
      pageTexts: ocrResult.pageTexts,
      metadata: {
        ...ocrResult.metadata,
        creditsRemaining: profile.tier === 'custom' 
          ? 'unlimited' 
          : profile.credits - creditsNeeded,
        ocrCountRemaining: OCR_LIMITS[profile.tier as keyof typeof OCR_LIMITS].monthlyOCR 
          - profile.ocr_count_monthly - 1,
      },
    });

  } catch (error: any) {
    console.error('OCR endpoint error:', error);
    
    if (req.body?.documentId) {
      try {
        await supabase
          .from('user_books')
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

/**
 * Handle OCR status check
 */
async function handleOCRStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // For unauthenticated requests, return 401; for authenticated, return 500
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.status(500).json({ error: 'Server configuration error' });
    }

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

    // Get document (using user_books after consolidation)
    const { data: document, error: docError } = await supabase
      .from('user_books')
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

/**
 * Helper functions
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}


async function extractTextContent(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  
  if (mimeType === 'application/pdf') {
    return '[PDF content extraction pending]';
  }
  
  return '';
}

/**
 * Handle relationship actions and document description actions
 */
async function handleRelationshipActions(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const action = (req.body?.action || req.query.action) as string;
    
    // Route based on HTTP method and action
    if (req.method === 'GET') {
      return await handleRelationshipGet(req, res, action);
    } else if (req.method === 'POST') {
      return await handleRelationshipPost(req, res, action);
    } else if (req.method === 'PATCH') {
      return await handleRelationshipPatch(req, res, action);
    } else if (req.method === 'DELETE') {
      return await handleRelationshipDelete(req, res, action);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unhandled error in relationship handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage
    });
  }
}

// Optional service - loaded dynamically to avoid module loading errors
let cachedDocumentDescriptionService: any = null;

async function getDocumentDescriptionService() {
  if (cachedDocumentDescriptionService !== null) {
    return cachedDocumentDescriptionService;
  }
  
  if (cachedDocumentDescriptionService === false) {
    return null;
  }
  
  try {
    const module = await import('../../lib/documentDescriptionService');
    cachedDocumentDescriptionService = module.documentDescriptionService;
    return cachedDocumentDescriptionService;
  } catch (error) {
    cachedDocumentDescriptionService = false;
    console.warn('DocumentDescriptionService not available:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

async function handleRelationshipGet(req: VercelRequest, res: VercelResponse, action: string) {
  try {
    const { sourceDocumentId, userId, bookId } = req.query;

    // Handle document description requests
    if (action === 'getDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.getDescription(
        bookId as string,
        userId as string
      );
      return res.status(200).json({ data: description });
    }

    if (action === 'getCombinedDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.getCombinedDescription(
        bookId as string,
        userId as string
      );
      return res.status(200).json({ data: { description } });
    }

    // Original functionality: Get related documents
    if (!sourceDocumentId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const { data, error } = await supabase.rpc('get_related_documents_with_details', {
      source_doc_id: sourceDocumentId as string
    });

    if (error) {
      console.error('Error fetching related documents:', error);
      return res.status(500).json({ error: 'Failed to fetch related documents' });
    }

    return res.status(200).json({ 
      success: true, 
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Error in GET relationship handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRelationshipPost(req: VercelRequest, res: VercelResponse, action: string) {
  try {
    const { sourceDocumentId, relatedDocumentId, relationshipDescription, userId, bookId, content } = req.body;

    // Handle document description generation
    if (action === 'generateDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const description = await service.generateDescription(
        bookId,
        userId,
        content
      );
      if (!description) {
        return res.status(500).json({ error: 'Failed to generate description' });
      }
      return res.status(200).json({ data: description });
    }

    if (!sourceDocumentId || !relatedDocumentId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Authenticate user
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    let authenticatedSupabase = supabase;
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
      authenticatedSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      if (token) {
        const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser(token);
        if (authError || !user || user.id !== userId) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
      }
    } else if (token && process.env.SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
      authenticatedSupabase = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      });
      
      const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser(token);
      if (authError || !user || user.id !== userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!authenticatedSupabase) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    const { data: existing, error: checkError } = await authenticatedSupabase
      .from('document_relationships')
      .select('id')
      .eq('source_document_id', sourceDocumentId)
      .eq('related_document_id', relatedDocumentId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing relationship:', checkError);
      return res.status(500).json({ error: 'Failed to check existing relationship' });
    }

    if (existing) {
      return res.status(409).json({ error: 'Relationship already exists' });
    }

    const insertData = {
      user_id: userId,
      source_document_id: sourceDocumentId,
      related_document_id: relatedDocumentId,
      relationship_description: relationshipDescription,
      relevance_calculation_status: 'pending'
    };
    
    const { data: relationship, error } = await authenticatedSupabase
      .from('document_relationships')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating relationship:', error);
      return res.status(500).json({ 
        error: 'Failed to create relationship', 
        details: error.message,
        code: error.code
      });
    }

    return res.status(201).json({ 
      success: true, 
      data: relationship,
      message: 'Relationship created successfully. Relevance calculation will start in background.'
    });

  } catch (error) {
    console.error('Error in POST relationship handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRelationshipPatch(req: VercelRequest, res: VercelResponse, action: string) {
  try {
    const { relationshipId, bookId, userId } = req.query;

    // Handle document description update
    if (action === 'updateDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const body = req.body as any;
      const description = await service.updateDescription(
        bookId as string,
        userId as string,
        body.userDescription
      );
      if (!description) {
        return res.status(500).json({ error: 'Failed to update description' });
      }
      return res.status(200).json({ data: description });
    }

    // Original functionality: Update relationship
    const { relationshipDescription, relevancePercentage, aiGeneratedDescription, relevanceCalculationStatus } = req.body;

    if (!relationshipId) {
      return res.status(400).json({ error: 'Missing relationship ID' });
    }

    const updateData: any = {};
    if (relationshipDescription !== undefined) updateData.relationship_description = relationshipDescription;
    if (relevancePercentage !== undefined) updateData.relevance_percentage = relevancePercentage;
    if (aiGeneratedDescription !== undefined) updateData.ai_generated_description = aiGeneratedDescription;
    if (relevanceCalculationStatus !== undefined) updateData.relevance_calculation_status = relevanceCalculationStatus;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: relationship, error } = await supabase
      .from('document_relationships')
      .update(updateData)
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) {
      console.error('Error updating relationship:', error);
      return res.status(500).json({ error: 'Failed to update relationship' });
    }

    return res.status(200).json({ 
      success: true, 
      data: relationship,
      message: 'Relationship updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH relationship handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRelationshipDelete(req: VercelRequest, res: VercelResponse, action: string) {
  try {
    const { relationshipId, bookId, userId } = req.query;

    // Handle document description deletion
    if (action === 'deleteDescription' && bookId && userId) {
      const service = await getDocumentDescriptionService();
      if (!service) {
        return res.status(500).json({ error: 'Document description service not available' });
      }
      const success = await service.deleteDescription(
        bookId as string,
        userId as string
      );
      if (!success) {
        return res.status(500).json({ error: 'Failed to delete description' });
      }
      return res.status(200).json({ success: true });
    }

    // Original functionality: Delete relationship
    if (!relationshipId) {
      return res.status(400).json({ error: 'Missing relationship ID' });
    }

    const { error } = await supabase
      .from('document_relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      console.error('Error deleting relationship:', error);
      return res.status(500).json({ error: 'Failed to delete relationship' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Relationship deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE relationship handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

