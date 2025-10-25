import React, { useState } from 'react'

const OAuthDemo = () => {
  const [authStatus, setAuthStatus] = useState('Not authenticated')
  const [biometricStatus, setBiometricStatus] = useState('Not tested')
  const [keychainStatus, setKeychainStatus] = useState('Not tested')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testBiometricAuth = async () => {
    try {
      // Test if biometric authentication is available
      const { BiometricAuth } = await import('@capacitor-community/biometric-auth')
      
      const result = await BiometricAuth.checkBiometry()
      setBiometricStatus(`Available: ${result.isAvailable}`)
      addLog(`✅ Biometric auth available: ${result.isAvailable}`)
      
      if (result.isAvailable) {
        try {
          await BiometricAuth.authenticate({
            reason: 'Authenticate to access Smart Reader',
            title: 'Smart Reader Authentication',
            subtitle: 'Use Face ID or Touch ID',
            description: 'Authenticate to securely access your documents'
          })
          setBiometricStatus('Authentication successful!')
          addLog('✅ Biometric authentication successful!')
        } catch (error) {
          setBiometricStatus(`Authentication failed: ${error}`)
          addLog(`❌ Biometric auth failed: ${error}`)
        }
      }
    } catch (error) {
      setBiometricStatus(`Error: ${error}`)
      addLog(`❌ Biometric auth error: ${error}`)
    }
  }

  const testKeychainStorage = async () => {
    try {
      // Test keychain storage for secure token storage
      const { SecureStoragePlugin } = await import('@capacitor-community/secure-storage')
      
      const testToken = 'test-jwt-token-12345'
      await SecureStoragePlugin.set({
        key: 'smart_reader_token',
        value: testToken
      })
      addLog('✅ Token stored in keychain')
      
      const retrievedToken = await SecureStoragePlugin.get({
        key: 'smart_reader_token'
      })
      
      if (retrievedToken.value === testToken) {
        setKeychainStatus('Keychain storage working!')
        addLog('✅ Token retrieved from keychain')
      } else {
        setKeychainStatus('Keychain retrieval failed')
        addLog('❌ Token mismatch in keychain')
      }
    } catch (error) {
      setKeychainStatus(`Error: ${error}`)
      addLog(`❌ Keychain error: ${error}`)
    }
  }

  const testOAuthFlow = async () => {
    try {
      // Simulate OAuth flow
      setAuthStatus('Starting OAuth flow...')
      addLog('Starting OAuth authentication...')
      
      // Check if we're in a native app
      if (window.location.protocol === 'capacitor:') {
        // In native app, we can use Universal Links
        setAuthStatus('Opening OAuth in browser...')
        addLog('Opening OAuth in external browser...')
        
        // Simulate opening OAuth URL
        const oauthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=smartreader://oauth/callback&response_type=code&scope=openid%20email%20profile'
        
        // In a real app, this would open the system browser
        addLog(`OAuth URL: ${oauthUrl}`)
        setAuthStatus('OAuth URL generated (would open in browser)')
      } else {
        // In web, use standard OAuth
        setAuthStatus('Using web OAuth flow...')
        addLog('Using web OAuth flow...')
      }
    } catch (error) {
      setAuthStatus(`OAuth error: ${error}`)
      addLog(`❌ OAuth error: ${error}`)
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
          onClick={testBiometricAuth}
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
          👤 Test Biometric Auth
        </button>
        
        <button
          onClick={testKeychainStorage}
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
          🔑 Test Keychain Storage
        </button>
      </div>

      {/* Status Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
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
            🔗 OAuth Status
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {authStatus}
          </p>
        </div>

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
            👤 Biometric Auth
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {biometricStatus}
          </p>
        </div>

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
            🔑 Keychain Storage
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {keychainStatus}
          </p>
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
          🎯 Security Features
        </h3>
        <ul style={{
          color: '#d1d5db',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li><strong>OAuth Flow:</strong> Secure authentication with Google/other providers</li>
          <li><strong>Biometric Auth:</strong> Face ID/Touch ID for secure access</li>
          <li><strong>Keychain Storage:</strong> Secure storage of authentication tokens</li>
          <li><strong>Universal Links:</strong> Seamless OAuth redirects in native app</li>
        </ul>
      </div>
    </div>
  )
}

export default OAuthDemo
