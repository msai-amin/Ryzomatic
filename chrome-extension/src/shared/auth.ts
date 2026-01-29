/**
 * Supabase Authentication for Chrome Extension
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Session, User } from './types';
import { getStoredSession, storeSession, clearSession } from './storage';

// Configuration - these will be injected at build time
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pbfipmvtkbivnwwgukpw.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ session: Session | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { session: null, error: error.message };
    }

    if (!data.session || !data.user) {
      return { session: null, error: 'No session returned' };
    }

    const session: Session = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: data.user.id,
        email: data.user.email || '',
        full_name: data.user.user_metadata?.full_name,
        avatar_url: data.user.user_metadata?.avatar_url,
      },
    };

    await storeSession(session);
    return { session, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign in failed';
    return { session: null, error: message };
  }
}

/**
 * Sign out and clear session
 */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    await clearSession();
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign out failed';
    return { error: message };
  }
}

/**
 * Get current auth token, refreshing if necessary
 */
export async function getAuthToken(): Promise<string | null> {
  const session = await getStoredSession();
  if (!session) return null;

  // Check if token is expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = session.expires_at < now + 300;

  if (isExpired) {
    // Try to refresh the token
    const refreshed = await refreshToken(session.refresh_token);
    if (refreshed) {
      return refreshed.access_token;
    }
    // If refresh failed, clear session
    await clearSession();
    return null;
  }

  return session.access_token;
}

/**
 * Refresh the auth token
 */
export async function refreshToken(
  refreshToken: string
): Promise<Session | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      console.error('Token refresh failed:', error?.message);
      return null;
    }

    const session: Session = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: data.user.id,
        email: data.user.email || '',
        full_name: data.user.user_metadata?.full_name,
        avatar_url: data.user.user_metadata?.avatar_url,
      },
    };

    await storeSession(session);
    return session;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getStoredSession();
  return session?.user ?? null;
}

/**
 * Validate current session by making a test request
 */
export async function validateSession(): Promise<boolean> {
  try {
    const token = await getAuthToken();
    if (!token) return false;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    return !error && !!data.user;
  } catch {
    return false;
  }
}

