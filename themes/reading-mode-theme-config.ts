/**
 * Reading Mode Theme Configuration
 * Optimized for extended reading sessions on computer monitors
 * 
 * Features:
 * - Warm, eye-friendly background (reduces blue light)
 * - High contrast for readability
 * - Optimal typography for screen reading
 * - Comfortable color palette
 */

import { ThemeConfig } from './theme1-config';

export const readingModeThemeConfig: ThemeConfig = {
  name: 'Reading Mode',
  description: 'Optimized for extended reading on computer monitors - warm tones, high contrast, comfortable typography',
  
  colors: {
    // Primary Colors (Warm, muted tones)
    primary: '#8b7355', // Warm brown-gray
    primaryHover: '#6b5a47', // Darker warm brown
    primaryLight: '#a68b6f', // Lighter warm brown
    primaryDark: '#5a4a3a', // Dark warm brown
    
    // Secondary Colors (Soft accent colors)
    secondary: '#7a8b6f', // Muted green-gray
    secondaryHover: '#5f6d55', // Darker muted green
    secondaryLight: '#9ba88f', // Lighter muted green
    
    // Background Colors (Warm, eye-friendly)
    background: '#f5f1e8', // Warm beige (reduces eye strain)
    backgroundSecondary: '#ede8dd', // Slightly darker warm beige
    backgroundTertiary: '#e5dfd2', // Even darker warm beige
    
    // Surface Colors (Subtle contrast)
    surface: '#faf8f3', // Very light warm beige
    surfaceHover: '#f0ebe0', // Slightly darker on hover
    surfaceBorder: '#d4c9b8', // Warm border color
    
    // Text Colors (High contrast for readability)
    textPrimary: '#2c2416', // Dark brown-black (high contrast)
    textSecondary: '#4a3f2e', // Medium brown (good contrast)
    textTertiary: '#6b5d47', // Lighter brown (subtle text)
    textInverse: '#faf8f3', // Light text for dark backgrounds
    
    // Status Colors (Muted, readable)
    success: '#5a7c5a', // Muted green
    successHover: '#4a6b4a', // Darker muted green
    successLight: '#8ba68b', // Light muted green
    warning: '#b8860b', // Warm amber
    warningHover: '#9a7009', // Darker amber
    error: '#8b4a4a', // Muted red
    errorHover: '#6b3a3a', // Darker muted red
    info: '#5a7a8b', // Muted blue
    infoHover: '#4a6a7b', // Darker muted blue
    
    // Highlight Colors (Warm, readable on beige background)
    highlight: {
      yellow: '#d4a574', // Warm golden yellow
      teal: '#6b9a8b', // Muted teal
      red: '#b87a6b', // Warm coral
      blue: '#6b8ba6', // Muted blue
      green: '#7a9a7a', // Muted green
    },
    
    // Border Colors (Subtle, warm)
    border: '#d4c9b8', // Warm light brown
    borderLight: '#e5dfd2', // Very light warm brown
    borderDark: '#b8a896', // Darker warm brown
    
    // Shadow Colors (Subtle, warm)
    shadow: 'rgba(44, 36, 22, 0.15)', // Warm dark shadow
    shadowLight: 'rgba(44, 36, 22, 0.08)', // Light warm shadow
    shadowDark: 'rgba(44, 36, 22, 0.25)', // Darker warm shadow
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
      sans: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif', // Modern, readable sans-serif
      serif: '"Georgia", "Times New Roman", serif', // Classic serif for reading
      mono: '"Fira Code", "Consolas", monospace', // Code font
    },
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      base: '1.125rem', // 18px (larger for reading comfort)
      lg: '1.25rem', // 20px
      xl: '1.5rem', // 24px
      '2xl': '1.875rem', // 30px
      '3xl': '2.25rem', // 36px
      '4xl': '2.75rem', // 44px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.4, // Tighter for headings
      normal: 1.75, // Comfortable for body text (optimal for reading)
      relaxed: 2.0, // More relaxed for long reading
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
    sm: '0 1px 2px 0 rgba(44, 36, 22, 0.08)',
    md: '0 4px 6px -1px rgba(44, 36, 22, 0.1), 0 2px 4px -1px rgba(44, 36, 22, 0.06)',
    lg: '0 10px 15px -3px rgba(44, 36, 22, 0.1), 0 4px 6px -2px rgba(44, 36, 22, 0.05)',
    xl: '0 20px 25px -5px rgba(44, 36, 22, 0.1), 0 10px 10px -5px rgba(44, 36, 22, 0.04)',
    '2xl': '0 25px 50px -12px rgba(44, 36, 22, 0.15)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

