import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// import './utils/googleApiTest' // Import Google API test for debugging (archived)
// import './utils/simpleOAuthTest' // Import simple OAuth test for debugging (archived)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


