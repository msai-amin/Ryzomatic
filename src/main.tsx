import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '../themes/ThemeProvider'
import { AuthProvider } from './contexts/AuthContext'
// Initialize Sentry for error tracking
import initSentry from '../sentry.client.config'
import * as Sentry from '@sentry/react'
// import './utils/googleApiTest' // Import Google API test for debugging (archived)
// import './utils/simpleOAuthTest' // Import simple OAuth test for debugging (archived)

initSentry()

// CRITICAL: Initialize globalThis.pdfjsLib BEFORE rendering React
// This must happen before any pdf_viewer.mjs imports are evaluated
// We initialize it synchronously here to ensure it's ready when modules are loaded
async function initializeApp() {
  try {
    if (!(globalThis as any).pdfjsLib) {
      const pdfjsModule = await import('pdfjs-dist')
      const pdfjsLib = pdfjsModule.default || pdfjsModule
      ;(globalThis as any).pdfjsLib = pdfjsLib
      console.log('✅ globalThis.pdfjsLib initialized in main.tsx')
    }
  } catch (error) {
    console.error('❌ Failed to initialize PDF.js in main.tsx:', error)
    // Continue anyway - PDF viewer will handle errors gracefully
  }
  
  // Render React after PDF.js is initialized
  ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong</div>} showDialog>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
  )
}

// Initialize and render
initializeApp().catch(console.error)


