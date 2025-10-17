import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { theme1Config, ThemeConfig, annotationColors } from './theme1-config';
import './theme1-variables.css';

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  annotationColors: typeof annotationColors;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeConfig;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultTheme = theme1Config 
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(defaultTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('academic-reader-theme');
    const savedDarkMode = localStorage.getItem('academic-reader-dark-mode');
    
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme as string);
        setCurrentTheme(parsedTheme);
      } catch (error) {
        console.warn('Failed to parse saved theme, using default');
      }
    }
    
    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode as string));
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('academic-reader-theme', JSON.stringify(currentTheme));
  }, [currentTheme]);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('academic-reader-dark-mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          root.style.setProperty(`--color-${key}-${subKey}`, subValue as string);
        });
      } else {
        root.style.setProperty(`--color-${key}`, value as string);
      }
    });

    // Apply spacing
    Object.entries(currentTheme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    // Apply typography
    Object.entries(currentTheme.typography).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          root.style.setProperty(`--font-${key}-${subKey}`, subValue as string);
        });
      } else {
        root.style.setProperty(`--font-${key}`, value as string);
      }
    });

    // Apply border radius
    Object.entries(currentTheme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--border-radius-${key}`, value);
    });

    // Apply shadows
    Object.entries(currentTheme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply dark mode class
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [currentTheme, isDarkMode]);

  const setTheme = (theme: ThemeConfig) => {
    setCurrentTheme(theme);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const value: ThemeContextType = {
    currentTheme,
    setTheme,
    annotationColors,
    isDarkMode,
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={`theme-academic ${isDarkMode ? 'dark' : ''}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme switching component
export const ThemeSwitcher: React.FC = () => {
  const { currentTheme, setTheme, isDarkMode, toggleDarkMode } = useTheme();

  const themes = [
    { name: 'Academic Reader Pro', config: theme1Config },
    // Add more themes here as they're created
  ];

  return (
    <div className="flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center space-x-2">
        <label htmlFor="theme-select" className="text-sm font-medium text-gray-700">
          Theme:
        </label>
        <select
          id="theme-select"
          value={currentTheme.name}
          onChange={(e) => {
            const selectedTheme = themes.find(t => t.name === e.target.value);
            if (selectedTheme) {
              setTheme(selectedTheme.config);
            }
          }}
          className="border border-gray-300 rounded-md px-3 py-1 text-sm"
        >
          {themes.map((theme) => (
            <option key={theme.name} value={theme.name}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex items-center space-x-2">
        <label htmlFor="dark-mode-toggle" className="text-sm font-medium text-gray-700">
          Dark Mode:
        </label>
        <button
          id="dark-mode-toggle"
          onClick={toggleDarkMode}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isDarkMode ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isDarkMode ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

// Annotation color picker component
export const AnnotationColorPicker: React.FC<{
  selectedColor: string;
  onColorSelect: (color: string) => void;
}> = ({ selectedColor, onColorSelect }) => {
  const { annotationColors } = useTheme();

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-gray-900">Color Coding System</h3>
      <div className="space-y-2">
        {annotationColors.map((item) => (
          <div
            key={item.value}
            className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
              selectedColor === item.color
                ? 'bg-blue-50 border-2 border-blue-200'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onColorSelect(item.color)}
          >
            <div
              className="w-6 h-6 rounded-full border-2 border-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span 
              className={`text-sm font-medium ${
                selectedColor === item.color ? 'text-gray-900' : 'text-gray-800'
              }`}
            >
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
