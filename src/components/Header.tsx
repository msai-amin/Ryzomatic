import React from 'react'
import { Upload, MessageCircle, Settings, FileText, Library, User, Cloud, LogOut } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { DocumentUpload } from './DocumentUpload'
import { TypographySettings } from './TypographySettings'
import { LibraryModal } from './LibraryModal'
import { AuthModal } from './AuthModal'

export const Header: React.FC = () => {
  const { 
    toggleChat, 
    currentDocument, 
    isAuthenticated, 
    user, 
    logout,
    libraryRefreshTrigger
  } = useAppStore()
  const [showUpload, setShowUpload] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)
  const [showLibrary, setShowLibrary] = React.useState(false)
  const [showAuth, setShowAuth] = React.useState(false)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="bg-black border-b border-green-400 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-white text-black px-3 py-1 border border-gray-300 font-bold text-sm">
              VStyle
            </div>
            <h1 className="text-xl font-semibold text-white">NEO_READER</h1>
          </div>

          {/* Document Info */}
          {currentDocument && (
            <div className="flex items-center space-x-2 text-sm text-green-400">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-xs">{currentDocument.name}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Show Library and Upload only when user is signed in */}
            {user && (
              <>
                <button
                  onClick={() => setShowLibrary(true)}
                  className="border border-green-400 text-green-400 px-3 py-1 rounded hover:bg-green-400 hover:text-black transition-colors flex items-center space-x-2"
                >
                  <Library className="w-4 h-4" />
                  <span>LIBRARY</span>
                </button>

                <button
                  onClick={() => setShowUpload(true)}
                  className="bg-green-400 text-black px-3 py-1 rounded hover:bg-green-300 transition-colors flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>UPLOAD</span>
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowSettings(true)}
              className="border border-green-400 text-green-400 px-3 py-1 rounded hover:bg-green-400 hover:text-black transition-colors flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>SETTINGS</span>
            </button>

            {/* Auth Button */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-green-400">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {user.full_name || user.email}
                  </span>
                  <span className="text-xs bg-green-400 text-black px-2 py-1 rounded-full">
                    {user.tier?.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="border border-red-500 text-red-400 px-3 py-1 rounded hover:bg-red-500 hover:text-white transition-colors flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>LOGOUT</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="border border-green-400 text-green-400 px-3 py-1 rounded hover:bg-green-400 hover:text-black transition-colors flex items-center space-x-2"
              >
                <User className="w-4 h-4" />
                <span>SIGN IN</span>
              </button>
            )}
            
            <button
              onClick={toggleChat}
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-400 transition-colors flex items-center space-x-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>AI CHAT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAuth && (
        <AuthModal 
          isOpen={showAuth} 
          onClose={() => setShowAuth(false)} 
          onAuthSuccess={() => setShowAuth(false)}
        />
      )}

      {showLibrary && (
        <LibraryModal 
          isOpen={showLibrary} 
          onClose={() => setShowLibrary(false)} 
          refreshTrigger={libraryRefreshTrigger}
        />
      )}

      {showUpload && (
        <DocumentUpload onClose={() => setShowUpload(false)} />
      )}
      
      {showSettings && (
        <TypographySettings onClose={() => setShowSettings(false)} />
      )}
    </header>
  )
}


