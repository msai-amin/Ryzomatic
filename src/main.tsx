import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '../themes/ThemeProvider'
import { AuthProvider } from './contexts/AuthContext'
// Initialize Sentry for error tracking
import initSentry from '../sentry.client.config'
import * as Sentry from '@sentry/react'
import { configurePDFWorker, getPDFWorkerSrc } from './utils/pdfjsConfig'
// import './utils/googleApiTest' // Import Google API test for debugging (archived)
// import './utils/simpleOAuthTest' // Import simple OAuth test for debugging (archived)

initSentry()

// CRITICAL: Pre-import pdfjs-dist to ensure it's loaded before react-pdf-viewer
// We use a top-level await to ensure the module is loaded synchronously
// This ensures that when react-pdf-viewer's Worker component imports pdfjs-dist,
// it gets the same module instance that has GlobalWorkerOptions configured
// According to react-pdf-viewer docs: https://react-pdf-viewer.dev/docs/options/
// The Worker component expects GlobalWorkerOptions to exist on the pdfjs-dist module

// Use dynamic import at top level (not in a function) to ensure it runs before React renders
const pdfjsModulePromise = import('pdfjs-dist').then((module) => {
  const pdfjsLib = module.default || module
  const workerSrc = getPDFWorkerSrc()
  
  // Configure GlobalWorkerOptions.workerSrc
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
    console.log('✅ main.tsx: Configured pdfjsLib.GlobalWorkerOptions.workerSrc', { 
      workerSrc,
      hasGlobalWorkerOptions: !!pdfjsLib.GlobalWorkerOptions,
      hasGetDocument: typeof pdfjsLib.getDocument === 'function',
      libKeys: Object.keys(pdfjsLib).slice(0, 10)
    })
  } else {
    console.error('❌ main.tsx: GlobalWorkerOptions not found on pdfjsLib', {
      pdfjsLibType: typeof pdfjsLib,
      libKeys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 20) : [],
      hasGetDocument: typeof pdfjsLib?.getDocument,
      moduleKeys: Object.keys(module).slice(0, 10)
    })
  }
  
  // Set globalThis.pdfjsLib for our own use
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any).pdfjsLib = pdfjsLib
    console.log('✅ main.tsx: Set globalThis.pdfjsLib', {
      hasGlobalWorkerOptions: !!pdfjsLib?.GlobalWorkerOptions,
      workerSrc: pdfjsLib?.GlobalWorkerOptions?.workerSrc,
      hasGetDocument: typeof pdfjsLib?.getDocument === 'function'
    })
  }
  
  return pdfjsLib
})

// Start the import immediately (don't await, but ensure it starts)
pdfjsModulePromise.catch((error) => {
  console.error('❌ main.tsx: Failed to import pdfjs-dist:', error)
})

// CRITICAL: Initialize globalThis.pdfjsLib BEFORE rendering React
// This must happen before any pdf_viewer.mjs imports are evaluated
// We initialize it synchronously here to ensure it's ready when modules are loaded
async function initializeApp() {
  try {
    // Wait for pdfjs-dist to be imported and configured
    await pdfjsModulePromise
    
    // Verify it's working correctly
    const existingLib = (globalThis as any).pdfjsLib
    if (existingLib) {
      console.log('✅ main.tsx: globalThis.pdfjsLib configured', {
        hasGetDocument: typeof existingLib.getDocument === 'function',
        hasGlobalWorkerOptions: !!existingLib.GlobalWorkerOptions,
        workerSrc: existingLib.GlobalWorkerOptions?.workerSrc
      })
    } else {
      console.error('❌ main.tsx: globalThis.pdfjsLib not set after import')
    }
  } catch (error) {
    console.error('❌ Failed to initialize PDF.js in main.tsx:', error)
    // Continue anyway - PDF viewer will handle errors gracefully
  }
  
  // Render React after PDF.js is initialized
  ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div>Something went wrong</div>} showDialog={false}>
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


