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

// CRITICAL: Initialize globalThis.pdfjsLib as early as possible
// This must happen before any pdf_viewer.mjs imports are evaluated
// We do this here to ensure it's set before React components render
;(async () => {
  try {
    if (!(globalThis as any).pdfjsLib) {
      const pdfjsModule = await import('pdfjs-dist')
      const pdfjsLib = pdfjsModule.default || pdfjsModule
      ;(globalThis as any).pdfjsLib = pdfjsLib
      console.log('✅ globalThis.pdfjsLib initialized in main.tsx')
    }
  } catch (error) {
    console.error('❌ Failed to initialize PDF.js in main.tsx:', error)
    // Don't throw - let the app continue, PDF viewer will handle the error
  }
})()

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


