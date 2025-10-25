/**
 * Academic Reader Pro Theme System
 * Exports all theme-related components and configurations
 */

// Theme Configuration
export { theme1Config, annotationColors } from './theme1-config'
export type { ThemeConfig, ThemeColors, ThemeSpacing, ThemeTypography, ThemeBorderRadius, ThemeShadows } from './theme1-config'

// Theme Provider and Hooks
export { ThemeProvider, useTheme, ThemeSwitcher, AnnotationColorPicker } from './ThemeProvider'
export type { AnnotationColor } from './ThemeProvider'

// Color Management Modals
export { ColorEditModal } from './ColorEditModal'
export { AddCategoryModal } from './AddCategoryModal'

// Themed Components
export { ThemedApp } from './ThemedApp'
export { ThemedHeader } from './ThemedHeader'
export { ThemedSidebar } from './ThemedSidebar'
export { ThemedMainContent } from './ThemedMainContent'

// CSS Variables (for direct import)
import '../src/themes/theme1-variables.css'
