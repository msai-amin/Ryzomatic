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


