import React from 'react'
import ReactDOM from 'react-dom/client'
import ProductionApp from './production-app'
import '@shared/index.css' // Import the shared CSS

// Mobile-specific initialization
const initializeMobile = async () => {
  // Only import Capacitor when running on native platform
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    const { Capacitor } = await import('@capacitor/core')
    console.log('Running on:', Capacitor.getPlatform())

    if (Capacitor.isNativePlatform()) {
      // Import and initialize mobile-specific plugins
      const { StatusBar } = await import('@capacitor/status-bar')
      const { Keyboard } = await import('@capacitor/keyboard')

      // Configure status bar
      await StatusBar.setStyle({ style: 'default' })
      await StatusBar.setBackgroundColor({ color: '#667eea' })

      // Configure keyboard
      await Keyboard.setResizeMode({ mode: 'body' })

      console.log('Mobile plugins initialized')
    }
  } else {
    console.log('Running on web platform')
  }
}

initializeMobile()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProductionApp />
  </React.StrictMode>,
)
