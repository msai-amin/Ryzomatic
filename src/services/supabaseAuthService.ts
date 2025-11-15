import { createClient } from '@supabase/supabase-js';

const runtimeEnv =
  typeof process !== 'undefined' && process.env
    ? (process.env as Record<string, string | undefined>)
    : {};

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  runtimeEnv.VITE_SUPABASE_URL ||
  runtimeEnv.SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv.VITE_SUPABASE_ANON_KEY ||
  runtimeEnv.SUPABASE_ANON_KEY;

console.log('=== Supabase Environment Variables Debug ===');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY present:', !!supabaseAnonKey);
console.log('VITE_SUPABASE_ANON_KEY is placeholder:', supabaseAnonKey?.includes('your_') || supabaseAnonKey?.includes('_here'));
console.log('All env vars:', import.meta.env);

// Check if the key is a placeholder
const isPlaceholderKey = supabaseAnonKey?.includes('your_') || 
                         supabaseAnonKey?.includes('_here') || 
                         supabaseAnonKey?.includes('_key_here') ||
                         !supabaseAnonKey ||
                         supabaseAnonKey.length < 50; // Real JWT keys are much longer

if (!supabaseUrl || !supabaseAnonKey || isPlaceholderKey) {
  console.error('❌ Missing or Invalid Supabase environment variables:');
  console.error('   URL:', supabaseUrl || 'NOT SET');
  console.error('   Anon Key:', supabaseAnonKey ? (isPlaceholderKey ? 'PLACEHOLDER (NOT VALID)' : 'SET') : 'NOT SET');
  
  if (isPlaceholderKey && supabaseAnonKey) {
    console.error('   ⚠️  The anon key appears to be a placeholder value!');
    console.error('   ⚠️  Replace it with your actual Supabase anon key from the dashboard');
  }
  
  console.warn('⚠️  Running without Supabase - authentication and database features will not work');
  
  if (import.meta.env.DEV) {
    console.warn('📝 To fix this for local development:');
    console.warn('   1. Open .env.local file in the project root');
    console.warn('   2. Replace VITE_SUPABASE_ANON_KEY with your actual key');
    console.warn('   3. Get your key from: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api');
    console.warn('   4. Look for "anon public" key (starts with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)');
    console.warn('   5. Copy the full key and paste it in .env.local');
    console.warn('   6. Restart the dev server after updating the key');
    console.warn('   7. See LOCAL_AUTH_SETUP.md or QUICK_START_LOCAL_AUTH.md for detailed instructions');
  }
}

const authStorage =
  typeof window !== 'undefined' ? window.localStorage : undefined;

// Don't initialize Supabase if the key is a placeholder
// This prevents confusing errors when authentication is attempted
const isValidKey = supabaseAnonKey && 
                   !supabaseAnonKey.includes('your_') && 
                   !supabaseAnonKey.includes('_here') && 
                   !supabaseAnonKey.includes('_key_here') &&
                   supabaseAnonKey.length >= 50; // Real JWT keys are much longer

export const supabase =
  supabaseUrl && isValidKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorage,
          storageKey: 'sb-auth-token',
        },
      })
    : null;

// Log warning if Supabase is not initialized due to invalid key
if (!supabase && supabaseUrl && supabaseAnonKey && !isValidKey) {
  console.warn('⚠️  Supabase client not initialized: API key appears to be a placeholder');
  console.warn('   Please update .env.local with your actual Supabase anon key');
  console.warn('   Get it from: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api');
}

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
    if (!supabase) {
      throw new Error(
        'Authentication is not configured. Please update VITE_SUPABASE_ANON_KEY in .env.local with your actual Supabase API key.'
      );
    }
    
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
    if (!supabase) {
      throw new Error(
        'Authentication is not configured. Please update VITE_SUPABASE_ANON_KEY in .env.local with your actual Supabase API key.'
      );
    }
    
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
    // Check if Supabase is initialized
    if (!supabase) {
      const isPlaceholderKey = supabaseAnonKey?.includes('your_') || 
                               supabaseAnonKey?.includes('_here') || 
                               supabaseAnonKey?.includes('_key_here') ||
                               !supabaseAnonKey ||
                               supabaseAnonKey.length < 50;
      
      if (isPlaceholderKey) {
        throw new Error(
          'Authentication is not configured. Please update VITE_SUPABASE_ANON_KEY in .env.local with your actual Supabase API key. ' +
          'Get it from: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api'
        );
      } else {
        throw new Error('Supabase is not initialized. Please check your environment variables.');
      }
    }
    
    // Always use current origin to avoid redirect issues
    // This ensures localhost stays on localhost and production stays on production
    const redirectUrl = window.location.origin;
    
    console.log('Initiating Google OAuth with redirect:', redirectUrl);
    console.log('Current URL:', window.location.href);
    console.log('Supabase URL:', supabaseUrl);
    
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
  onAuthStateChange(callback: (user: any, event: string) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null, event);
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
      if (!supabase) {
        console.error('Cannot process OAuth callback: Supabase client not initialized');
        console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly');
        return false;
      }
      
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
      
      // Check if Supabase client is properly configured
      const isPlaceholderKey = supabaseAnonKey?.includes('your_') || 
                               supabaseAnonKey?.includes('_here') || 
                               supabaseAnonKey?.includes('_key_here') ||
                               !supabaseAnonKey ||
                               supabaseAnonKey.length < 50;
      
      if (isPlaceholderKey) {
        console.error('❌ Cannot process OAuth callback: Invalid Supabase API key');
        console.error('   The VITE_SUPABASE_ANON_KEY appears to be a placeholder');
        console.error('   Please update .env.local with your actual Supabase anon key');
        console.error('   Get it from: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api');
        return false;
      }
      
      // Set the session manually using the tokens from the URL
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        if (sessionError.message.includes('Invalid API key') || sessionError.message.includes('401')) {
          console.error('   This usually means VITE_SUPABASE_ANON_KEY is incorrect or placeholder');
          console.error('   Please check your .env.local file and ensure the key is correct');
        }
        return false;
      }
      
      if (sessionData.session) {
        console.log('✅ Session created successfully:', sessionData.session.user.email);
        return true;
      }
      
      console.log('❌ No session created');
      return false;
    } catch (error) {
      console.error('❌ Error processing OAuth callback:', error);
      return false;
    }
  }
}

export const authService = new SupabaseAuthService();
