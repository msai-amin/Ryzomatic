import React from 'react'
import ReactDOM from 'react-dom/client'

const DebugApp = () => {
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
        🎉 Smart Reader iPad App
      </h1>
      <p style={{ color: '#666', fontSize: '18px', textAlign: 'center', marginBottom: '20px' }}>
        The app is loading successfully! This is a debug version to test the basic setup.
      </p>
      <div style={{ 
        backgroundColor: '#667eea', 
        color: 'white', 
        padding: '15px 30px', 
        borderRadius: '8px',
        fontSize: '16px'
      }}>
        ✅ Capacitor is working
      </div>
      <div style={{ 
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#e8f4fd',
        borderRadius: '5px',
        fontSize: '14px',
        color: '#0066cc'
      }}>
        <strong>Next steps:</strong><br/>
        1. Test basic functionality<br/>
        2. Add Apple Pencil support<br/>
        3. Implement offline storage
      </div>
    </div>
  )
}

console.log('🚀 Debug app starting...')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DebugApp />
  </React.StrictMode>,
)
