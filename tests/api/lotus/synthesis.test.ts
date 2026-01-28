/**
 * Tests for LOTUS Synthesis API endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mockUser } from '../../fixtures/user';
import { 
  mockBooks, 
  mockDocumentContent, 
  mockLotusResponse,
  mockLotusUnavailableResponse,
  mockSynthesisRequest 
} from '../../fixtures/document';

// Use vi.hoisted to create the mock before hoisting
const mockSupabaseClient = vi.hoisted(() => {
  // Create a chainable AND thenable mock
  // Each method returns the mock itself (for chaining)
  // The mock is also thenable so await works
  const mock: any = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    rpc: vi.fn(),
    // Default thenable behavior - will be overridden per test
    _data: null as any,
    _error: null as any,
    then(resolve: any) {
      return Promise.resolve(resolve({ data: this._data, error: this._error }));
    },
  };
  
  // Set up chainable mock returns - each returns the mock for chaining
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.insert.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.in.mockReturnValue(mock);
  mock.order.mockReturnValue(mock);
  mock.single.mockReturnValue(mock);
  mock.rpc.mockReturnValue(mock);
  
  return mock;
});

// Mock modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('../../../lib/rateLimiter.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100, remaining: 99 }),
  getRateLimitHeaders: vi.fn().mockReturnValue({ 'X-RateLimit-Limit': '100' }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import handler after mocks are set up
import handler from '../../../api/lotus/synthesis';
import { checkRateLimit } from '../../../lib/rateLimiter.js';

// Helper to create mock request
function createMockRequest(options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}): VercelRequest {
  return {
    method: options.method || 'POST',
    body: options.body || {},
    headers: {
      authorization: 'Bearer test-token',
      ...options.headers,
    },
  } as unknown as VercelRequest;
}

// Helper to create mock response
function createMockResponse(): VercelResponse & { 
  _status: number; 
  _json: any; 
  _headers: Record<string, string>;
} {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    status: vi.fn(function(this: any, code: number) {
      this._status = code;
      return this;
    }),
    json: vi.fn(function(this: any, data: any) {
      this._json = data;
      return this;
    }),
    setHeader: vi.fn(function(this: any, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
  };
  return res as any;
}

// Track mock results per table/query type
let mockResults: {
  user_books?: { data: any; error: any };
  document_content?: { data: any; error: any };
  usage_records?: { data: any; error: any };
  rpc?: { data: any; error: any };
  single?: { data: any; error: any };
} = {};

let currentTable = '';

describe('LOTUS Synthesis API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock results
    mockResults = {
      user_books: { data: null, error: null },
      document_content: { data: [], error: null },
      usage_records: { data: null, error: null },
      rpc: { data: null, error: null },
      single: { data: null, error: null },
    };
    currentTable = '';
    
    // Reset Supabase mock to default successful state
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    
    // from() tracks which table is being queried
    mockSupabaseClient.from.mockImplementation((table: string) => {
      currentTable = table;
      return mockSupabaseClient;
    });
    
    // Chain methods return the mock
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.in.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    
    // Terminal methods return based on current table context
    mockSupabaseClient.order.mockImplementation(() => {
      const result = mockResults[currentTable as keyof typeof mockResults] || { data: [], error: null };
      return {
        ...mockSupabaseClient,
        then: (resolve: any) => Promise.resolve(resolve(result)),
      };
    });
    
    mockSupabaseClient.single.mockImplementation(() => {
      const result = mockResults.single || { data: null, error: null };
      return {
        then: (resolve: any) => Promise.resolve(resolve(result)),
      };
    });
    
    mockSupabaseClient.rpc.mockImplementation(() => {
      const result = mockResults.rpc || { data: null, error: null };
      return {
        then: (resolve: any) => Promise.resolve(resolve(result)),
      };
    });
    
    // Make the base mock thenable for queries that end with eq() or in()
    Object.defineProperty(mockSupabaseClient, 'then', {
      value: function(resolve: any) {
        const result = mockResults[currentTable as keyof typeof mockResults] || { data: null, error: null };
        return Promise.resolve(resolve(result));
      },
      writable: true,
      configurable: true,
    });
    
    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Method Validation', () => {
    it('should return 405 for GET requests', async () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(405);
      expect(res._json).toEqual({ error: 'Method not allowed' });
    });

    it('should return 405 for PUT requests', async () => {
      const req = createMockRequest({ method: 'PUT' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(405);
    });

    it('should return 405 for DELETE requests', async () => {
      const req = createMockRequest({ method: 'DELETE' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(405);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when documentIds is missing', async () => {
      const req = createMockRequest({
        body: { query: 'test query' },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json.error).toContain('documentIds');
    });

    it('should return 400 when documentIds is empty array', async () => {
      const req = createMockRequest({
        body: { documentIds: [], query: 'test query' },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json.error).toContain('documentIds');
    });

    it('should return 400 when documentIds is not an array', async () => {
      const req = createMockRequest({
        body: { documentIds: 'not-an-array', query: 'test query' },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
    });

    it('should return 400 when query is missing', async () => {
      const req = createMockRequest({
        body: { documentIds: ['doc-1'] },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json.error).toContain('query');
    });

    it('should return 400 when query is not a string', async () => {
      const req = createMockRequest({
        body: { documentIds: ['doc-1'], query: 123 },
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when no authorization header', async () => {
      const req = createMockRequest({
        body: mockSynthesisRequest,
        headers: { authorization: '' },
      });
      // Remove authorization header
      (req.headers as any).authorization = undefined;
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(401);
      expect(res._json.error).toBe('Unauthorized');
    });

    it('should return 401 when token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(401);
      expect(res._json.error).toBe('Invalid token');
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAt: new Date(),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(429);
      expect(res._json.error).toBe('Rate limit exceeded');
    });

    it('should set rate limit headers', async () => {
      // Mock the full flow for a successful request to check headers
      mockResults.user_books = { data: mockBooks.slice(0, 3), error: null };
      mockResults.document_content = { data: mockDocumentContent, error: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLotusResponse),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.setHeader).toHaveBeenCalled();
    });
  });

  describe('Document Fetching', () => {
    it('should return 404 when some documents not found', async () => {
      // Return fewer books than requested
      mockResults.user_books = { data: [mockBooks[0]], error: null }; // Only 1 book

      const req = createMockRequest({
        body: mockSynthesisRequest, // Requests 3 documents
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(404);
      expect(res._json.error).toContain('not found');
    });

    it('should return 500 when document fetch fails', async () => {
      mockResults.user_books = { data: null, error: new Error('Database error') };

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(500);
      expect(res._json.error).toContain('Failed to fetch');
    });

    it('should return 400 when no document content found', async () => {
      // Return books but no content
      mockResults.user_books = { data: mockBooks.slice(0, 3), error: null };
      mockResults.document_content = { data: [], error: null };
      mockResults.rpc = { data: null, error: new Error('No content') };
      mockResults.single = { data: { content: '' }, error: null };

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(400);
      expect(res._json.error).toContain('No document content');
    });
  });

  describe('LOTUS Backend Errors', () => {
    beforeEach(() => {
      // Setup successful document fetching
      mockResults.user_books = { data: mockBooks.slice(0, 3), error: null };
      mockResults.document_content = { data: mockDocumentContent, error: null };
    });

    it('should return 503 when LOTUS backend returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(503);
      expect(res._json.code).toBe('LOTUS_NOT_AVAILABLE');
    });

    it('should return 503 when LOTUS backend returns 502', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(503);
      expect(res._json.code).toBe('LOTUS_NOT_AVAILABLE');
    });

    it('should return 500 when LOTUS backend returns other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(500);
      expect(res._json.error).toContain('LOTUS synthesis failed');
    });

    it('should return 503 when fetch throws network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(503);
      expect(res._json.code).toBe('LOTUS_NOT_AVAILABLE');
    });
  });

  describe('Successful Synthesis', () => {
    beforeEach(() => {
      // Setup successful document fetching
      mockResults.user_books = { data: mockBooks.slice(0, 3), error: null };
      mockResults.document_content = { data: mockDocumentContent, error: null };
    });

    it('should return 200 with synthesis result on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLotusResponse),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.synthesis).toBe(mockLotusResponse.synthesis);
      expect(res._json.document_count).toBeGreaterThan(0);
      expect(res._json.documents_used).toBeDefined();
    });

    it('should track usage on successful synthesis', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLotusResponse),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      // Verify usage_records insert was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('usage_records');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should call LOTUS backend with correct payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLotusResponse),
      });

      const req = createMockRequest({
        body: mockSynthesisRequest,
      });
      const res = createMockResponse();

      await handler(req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('documents'),
        })
      );
    });
  });
});
