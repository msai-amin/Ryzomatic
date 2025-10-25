import React from 'react'
import ReactDOM from 'react-dom/client'
import UltraSimpleTest from './ultra-simple-test'

console.log('🚀 Main script starting...')

try {
  const rootElement = document.getElementById('root')
  console.log('Root element found:', rootElement)
  
  if (!rootElement) {
    throw new Error('Root element not found')
  }
  
  const root = ReactDOM.createRoot(rootElement)
  console.log('React root created:', root)
  
  root.render(
    <React.StrictMode>
      <UltraSimpleTest />
    </React.StrictMode>
  )
  
  console.log('✅ React app rendered successfully')
} catch (error) {
  console.error('❌ Error rendering React app:', error)
  
  // Fallback: render basic HTML
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; background-color: #000000; color: #ffffff; min-height: 100vh; font-family: Arial, sans-serif;">
        <h1 style="font-size: 2rem; color: #9ca3af; margin-bottom: 20px;">
          🎉 Smart Reader iPad App - Fallback
        </h1>
        <p style="font-size: 1.2rem; color: #d1d5db; margin-bottom: 30px;">
          React rendering failed, but basic HTML works!
        </p>
        <div style="background-color: #9ca3af; color: #000000; padding: 20px; border-radius: 12px; text-align: center;">
          ✅ Basic functionality confirmed
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #111827; border-radius: 8px; border: 1px solid #9ca3af;">
          <strong>Error:</strong> ${error}
        </div>
      </div>
    `
  }
}
