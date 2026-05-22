/**
 * Tests for ocrService — covers the cookie-authed polling/trigger pair
 * (pollOCRStatus, requestOCRProcess) that the PDF viewer uses, plus the
 * token-authed legacy entry points (startOCRProcessing, checkOCRStatus,
 * retryOCRProcessing) that other callers still use.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the auth service so requestOCRProcess can fetch a token without
// touching Supabase. The mock is dynamic; each test resets the resolved value.
const mockGetSession = vi.fn();
vi.mock('../../src/services/supabaseAuthService', () => ({
  authService: {
    getSession: mockGetSession,
  },
}));

import {
  pollOCRStatus,
  requestOCRProcess,
  startOCRProcessing,
  checkOCRStatus,
  retryOCRProcessing,
} from '../../src/services/ocrService';

const originalFetch = global.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockGetSession.mockReset();
  // Silence the console.error calls inside the service so test output stays clean
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('pollOCRStatus', () => {
  it('returns parsed JSON on a 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ocrStatus: 'processing',
        ocrMetadata: { canRetry: true },
      }),
    });

    const result = await pollOCRStatus('doc-1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents?action=ocr-status&documentId=doc-1'
    );
    expect(result).toEqual({
      ocrStatus: 'processing',
      ocrMetadata: { canRetry: true },
    });
  });

  it('returns null on a non-OK response without throwing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await pollOCRStatus('doc-2');

    expect(result).toBeNull();
  });

  it('returns null when fetch rejects (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const result = await pollOCRStatus('doc-3');

    expect(result).toBeNull();
  });
});

describe('requestOCRProcess', () => {
  it('returns false when no access token is available', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: null });

    const ok = await requestOCRProcess('doc-1');

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('POSTs to the OCR endpoint with the bearer token and returns true on 2xx', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: 'tok-abc' });
    mockFetch.mockResolvedValueOnce({ ok: true });

    const ok = await requestOCRProcess('doc-1');

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents?action=ocr-process&documentId=doc-1',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-abc',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('returns false on non-OK API responses', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: 'tok-abc' });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const ok = await requestOCRProcess('doc-1');

    expect(ok).toBe(false);
  });

  it('returns false when fetch rejects', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: 'tok-abc' });
    mockFetch.mockRejectedValueOnce(new Error('boom'));

    const ok = await requestOCRProcess('doc-1');

    expect(ok).toBe(false);
  });
});

describe('startOCRProcessing (token-authed)', () => {
  it('POSTs the request body and returns success with extracted text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        extractedText: 'hello world',
        pageTexts: ['hello world'],
        metadata: { pages: 1 },
      }),
    });

    const res = await startOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1'
    );

    expect(res.success).toBe(true);
    expect(res.extractedText).toBe('hello world');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents?action=ocr-process',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-1',
        }),
      })
    );
  });

  it('returns failure when the API returns an error body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'OCR queue full', canRetry: false }),
    });

    const res = await startOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1'
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('OCR queue full');
    expect(res.canRetry).toBe(false);
  });

  it('returns failure on fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));

    const res = await startOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1'
    );

    expect(res.success).toBe(false);
    expect(res.canRetry).toBe(true); // default for network errors
  });
});

describe('checkOCRStatus (token-authed)', () => {
  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        documentId: 'd1',
        ocrStatus: 'completed',
        content: 'extracted text',
      }),
    });

    const res = await checkOCRStatus('d1', 'tok-1');

    expect(res?.ocrStatus).toBe('completed');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/documents?action=ocr-status&documentId=d1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }),
      })
    );
  });

  it('returns null on non-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Forbidden' });

    const res = await checkOCRStatus('d1', 'tok-1');

    expect(res).toBeNull();
  });
});

describe('retryOCRProcessing', () => {
  it('returns immediately on first success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ extractedText: 'ok' }),
    });

    const res = await retryOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1',
      3,
      1
    );

    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('stops retrying when canRetry is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid pdf', canRetry: false }),
    });

    const res = await retryOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1',
      3,
      1
    );

    expect(res.success).toBe(false);
    expect(res.canRetry).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxRetries times on transient failures', async () => {
    // Two retryable failures, then success
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'transient', canRetry: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'transient', canRetry: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ extractedText: 'eventually' }),
      });

    const res = await retryOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1',
      3,
      1
    );

    expect(res.success).toBe(true);
    expect(res.extractedText).toBe('eventually');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns the last failure when all retries are exhausted', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'still failing', canRetry: true }),
    });

    const res = await retryOCRProcessing(
      { documentId: 'd1', s3Key: 'k', pageCount: 1 },
      'tok-1',
      2,
      1
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('still failing');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
