/**
 * Docling Document Processing Service
 * 
 * TypeScript wrapper for the Python Docling API endpoint.
 * Provides document conversion with superior table, formula, and layout extraction.
 */

import { logger } from './logger';

/**
 * Result from Docling document conversion
 */
export interface DoclingResult {
  success: boolean;
  markdown: string;
  text: string;
  metadata: {
    pageCount: number;
    tables: number;
    figures: number;
    fileType: string;
    fileName: string;
  };
  structure: {
    pages: Array<{
      pageNumber: number;
      text: string;
    }>;
  };
  error?: string;
}

/**
 * Options for Docling document processing
 */
export interface DoclingOptions {
  /** Enable OCR for scanned documents (default: true) */
  enableOcr?: boolean;
  /** Extract table structures (default: true) */
  extractTables?: boolean;
  /** Extract mathematical formulas (default: true) */
  extractFormulas?: boolean;
  /** Preserve document layout structure (default: true) */
  preserveLayout?: boolean;
}

/**
 * Supported file extensions for Docling processing
 */
const DOCLING_SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'html',
  'htm',
  'png',
  'jpg',
  'jpeg',
  'tiff',
  'tif',
  'bmp',
];

/**
 * Check if a file type is supported by Docling
 * 
 * @param fileName - Name of the file to check
 * @returns true if the file type is supported
 */
export function isDoclingSupported(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return DOCLING_SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get the file extension from a filename
 */
function getFileExtension(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() || 'pdf';
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Process a document using Docling
 * 
 * @param file - File object or ArrayBuffer containing the document
 * @param fileName - Name of the file (used for extension detection)
 * @param options - Processing options
 * @returns DoclingResult with extracted content and metadata
 */
export async function processWithDocling(
  file: File | ArrayBuffer,
  fileName: string,
  options: DoclingOptions = {}
): Promise<DoclingResult> {
  const context = {
    component: 'DoclingService',
    action: 'processWithDocling',
    fileName,
    fileExtension: getFileExtension(fileName),
  };

  logger.info('Starting Docling document processing', context);

  try {
    // Convert file to ArrayBuffer if needed
    const arrayBuffer = file instanceof File 
      ? await file.arrayBuffer() 
      : file;

    // Convert to base64
    const base64Data = arrayBufferToBase64(arrayBuffer);

    logger.info('Sending document to Docling API', context, {
      fileSizeBytes: arrayBuffer.byteLength,
    });

    // Call the Docling API endpoint
    const response = await fetch('/api/docling', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData: base64Data,
        fileName,
        options: {
          enableOcr: options.enableOcr ?? true,
          extractTables: options.extractTables ?? true,
          extractFormulas: options.extractFormulas ?? true,
          preserveLayout: options.preserveLayout ?? true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Docling API returned status ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Use default error message
      }

      logger.error('Docling API request failed', context, new Error(errorMessage));
      
      return {
        success: false,
        markdown: '',
        text: '',
        metadata: {
          pageCount: 0,
          tables: 0,
          figures: 0,
          fileType: getFileExtension(fileName),
          fileName,
        },
        structure: { pages: [] },
        error: errorMessage,
      };
    }

    const result: DoclingResult = await response.json();

    logger.info('Docling processing completed', context, {
      pageCount: result.metadata?.pageCount,
      tables: result.metadata?.tables,
      figures: result.metadata?.figures,
      textLength: result.text?.length,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Docling processing failed', context, error as Error);

    return {
      success: false,
      markdown: '',
      text: '',
      metadata: {
        pageCount: 0,
        tables: 0,
        figures: 0,
        fileType: getFileExtension(fileName),
        fileName,
      },
      structure: { pages: [] },
      error: `Document processing failed: ${errorMessage}`,
    };
  }
}

/**
 * Check if Docling service is available
 * 
 * @returns Promise<boolean> indicating service availability
 */
export async function isDoclingAvailable(): Promise<boolean> {
  try {
    // Simple health check - we could add a dedicated health endpoint later
    const response = await fetch('/api/docling', {
      method: 'OPTIONS',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return [...DOCLING_SUPPORTED_EXTENSIONS];
}

/**
 * Get MIME type for supported extensions
 */
export function getMimeTypesForDocling(): Record<string, string[]> {
  return {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/html': ['.html', '.htm'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/tiff': ['.tiff', '.tif'],
    'image/bmp': ['.bmp'],
  };
}
