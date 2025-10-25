import React from 'react'
import ReactDOM from 'react-dom/client'

const TestApp = () => {
  return (
    <div>
      <h1>Smart Reader Mobile Test</h1>
      <p>This is a test build to verify Capacitor setup.</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestApp />
  </React.StrictMode>,
)
