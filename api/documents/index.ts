/**
 * Consolidated Documents API
 * Handles all document-related operations in a single endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { uploadFile, generateDocumentKey } from '../../lib/s3';
import { GPT5NanoService, OCR_LIMITS } from '../../lib/gpt5nano';
import { geminiService } from '../../lib/gemini';
import { documentDescriptionService } from '../../lib/documentDescriptionService';
import { checkRateLimit, getRateLimitHeaders } from '../../lib/rateLimiter.js';
import formidable from 'formidable';
import fs from 'fs/promises';
import JSZip from 'jszip';
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
  free: { documents: 10, maxFileSize: 10 * 1024 * 1024 },
  pro: { documents: 100, maxFileSize: 50 * 1024 * 1024 },
  premium: { documents: 1000, maxFileSize: 100 * 1024 * 1024 },
  enterprise: { documents: Infinity, maxFileSize: 500 * 1024 * 1024 },
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
      return res.status(400).json({ 
        error: 'Invalid action', 
        validActions: ['upload', 'ocr-process', 'ocr-status']
      });
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
      'application/epub+zip',
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

    const normalizedFileType: 'pdf' | 'text' | 'epub' = (() => {
      switch (mimeType) {
        case 'application/pdf':
          return 'pdf';
        case 'application/epub+zip':
          return 'epub';
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
      documentDescriptionService.generateDescription(document.id, user.id, content)
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

    if (profile.tier !== 'enterprise' && profile.credits < creditsNeeded) {
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

    // Perform OCR
    const ocrResult = await GPT5NanoService.ocrDocument(
      pdfBuffer,
      pageCount,
      options
    );

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
    if (profile.tier !== 'enterprise') {
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
        creditsRemaining: profile.tier === 'enterprise' 
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

const EPUB_WHITESPACE_REGEX = /\s+/g;
const EPUB_SCRIPT_REGEX = /<script[\s\S]*?<\/script>/gi;
const EPUB_STYLE_REGEX = /<style[\s\S]*?<\/style>/gi;
const EPUB_TAG_REGEX = /<[^>]+>/g;

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanHtmlText(html: string): string {
  const withoutScripts = html.replace(EPUB_SCRIPT_REGEX, ' ');
  const withoutStyles = withoutScripts.replace(EPUB_STYLE_REGEX, ' ');
  const withoutTags = withoutStyles.replace(EPUB_TAG_REGEX, ' ');
  return withoutTags.replace(EPUB_WHITESPACE_REGEX, ' ').trim();
}

function resolveEpubPath(basePath: string, relativePath: string): string {
  if (!basePath) return relativePath;
  if (relativePath.startsWith('/')) {
    return relativePath.slice(1);
  }

  const baseSegments = basePath.split('/').filter(Boolean);
  const relativeSegments = relativePath.split('/');

  for (const segment of relativeSegments) {
    if (segment === '..') {
      baseSegments.pop();
    } else if (segment !== '.') {
      baseSegments.push(segment);
    }
  }

  return baseSegments.join('/');
}

async function extractEpubText(buffer: Buffer): Promise<string> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const zip = await JSZip.loadAsync(buffer);

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('EPUB container.xml not found');
  }

  const containerXml = await containerEntry.async('string');
  const containerJson = parser.parse(containerXml);
  const rootfilePath =
    containerJson?.container?.rootfiles?.rootfile?.['@_full-path'] ||
    containerJson?.container?.rootfiles?.rootfile?.['@_fullPath'];

  if (!rootfilePath) {
    throw new Error('EPUB package (OPF) file not located');
  }

  const opfEntry = zip.file(rootfilePath);
  if (!opfEntry) {
    throw new Error(`EPUB package file ${rootfilePath} missing`);
  }

  const opfXml = await opfEntry.async('string');
  const opfJson = parser.parse(opfXml);

  const manifestItems = ensureArray(opfJson?.package?.manifest?.item);
  const spineItems = ensureArray(opfJson?.package?.spine?.itemref);

  if (manifestItems.length === 0 || spineItems.length === 0) {
    throw new Error('EPUB manifest or spine is empty');
  }

  const manifestMap = new Map<string, { href: string; mediaType: string }>();
  manifestItems.forEach((item: any) => {
    const id = item?.['@_id'];
    const href = item?.['@_href'];
    const mediaType = item?.['@_media-type'];
    if (id && href && mediaType) {
      manifestMap.set(id, { href, mediaType });
    }
  });

  const opfDir =
    rootfilePath.lastIndexOf('/') >= 0 ? rootfilePath.slice(0, rootfilePath.lastIndexOf('/') + 1) : '';

  const sections: string[] = [];

  for (const spineItem of spineItems) {
    const idref = spineItem?.['@_idref'];
    if (!idref) continue;

    const manifestItem = manifestMap.get(idref);
    if (!manifestItem) continue;

    const { mediaType, href } = manifestItem;
    if (
      !mediaType ||
      (
        mediaType !== 'application/xhtml+xml' &&
        mediaType !== 'application/xml' &&
        !mediaType.includes('html')
      )
    ) {
      continue;
    }

    const entryPath = resolveEpubPath(opfDir, href);
    const entryFile = zip.file(entryPath);
    if (!entryFile) continue;

    const entryContent = await entryFile.async('string');
    const text = cleanHtmlText(entryContent);
    if (text) {
      sections.push(text);
    }
  }

  return sections.join('\n\n').trim();
}

async function extractTextContent(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  
  if (mimeType === 'application/pdf') {
    return '[PDF content extraction pending]';
  }

  if (mimeType === 'application/epub+zip') {
    try {
      const text = await extractEpubText(buffer);
      return text || '[EPUB content extraction pending]';
    } catch (error) {
      console.error('Failed to extract EPUB text:', error);
      return '[EPUB content extraction pending]';
    }
  }
  
  return '';
}

