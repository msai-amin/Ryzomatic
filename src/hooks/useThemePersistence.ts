import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

/**
 * Hook to persist theme settings to localStorage
 * Automatically saves theme changes and loads them on app start
 */
export const useThemePersistence = () => {
  const { theme, updateTheme } = useAppStore()

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('ryzomatic-theme')
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme)
        updateTheme(parsedTheme)
      } catch (error) {
        console.warn('Failed to parse saved theme:', error)
      }
    }
  }, [updateTheme])

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('ryzomatic-theme', JSON.stringify(theme))
  }, [theme])

  return { theme, updateTheme }
}
