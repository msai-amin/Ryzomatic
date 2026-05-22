/**
 * Tests for highlightService — focuses on the CRUD surface exercised
 * by PDFViewerV2 (createHighlight, getHighlights, updateHighlight,
 * deleteHighlight) and the in-memory cache that backs them.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the auth service so getAuthHeader doesn't try to talk to Supabase.
// vi.hoisted is needed because vi.mock factories are hoisted above imports
// and can't reference module-scoped variables.
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));
vi.mock('../../src/services/supabaseAuthService', () => ({
  authService: {
    getSession: mockGetSession,
  },
}));

// Mock supabase directly because extractConceptsFromHighlight calls
// supabase.auth.getSession() and supabase.from('concepts').*. We don't
// want this background work to throw during a test or hit network.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// Mock the AI concept extraction helper for the same reason.
vi.mock('../../src/services/aiService', () => ({
  extractConceptsFromText: vi.fn().mockResolvedValue([]),
}));

import {
  highlightService,
  type Highlight,
  type CreateHighlightData,
} from '../../src/services/highlightService';

const originalFetch = global.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

const baseCreateData: CreateHighlightData = {
  bookId: 'book-1',
  pageNumber: 1,
  highlightedText: 'short', // < 10 chars to skip background concept extraction
  colorId: 'yellow',
  colorHex: '#ffeb3b',
  positionData: {} as any,
};

const sampleHighlight: Highlight = {
  id: 'hl-1',
  bookId: 'book-1',
  pageNumber: 1,
  highlightedText: 'short',
  colorId: 'yellow',
  colorHex: '#ffeb3b',
  positionData: {} as any,
  isOrphaned: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Highlight;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockGetSession.mockResolvedValue({ access_token: 'tok-abc' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Clear any cache state carried over between tests
  (highlightService as any).cache.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('highlightService.createHighlight', () => {
  it('POSTs to /api/highlights with the bearer token and caches the result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ highlight: sampleHighlight }),
    });

    const result = await highlightService.createHighlight(baseCreateData);

    expect(result).toEqual(sampleHighlight);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/highlights',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-abc',
          'Content-Type': 'application/json',
        }),
      })
    );
    // Cache populated for the bookId
    expect(highlightService.getCachedHighlights('book-1')).toEqual([sampleHighlight]);
  });

  it('throws and does not cache on a non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'quota exceeded' }),
    });

    await expect(highlightService.createHighlight(baseCreateData)).rejects.toThrow(
      'quota exceeded'
    );
    expect(highlightService.getCachedHighlights('book-1')).toBeNull();
  });

  it('propagates an auth-missing error from getAuthHeader', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: null });

    await expect(highlightService.createHighlight(baseCreateData)).rejects.toThrow(
      /not authenticated/i
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('highlightService.getHighlights', () => {
  it('fetches by bookId, returns the array, and warms the cache', async () => {
    const all = [sampleHighlight, { ...sampleHighlight, id: 'hl-2', pageNumber: 2 }];
    // getHighlights uses response.text() + JSON.parse and checks content-type
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: (h: string) => (h === 'content-type' ? 'application/json' : null) },
      text: () => Promise.resolve(JSON.stringify({ highlights: all })),
    });

    const result = await highlightService.getHighlights('book-1');

    expect(result).toHaveLength(2);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/highlights');
    expect(mockFetch.mock.calls[0][0]).toContain('bookId=book-1');
    expect(highlightService.getCachedHighlights('book-1')).toHaveLength(2);
  });

  it('returns an empty array on 404 (book does not exist yet)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'not found' }),
    });

    const result = await highlightService.getHighlights('book-1');
    expect(result).toEqual([]);
  });
});

describe('highlightService.deleteHighlight', () => {
  it('issues a DELETE and removes the highlight from cache', async () => {
    // Pre-populate cache
    (highlightService as any).cache.set('book-1', [sampleHighlight]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await highlightService.deleteHighlight('hl-1');

    expect(mockFetch.mock.calls[0][0]).toContain('/api/highlights');
    expect(mockFetch.mock.calls[0][1]?.method).toBe('DELETE');
    // Cache entry for this bookId is gone or empty
    const cached = highlightService.getCachedHighlights('book-1');
    expect(cached === null || cached.length === 0).toBe(true);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'not found' }),
    });

    await expect(highlightService.deleteHighlight('hl-1')).rejects.toThrow();
  });
});

describe('highlightService.deleteHighlights', () => {
  it('batch-deletes a list of ids and returns deletedCount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deletedCount: 2 }),
    });

    const count = await highlightService.deleteHighlights(['hl-1', 'hl-2']);

    expect(count).toBe(2);
    expect(mockFetch.mock.calls[0][1]?.method).toBe('DELETE');
    expect(mockFetch.mock.calls[0][0]).toContain('/api/highlights/delete');
  });
});

describe('highlightService.updateHighlight', () => {
  it('PUTs the update body and returns the updated record', async () => {
    const updated = { ...sampleHighlight, colorId: 'green', colorHex: '#22c55e' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ highlight: updated }),
    });

    const result = await highlightService.updateHighlight('hl-1', {
      colorId: 'green',
      colorHex: '#22c55e',
    });

    expect(result.colorId).toBe('green');
    expect(mockFetch.mock.calls[0][1]?.method).toBe('PUT');
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.id).toBe('hl-1');
    expect(body.colorId).toBe('green');
  });
});
