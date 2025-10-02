import { useEffect, useState } from 'react'
import { DocumentViewer } from './components/DocumentViewer'
import { ChatModal } from './components/ChatModal'
import { Header } from './components/Header'
import { AuthModal } from './components/AuthModal'
import { useAppStore } from './store/appStore'
import { authService } from './services/supabaseAuthService'

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

  useEffect(() => {
    // Check authentication status on app load
    const initializeAuth = async () => {
      await checkAuth()
      setIsInitialized(true)
    }
    
    initializeAuth()

    // Listen for auth state changes (critical for OAuth callback!)
    const { data: { subscription } } = authService.onAuthStateChange(async (user) => {
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

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [checkAuth])

  const handleAuthSuccess = async () => {
    await checkAuth()
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

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-20">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Smart Reader
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Your intelligent document reading assistant
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
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

  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-gray-50">
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


