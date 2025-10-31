// OCR Service - Client-side service for OCR operations

interface OCRProcessRequest {
  documentId: string;
  s3Key: string;
  pageCount: number;
  options?: {
    extractTables?: boolean;
    preserveFormatting?: boolean;
  };
}

interface OCRStatusResponse {
  documentId: string;
  ocrStatus: string;
  ocrMetadata?: any;
  content?: string;
}

interface OCRProcessResponse {
  success: boolean;
  extractedText?: string;
  pageTexts?: string[];
  metadata?: any;
  error?: string;
  canRetry?: boolean;
}

/**
 * Start OCR processing for a document
 */
export async function startOCRProcessing(
  request: OCRProcessRequest,
  authToken: string
): Promise<OCRProcessResponse> {
  try {
    const response = await fetch('/api/documents?action=ocr-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.details || 'OCR processing failed',
        canRetry: data.canRetry ?? true,
      };
    }

    return {
      success: true,
      extractedText: data.extractedText,
      pageTexts: data.pageTexts,
      metadata: data.metadata,
    };
  } catch (error: any) {
    console.error('OCR processing request failed:', error);
    return {
      success: false,
      error: error.message || 'Network error',
      canRetry: true,
    };
  }
}

/**
 * Check OCR status for a document
 */
export async function checkOCRStatus(
  documentId: string,
  authToken: string
): Promise<OCRStatusResponse | null> {
  try {
    const response = await fetch(`/api/documents?action=ocr-status&documentId=${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to check OCR status:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('OCR status check failed:', error);
    return null;
  }
}

/**
 * Retry OCR processing (wrapper around startOCRProcessing with retry logic)
 */
export async function retryOCRProcessing(
  request: OCRProcessRequest,
  authToken: string,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<OCRProcessResponse> {
  let lastError: OCRProcessResponse | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`OCR retry attempt ${attempt}/${maxRetries}`);

    const result = await startOCRProcessing(request, authToken);

    if (result.success) {
      return result;
    }

    lastError = result;

    // If not retryable, stop immediately
    if (result.canRetry === false) {
      break;
    }

    // Wait before next retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  return lastError || {
    success: false,
    error: 'Max retries exceeded',
    canRetry: false,
  };
}

