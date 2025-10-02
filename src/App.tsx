import { useEffect, useState } from 'react'
import { DocumentViewer } from './components/DocumentViewer'
import { ChatModal } from './components/ChatModal'
import { Header } from './components/Header'
import { AuthModal } from './components/AuthModal'
import NeoReaderTerminal from './components/NeoReaderTerminal'
import LandingPage from './components/LandingPage'
import { useAppStore } from './store/appStore'
import { authService, supabase } from './services/supabaseAuthService'

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
    // Check if we should show NeoReader Terminal first
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    
    console.log('URL search params:', Object.fromEntries(urlParams.entries()))
    console.log('URL hash params:', Object.fromEntries(hashParams.entries()))
    
    // Check if we should show NeoReader Terminal
    if (urlParams.get('neo') === 'true') {
      console.log('Setting showNeoReader to true')
      setShowNeoReader(true)
      setIsInitialized(true)
      return
    }

    // Check if we should show auth modal from landing page
    if (urlParams.get('auth') === 'true') {
      console.log('Showing auth modal from landing page')
      setIsAuthModalOpen(true)
      setIsInitialized(true)
      return
    }

    // Check if we should show landing page (default behavior)
    console.log('Checking landing page conditions...')
    console.log('Has code param:', urlParams.has('code'))
    console.log('Has access_token param:', hashParams.has('access_token'))
    console.log('Should show landing page:', !urlParams.has('code') && !hashParams.has('access_token'))
    
    if (!urlParams.has('code') && !hashParams.has('access_token')) {
      console.log('✅ Showing landing page')
      setShowLandingPage(true)
      setIsInitialized(true)
      return
    } else {
      console.log('❌ Not showing landing page - has OAuth params')
    }

    // Check authentication status on app load
    const initializeAuth = async () => {
      // If we have OAuth callback parameters, let Supabase handle them
      if (urlParams.has('code') || hashParams.has('access_token')) {
        console.log('OAuth callback detected, processing...')
        console.log('Code param:', urlParams.get('code'))
        console.log('Access token param:', hashParams.get('access_token'))
        
        // Force Supabase to process the OAuth callback BEFORE clearing URL
        try {
          if (supabase) {
            const success = await authService.processOAuthCallback()
            if (success) {
              console.log('✅ OAuth callback processed successfully!')
              // Clear the URL parameters after successful processing
              window.history.replaceState({}, document.title, window.location.pathname)
            } else {
              console.log('❌ OAuth callback processing failed')
            }
          } else {
            console.log('Supabase not available - skipping OAuth processing')
          }
        } catch (error) {
          console.error('Error processing OAuth callback:', error)
        }
      } else {
        console.log('No OAuth callback parameters found')
        console.log('Current URL:', window.location.href)
      }
      
      if (supabase) {
        await checkAuth()
      } else {
        console.log('Supabase not available - skipping auth check')
      }
      setIsInitialized(true)
    }
    
    initializeAuth()

    // Listen for auth state changes (critical for OAuth callback!)
    let subscription: any = null
    if (supabase) {
      const authStateChange = authService.onAuthStateChange(async (user) => {
        console.log('Auth state changed:', user ? 'signed in' : 'signed out')
        
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


