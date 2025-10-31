/**
 * Mock Supabase client for testing
 */

import { vi } from 'vitest';

export const createMockSupabaseClient = () => {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: null }, unsubscribe: vi.fn() })),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      range: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
        createSignedUrl: vi.fn(),
        createSignedUrls: vi.fn(),
        list: vi.fn(),
        move: vi.fn(),
        copy: vi.fn(),
      })),
    },
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  };
};

export const mockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
  status: error ? 'error' : 'success',
  statusText: error ? 'ERROR' : 'OK',
});

