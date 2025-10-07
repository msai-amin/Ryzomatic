import React from 'react'
import { ThemedApp } from './ThemedApp'

/**
 * Theme Demo Component
 * 
 * This component demonstrates how to use the Academic Reader Pro theme system.
 * It can be used as a standalone demo or integrated into your existing app.
 * 
 * Usage:
 * 1. Import and use directly: <ThemeDemo />
 * 2. Or use individual components: <ThemedHeader />, <ThemedSidebar />, etc.
 * 3. Or wrap your app with <ThemeProvider> and use theme hooks
 */

export const ThemeDemo: React.FC = () => {
  return (
    <div className="theme-demo">
      <ThemedApp />
    </div>
  )
}

export default ThemeDemo
