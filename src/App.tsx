import { useEffect, useState } from 'react'
import { DocumentViewer } from './components/DocumentViewer'
import { ChatModal } from './components/ChatModal'
import { Header } from './components/Header'
import { AuthModal } from './components/AuthModal'
import NeoReaderTerminal from './components/NeoReaderTerminal'
import LandingPage from './components/LandingPage'
import { useAppStore } from './store/appStore'
import { authService, supabase } from './services/supabaseAuthService'
import { healthMonitor } from './services/healthMonitor'
import { logger } from './services/logger'
import { errorHandler } from './services/errorHandler'

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
      const authStateChange = authService.onAuthStateChange(async (user) => {
        logger.info('Auth state changed', context, {
          signedIn: !!user,
          userId: user?.id
        });
        
        if (user) {
          // User just signed in (via OAuth or email)
          await checkAuth()
          setIsAuthModalOpen(false)
        } else {
          // User signed out
          await checkAuth()
        }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Smart Reader...</p>
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
      <div className="min-h-screen bg-black">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold text-white mb-4 glow-text">
              NEO_READER
            </h1>
            <p className="text-xl text-green-400 mb-8">
              Your intelligent document reading assistant
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-green-400 text-black px-8 py-3 rounded-lg text-lg font-semibold hover:bg-green-300 transition-colors"
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


  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-black">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <DocumentViewer />
      </main>
      
      {isChatOpen && (
        <ChatModal onClose={() => toggleChat()} />
      )}
    </div>
  )
}

export default App


