import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, generateDocumentKey } from '../../lib/s3';
import formidable from 'formidable';
import fs from 'fs/promises';
import { geminiService } from '../../lib/gemini';
import { documentDescriptionService } from '../../lib/documentDescriptionService';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tier limits for documents
const TIER_LIMITS = {
  free: { documents: 10, maxFileSize: 10 * 1024 * 1024 }, // 10MB
  pro: { documents: 100, maxFileSize: 50 * 1024 * 1024 }, // 50MB
  premium: { documents: 1000, maxFileSize: 100 * 1024 * 1024 }, // 100MB
  enterprise: { documents: Infinity, maxFileSize: 500 * 1024 * 1024 }, // 500MB
};

/**
 * Extract text content from file
 */
async function extractTextContent(filePath: string, mimeType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  
  // For text files, directly read content
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }
  
  // For PDFs, we'll need pdf-parse or similar
  // For now, return empty string - will implement in next iteration
  if (mimeType === 'application/pdf') {
    // TODO: Implement PDF text extraction
    // Can use pdf-parse or call a separate PDF processing service
    return '[PDF content extraction pending]';
  }
  
  return '';
}

/**
 * Upload document endpoint
 * POST /api/documents/upload
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { count: documentCount } = await supabase
      .from('documents')
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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
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
    const content = await extractTextContent(file.filepath, file.mimetype || 'text/plain');

    // Check content moderation (optional but recommended)
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

    // Extract metadata using Gemini (if content available)
    let metadata = {};
    if (content && content.length > 100) {
      try {
        metadata = await geminiService.extractMetadata(content, profile.tier);
      } catch (error) {
        console.error('Metadata extraction failed:', error);
        // Continue without metadata
      }
    }

    // Create document record
    const title = (fields.title?.[0] as string) || 
                  (metadata as any).title || 
                  file.originalFilename || 
                  'Untitled Document';

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title,
        file_name: file.originalFilename || 'unknown',
        file_size: file.size,
        file_type: file.mimetype || 'application/octet-stream',
        s3_key: s3Key,
        content,
        embedding_status: 'pending',
        metadata: {
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
      credits_used: 0, // Document upload doesn't cost credits
      metadata: {
        documentId: document.id,
        fileSize: file.size,
        fileType: file.mimetype,
      },
    });

    // Generate document description (async, non-blocking)
    if (content && content.length > 100) {
      documentDescriptionService.generateDescription(document.id, user.id, content)
        .catch(err => console.error('Error generating description:', err));
    }

    // TODO: Trigger background job for vector embedding
    // This would call Pinecone to create embeddings for the document
    // For now, we'll leave it as pending

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

