import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { theme1Config, ThemeConfig, annotationColors as defaultAnnotationColors } from './theme1-config';
import { readingModeThemeConfig } from './reading-mode-theme-config';
import '../src/themes/theme1-variables.css';
import { MoreVertical, Plus } from 'lucide-react';
import { ColorEditModal } from './ColorEditModal';
import { AddCategoryModal } from './AddCategoryModal';

export interface AnnotationColor {
  id: string;
  color: string;
  name: string;
  value: string;
  bgOpacity: string;
}

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  annotationColors: AnnotationColor[];
  updateAnnotationColor: (id: string, updates: Partial<AnnotationColor>) => void;
  addAnnotationColor: (color: Omit<AnnotationColor, 'id'>) => void;
  deleteAnnotationColor: (id: string) => void;
  resetAnnotationColor: (id: string) => void;
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
  const [annotationColors, setAnnotationColors] = useState<AnnotationColor[]>(defaultAnnotationColors);

  // Load theme and custom colors from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('academic-reader-theme');
    const savedDarkMode = localStorage.getItem('academic-reader-dark-mode');
    const savedColors = localStorage.getItem('annotation-colors-custom');
    
    // Load dark mode first so we can use it for validation
    let loadedDarkMode = false;
    if (savedDarkMode) {
      try {
        loadedDarkMode = JSON.parse(savedDarkMode as string);
        setIsDarkMode(loadedDarkMode);
      } catch (error) {
        console.warn('Failed to parse saved dark mode, using default');
      }
    }
    
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme as string);
        // Comprehensive validation: check for all required properties
        const hasRequiredColors = parsedTheme && 
          parsedTheme.colors && 
          parsedTheme.colors.background && 
          parsedTheme.colors.textPrimary &&
          parsedTheme.colors.surface &&
          parsedTheme.colors.border;
        
        // Validate color values are not invalid (white backgrounds causing visibility issues)
        // Allow dark themes with light text - that's valid
        if (hasRequiredColors) {
          // Quick validation: only block white/transparent backgrounds (always problematic)
          // Don't block white text - it's valid in dark mode
          const bg = String(parsedTheme.colors.background || '').toLowerCase().trim();
          const isWhiteBg = bg === '#ffffff' || bg === '#fff' || bg === 'white' || bg === 'transparent' || bg === 'rgba(0,0,0,0)';
          
          // Only block white/transparent backgrounds - always invalid regardless of mode
          // White text is fine in dark mode, so don't validate that
          if (isWhiteBg) {
            console.warn('Saved theme has invalid white/transparent background, using default theme');
            localStorage.removeItem('academic-reader-theme');
            setCurrentTheme(defaultTheme);
          } else {
            // Theme is valid - apply it
            setCurrentTheme(parsedTheme);
          }
        } else {
          console.warn('Saved theme is missing required properties, using default');
          // Clear invalid theme from localStorage
          localStorage.removeItem('academic-reader-theme');
        }
      } catch (error) {
        console.warn('Failed to parse saved theme, using default:', error);
        // Clear corrupted theme from localStorage
        localStorage.removeItem('academic-reader-theme');
      }
    }

    if (savedColors) {
      try {
        const parsedColors = JSON.parse(savedColors as string);
        if (Array.isArray(parsedColors)) {
          setAnnotationColors(parsedColors);
        }
      } catch (error) {
        console.warn('Failed to parse saved colors, using defaults');
      }
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

  // Save custom annotation colors to localStorage
  useEffect(() => {
    localStorage.setItem('annotation-colors-custom', JSON.stringify(annotationColors));
  }, [annotationColors]);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    
    // Ensure theme is valid - if currentTheme is missing properties, use defaultTheme
    const themeToApply = currentTheme || defaultTheme;
    
    // Safety check: If the theme background is white/transparent, force default theme
    const bg = String(themeToApply.colors?.background || '').toLowerCase().trim();
    const isInvalidBg = bg === '#ffffff' || bg === '#fff' || bg === 'white' || bg === 'transparent' || bg === 'rgba(0,0,0,0)' || bg === '';
    if (isInvalidBg) {
      console.warn('Theme has invalid white/transparent/missing background, forcing default theme');
      // Clear corrupted theme and reset
      localStorage.removeItem('academic-reader-theme');
      setCurrentTheme(defaultTheme);
      // Don't return early - apply defaultTheme immediately
      const finalTheme = defaultTheme;
      
      // Apply default theme colors immediately
      Object.entries(finalTheme.colors).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (subValue && typeof subValue === 'string') {
              root.style.setProperty(`--color-${key}-${subKey}`, subValue);
            }
          });
        } else if (value && typeof value === 'string') {
          root.style.setProperty(`--color-${key}`, value);
        }
      });
      
      // Apply other theme properties
      Object.entries(finalTheme.spacing || {}).forEach(([key, value]) => {
        if (value) root.style.setProperty(`--spacing-${key}`, value as string);
      });
      
      Object.entries(finalTheme.typography || {}).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (subValue !== null && subValue !== undefined) {
              root.style.setProperty(`--font-${key}-${subKey}`, String(subValue));
            }
          });
        } else if (value !== null && value !== undefined) {
          root.style.setProperty(`--font-${key}`, String(value));
        }
      });
      
      Object.entries(finalTheme.borderRadius || {}).forEach(([key, value]) => {
        if (value) root.style.setProperty(`--border-radius-${key}`, value as string);
      });
      
      Object.entries(finalTheme.shadows || {}).forEach(([key, value]) => {
        if (value) root.style.setProperty(`--shadow-${key}`, value as string);
      });
      
      return; // Exit early after applying default
    }
    
    // Comprehensive color validation to prevent visibility issues
    const validateColor = (color: string, fallback: string, key: string, subKey?: string): string => {
      if (!color || typeof color !== 'string') {
        return fallback;
      }
      
      const colorLower = color.toLowerCase().trim();
      const isWhite = colorLower === '#ffffff' || colorLower === '#fff' || colorLower === 'white';
      const isTransparent = colorLower === 'transparent' || colorLower === 'rgba(0,0,0,0)';
      
      // Determine color type
      const isBackgroundColor = key === 'background' || key === 'backgroundSecondary' || 
                                key === 'backgroundTertiary' || key === 'surface' || 
                                key === 'surfaceHover' || key === 'surfaceBorder';
      const isTextColor = key === 'textPrimary' || key === 'textSecondary' || 
                          key === 'textTertiary' || key === 'textInverse' ||
                          (key === 'text' && (subKey === 'Primary' || subKey === 'Secondary' || subKey === 'Tertiary'));
      
      // Block white/transparent backgrounds - always invalid (causes visibility issues)
      if (isBackgroundColor && (isWhite || isTransparent)) {
        console.warn(`Invalid white/transparent background color detected for ${key}${subKey ? '.' + subKey : ''}, using fallback`);
        return fallback;
      }
      
      // Don't block white text - it's valid in dark mode
      // Only block if we're in light mode AND it's a text color AND background is light
      // For now, be less strict - allow white text since we're using dark theme
      
      return color;
    };
    
    // Apply CSS custom properties with comprehensive validation
    Object.entries(themeToApply.colors).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue && typeof subValue === 'string') {
            // Get fallback from defaultTheme if available
            const fallback = (defaultTheme.colors as any)[key]?.[subKey] || subValue;
            const validatedColor = validateColor(subValue, fallback, key, subKey);
            root.style.setProperty(`--color-${key}-${subKey}`, validatedColor);
          }
        });
      } else if (value && typeof value === 'string') {
        // Get fallback from defaultTheme if available
        const fallback = (defaultTheme.colors as any)[key] || value;
        const validatedColor = validateColor(value, fallback, key);
        root.style.setProperty(`--color-${key}`, validatedColor);
      }
    });

    // Apply spacing
    if (themeToApply.spacing) {
      Object.entries(themeToApply.spacing).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(`--spacing-${key}`, value as string);
        }
      });
    }

    // Apply typography
    if (themeToApply.typography) {
      Object.entries(themeToApply.typography).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (subValue !== null && subValue !== undefined) {
              root.style.setProperty(`--font-${key}-${subKey}`, String(subValue));
            }
          });
        } else if (value !== null && value !== undefined) {
          root.style.setProperty(`--font-${key}`, String(value));
        }
      });
    }

    // Apply border radius
    if (themeToApply.borderRadius) {
      Object.entries(themeToApply.borderRadius).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(`--border-radius-${key}`, value as string);
        }
      });
    }

    // Apply shadows
    if (themeToApply.shadows) {
      Object.entries(themeToApply.shadows).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(`--shadow-${key}`, value as string);
        }
      });
    }

    // Apply dark mode class
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [currentTheme, isDarkMode, defaultTheme]);

  const setTheme = (theme: ThemeConfig) => {
    setCurrentTheme(theme);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Color management functions
  const updateAnnotationColor = (id: string, updates: Partial<AnnotationColor>) => {
    setAnnotationColors((colors) =>
      colors.map((color) =>
        color.id === id ? { ...color, ...updates } : color
      )
    );
  };

  const addAnnotationColor = (color: Omit<AnnotationColor, 'id'>) => {
    const newColor: AnnotationColor = {
      ...color,
      id: `custom-${Date.now()}`,
    };
    setAnnotationColors((colors) => [...colors, newColor]);
  };

  const deleteAnnotationColor = (id: string) => {
    setAnnotationColors((colors) => colors.filter((color) => color.id !== id));
  };

  const resetAnnotationColor = (id: string) => {
    const defaultColor = defaultAnnotationColors.find((color) => color.id === id);
    if (defaultColor) {
      updateAnnotationColor(id, defaultColor);
    }
  };

  const value: ThemeContextType = {
    currentTheme,
    setTheme,
    annotationColors,
    updateAnnotationColor,
    addAnnotationColor,
    deleteAnnotationColor,
    resetAnnotationColor,
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

// CRITICAL: Safe default context to prevent crashes during initialization
// This prevents "Cannot read properties of undefined" errors when components
// use useTheme before ThemeProvider is fully initialized
// This addresses the race condition where PDFViewerV2 renders before ThemeProvider context is ready
// CRITICAL: defaultAnnotationColors is imported from theme1-config.ts and is guaranteed to be an array
// Using an array (even if empty) ensures .length checks never crash
const safeDefaultContext: ThemeContextType = {
  currentTheme: theme1Config,
  setTheme: () => {
    console.warn('useTheme: setTheme called outside ThemeProvider, using default theme');
  },
  annotationColors: Array.isArray(defaultAnnotationColors) ? defaultAnnotationColors : [],
  updateAnnotationColor: () => {
    console.warn('useTheme: updateAnnotationColor called outside ThemeProvider');
  },
  addAnnotationColor: () => {
    console.warn('useTheme: addAnnotationColor called outside ThemeProvider');
  },
  deleteAnnotationColor: () => {
    console.warn('useTheme: deleteAnnotationColor called outside ThemeProvider');
  },
  resetAnnotationColor: () => {
    console.warn('useTheme: resetAnnotationColor called outside ThemeProvider');
  },
  isDarkMode: false,
  toggleDarkMode: () => {
    console.warn('useTheme: toggleDarkMode called outside ThemeProvider');
  },
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  // CRITICAL: Return safe default instead of throwing error
  // This prevents components from crashing during initialization or if ThemeProvider is missing
  // The safe default ensures all properties are always defined, preventing undefined.length errors
  // This addresses the race condition where PDFViewerV2 renders before ThemeProvider context is ready
  if (context === undefined) {
    // Log a warning for developers, but keep the app alive for the user
    // This prevents the "Cannot read properties of undefined (reading 'length')" crash
    console.warn('useTheme was used outside of ThemeProvider. Returning safe defaults.');
    return safeDefaultContext;
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
  const { 
    annotationColors, 
    updateAnnotationColor, 
    addAnnotationColor, 
    deleteAnnotationColor, 
    resetAnnotationColor 
  } = useTheme();
  
  const [editingColor, setEditingColor] = useState<AnnotationColor | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleEdit = (color: AnnotationColor, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingColor(color);
  };

  const isDefaultColor = (id: string) => id.startsWith('default-');

  return (
    <>
      <div className="space-y-2" style={{ backgroundColor: 'transparent', color: 'inherit' }}>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)', backgroundColor: 'transparent' }}>
          Color Coding System
        </h3>
        <div className="space-y-2" style={{ backgroundColor: 'transparent' }}>
          {annotationColors.map((item) => (
            <div
              key={item.id}
              className="flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors relative group"
              style={{
                backgroundColor: selectedColor === item.color ? 'rgba(156, 163, 175, 0.2)' : 'transparent',
                border: selectedColor === item.color ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: 'inherit',
              }}
              onClick={() => onColorSelect(item.color)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className="w-6 h-6 rounded-full flex-shrink-0"
                style={{ 
                  backgroundColor: item.color,
                  border: '2px solid var(--color-border)'
                }}
              />
              <span 
                className="text-sm font-semibold flex-1"
                style={{
                  color: 'var(--color-text-primary)'
                }}
              >
                {item.name}
              </span>
              {/* Kebab menu button */}
              <button
                onClick={(e) => handleEdit(item, e)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: hoveredId === item.id ? 'var(--color-surface-hover)' : 'transparent',
                }}
                title="Edit category"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New Category Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full mt-4 flex items-center justify-center space-x-2 p-2 rounded-lg border-2 border-dashed transition-colors"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add New Category</span>
        </button>
      </div>

      {/* Edit Modal */}
      {editingColor && (
        <ColorEditModal
          isOpen={!!editingColor}
          onClose={() => setEditingColor(null)}
          color={editingColor}
          onSave={updateAnnotationColor}
          onDelete={deleteAnnotationColor}
          onReset={resetAnnotationColor}
          isDefault={isDefaultColor(editingColor.id)}
        />
      )}

      {/* Add Modal */}
      <AddCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addAnnotationColor}
        existingColors={annotationColors}
      />
    </>
  );
};
