import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Supabase Environment Variables Debug ===');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY present:', !!supabaseAnonKey);
console.log('All env vars:', import.meta.env);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:');
  console.error('URL:', supabaseUrl);
  console.error('Key present:', !!supabaseAnonKey);
  console.warn('Running without Supabase - some features may not work');
  // Don't throw error in development, just warn
  if (import.meta.env.DEV) {
    console.warn('Development mode: Supabase not configured');
  } else {
    throw new Error('Missing Supabase environment variables');
  }
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  tier: 'free' | 'pro' | 'premium' | 'enterprise';
  credits: number;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

class SupabaseAuthService {
  /**
   * Sign up with email and password
   */
  async signUp(data: SignUpData) {
    const { email, password, fullName } = data;
    
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return authData;
  }

  /**
   * Sign in with email and password
   */
  async signIn(data: SignInData) {
    const { email, password } = data;
    
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return authData;
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    // For development, always use current origin to avoid redirect issues
    // For production, use VITE_APP_URL if set
    const isDevelopment = import.meta.env.DEV;
    const redirectUrl = isDevelopment 
      ? window.location.origin 
      : (import.meta.env.VITE_APP_URL || window.location.origin);
    
    console.log('Initiating Google OAuth with redirect:', redirectUrl);
    console.log('Current URL:', window.location.href);
    console.log('Supabase URL:', supabaseUrl);
    console.log('Is development:', isDevelopment);
    
    const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google OAuth error:', error);
      throw new Error(error.message);
    }

    console.log('OAuth data:', oauthData);
    return oauthData;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      throw new Error(error.message);
    }
    return user;
  }

  /**
   * Get user profile (from profiles table)
   */
  async getUserProfile(userId: string): Promise<AuthUser | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  }

  /**
   * Create user profile (fallback if trigger didn't fire)
   */
  async createUserProfile(profileData: AuthUser): Promise<AuthUser> {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        tier: profileData.tier || 'free',
        credits: profileData.credits || 100,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user profile:', error);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<AuthUser>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }

  /**
   * Get auth session
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    return session;
  }

  /**
   * Manually process OAuth callback from URL hash
   */
  async processOAuthCallback(): Promise<boolean> {
    try {
      console.log('Processing OAuth callback manually...');
      
      // Extract tokens from URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('Access token present:', !!accessToken);
      console.log('Refresh token present:', !!refreshToken);
      
      if (!accessToken) {
        console.log('No access token found in URL');
        return false;
      }
      
      // Set the session manually using the tokens from the URL
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        return false;
      }
      
      if (sessionData.session) {
        console.log('✅ Session created successfully:', sessionData.session.user.email);
        return true;
      }
      
      console.log('❌ No session created');
      return false;
    } catch (error) {
      console.error('Error processing OAuth callback:', error);
      return false;
    }
  }
}

export const authService = new SupabaseAuthService();
