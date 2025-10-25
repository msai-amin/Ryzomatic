import React, { useState } from 'react'

const SimpleOAuthDemo = () => {
  const [authStatus, setAuthStatus] = useState('Not authenticated')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testOAuthFlow = async () => {
    try {
      setAuthStatus('Starting OAuth flow...')
      addLog('Starting OAuth authentication...')
      
      // Check if we're in a native app
      if (window.location.protocol === 'capacitor:') {
        setAuthStatus('Native app detected - OAuth ready!')
        addLog('✅ Running in native Capacitor app')
        
        // Simulate OAuth URL generation
        const oauthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=smartreader://oauth/callback&response_type=code&scope=openid%20email%20profile'
        addLog(`OAuth URL: ${oauthUrl}`)
        
        // In a real app, this would open the system browser
        setAuthStatus('OAuth URL generated (would open in browser)')
        addLog('✅ OAuth flow ready for implementation')
      } else {
        setAuthStatus('Web app detected - using web OAuth')
        addLog('✅ Running in web browser')
        addLog('✅ Web OAuth flow ready')
      }
    } catch (error) {
      setAuthStatus(`OAuth error: ${error}`)
      addLog(`❌ OAuth error: ${error}`)
    }
  }

  const testLocalStorage = async () => {
    try {
      addLog('Testing localStorage for token storage...')
      
      const testToken = 'test-jwt-token-12345'
      localStorage.setItem('smart_reader_token', testToken)
      addLog('✅ Token stored in localStorage')
      
      const retrievedToken = localStorage.getItem('smart_reader_token')
      
      if (retrievedToken === testToken) {
        setAuthStatus('Token storage working!')
        addLog('✅ Token retrieved from localStorage')
      } else {
        setAuthStatus('Token retrieval failed')
        addLog('❌ Token mismatch in localStorage')
      }
    } catch (error) {
      setAuthStatus(`Storage error: ${error}`)
      addLog(`❌ Storage error: ${error}`)
    }
  }

  const testSecureStorage = async () => {
    try {
      addLog('Testing secure storage simulation...')
      
      // Simulate secure storage using a simple encryption
      const testData = 'sensitive-user-data'
      const encodedData = btoa(testData) // Simple base64 encoding
      
      localStorage.setItem('secure_data', encodedData)
      addLog('✅ Data encoded and stored')
      
      const retrievedData = localStorage.getItem('secure_data')
      const decodedData = atob(retrievedData || '')
      
      if (decodedData === testData) {
        setAuthStatus('Secure storage simulation working!')
        addLog('✅ Data retrieved and decoded successfully')
      } else {
        setAuthStatus('Secure storage simulation failed')
        addLog('❌ Data mismatch in secure storage')
      }
    } catch (error) {
      setAuthStatus(`Secure storage error: ${error}`)
      addLog(`❌ Secure storage error: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
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
          fontSize: '2rem', 
          color: '#9ca3af',
          margin: 0 
        }}>
          🔐 OAuth & Security Demo
        </h1>
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

      {/* Test Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <button
          onClick={testOAuthFlow}
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
          🔗 Test OAuth Flow
        </button>
        
        <button
          onClick={testLocalStorage}
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
          💾 Test Token Storage
        </button>
        
        <button
          onClick={testSecureStorage}
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
          🔒 Test Secure Storage
        </button>
      </div>

      {/* Status Card */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '30px',
        border: '1px solid #9ca3af'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          🔐 Authentication Status
        </h3>
        <p style={{
          color: '#d1d5db',
          fontSize: '1rem',
          lineHeight: '1.4'
        }}>
          {authStatus}
        </p>
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
          📝 Security Test Logs
        </h3>
        
        {logs.length === 0 ? (
          <p style={{
            color: '#d1d5db',
            fontStyle: 'italic'
          }}>
            No security tests run yet. Click a button above to start!
          </p>
        ) : (
          <div style={{
            backgroundColor: '#000000',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            color: '#ffffff',
            maxHeight: '300px',
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

      {/* Instructions */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#111827',
        borderRadius: '12px',
        border: '1px solid #9ca3af'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          🎯 Security Features Tested
        </h3>
        <ul style={{
          color: '#d1d5db',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li><strong>OAuth Flow:</strong> Detects native vs web environment</li>
          <li><strong>Token Storage:</strong> Tests localStorage for auth tokens</li>
          <li><strong>Secure Storage:</strong> Simulates encrypted data storage</li>
          <li><strong>Platform Detection:</strong> Capacitor vs web environment</li>
        </ul>
      </div>
    </div>
  )
}

export default SimpleOAuthDemo
