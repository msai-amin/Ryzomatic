import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { theme1Config, ThemeConfig, annotationColors as defaultAnnotationColors } from './theme1-config';
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
    
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme as string);
        // Validate that the theme has all required properties
        if (parsedTheme && parsedTheme.colors && parsedTheme.colors.background && parsedTheme.colors.textPrimary) {
          setCurrentTheme(parsedTheme);
        } else {
          console.warn('Saved theme is missing required properties, using default');
          // Clear invalid theme from localStorage
          localStorage.removeItem('academic-reader-theme');
        }
      } catch (error) {
        console.warn('Failed to parse saved theme, using default');
        // Clear corrupted theme from localStorage
        localStorage.removeItem('academic-reader-theme');
      }
    }
    
    if (savedDarkMode) {
      try {
        setIsDarkMode(JSON.parse(savedDarkMode as string));
      } catch (error) {
        console.warn('Failed to parse saved dark mode, using default');
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
    
    // Validate that background/surface colors aren't white (which would cause visibility issues on dark theme)
    const validateBackgroundColor = (color: string, fallback: string, key: string): string => {
      // Only validate background and surface colors to prevent white backgrounds
      const isBackgroundColor = key === 'background' || key === 'backgroundSecondary' || 
                                key === 'backgroundTertiary' || key === 'surface' || 
                                key === 'surfaceHover' || key === 'surfaceBorder';
      
      if (isBackgroundColor && color && 
          (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#fff' || color.toLowerCase() === 'white')) {
        console.warn(`Invalid white background color detected for ${key}, using fallback`);
        return fallback;
      }
      return color;
    };
    
    // Apply CSS custom properties with validation
    Object.entries(themeToApply.colors).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue && typeof subValue === 'string') {
            // Get fallback from defaultTheme if available
            const fallback = (defaultTheme.colors as any)[key]?.[subKey] || subValue;
            const validatedColor = validateBackgroundColor(subValue, fallback, key);
            root.style.setProperty(`--color-${key}-${subKey}`, validatedColor);
          }
        });
      } else if (value && typeof value === 'string') {
        // Get fallback from defaultTheme if available
        const fallback = (defaultTheme.colors as any)[key] || value;
        const validatedColor = validateBackgroundColor(value, fallback, key);
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
      <div className="space-y-2">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Color Coding System
        </h3>
        <div className="space-y-2">
          {annotationColors.map((item) => (
            <div
              key={item.id}
              className="flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors relative group"
              style={{
                backgroundColor: selectedColor === item.color ? 'rgba(156, 163, 175, 0.2)' : 'transparent',
                border: selectedColor === item.color ? '2px solid var(--color-primary)' : '2px solid transparent',
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
