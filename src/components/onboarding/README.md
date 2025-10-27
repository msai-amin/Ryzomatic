# ryzomatic - Onboarding System

A comprehensive, responsibly designed onboarding system that guides users through the app's features with progressive disclosure and contextual help.

## 🎯 Design Principles

### 1. **Progressive Disclosure**
- Information is revealed gradually based on user context
- Users can skip non-essential steps
- Essential features are highlighted first

### 2. **Contextual Awareness**
- Onboarding adapts based on whether documents are loaded
- Different tours for different user types (students, researchers, professors)
- Smart step filtering based on current app state

### 3. **Non-Intrusive**
- Users can dismiss onboarding at any time
- Help is always available via the help button
- No forced interactions or blocking modals

### 4. **Accessible**
- Proper ARIA labels and keyboard navigation
- Clear visual indicators and progress tracking
- Screen reader friendly

## 🏗️ Architecture

### Core Components

#### `OnboardingProvider`
- Context provider that manages onboarding state
- Handles step progression and completion tracking
- Provides methods for starting, stopping, and navigating tours

#### `OnboardingOverlay`
- Main overlay component that displays tour steps
- Handles positioning and targeting of UI elements
- Manages step navigation and completion

#### `ContextualHelp`
- Floating help button and help panel
- Provides quick access to help topics
- Allows users to start specific feature tours

### Key Features

#### **Smart Step Management**
```typescript
// Steps are automatically filtered based on context
if (!currentDocument) {
  filteredSteps = allSteps.filter(step => 
    step.category === 'welcome' || 
    step.category === 'document' ||
    step.id === 'ai-chat'
  )
}
```

#### **Flexible Targeting**
```typescript
// Steps can target specific UI elements
{
  id: 'upload-document',
  target: '[data-tour="upload-button"]',
  placement: 'bottom',
  category: 'document'
}
```

#### **Progressive Categories**
- **Welcome**: Essential first-time user experience
- **Document**: Document management and library features
- **AI**: AI-powered reading assistance
- **Productivity**: Focus and efficiency tools
- **Advanced**: Customization and power features

## 🚀 Usage

### Basic Integration

```tsx
import { OnboardingProvider, OnboardingOverlay, ContextualHelp } from './onboarding'

function App() {
  return (
    <OnboardingProvider>
      <YourAppContent />
      <OnboardingOverlay />
      <ContextualHelp />
    </OnboardingProvider>
  )
}
```

### Starting Tours Programmatically

```tsx
import { useOnboarding } from './onboarding'

function MyComponent() {
  const { startOnboarding } = useOnboarding()
  
  const handleStartTour = () => {
    startOnboarding('ai') // Start AI features tour
  }
  
  return <button onClick={handleStartTour}>Learn AI Features</button>
}
```

### Adding Data Attributes

To make UI elements targetable by onboarding:

```tsx
<button data-tour="upload-button">Upload Document</button>
<input data-tour="search-input" placeholder="Search..." />
<div data-tour="document-list">Document List</div>
```

## 📋 Onboarding Steps

### Welcome & Getting Started
1. **Welcome Message** - Introduction to the app
2. **Upload Document** - How to upload first document
3. **Document Library** - Accessing and organizing documents

### AI Features
4. **AI Chat** - Opening the AI assistant
5. **Text Selection** - Using AI with selected text
6. **AI Insights** - Understanding AI responses

### Productivity Tools
7. **Pomodoro Timer** - Focus session management
8. **Text-to-Speech** - Audio reading features
9. **Highlighting** - Smart annotation system

### Advanced Features
10. **Settings** - Customization options
11. **Keyboard Shortcuts** - Power user features

## 🎨 Customization

### Adding New Steps

```typescript
const newStep: OnboardingStep = {
  id: 'my-feature',
  title: 'My Feature',
  description: 'Learn about this feature',
  target: '[data-tour="my-feature"]',
  placement: 'bottom',
  category: 'advanced',
  skipable: true,
  required: false
}
```

### Custom Help Topics

```typescript
const customTopic: HelpTopic = {
  id: 'my-topic',
  title: 'My Topic',
  description: 'Learn about this topic',
  icon: <MyIcon className="w-5 h-5" />,
  category: 'custom',
  steps: [
    'Step 1: Do this',
    'Step 2: Then do that'
  ]
}
```

## 🔧 Configuration

### Step Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier for the step |
| `title` | string | Step title displayed to user |
| `description` | string | Detailed explanation |
| `target` | string | CSS selector for target element |
| `placement` | string | Tooltip placement relative to target |
| `category` | string | Step category for filtering |
| `skipable` | boolean | Whether step can be skipped |
| `required` | boolean | Whether step is mandatory |

### Placement Options

- `top` - Above the target element
- `bottom` - Below the target element
- `left` - To the left of the target element
- `right` - To the right of the target element
- `center` - Centered on screen (no target)

## 🧪 Testing

### Manual Testing Checklist

- [ ] Onboarding starts automatically for new users
- [ ] All steps display correctly with proper positioning
- [ ] Navigation (next/previous/skip) works properly
- [ ] Help panel opens and displays topics correctly
- [ ] Contextual tours work for different categories
- [ ] Onboarding can be dismissed and restarted
- [ ] Progress is saved and remembered
- [ ] Accessibility features work (keyboard navigation, screen readers)

### Automated Testing

```typescript
// Test onboarding state management
const { result } = renderHook(() => useOnboarding())
expect(result.current.isActive).toBe(false)

// Test step progression
act(() => {
  result.current.startOnboarding()
})
expect(result.current.currentStep).toBe(0)
```

## 🚀 Future Enhancements

### Planned Features
- **Analytics Integration** - Track onboarding completion rates
- **A/B Testing** - Test different onboarding flows
- **Video Tutorials** - Embedded video explanations
- **Interactive Demos** - Hands-on feature demonstrations
- **Personalization** - Customized tours based on user role
- **Multi-language Support** - Internationalization

### Performance Optimizations
- **Lazy Loading** - Load onboarding components on demand
- **Step Caching** - Cache completed steps for faster restarts
- **Bundle Splitting** - Separate onboarding code from main bundle

## 📚 Best Practices

### For Developers
1. **Always add data-tour attributes** to interactive elements
2. **Use descriptive step descriptions** that explain the value
3. **Test on different screen sizes** to ensure proper positioning
4. **Keep steps concise** - users have short attention spans
5. **Provide skip options** for non-essential features

### For UX Designers
1. **Start with core workflows** - don't overwhelm with advanced features
2. **Use visual hierarchy** - important features should be highlighted first
3. **Provide clear progress indicators** - users need to know how much is left
4. **Design for interruption** - users should be able to pause and resume
5. **Test with real users** - validate that the flow makes sense

## 🐛 Troubleshooting

### Common Issues

**Onboarding doesn't start automatically**
- Check if user is authenticated
- Verify localStorage doesn't have 'onboarding-completed' set
- Ensure OnboardingProvider wraps the app

**Steps don't position correctly**
- Verify target elements have correct data-tour attributes
- Check if target elements are visible when step loads
- Ensure proper CSS positioning and z-index

**Help panel doesn't open**
- Check if ContextualHelp component is rendered
- Verify z-index doesn't conflict with other elements
- Ensure click handlers are properly attached

### Debug Mode

Enable debug logging by setting localStorage:
```javascript
localStorage.setItem('onboarding-debug', 'true')
```

This will log detailed information about step progression and targeting.
