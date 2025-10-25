import React, { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

const SimpleOfflineDemo = () => {
  const [isNative, setIsNative] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<string[]>([])

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const platform = Capacitor.getPlatform()
        setIsNative(platform === 'ios' || platform === 'android')
        addTestResult(`Platform detected: ${platform}`)
        addTestResult(`Native platform: ${Capacitor.isNativePlatform()}`)
      } catch (err) {
        addTestResult(`Error checking platform: ${err}`)
      }
    }

    checkPlatform()
  }, [])

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testCapacitorModules = async () => {
    setIsLoading(true)
    setError(null)
    addTestResult('Testing Capacitor modules...')

    try {
      // Test @capacitor/core
      addTestResult(`Capacitor version: ${Capacitor.getPlatform()}`)
      
      // Test @capacitor/filesystem
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      addTestResult('Filesystem module loaded successfully')
      
      // Test basic filesystem operations
      const testDir = 'smart-reader-test'
      await Filesystem.mkdir({
        path: testDir,
        directory: Directory.Data,
        recursive: true
      })
      addTestResult('Created test directory')

      // Test writing a file
      const testData = 'Hello from Smart Reader!'
      await Filesystem.writeFile({
        path: `${testDir}/test.txt`,
        data: testData,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      })
      addTestResult('Wrote test file')

      // Test reading the file
      const result = await Filesystem.readFile({
        path: `${testDir}/test.txt`,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      })
      addTestResult(`Read test file: ${result.data}`)

      // Test getting file URI
      const uriResult = await Filesystem.getUri({
        path: `${testDir}/test.txt`,
        directory: Directory.Data
      })
      addTestResult(`File URI: ${uriResult.uri}`)

      // Clean up
      await Filesystem.deleteFile({
        path: `${testDir}/test.txt`,
        directory: Directory.Data
      })
      addTestResult('Cleaned up test file')

      addTestResult('✅ All Capacitor tests passed!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      addTestResult(`❌ Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testNetworkRequest = async () => {
    setIsLoading(true)
    setError(null)
    addTestResult('Testing network request...')

    try {
      const response = await fetch('https://httpbin.org/json')
      const data = await response.json()
      addTestResult(`Network request successful: ${JSON.stringify(data).substring(0, 50)}...`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      addTestResult(`❌ Network error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setTestResults([])
    setError(null)
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--color-background, #000000)',
      color: 'var(--color-text, #ffffff)',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          color: 'var(--color-primary, #9ca3af)',
          margin: 0 
        }}>
          🔧 Capacitor Test
        </h1>
        <button
          onClick={clearResults}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--color-primary, #9ca3af)',
            border: '1px solid var(--color-primary, #9ca3af)',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Platform Info */}
      <div style={{
        backgroundColor: 'var(--color-background-secondary, #111827)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '30px',
        border: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '15px'
        }}>
          Platform Information
        </h2>
        <div style={{
          color: 'var(--color-text-secondary, #d1d5db)',
          lineHeight: '1.6'
        }}>
          <div>Native Platform: {isNative ? '✅ Yes' : '❌ No'}</div>
          <div>Capacitor Available: {typeof Capacitor !== 'undefined' ? '✅ Yes' : '❌ No'}</div>
          <div>Platform: {Capacitor.getPlatform()}</div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Test Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <button
          onClick={testCapacitorModules}
          disabled={isLoading || !isNative}
          style={{
            backgroundColor: isNative ? 'var(--color-primary, #9ca3af)' : '#6c757d',
            color: isNative ? 'var(--color-background, #000000)' : '#ffffff',
            border: 'none',
            padding: '15px 20px',
            borderRadius: '8px',
            cursor: isNative && !isLoading ? 'pointer' : 'not-allowed',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {isLoading ? 'Testing...' : 'Test Capacitor'}
        </button>

        <button
          onClick={testNetworkRequest}
          disabled={isLoading}
          style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '15px 20px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {isLoading ? 'Testing...' : 'Test Network'}
        </button>
      </div>

      {/* Test Results */}
      <div style={{
        backgroundColor: 'var(--color-background-secondary, #111827)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '15px'
        }}>
          Test Results
        </h2>
        
        {testResults.length === 0 ? (
          <p style={{
            color: 'var(--color-text-secondary, #d1d5db)',
            fontStyle: 'italic'
          }}>
            No tests run yet. Click a test button above to start.
          </p>
        ) : (
          <div style={{
            backgroundColor: 'var(--color-background, #000000)',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.9rem',
            color: 'var(--color-text, #ffffff)',
            maxHeight: '400px',
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
        backgroundColor: 'var(--color-background-secondary, #111827)',
        borderRadius: '12px',
        border: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '15px'
        }}>
          Instructions
        </h3>
        <ul style={{
          color: 'var(--color-text-secondary, #d1d5db)',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li>This demo tests Capacitor functionality on your iPad Pro M4</li>
          <li>Click "Test Capacitor" to verify file system access</li>
          <li>Click "Test Network" to verify internet connectivity</li>
          <li>All test results will appear in the console below</li>
          <li>If tests fail, check the Xcode console for detailed errors</li>
        </ul>
      </div>
    </div>
  )
}

export default SimpleOfflineDemo
