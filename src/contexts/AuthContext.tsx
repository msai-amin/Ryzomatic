import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseAuthService';
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

