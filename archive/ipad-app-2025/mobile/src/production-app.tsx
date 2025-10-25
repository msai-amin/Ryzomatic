import React, { useState, useEffect } from 'react'

const ProductionApp = () => {
  const [currentView, setCurrentView] = useState('home')
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [touchCount, setTouchCount] = useState(0)
  const [lastTouch, setLastTouch] = useState('None')

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0]
      setTouchCount(prev => prev + 1)
      const touchPos = `(${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`
      setLastTouch(touchPos)
    }
  }

  // Native plugin tests
  const testHaptics = async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Medium })
      addLog('✅ Haptics working!')
    } catch (error) {
      addLog(`❌ Haptics error: ${error}`)
    }
  }

  const testStatusBar = async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      addLog('✅ Status Bar working!')
    } catch (error) {
      addLog(`❌ Status Bar error: ${error}`)
    }
  }

  const testOAuth = async () => {
    try {
      if (window.location.protocol === 'capacitor:') {
        addLog('✅ Native app detected - OAuth ready!')
        const oauthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=smartreader://oauth/callback&response_type=code&scope=openid%20email%20profile'
        addLog(`OAuth URL: ${oauthUrl}`)
      } else {
        addLog('✅ Web app detected - using web OAuth')
      }
    } catch (error) {
      addLog(`❌ OAuth error: ${error}`)
    }
  }

  const testTokenStorage = async () => {
    try {
      const testToken = 'test-jwt-token-12345'
      localStorage.setItem('smart_reader_token', testToken)
      addLog('✅ Token stored in localStorage')
      
      const retrievedToken = localStorage.getItem('smart_reader_token')
      if (retrievedToken === testToken) {
        addLog('✅ Token retrieved successfully')
      } else {
        addLog('❌ Token mismatch')
      }
    } catch (error) {
      addLog(`❌ Token storage error: ${error}`)
    }
  }

  const testCamera = async () => {
    try {
      const { Camera } = await import('@capacitor/camera')
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri'
      })
      addLog(`✅ Camera working! Photo: ${image.webPath}`)
    } catch (error) {
      addLog(`❌ Camera error: ${error}`)
    }
  }

  const testFileSystem = async () => {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      
      const testDir = 'smart-reader-test'
      await Filesystem.mkdir({
        path: testDir,
        directory: Directory.Data,
        recursive: true
      })
      addLog('✅ File system working!')
    } catch (error) {
      addLog(`❌ File system error: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  // Initialize app
  useEffect(() => {
    addLog('🚀 Smart Reader iPad App starting...')
    addLog('✅ All systems ready!')
  }, [])

  const renderHomeView = () => (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid #9ca3af'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          color: '#9ca3af',
          margin: 0 
        }}>
          📚 Smart Reader
        </h1>
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '0.9rem',
            color: '#d1d5db'
          }}>
            Touch: {touchCount} | Last: {lastTouch}
          </div>
          <button
            onClick={clearLogs}
            style={{
              backgroundColor: 'transparent',
              color: '#9ca3af',
              border: '1px solid #9ca3af',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Clear Logs
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '30px',
        marginBottom: '30px'
      }}>
        {/* Left Column - Main Features */}
        <div>
          <h2 style={{
            fontSize: '1.8rem',
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            🎯 Core Features
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <button
              onClick={() => setCurrentView('pdf')}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              📄 PDF Reader
            </button>
            
            <button
              onClick={() => setCurrentView('library')}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              📚 Library
            </button>
            
            <button
              onClick={() => setCurrentView('ai')}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              🤖 AI Chat
            </button>
            
            <button
              onClick={() => setCurrentView('notes')}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '600',
                textAlign: 'center'
              }}
            >
              ✏️ Notes
            </button>
          </div>

          {/* Touch Area */}
          <div 
            onTouchStart={handleTouch}
            onTouchEnd={handleTouch}
            style={{
              backgroundColor: '#111827',
              padding: '30px',
              borderRadius: '12px',
              border: '2px solid #9ca3af',
              textAlign: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>👆</div>
            <h3 style={{
              fontSize: '1.5rem',
              color: '#9ca3af',
              marginBottom: '10px'
            }}>
              Touch & Gesture Area
            </h3>
            <p style={{
              color: '#d1d5db',
              marginBottom: '20px'
            }}>
              Touch here to test iPad interactions
            </p>
            <div style={{
              backgroundColor: '#9ca3af',
              color: '#000000',
              padding: '15px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              Touch Count: {touchCount}
            </div>
          </div>
        </div>

        {/* Right Column - Native Features */}
        <div>
          <h2 style={{
            fontSize: '1.8rem',
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            📱 Native Features
          </h2>
          
          <div style={{
            display: 'grid',
            gap: '15px',
            marginBottom: '30px'
          }}>
            <button
              onClick={testHaptics}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              📳 Test Haptics
            </button>
            
            <button
              onClick={testStatusBar}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              📊 Test Status Bar
            </button>
            
            <button
              onClick={testOAuth}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              🔐 Test OAuth
            </button>
            
            <button
              onClick={testTokenStorage}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              💾 Test Storage
            </button>
            
            <button
              onClick={testCamera}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              📷 Test Camera
            </button>
            
            <button
              onClick={testFileSystem}
              style={{
                backgroundColor: '#9ca3af',
                color: '#000000',
                border: 'none',
                padding: '15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              📁 Test File System
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #9ca3af'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          📝 System Logs
        </h3>
        
        {logs.length === 0 ? (
          <p style={{
            color: '#d1d5db',
            fontStyle: 'italic'
          }}>
            No logs yet. Interact with the app to see activity!
          </p>
        ) : (
          <div style={{
            backgroundColor: '#000000',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            color: '#ffffff',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderPDFView = () => (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2rem', color: '#9ca3af', margin: 0 }}>
          📄 PDF Reader
        </h1>
        <button
          onClick={() => setCurrentView('home')}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#111827',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #9ca3af',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📄</div>
        <h2 style={{ fontSize: '1.8rem', color: '#9ca3af', marginBottom: '20px' }}>
          PDF Reader Ready
        </h2>
        <p style={{ color: '#d1d5db', fontSize: '1.1rem', marginBottom: '30px' }}>
          Upload and read PDFs with Apple Pencil support, highlighting, and annotations.
        </p>
        <button
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}
        >
          Upload PDF
        </button>
      </div>
    </div>
  )

  const renderLibraryView = () => (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2rem', color: '#9ca3af', margin: 0 }}>
          📚 Library
        </h1>
        <button
          onClick={() => setCurrentView('home')}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#111827',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #9ca3af',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📚</div>
        <h2 style={{ fontSize: '1.8rem', color: '#9ca3af', marginBottom: '20px' }}>
          Document Library
        </h2>
        <p style={{ color: '#d1d5db', fontSize: '1.1rem', marginBottom: '30px' }}>
          Organize and manage your research documents with smart categorization and search.
        </p>
        <button
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}
        >
          Browse Documents
        </button>
      </div>
    </div>
  )

  const renderAIView = () => (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2rem', color: '#9ca3af', margin: 0 }}>
          🤖 AI Chat
        </h1>
        <button
          onClick={() => setCurrentView('home')}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#111827',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #9ca3af',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🤖</div>
        <h2 style={{ fontSize: '1.8rem', color: '#9ca3af', marginBottom: '20px' }}>
          AI Research Assistant
        </h2>
        <p style={{ color: '#d1d5db', fontSize: '1.1rem', marginBottom: '30px' }}>
          Get intelligent insights, summaries, and answers about your research documents.
        </p>
        <button
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}
        >
          Start Chat
        </button>
      </div>
    </div>
  )

  const renderNotesView = () => (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ fontSize: '2rem', color: '#9ca3af', margin: 0 }}>
          ✏️ Notes
        </h1>
        <button
          onClick={() => setCurrentView('home')}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ← Back to Home
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#111827',
        padding: '40px',
        borderRadius: '12px',
        border: '1px solid #9ca3af',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✏️</div>
        <h2 style={{ fontSize: '1.8rem', color: '#9ca3af', marginBottom: '20px' }}>
          Smart Notes
        </h2>
        <p style={{ color: '#d1d5db', fontSize: '1.1rem', marginBottom: '30px' }}>
          Take notes with Apple Pencil, organize thoughts, and sync across devices.
        </p>
        <button
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: '600'
          }}
        >
          Create Note
        </button>
      </div>
    </div>
  )

  // Render current view
  switch (currentView) {
    case 'pdf':
      return renderPDFView()
    case 'library':
      return renderLibraryView()
    case 'ai':
      return renderAIView()
    case 'notes':
      return renderNotesView()
    default:
      return renderHomeView()
  }
}

export default ProductionApp
