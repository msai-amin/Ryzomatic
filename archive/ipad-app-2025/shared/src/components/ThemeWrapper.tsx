import React from 'react'
import { useAppStore } from '../store/appStore'
import { ThemeProvider } from '../../themes/ThemeProvider'
import { ThemedApp } from '../../themes/ThemedApp'

interface ThemeWrapperProps {
  children: React.ReactNode
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children }) => {
  const { theme } = useAppStore()

  // If academic theme is selected, render the themed app
  if (theme.currentTheme === 'academic') {
    return (
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    )
  }

  // Otherwise, render the default app
  return <>{children}</>
}
