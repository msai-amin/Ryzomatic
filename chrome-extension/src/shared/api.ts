/**
 * API Client for Ryzomatic Chrome Extension
 */

import { getAuthToken } from './auth';
import {
  Document,
  DocumentUploadResponse,
  Highlight,
  HighlightCreateRequest,
  Note,
  NoteCreateRequest,
  PageContent,
} from './types';

// API Base URL - injected at build time
const API_BASE_URL = process.env.API_BASE_URL || 'https://ryzomatic.net';

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ==================== Documents ====================

/**
 * Upload a document (web page or PDF)
 */
export async function uploadDocument(
  file: File | Blob,
  title?: string,
  metadata?: Record<string, unknown>
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  return apiRequest<DocumentUploadResponse>('/api/documents?action=upload', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Save a web page as a document
 */
export async function saveWebPage(
  content: PageContent
): Promise<DocumentUploadResponse> {
  // Create a text file from the extracted content
  const textContent = `# ${content.title}\n\nSource: ${content.url}\n${
    content.author ? `Author: ${content.author}\n` : ''
  }${content.publishDate ? `Date: ${content.publishDate}\n` : ''}\n---\n\n${content.text}`;

  const blob = new Blob([textContent], { type: 'text/plain' });
  const filename = `${content.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.txt`;
  const file = new File([blob], filename, { type: 'text/plain' });

  return uploadDocument(file, content.title, {
    source_url: content.url,
    source_type: 'web_page',
    author: content.author,
    publish_date: content.publishDate,
    description: content.description,
    favicon: content.favicon,
    og_image: content.ogImage,
    captured_at: new Date().toISOString(),
  });
}

/**
 * Save a PDF document
 */
export async function savePdf(
  pdfBlob: Blob,
  title: string,
  sourceUrl: string
): Promise<DocumentUploadResponse> {
  const filename = `${title.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.pdf`;
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  return uploadDocument(file, title, {
    source_url: sourceUrl,
    source_type: 'pdf',
    captured_at: new Date().toISOString(),
  });
}

/**
 * Get recent documents for the current user
 */
export async function getRecentDocuments(limit: number = 10): Promise<Document[]> {
  const response = await apiRequest<{ success: boolean; data: Document[] }>(
    `/api/documents?action=recent&limit=${limit}`,
    { method: 'GET' }
  );
  return response.data || [];
}

/**
 * Search documents in the library
 */
export async function searchDocuments(query: string): Promise<Document[]> {
  const response = await apiRequest<{ success: boolean; data: Document[] }>(
    `/api/documents?action=search&q=${encodeURIComponent(query)}`,
    { method: 'GET' }
  );
  return response.data || [];
}

// ==================== Highlights ====================

/**
 * Create a highlight
 */
export async function createHighlight(
  request: HighlightCreateRequest
): Promise<Highlight> {
  const response = await apiRequest<{ success: boolean; highlight: Highlight }>(
    '/api/highlights',
    {
      method: 'POST',
      body: JSON.stringify({
        bookId: request.bookId,
        pageNumber: request.pageNumber,
        highlightedText: request.highlightedText,
        colorId: request.colorId,
        colorHex: request.colorHex,
        positionData: request.positionData,
        textStartOffset: request.textStartOffset,
        textEndOffset: request.textEndOffset,
        textContextBefore: request.textContextBefore,
        textContextAfter: request.textContextAfter,
      }),
    }
  );
  return response.highlight;
}

/**
 * Get highlights for a document
 */
export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const response = await apiRequest<{ success: boolean; highlights: Highlight[] }>(
    `/api/highlights?bookId=${bookId}`,
    { method: 'GET' }
  );
  return response.highlights || [];
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId: string): Promise<void> {
  await apiRequest(`/api/highlights?id=${highlightId}`, {
    method: 'DELETE',
  });
}

// ==================== Notes ====================

/**
 * Create a note
 */
export async function createNote(request: NoteCreateRequest): Promise<Note> {
  // Note: This would need a corresponding API endpoint
  // For now, we'll use the document upload with special metadata
  const response = await apiRequest<{ success: boolean; note: Note }>(
    '/api/notes',
    {
      method: 'POST',
      body: JSON.stringify({
        book_id: request.bookId,
        page_number: request.pageNumber,
        content: request.content,
        position_x: request.positionX,
        position_y: request.positionY,
      }),
    }
  );
  return response.note;
}

// ==================== Quick Clips ====================

/**
 * Save a quick clip (standalone highlight from a web page)
 * This creates a minimal document entry and attaches the highlight
 */
export async function saveQuickClip(
  text: string,
  sourceUrl: string,
  sourceTitle: string,
  colorId: string,
  colorHex: string,
  context?: { before?: string; after?: string }
): Promise<{ document: Document; highlight: Highlight }> {
  // First, save the page as a minimal document
  const docResponse = await saveWebPage({
    url: sourceUrl,
    title: `Clip from: ${sourceTitle}`,
    text: text,
    description: `Quick clip: "${text.slice(0, 100)}..."`,
    isPdf: false,
  });

  if (!docResponse.success || !docResponse.document) {
    throw new Error(docResponse.error || 'Failed to save clip');
  }

  // Then create a highlight on that document
  const highlight = await createHighlight({
    bookId: docResponse.document.id,
    pageNumber: 1,
    highlightedText: text,
    colorId,
    colorHex,
    positionData: { x: 0, y: 0, width: 100, height: 20 },
    textContextBefore: context?.before,
    textContextAfter: context?.after,
  });

  return { document: docResponse.document, highlight };
}

// ==================== Health Check ====================

/**
 * Check if the API is available
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

