# 🔘 Landing Page Buttons - Quick Reference

## Button Handlers

### **handleSignIn()**
```typescript
window.location.href = '/?auth=true';
```
**Opens:** AuthModal for login

---

### **handleGetStarted()**
```typescript
if (isAuthenticated) {
  window.location.href = '/';        // Go to app
} else {
  window.location.href = '/?auth=true';  // Open auth modal
}
```
**Smart button:** Different action based on auth state

---

### **handleGoToApp()**
```typescript
window.location.href = '/';
```
**Opens:** Main application (for authenticated users)

---

## Button Locations

| Button | Location | Handler | When Visible |
|--------|----------|---------|--------------|
| **Sign in** | Header (right) | `handleSignIn()` | Not authenticated |
| **Start free trial** | Header (right) | `handleGetStarted()` | Not authenticated |
| **Go to App** | Header (right) | `handleGoToApp()` | Authenticated |
| **Start Your Free Trial** | Hero section | `handleGetStarted()` | Always |
| **Choose Student** | Pricing | `handleGetStarted()` | Always |
| **Choose Researcher** | Pricing | `handleGetStarted()` | Always |
| **Contact Sales** | Pricing | Opens email | Always |

---

## Authentication States

### **Not Logged In** (Default)
Header shows:
- "Sign in" button (desktop only)
- "Start free trial" button (all devices)

### **Logged In**
Header shows:
- User email (shortened, desktop only)
- "Go to App" button (all devices)

---

## URL Flow

```
Landing Page (/)
    ↓ Click "Start free trial"
Auth Modal (/?auth=true)
    ↓ Sign in with Google/Email
Main App (/)
    ↓ User authenticated
Document Viewer
```

---

## Quick Test

1. Open landing page: `http://localhost:5173`
2. Click "Start free trial" → Should open auth modal
3. Sign in with Google
4. Should redirect to main app
5. Go back to landing page → Should show "Go to App" button

---

## Code Location

File: `/src/components/LandingPage.tsx`

Lines:
- **handleSignIn**: Line ~134
- **handleGetStarted**: Line ~138
- **handleGoToApp**: Line ~146

