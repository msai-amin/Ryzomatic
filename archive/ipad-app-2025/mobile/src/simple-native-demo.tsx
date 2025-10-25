import React, { useState } from 'react'

const SimpleNativeDemo = () => {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (message: string) => {
    setTestResults(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testHaptics = async () => {
    setIsLoading(true)
    addResult('Testing Haptics...')
    
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Medium })
      addResult('✅ Haptics working!')
    } catch (error) {
      addResult(`❌ Haptics error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testStatusBar = async () => {
    setIsLoading(true)
    addResult('Testing Status Bar...')
    
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      addResult('✅ Status Bar working!')
    } catch (error) {
      addResult(`❌ Status Bar error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testCamera = async () => {
    setIsLoading(true)
    addResult('Testing Camera...')
    
    try {
      const { Camera } = await import('@capacitor/camera')
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri'
      })
      addResult(`✅ Camera working! Photo: ${image.webPath}`)
    } catch (error) {
      addResult(`❌ Camera error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
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
          📱 Native Plugins Test
        </h1>
        <button
          onClick={clearResults}
          style={{
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: '1px solid #9ca3af',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Clear
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
          onClick={testHaptics}
          disabled={isLoading}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          📳 Test Haptics
        </button>
        
        <button
          onClick={testStatusBar}
          disabled={isLoading}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          📊 Test Status Bar
        </button>
        
        <button
          onClick={testCamera}
          disabled={isLoading}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          📷 Test Camera
        </button>
      </div>

      {/* Results */}
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
          📝 Test Results
        </h3>
        
        {testResults.length === 0 ? (
          <p style={{
            color: '#d1d5db',
            fontStyle: 'italic'
          }}>
            No tests run yet. Click a button above to start!
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
            {testResults.map((result, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {result}
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
          🎯 What Each Test Does
        </h3>
        <ul style={{
          color: '#d1d5db',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li><strong>Haptics:</strong> Triggers vibration feedback on your iPad</li>
          <li><strong>Status Bar:</strong> Changes the status bar style to dark</li>
          <li><strong>Camera:</strong> Opens the camera to take a photo</li>
        </ul>
      </div>
    </div>
  )
}

export default SimpleNativeDemo
