import React, { useState } from 'react'

const BasicTest = () => {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testBasicFunctionality = () => {
    setIsLoading(true)
    addResult('Starting basic functionality test...')
    
    try {
      // Test 1: Basic JavaScript
      addResult('✅ JavaScript is working')
      
      // Test 2: React state
      addResult('✅ React state management is working')
      
      // Test 3: DOM manipulation
      const testElement = document.getElementById('test-element')
      if (testElement) {
        addResult('✅ DOM access is working')
      }
      
      // Test 4: Local storage
      try {
        localStorage.setItem('test-key', 'test-value')
        const retrieved = localStorage.getItem('test-key')
        if (retrieved === 'test-value') {
          addResult('✅ localStorage is working')
        } else {
          addResult('❌ localStorage test failed')
        }
        localStorage.removeItem('test-key')
      } catch (err) {
        addResult(`❌ localStorage error: ${err}`)
      }
      
      // Test 5: Fetch API
      fetch('https://httpbin.org/json')
        .then(response => response.json())
        .then(data => {
          addResult('✅ Fetch API is working')
          addResult(`Network response: ${JSON.stringify(data).substring(0, 50)}...`)
        })
        .catch(err => {
          addResult(`❌ Fetch error: ${err}`)
        })
      
      // Test 6: Platform detection
      const userAgent = navigator.userAgent
      const isIOS = /iPad|iPhone|iPod/.test(userAgent)
      addResult(`Platform: ${isIOS ? 'iOS' : 'Other'}`)
      addResult(`User Agent: ${userAgent.substring(0, 50)}...`)
      
      // Test 7: Capacitor detection
      const isCapacitor = window.location.protocol === 'capacitor:'
      addResult(`Capacitor environment: ${isCapacitor ? 'Yes' : 'No'}`)
      addResult(`Protocol: ${window.location.protocol}`)
      
      // Test 8: Check for global Capacitor
      if (typeof (window as any).Capacitor !== 'undefined') {
        const Capacitor = (window as any).Capacitor
        addResult(`Global Capacitor found: ${Capacitor.getPlatform()}`)
      } else {
        addResult('Global Capacitor not found')
      }
      
      addResult('✅ Basic functionality test completed!')
      
    } catch (err) {
      addResult(`❌ Test error: ${err}`)
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
          🔧 Basic Test
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

      {/* Test Button */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <button
          onClick={testBasicFunctionality}
          disabled={isLoading}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px 30px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1.2rem',
            fontWeight: '600'
          }}
        >
          {isLoading ? 'Testing...' : 'Run Basic Tests'}
        </button>
      </div>

      {/* Test Results */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #9ca3af'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          Test Results
        </h2>
        
        {testResults.length === 0 ? (
          <p style={{
            color: '#d1d5db',
            fontStyle: 'italic'
          }}>
            No tests run yet. Click the button above to start.
          </p>
        ) : (
          <div style={{
            backgroundColor: '#000000',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.9rem',
            color: '#ffffff',
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

      {/* Hidden test element */}
      <div id="test-element" style={{ display: 'none' }}>
        Test element for DOM access
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
          What This Tests
        </h3>
        <ul style={{
          color: '#d1d5db',
          lineHeight: '1.6',
          paddingLeft: '20px'
        }}>
          <li>Basic JavaScript functionality</li>
          <li>React state management</li>
          <li>DOM access and manipulation</li>
          <li>localStorage availability</li>
          <li>Network requests (fetch API)</li>
          <li>Platform detection (iOS vs other)</li>
          <li>Capacitor environment detection</li>
          <li>Global Capacitor availability</li>
        </ul>
      </div>
    </div>
  )
}

export default BasicTest
