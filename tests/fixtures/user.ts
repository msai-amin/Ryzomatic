/**
 * User fixtures for testing
 */

import type { User } from '@supabase/supabase-js';

export const mockUser: User = {
  id: 'test-user-id-123',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
};

export const mockAuthResponse = {
  data: {
    user: mockUser,
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser,
    },
  },
  error: null,
};

