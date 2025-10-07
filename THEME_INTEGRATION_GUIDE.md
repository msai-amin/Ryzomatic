# Theme Integration Guide

## 🎨 How to Use the Academic Theme as an Option

Your site now has a **Theme Switcher** that allows users to choose between the original dark terminal theme and the new Academic Reader Pro theme.

## 🚀 What's Been Added

### 1. Theme Switcher Component
- **Location**: Header (next to Settings button)
- **Features**: 
  - Dropdown with theme options
  - Visual previews of each theme
  - Dark mode toggle
  - Persistent theme selection

### 2. Theme State Management
- **Added to App Store**: `theme` state with `currentTheme` and `isDarkMode`
- **Persistence**: Theme preferences saved to localStorage
- **Actions**: `updateTheme()` function to change themes

### 3. Theme Wrapper
- **Conditional Rendering**: Shows Academic theme when selected, default theme otherwise
- **Seamless Integration**: No changes needed to existing components

## 🎯 How It Works

### Theme Selection Flow
1. User clicks theme switcher in header
2. Dropdown shows available themes:
   - **Default**: Original dark terminal theme
   - **Academic Reader Pro**: Clean professional research interface
3. User selects theme → App switches immediately
4. Theme preference saved to localStorage
5. Next visit loads saved theme automatically

### Theme States
```typescript
interface ThemeSettings {
  currentTheme: 'default' | 'academic'
  isDarkMode: boolean
}
```

## 🎨 Available Themes

### Default Theme
- **Style**: Dark terminal aesthetic
- **Colors**: Black background, green text
- **Use Case**: Original app experience

### Academic Reader Pro Theme
- **Style**: Clean, professional research interface
- **Colors**: Light gray background, blue accents
- **Features**:
  - Color-coded annotation system
  - Document library sidebar
  - Split-pane reading interface
  - Professional typography

## 🔧 Technical Implementation

### Files Added/Modified

**New Components:**
- `src/components/ThemeSwitcher.tsx` - Theme selection UI
- `src/components/ThemeWrapper.tsx` - Conditional theme rendering
- `src/hooks/useThemePersistence.ts` - Theme persistence logic

**Modified Files:**
- `src/store/appStore.ts` - Added theme state
- `src/components/Header.tsx` - Added theme switcher
- `src/App.tsx` - Wrapped with ThemeWrapper

**Theme Files:**
- `themes/` - Complete theme system (already created)

### State Management
```typescript
// Get current theme
const { theme } = useAppStore()

// Change theme
const { updateTheme } = useAppStore()
updateTheme({ currentTheme: 'academic' })
updateTheme({ isDarkMode: true })
```

## 🎯 User Experience

### Theme Switching
1. **Instant Switch**: No page reload required
2. **Visual Feedback**: Clear indication of current theme
3. **Persistent**: Remembers choice across sessions
4. **Responsive**: Works on all screen sizes

### Theme Features
- **Academic Theme**: Full research interface with sidebar, annotations, etc.
- **Default Theme**: Original app experience unchanged
- **Dark Mode**: Available for both themes
- **Smooth Transitions**: CSS transitions between themes

## 🚀 Usage Examples

### For Users
1. Click the theme switcher in the header
2. Select "Academic Reader Pro" for research interface
3. Toggle dark mode if desired
4. Theme persists across sessions

### For Developers
```typescript
// Check current theme
const { theme } = useAppStore()
if (theme.currentTheme === 'academic') {
  // Show academic-specific features
}

// Change theme programmatically
updateTheme({ currentTheme: 'academic' })
```

## 🔄 Adding More Themes

To add new themes:

1. **Create Theme Config**: Add to `themes/theme2-config.ts`
2. **Update Theme Switcher**: Add to themes array in `ThemeSwitcher.tsx`
3. **Add Theme Wrapper Logic**: Update `ThemeWrapper.tsx`
4. **Update App Store**: Add new theme option to `ThemeSettings`

## 🎨 Customization

### Theme Colors
- Modify `themes/theme1-config.ts` for Academic theme
- CSS variables automatically applied
- Easy to create theme variations

### Theme Switcher UI
- Customize dropdown appearance in `ThemeSwitcher.tsx`
- Add theme previews or descriptions
- Modify button styling

### Theme Persistence
- Change localStorage key in `useThemePersistence.ts`
- Add theme validation
- Implement theme migration

## 📱 Mobile Support

- Theme switcher responsive on mobile
- Academic theme optimized for touch
- Sidebar collapses on small screens
- Touch-friendly theme selection

## 🎯 Benefits

1. **User Choice**: Users can pick their preferred interface
2. **No Breaking Changes**: Original theme still available
3. **Easy Extension**: Simple to add more themes
4. **Persistent**: Remembers user preferences
5. **Professional**: Academic theme for research workflows

## 🚀 Next Steps

1. **Test Both Themes**: Switch between themes to ensure everything works
2. **Customize**: Modify colors, spacing, or components as needed
3. **Add Features**: Extend themes with additional functionality
4. **User Feedback**: Gather feedback on theme preferences
5. **More Themes**: Create additional theme variations

The theme system is now fully integrated and ready to use! 🎉
