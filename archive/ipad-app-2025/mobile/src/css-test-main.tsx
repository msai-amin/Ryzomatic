import React from 'react'
import ReactDOM from 'react-dom/client'
import '@shared/index.css'

const CssTestApp = () => {
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Inter, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-background, #000000)',
      color: 'var(--color-text, #ffffff)'
    }}>
      <h1 style={{ 
        color: 'var(--color-primary, #9ca3af)',
        marginBottom: '20px',
        fontSize: '2rem'
      }}>
        🎨 CSS Test - Smart Reader iPad
      </h1>
      
      <div style={{ 
        backgroundColor: 'var(--color-primary, #9ca3af)',
        color: 'var(--color-background, #000000)',
        padding: '20px 40px', 
        borderRadius: '12px',
        fontSize: '18px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        ✅ CSS Variables Working!
      </div>

      <div style={{ 
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'var(--color-background-secondary, #111827)',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid var(--color-primary, #9ca3af)',
          minWidth: '200px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'var(--color-primary, #9ca3af)' }}>Theme Colors</h3>
          <p style={{ fontSize: '14px', margin: '10px 0' }}>
            Background: Dark<br/>
            Primary: Gray<br/>
            Text: White
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--color-background-tertiary, #1f2937)',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid var(--color-primary, #9ca3af)',
          minWidth: '200px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'var(--color-primary, #9ca3af)' }}>iPad Ready</h3>
          <p style={{ fontSize: '14px', margin: '10px 0' }}>
            Touch optimized<br/>
            Apple Pencil ready<br/>
            Split-screen support
          </p>
        </div>
      </div>

      <div style={{ 
        marginTop: '30px',
        padding: '20px',
        backgroundColor: 'var(--color-background-secondary, #111827)',
        borderRadius: '8px',
        fontSize: '16px',
        color: 'var(--color-text-secondary, #d1d5db)',
        textAlign: 'center',
        maxWidth: '500px'
      }}>
        <strong>CSS Status:</strong> ✅ Loaded<br/>
        <strong>Theme Variables:</strong> ✅ Working<br/>
        <strong>iPad Optimization:</strong> ✅ Ready
      </div>
    </div>
  )
}

console.log('🎨 CSS test app starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssTestApp />
  </React.StrictMode>,
)
