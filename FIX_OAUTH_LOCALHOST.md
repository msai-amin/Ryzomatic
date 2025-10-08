# 🔧 Fix OAuth Redirect to Localhost

## Problem
After Google sign-in on localhost, you're redirected to production site instead of staying on localhost.

## Solution

### **Step 1: Update Supabase OAuth Settings**

1. Go to [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Find **"Site URL"** and **"Redirect URLs"**

### **Step 2: Add Localhost URLs**

**Add these to "Redirect URLs":**
```
http://localhost:3001
http://localhost:3001/*
http://localhost:3001/auth/callback
http://localhost:5173
http://localhost:5173/*
```

**Keep existing production URLs:**
```
https://smart-reader-serverless.vercel.app
https://smart-reader-serverless.vercel.app/*
https://smart-reader-serverless.vercel.app/auth/callback
```

### **Step 3: Update Site URL (Development)**

**During development, set "Site URL" to:**
```
http://localhost:3001
```

**Or use environment-specific:**
- Development: `http://localhost:3001`
- Production: `https://smart-reader-serverless.vercel.app`

### **Step 4: Save Changes**

Click **"Save"** in Supabase dashboard

---

## Alternative: Test Without OAuth

### **Option 1: Use Email Sign In**

Instead of Google OAuth:
1. Create account with email/password
2. Sign in with email
3. Stays on localhost ✅

### **Option 2: Skip Auth for Testing**

Temporarily test S3 without upload:
- We can test S3 API endpoints directly
- Verify S3 integration works
- Then fix OAuth for full flow

---

## Quick Test (Skip OAuth)

Let me create a test script that bypasses OAuth:

```typescript
// Test S3 directly
import { bookStorageService } from './services/bookStorageService';

// Upload test
const testFile = new Blob(['test'], { type: 'application/pdf' });
const result = await bookStorageService.uploadBook(testFile, {
  userId: 'test-user',
  bookId: 'test-book',
  title: 'Test',
  fileName: 'test.pdf',
  fileType: 'pdf',
  fileSize: 1000
});

console.log('S3 Upload Test:', result);
```

---

## Recommended Approach

1. **Update Supabase OAuth settings** (5 minutes)
2. **Test with Google sign-in** on localhost
3. **Should stay on localhost** after auth
4. **Upload will work** on localhost with new S3 code

---

Would you like me to:
A) Wait while you update Supabase OAuth settings
B) Create a direct S3 test script to verify S3 works
C) Both

Let me know!
