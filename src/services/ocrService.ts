// OCR Service - Client-side service for OCR operations

export interface OCRPollResult {
  ocrStatus: 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined'
  ocrMetadata?: {
    error?: string
    canRetry?: boolean
    [key: string]: any
  }
  content?: string
}

/**
 * Fetch the latest OCR status for a document. Used by the PDFViewer polling
 * loop. Cookie-authed — does not require an explicit access token.
 *
 * Returns null on any non-OK response or network error so callers can keep
 * polling without an exception path.
 */
export async function pollOCRStatus(documentId: string): Promise<OCRPollResult | null> {
  try {
    const response = await fetch(`/api/documents?action=ocr-status&documentId=${documentId}`)
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Error checking OCR status:', error)
    return null
  }
}

/**
 * Trigger OCR processing for a document. Used by both the "start OCR" and
 * "retry OCR" buttons in the PDFViewer OCR banner. Resolves to `true` if
 * the API accepted the request (the actual processing is async; the caller
 * should kick off pollOCRStatus to observe completion).
 */
export async function requestOCRProcess(documentId: string): Promise<boolean> {
  try {
    const { authService } = await import('./supabaseAuthService')
    const session = await authService.getSession()
    const token = session?.access_token
    if (!token) {
      console.error('No access token available')
      return false
    }
    const response = await fetch(`/api/documents?action=ocr-process&documentId=${documentId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    return response.ok
  } catch (error) {
    console.error('Error requesting OCR processing:', error)
    return false
  }
}

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

