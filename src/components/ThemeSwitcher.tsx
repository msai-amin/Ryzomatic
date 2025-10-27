import React from 'react'
import { Palette, Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export const ThemeSwitcher: React.FC = () => {
  const { theme, updateTheme } = useAppStore()
  const [isOpen, setIsOpen] = React.useState(false)

  const themes = [
    {
      id: 'default',
      name: 'Default',
      description: 'Original dark terminal theme',
      icon: Monitor,
      preview: 'bg-black text-green-400'
    },
    {
      id: 'academic',
      name: 'ryzome',
      description: 'Clean professional research interface',
      icon: Palette,
      preview: 'bg-gray-50 text-gray-900'
    }
  ]

  const handleThemeChange = (themeId: 'default' | 'academic') => {
    updateTheme({ currentTheme: themeId })
    setIsOpen(false)
  }

  const toggleDarkMode = () => {
    updateTheme({ isDarkMode: !theme.isDarkMode })
  }

  const currentTheme = themes.find(t => t.id === theme.currentTheme) || themes[0]

  return (
    <div className="relative">
      {/* Theme Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-green-400 text-green-400 rounded hover:bg-green-400 hover:text-black transition-colors"
      >
        <currentTheme.icon className="w-4 h-4" />
        <span className="text-sm font-medium">{currentTheme.name}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Theme Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-black border border-green-400 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-green-400 mb-4">Choose Theme</h3>
            
            {/* Theme Options */}
            <div className="space-y-3 mb-4">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => handleThemeChange(themeOption.id as 'default' | 'academic')}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    theme.currentTheme === themeOption.id
                      ? 'border-green-400 bg-green-400 bg-opacity-10'
                      : 'border-gray-600 hover:border-green-400 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <themeOption.icon className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <div className="font-medium text-white">{themeOption.name}</div>
                      <div className="text-sm text-gray-400">{themeOption.description}</div>
                    </div>
                    <div className={`w-8 h-8 rounded border ${themeOption.preview}`} />
                  </div>
                </button>
              ))}
            </div>

            {/* Dark Mode Toggle */}
            <div className="border-t border-gray-600 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {theme.isDarkMode ? (
                    <Moon className="w-4 h-4 text-green-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-green-400" />
                  )}
                  <span className="text-sm text-white">Dark Mode</span>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    theme.isDarkMode ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      theme.isDarkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
