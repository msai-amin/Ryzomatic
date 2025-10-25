/**
 * Academic Reader Pro Theme 1 Configuration
 * Based on Sample-UI-Theme1.jsx
 * Clean, professional academic interface with color-coded annotation system
 */

export interface ThemeColors {
  // Primary Colors
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  
  // Secondary Colors
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;
  
  // Background Colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  
  // Surface Colors
  surface: string;
  surfaceHover: string;
  surfaceBorder: string;
  
  // Text Colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Status Colors
  success: string;
  successHover: string;
  successLight: string;
  warning: string;
  warningHover: string;
  error: string;
  errorHover: string;
  info: string;
  infoHover: string;
  
  // Highlight Colors (for annotations)
  highlight: {
    yellow: string;
    teal: string;
    red: string;
    blue: string;
    green: string;
  };
  
  // Border Colors
  border: string;
  borderLight: string;
  borderDark: string;
  
  // Shadow Colors
  shadow: string;
  shadowLight: string;
  shadowDark: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface ThemeTypography {
  fontFamily: {
    sans: string;
    serif: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeShadows {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ThemeConfig {
  name: string;
  description: string;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  breakpoints: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

export const theme1Config: ThemeConfig = {
  name: 'Academic Reader Pro',
  description: 'Clean, professional academic interface with color-coded annotation system',
  
  colors: {
    // Primary Colors (Gray theme for black/gray/white UI)
    primary: '#9ca3af', // gray-400 (improved contrast)
    primaryHover: '#6b7280', // gray-500
    primaryLight: '#d1d5db', // gray-300
    primaryDark: '#374151', // gray-700
    
    // Secondary Colors (Lighter gray for accents)
    secondary: '#9ca3af', // gray-400
    secondaryHover: '#6b7280', // gray-500
    secondaryLight: '#e5e7eb', // gray-200
    
    // Background Colors (Dark theme)
    background: '#000000', // black
    backgroundSecondary: '#111827', // gray-900
    backgroundTertiary: '#1f2937', // gray-800
    
    // Surface Colors (Dark surfaces)
    surface: '#111827', // gray-900
    surfaceHover: '#1f2937', // gray-800
    surfaceBorder: '#374151', // gray-700
    
    // Text Colors (Light text on dark background)
    textPrimary: '#f9fafb', // gray-50 (light text)
    textSecondary: '#d1d5db', // gray-300 (lighter gray text)
    textTertiary: '#9ca3af', // gray-400 (medium gray text)
    textInverse: '#111827', // gray-900 (dark text for light backgrounds)
    
    // Status Colors
    success: '#10b981', // green-500 (semantic clarity)
    successHover: '#059669', // green-600
    successLight: '#064e3b', // green-900
    warning: '#f59e0b', // amber-500
    warningHover: '#d97706', // amber-600
    error: '#f87171', // red-400 (lighter for visibility on dark)
    errorHover: '#ef4444', // red-500
    info: '#3b82f6', // blue-500
    infoHover: '#2563eb', // blue-600
    
    // Highlight Colors (for annotations)
    highlight: {
      yellow: '#FFD700', // Gold
      teal: '#4ECDC4', // Teal
      red: '#FF6B6B', // Coral Red
      blue: '#45B7D1', // Sky Blue
      green: '#96CEB4', // Mint Green
    },
    
    // Border Colors (Subtle borders on dark background)
    border: '#4b5563', // gray-600 (improved visibility)
    borderLight: '#1f2937', // gray-800
    borderDark: '#6b7280', // gray-500
    
    // Shadow Colors (Subtle shadows on dark background)
    shadow: 'rgba(0, 0, 0, 0.5)',
    shadowLight: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.7)',
  },
  
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
    '2xl': '3rem', // 48px
    '3xl': '4rem', // 64px
  },
  
  typography: {
    fontFamily: {
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    },
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem', // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.6,
      relaxed: 1.75,
    },
  },
  
  borderRadius: {
    none: '0',
    sm: '0.125rem', // 2px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    full: '9999px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// Color palette for annotations (matching the sample)
export const annotationColors = [
  { id: 'default-yellow', color: '#FFD700', name: 'Interesting Points', value: 'yellow', bgOpacity: 'rgba(255, 215, 0, 0.1)' },
  { id: 'default-teal', color: '#4ECDC4', name: 'Key Concepts', value: 'teal', bgOpacity: 'rgba(78, 205, 196, 0.1)' },
  { id: 'default-red', color: '#FF6B6B', name: 'Critique', value: 'red', bgOpacity: 'rgba(255, 107, 107, 0.1)' },
  { id: 'default-blue', color: '#45B7D1', name: 'Questions', value: 'blue', bgOpacity: 'rgba(69, 183, 209, 0.1)' },
  { id: 'default-green', color: '#96CEB4', name: 'Evidence', value: 'green', bgOpacity: 'rgba(150, 206, 180, 0.1)' },
];

// Component-specific style configurations
export const componentStyles = {
  header: {
    height: '80px',
    padding: '1rem 1.5rem',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
  },
  sidebar: {
    width: '20rem', // 320px
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
  },
  mainContent: {
    height: 'calc(100vh - 80px)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  readingPanel: {
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    padding: '1.5rem',
  },
  notesPanel: {
    backgroundColor: 'var(--color-background)',
    padding: '1.5rem',
  },
  floatingButton: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    width: '3.5rem',
    height: '3.5rem',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text-inverse)',
    boxShadow: 'var(--shadow-lg)',
  },
};
