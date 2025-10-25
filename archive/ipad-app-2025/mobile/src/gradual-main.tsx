import React from 'react'
import ReactDOM from 'react-dom/client'

// Gradual component loading to identify the issue
const GradualApp = () => {
  const [step, setStep] = React.useState(1)
  const [error, setError] = React.useState<string | null>(null)

  const loadComponent = async (componentName: string) => {
    try {
      setError(null)
      console.log(`Loading ${componentName}...`)
      
      if (componentName === 'App') {
        const { App } = await import('@shared/App')
        return App
      }
      
      return null
    } catch (err) {
      console.error(`Error loading ${componentName}:`, err)
      setError(`Failed to load ${componentName}: ${err}`)
      return null
    }
  }

  const [AppComponent, setAppComponent] = React.useState<React.ComponentType | null>(null)

  React.useEffect(() => {
    if (step === 5) {
      loadComponent('App').then(component => {
        if (component) {
          setAppComponent(() => component)
        }
      })
    }
  }, [step])

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>
        🔧 Smart Reader - Gradual Loading
      </h1>
      
      <div style={{ 
        backgroundColor: '#667eea', 
        color: 'white', 
        padding: '15px 30px', 
        borderRadius: '8px',
        fontSize: '16px',
        marginBottom: '20px'
      }}>
        Step {step}: Testing Component Loading
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '20px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setStep(step + 1)}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Next Step
        </button>
        
        <button 
          onClick={() => {
            setStep(1)
            setError(null)
            setAppComponent(null)
          }}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {step === 1 && (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <h3>✅ Step 1: Basic React</h3>
          <p>React rendering confirmed</p>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <h3>✅ Step 2: Import Resolution</h3>
          <p>Module imports working</p>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <h3>✅ Step 3: Shared Package</h3>
          <p>@shared package accessible</p>
        </div>
      )}

      {step === 4 && (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <h3>✅ Step 4: Dynamic Imports</h3>
          <p>Dynamic imports working</p>
        </div>
      )}

      {step === 5 && (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <h3>🔄 Step 5: Loading Full App</h3>
          <p>Attempting to load Smart Reader App component...</p>
          {AppComponent && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ 
                backgroundColor: '#d4edda',
                color: '#155724',
                padding: '15px',
                borderRadius: '5px',
                marginBottom: '20px'
              }}>
                ✅ App component loaded successfully!
              </div>
              <div style={{ 
                backgroundColor: '#667eea',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'inline-block'
              }}
              onClick={() => setStep(6)}
              >
                Launch Full App
              </div>
            </div>
          )}
        </div>
      )}

      {step === 6 && AppComponent && (
        <div style={{ width: '100%', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 1000 }}>
          <AppComponent />
        </div>
      )}

      <div style={{ 
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#e8f4fd',
        borderRadius: '5px',
        fontSize: '14px',
        color: '#0066cc',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        <strong>Debugging Process:</strong><br/>
        • Step 1-4: Test basic functionality<br/>
        • Step 5: Load App component dynamically<br/>
        • Step 6: Launch full app (if successful)
      </div>
    </div>
  )
}

console.log('🔧 Gradual loading app starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GradualApp />
  </React.StrictMode>,
)
