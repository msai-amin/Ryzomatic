import { useEffect, useState } from 'react'
import { DocumentViewer } from './components/DocumentViewer'
import { ChatModal } from './components/ChatModal'
import { ThemedHeader } from '../themes/ThemedHeader'
import { ThemedApp } from '../themes/ThemedApp'
import { AuthModal } from './components/AuthModal'
import NeoReaderTerminal from './components/NeoReaderTerminal'
import LandingPage from './components/LandingPage'
import { useAppStore } from './store/appStore'
import { authService, supabase } from './services/supabaseAuthService'
import { healthMonitor } from './services/healthMonitor'
import { logger } from './services/logger'
import { errorHandler } from './services/errorHandler'
import { supabaseStorageService } from './services/supabaseStorageService'
import { libraryOrganizationService } from './services/libraryOrganizationService'
import { librarySearchService } from './services/librarySearchService'
import { ThemeProvider } from '../themes/ThemeProvider'
import { useAuth } from './contexts/AuthContext'

function App() {
  // Use AuthContext as the single source of truth for auth state
  const { session, loading: authLoading } = useAuth()
  
  const { 
    isChatOpen, 
    toggleChat, 
    isAuthenticated, 
    checkAuth, 
    user 
  } = useAppStore()
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showNeoReader, setShowNeoReader] = useState(false)
  const [showLandingPage, setShowLandingPage] = useState(false)

  // Sync AuthContext session changes with Zustand store and initialize services
  useEffect(() => {
    if (!authLoading && session) {
      // Session is available from AuthContext, sync with Zustand store
      checkAuth(session).catch((error) => {
        logger.error('Failed to sync session with store', { component: 'App' }, error);
      });
      
      // Initialize services immediately when session is available
      // This prevents components from trying to use services before they're initialized
      if (session.user) {
        const userId = session.user.id;
        supabaseStorageService.setCurrentUser(userId);
        libraryOrganizationService.setCurrentUser(userId);
        librarySearchService.setCurrentUser(userId);
        logger.info('Services initialized with session from AuthContext', { userId });
      }
    } else if (!authLoading && !session) {
      // No session available, clear auth state in store
      const { setAuthenticated, setUser } = useAppStore.getState();
      setAuthenticated(false);
      setUser(null);
      
      // Clear services when there's no session
      supabaseStorageService.setCurrentUser(null as any);
      libraryOrganizationService.setCurrentUser(null as any);
      librarySearchService.setCurrentUser(null as any);
    }
  }, [session, authLoading, checkAuth]);

  useEffect(() => {
    // Initialize monitoring and error handling
    const context = {
      component: 'App',
      action: 'initialize'
    };

    logger.info('Application initializing', context);

    // Set up error notification callback
    errorHandler.setUserNotificationCallback((error) => {
      logger.error('User notification error', context, error);
      // Could show toast notification here
    });

    // Set up health monitoring alert callback
    healthMonitor.addAlertCallback((alert) => {
      logger.warn(`Health alert: ${alert.type}`, context, undefined, {
        message: alert.message,
        alertId: alert.id
      });
      // Could show alert notification here
    });

    // Check if we should show NeoReader Terminal first
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    
    logger.debug('URL parameters parsed', context, {
      searchParams: Object.fromEntries(urlParams.entries()),
      hashParams: Object.fromEntries(hashParams.entries())
    });
    
    // Check if we should show NeoReader Terminal
    if (urlParams.get('neo') === 'true') {
      logger.info('NeoReader Terminal requested', context);
      setShowNeoReader(true)
      setIsInitialized(true)
      return
    }

    // Check if we should show auth modal from landing page
    if (urlParams.get('auth') === 'true') {
      logger.info('Auth modal requested from landing page', context);
      setIsAuthModalOpen(true)
      setIsInitialized(true)
      return
    }

    // Check if we should show landing page (default behavior)
    logger.debug('Checking landing page conditions', context);
    const hasCodeParam = urlParams.has('code');
    const hasAccessTokenParam = hashParams.has('access_token');
    const shouldShowLandingPage = !hasCodeParam && !hasAccessTokenParam;
    
    logger.debug('Landing page conditions evaluated', context, {
      hasCodeParam,
      hasAccessTokenParam,
      shouldShowLandingPage
    });
    
    if (shouldShowLandingPage) {
      logger.info('Showing landing page - no OAuth params', context);
      setShowLandingPage(true)
      setIsInitialized(true)
      return
    } else {
      logger.info('Not showing landing page - has OAuth params', context);
    }

    // Wait for AuthContext to finish loading before initializing
    // This prevents the race condition where checkAuth runs before session is restored
    if (authLoading) {
      return; // Don't proceed until AuthContext has loaded the session
    }

    // Check authentication status on app load
    // Now that AuthContext has loaded, we can safely check auth state
    const initializeAuth = async () => {
      // If we have OAuth callback parameters, let Supabase handle them
      if (urlParams.has('code') || hashParams.has('access_token')) {
        logger.info('OAuth callback detected, processing', context, {
          hasCode: urlParams.has('code'),
          hasAccessToken: hashParams.has('access_token')
        });
        
        // Force Supabase to process the OAuth callback BEFORE clearing URL
        try {
          if (supabase) {
            const success = await authService.processOAuthCallback()
            if (success) {
              logger.info('OAuth callback processed successfully', context);
              // Clear the URL parameters after successful processing
              window.history.replaceState({}, document.title, window.location.pathname)
            } else {
              logger.warn('OAuth callback processing failed', context);
            }
          } else {
            logger.warn('Supabase not available - skipping OAuth processing', context);
          }
        } catch (error) {
          logger.error('Error processing OAuth callback', context, error as Error);
        }
      } else {
        logger.debug('No OAuth callback parameters found', context, {
          currentUrl: window.location.href
        });
      }
      
      // Services are already initialized in the sync effect above when session is available
      // No need to initialize them here again
      
      setIsInitialized(true)
      logger.info('Authentication initialization completed', context);
    }
    
    initializeAuth()

    // Listen for auth state changes (critical for OAuth callback!)
    let subscription: any = null
    if (supabase) {
      const authStateChange = authService.onAuthStateChange(async (user, event) => {
        logger.info('Auth state changed', context, {
          event: event,
          signedIn: !!user,
          userId: user?.id
        });
        
        // Only process SIGNED_IN and SIGNED_OUT events
        // Note: AuthContext already handles session updates, we just need to:
        // 1. Initialize services when user signs in
        // 2. Close auth modal on successful sign-in
        if (event === 'SIGNED_IN' && user) {
          // User just signed in (via OAuth or email)
          // Session sync will happen automatically via the useEffect that watches session
          
          // Initialize Supabase storage service with user ID
          supabaseStorageService.setCurrentUser(user.id)
          libraryOrganizationService.setCurrentUser(user.id)
          librarySearchService.setCurrentUser(user.id)
          logger.info('User signed in, services initialized', { userId: user.id })
          
          setIsAuthModalOpen(false)
        } else if (event === 'SIGNED_OUT') {
          // Only clear state on explicit sign-out, not on token refresh
          // Session sync will happen automatically via the useEffect that watches session
          logger.info('User signed out')
        }
        // Ignore TOKEN_REFRESHED and other events - AuthContext handles these
      })
      subscription = authStateChange.data.subscription
    }

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [checkAuth, authLoading, session])

  const handleAuthSuccess = async () => {
    if (supabase) {
      await checkAuth()
    }
    setIsAuthModalOpen(false)
  }

  // Parse auth intent from URL
  const urlParams = new URLSearchParams(window.location.search);
  const wantsAuth = urlParams.get('auth') === 'true';

  // Show loading while AuthContext is loading or app is initializing
  if (authLoading || !isInitialized) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: 'var(--color-primary)' }}
          ></div>
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
            Loading ryzomatic...
          </p>
        </div>
      </div>
    )
  }

  // Auth full-page panel (not modal) if ?auth=true and not authenticated
  if (!isAuthenticated && wantsAuth) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-slate-200 overflow-hidden">
        {/* Creative background branding */}
        <div className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center">
          {/* Centered giant, blurred text */}
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'min(16vw, 11rem)',
              color: 'rgba(100, 116, 139, 0.10)',
              letterSpacing: '.05em',
              fontWeight: 800,
              userSelect: 'none',
              filter: 'blur(3px)',
              textAlign: 'center',
              lineHeight: 1.08,
              zIndex: 0,
              position: 'absolute',
              top: '45%',
              left: 0,
              width: '100%',
              transform: 'translateY(-50%)',
            }}
          >
            ryzomatic
          </span>
          {/* Top left accent logo */}
          <img
            src="/ryzomatic-logo.png"
            alt="ryzomatic logo background"
            style={{
              position: 'absolute',
              top: '-2vw',
              left: '-7vw',
              width: '20vw',
              opacity: 0.07,
              transform: 'rotate(-18deg)',
              filter: 'blur(1.5px)',
              zIndex: 0,
            }}
          />
          {/* Bottom right accent logo */}
          <img
            src="/ryzomatic-logo.png"
            alt="ryzomatic logo background 2"
            style={{
              position: 'absolute',
              bottom: '-4vw',
              right: '-8vw',
              width: '24vw',
              opacity: 0.07,
              transform: 'rotate(19deg)',
              filter: 'blur(2px)',
              zIndex: 0,
            }}
          />
        </div>
        {/* Foreground: logo + modal */}
        <div className="relative z-10 mb-6 flex items-center gap-3">
          <img src="/ryzomatic-logo.png" alt="ryzomatic" className="h-12 w-12" />
          <h1 className="text-4xl font-bold tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ryzomatic</h1>
        </div>
        <div className="relative z-10">
          <AuthModal isOpen={true}
            onClose={() => window.location.href = '/'}
            onAuthSuccess={handleAuthSuccess}
          />
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated and not in auth flow
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <LandingPage />
      </div>
    );
  }

  // Show NeoReader Terminal if requested
  if (showNeoReader) {
    return <NeoReaderTerminal />;
  }

  // Show main app if authenticated
  return (
    <ThemeProvider>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ThemedApp />
    </ThemeProvider>
  );
}

export default App


