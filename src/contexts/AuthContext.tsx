import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseAuthService';
import { googleAuthService } from '../services/googleAuthService';
import { simpleGoogleAuth } from '../services/simpleGoogleAuth';
import type { Session } from '@supabase/supabase-js';

// Define the shape of the context
interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
});

// Create the provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // If Supabase is not available, mark as not loading and no session
      setLoading(false);
      setSession(null);
      return;
    }

    // 1. Check for an active session immediately on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Set up a listener for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      // If the event is SIGNED_IN or TOKEN_REFRESHED, loading is done.
      // If it's SIGNED_OUT, we're also "done" loading (with no user).
      if (_event !== 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    // Cleanup the subscription on component unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (typeof window === 'undefined') return;

    const provider = session?.user?.app_metadata?.provider;
    if (provider !== 'google') return;

    let cancelled = false;

    const ensureDriveConsent = async () => {
      try {
        const granted = await googleAuthService.ensureDriveAccess();

        if (cancelled) {
          return;
        }

        if (granted) {
          const user = googleAuthService.getCurrentUser();
          if (user) {
            simpleGoogleAuth.syncFromGoogleAuth(user);
          }
        } else {
          // Fall back to lightweight GIS so UI elements relying on it still function
          await simpleGoogleAuth.initialize().catch(error => {
            console.warn('Failed to initialize simpleGoogleAuth after Google login', error);
          });
        }
      } catch (error) {
        console.warn('Failed to ensure Google Drive consent after login', error);
        try {
          await simpleGoogleAuth.initialize();
        } catch (fallbackError) {
          console.warn('Fallback Google Identity initialization also failed', fallbackError);
        }
      }
    };

    ensureDriveConsent();

    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.app_metadata?.provider, session?.user?.id]);

  const value = {
    session,
    loading,
  };

  // Provide the session and loading state to children
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Create a custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

