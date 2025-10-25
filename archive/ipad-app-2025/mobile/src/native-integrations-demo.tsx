import React, { useState } from 'react'

const NativeIntegrationsDemo = () => {
  const [cameraResult, setCameraResult] = useState<string>('No photo taken')
  const [fileResult, setFileResult] = useState<string>('No file selected')
  const [hapticResult, setHapticResult] = useState<string>('No haptic feedback yet')
  const [statusBarResult, setStatusBarResult] = useState<string>('Status bar not configured')
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testCamera = async () => {
    setIsLoading(true)
    addLog('Testing Camera plugin...')
    
    try {
      // Dynamically import Camera plugin
      const { Camera } = await import('@capacitor/camera')
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri'
      })
      
      setCameraResult(`Photo taken: ${image.webPath}`)
      addLog('✅ Camera plugin working!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setCameraResult(`Camera error: ${errorMessage}`)
      addLog(`❌ Camera error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testFilePicker = async () => {
    setIsLoading(true)
    addLog('Testing File Picker...')
    
    try {
      // Create a file input element
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pdf,.doc,.docx,.txt'
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          setFileResult(`File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
          addLog(`✅ File selected: ${file.name}`)
        }
      }
      
      input.click()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setFileResult(`File picker error: ${errorMessage}`)
      addLog(`❌ File picker error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testHaptics = async () => {
    setIsLoading(true)
    addLog('Testing Haptics plugin...')
    
    try {
      // Dynamically import Haptics plugin
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      
      // Test different haptic patterns
      await Haptics.impact({ style: ImpactStyle.Medium })
      setHapticResult('Medium impact haptic triggered')
      addLog('✅ Medium impact haptic')
      
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Light })
        setHapticResult('Light impact haptic triggered')
        addLog('✅ Light impact haptic')
      }, 500)
      
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy })
        setHapticResult('Heavy impact haptic triggered')
        addLog('✅ Heavy impact haptic')
      }, 1000)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setHapticResult(`Haptics error: ${errorMessage}`)
      addLog(`❌ Haptics error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testStatusBar = async () => {
    setIsLoading(true)
    addLog('Testing Status Bar plugin...')
    
    try {
      // Dynamically import Status Bar plugin
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      
      // Test status bar styling
      await StatusBar.setStyle({ style: Style.Dark })
      setStatusBarResult('Status bar set to dark style')
      addLog('✅ Status bar set to dark')
      
      setTimeout(async () => {
        await StatusBar.setStyle({ style: Style.Light })
        setStatusBarResult('Status bar set to light style')
        addLog('✅ Status bar set to light')
      }, 2000)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStatusBarResult(`Status bar error: ${errorMessage}`)
      addLog(`❌ Status bar error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
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
          📱 Native Integrations Demo
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
        
        <button
          onClick={testFilePicker}
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
          📁 Test File Picker
        </button>
        
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
      </div>

      {/* Results */}
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
            📷 Camera
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {cameraResult}
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
            📁 File Picker
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {fileResult}
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
            📳 Haptics
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {hapticResult}
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
            📊 Status Bar
          </h3>
          <p style={{
            color: '#d1d5db',
            fontSize: '0.9rem',
            lineHeight: '1.4'
          }}>
            {statusBarResult}
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
          📝 Test Logs
        </h3>
        
        {logs.length === 0 ? (
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
          <li><strong>Camera:</strong> Opens device camera to take a photo</li>
          <li><strong>File Picker:</strong> Opens file selection dialog for documents</li>
          <li><strong>Haptics:</strong> Triggers different vibration patterns</li>
          <li><strong>Status Bar:</strong> Changes status bar style (dark/light)</li>
        </ul>
      </div>
    </div>
  )
}

export default NativeIntegrationsDemo
