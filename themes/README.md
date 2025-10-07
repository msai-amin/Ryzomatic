# Academic Reader Pro Theme System

A comprehensive theming system for the Academic Reader Pro application, based on the clean, professional design from `Sample-UI-Theme1.jsx`.

## 🎨 Theme Features

- **Clean Academic Design**: Professional interface optimized for research and reading
- **Color-Coded Annotations**: 5-color highlighting system for different types of notes
- **Responsive Layout**: Sidebar, main content, and notes panel
- **Dark Mode Support**: Automatic dark mode detection with manual toggle
- **CSS Variables**: Easy customization through CSS custom properties
- **TypeScript Support**: Fully typed theme configuration

## 🚀 Quick Start

### 1. Import the Theme Provider

```tsx
import { ThemeProvider, ThemedApp } from './themes'

function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  )
}
```

### 2. Use Individual Themed Components

```tsx
import { ThemedHeader, ThemedSidebar, ThemedMainContent } from './themes'

function MyApp() {
  return (
    <div>
      <ThemedHeader />
      <div className="flex">
        <ThemedSidebar isOpen={true} onToggle={() => {}} />
        <ThemedMainContent />
      </div>
    </div>
  )
}
```

### 3. Use Theme Hooks

```tsx
import { useTheme } from './themes'

function MyComponent() {
  const { currentTheme, annotationColors, isDarkMode, toggleDarkMode } = useTheme()
  
  return (
    <div style={{ color: 'var(--color-text-primary)' }}>
      <h1>{currentTheme.name}</h1>
      <button onClick={toggleDarkMode}>
        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
    </div>
  )
}
```

## 🎨 Color System

### Primary Colors
- **Primary**: Blue (#2563eb) - Main actions and highlights
- **Secondary**: Green (#059669) - TTS and success states
- **Background**: Light gray (#f9fafb) - Main background
- **Surface**: White (#ffffff) - Cards and panels

### Annotation Colors
- **Yellow** (#FFD700) - Interesting Points
- **Teal** (#4ECDC4) - Key Concepts  
- **Red** (#FF6B6B) - Critique
- **Blue** (#45B7D1) - Questions
- **Green** (#96CEB4) - Evidence

## 📁 File Structure

```
themes/
├── README.md                    # This file
├── index.ts                     # Main exports
├── theme1-config.ts            # Theme configuration
├── theme1-variables.css        # CSS custom properties
├── ThemeProvider.tsx           # Theme context and provider
├── ThemedApp.tsx              # Complete themed application
├── ThemedHeader.tsx           # Themed header component
├── ThemedSidebar.tsx          # Themed sidebar component
├── ThemedMainContent.tsx      # Themed main content area
└── Sample-UI-Theme1.jsx       # Original sample design
```

## 🔧 Customization

### 1. Modify Theme Configuration

Edit `theme1-config.ts` to change colors, spacing, typography, etc.:

```typescript
export const theme1Config: ThemeConfig = {
  name: 'My Custom Theme',
  colors: {
    primary: '#your-color',
    // ... other colors
  },
  // ... other properties
}
```

### 2. Use CSS Variables

All theme values are available as CSS custom properties:

```css
.my-component {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-lg);
}
```

### 3. Create New Themes

Create a new theme by extending the `ThemeConfig` interface:

```typescript
export const myCustomTheme: ThemeConfig = {
  name: 'My Custom Theme',
  description: 'A custom theme for my app',
  colors: { /* ... */ },
  spacing: { /* ... */ },
  // ... other properties
}
```

## 🎯 Component Usage

### ThemedHeader
- Clean header with logo, document info, and action buttons
- Responsive design with mobile-friendly menu
- Integrated with app store for authentication and document state

### ThemedSidebar
- Document library with progress indicators
- Color-coded annotation system
- Reading stats and recent activity
- Collapsible design

### ThemedMainContent
- Split-pane layout: reading panel + notes panel
- Highlighted text examples
- Interactive note creation
- TTS controls integration

## 🌙 Dark Mode

The theme automatically detects system dark mode preference and can be toggled manually:

```tsx
const { isDarkMode, toggleDarkMode } = useTheme()

<button onClick={toggleDarkMode}>
  {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
</button>
```

## 📱 Responsive Design

The theme includes responsive breakpoints and mobile-friendly components:

- **Mobile**: Collapsible sidebar, stacked layout
- **Tablet**: Sidebar overlay, optimized spacing
- **Desktop**: Full sidebar, side-by-side panels

## 🔄 Theme Switching

Switch between themes at runtime:

```tsx
const { currentTheme, setTheme } = useTheme()

<select onChange={(e) => setTheme(availableThemes[e.target.value])}>
  <option value="theme1">Academic Reader Pro</option>
  <option value="theme2">My Custom Theme</option>
</select>
```

## 🎨 Annotation System

The theme includes a comprehensive annotation system:

```tsx
import { AnnotationColorPicker } from './themes'

<AnnotationColorPicker
  selectedColor={currentColor}
  onColorSelect={setCurrentColor}
/>
```

## 🚀 Integration with Existing App

To integrate with your existing app:

1. Wrap your app with `ThemeProvider`
2. Replace components with themed versions
3. Use CSS variables for styling
4. Import theme hooks where needed

```tsx
// Before
<Header />
<Sidebar />
<MainContent />

// After  
<ThemedHeader />
<ThemedSidebar isOpen={isOpen} onToggle={toggleSidebar} />
<ThemedMainContent />
```

## 📝 Notes

- All components are fully typed with TypeScript
- CSS variables are automatically applied to the document root
- Theme state is persisted in localStorage
- Components are designed to work with the existing app store
- Easy to extend and customize for different use cases
