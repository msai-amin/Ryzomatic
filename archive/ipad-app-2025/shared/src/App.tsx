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

function App() {
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

    // Check authentication status on app load
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
      
      try {
        if (supabase) {
          await checkAuth()
          
          // Initialize Supabase storage service if user is already authenticated
          if (isAuthenticated && user) {
            supabaseStorageService.setCurrentUser(user.id)
            libraryOrganizationService.setCurrentUser(user.id)
            librarySearchService.setCurrentUser(user.id)
            logger.info('Supabase storage service initialized on startup', { userId: user.id })
          }
        } else {
          logger.warn('Supabase not available - skipping auth check', context);
        }
        setIsInitialized(true)
        logger.info('Authentication initialization completed', context);
      } catch (error) {
        logger.error('Authentication initialization failed', context, error as Error);
        await errorHandler.handleError(error as Error, context);
        setIsInitialized(true); // Still initialize to show error state
      }
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
        if (event === 'SIGNED_IN' && user) {
          // User just signed in (via OAuth or email)
          await checkAuth()
          
          // Initialize Supabase storage service with user ID
          supabaseStorageService.setCurrentUser(user.id)
          libraryOrganizationService.setCurrentUser(user.id)
          librarySearchService.setCurrentUser(user.id)
          logger.info('User signed in, services initialized', { userId: user.id })
          
          setIsAuthModalOpen(false)
        } else if (event === 'SIGNED_OUT') {
          // Only clear state on explicit sign-out, not on token refresh
          logger.info('User signed out')
          await checkAuth()
        }
        // Ignore TOKEN_REFRESHED and other events to prevent loops
      })
      subscription = authStateChange.data.subscription
    }

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [checkAuth])

  const handleAuthSuccess = async () => {
    if (supabase) {
      await checkAuth()
    }
    setIsAuthModalOpen(false)
  }

  // Show loading while checking auth
  if (!isInitialized) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: 'var(--color-background)',
        }}
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: 'var(--color-primary)' }}
          ></div>
          <p 
            className="mt-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Loading Academic Reader Pro...
          </p>
        </div>
      </div>
    )
  }

  // Show Landing Page if requested (check this BEFORE auth check)
  console.log('showLandingPage state:', showLandingPage)
  if (showLandingPage) {
    console.log('Rendering LandingPage component')
    return <LandingPage />
  }

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen"
        style={{
          backgroundColor: 'var(--color-background)',
        }}
      >
        <ThemedHeader 
          onUploadClick={() => {}} 
          isSidebarOpen={true}
          onSidebarToggle={() => {}}
        />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-20">
            <h1 
              className="text-4xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Academic Reader Pro
            </h1>
            <p 
              className="text-xl mb-8"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Your intelligent document reading assistant
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              GET STARTED
            </button>
          </div>
        </main>
        
        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    )
  }

  // Show NeoReader Terminal if requested
  console.log('showNeoReader state:', showNeoReader)
  console.log('isInitialized state:', isInitialized)
  if (showNeoReader) {
    console.log('Rendering NeoReaderTerminal component')
    return <NeoReaderTerminal />
  }


  // Show main app if authenticated - use ThemedApp for consistent production/development UI
  return (
    <ThemeProvider>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ThemedApp />
    </ThemeProvider>
  )
}

export default App


