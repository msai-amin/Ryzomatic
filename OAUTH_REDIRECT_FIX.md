# 🔧 Fix OAuth Redirect to Localhost

## Problem
After Google sign-in on localhost:3001, you're redirected to production (vercel.app) instead of staying on localhost.

## Root Cause
Supabase OAuth redirect URL is configured for production only.

---

## ✅ **SOLUTION 1: Update Supabase OAuth (5 minutes)**

### **Steps:**

1. **Go to Supabase Dashboard**
   - Visit: [supabase.com](https://supabase.com)
   - Select your project

2. **Navigate to Authentication Settings**
   - Click **"Authentication"** in left sidebar
   - Click **"URL Configuration"**

3. **Add Localhost to Redirect URLs**

Find the **"Redirect URLs"** section and add:
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

4. **Update Site URL (Optional)**

During development, temporarily change **"Site URL"** to:
```
http://localhost:3001
```

*Remember to change back to production URL when done testing!*

5. **Click "Save"**

6. **Test Again**
   - Go to `http://localhost:3001`
   - Sign in with Google
   - Should stay on localhost now ✅

---

## ✅ **SOLUTION 2: Test S3 Directly (No OAuth)**

I created a test page that bypasses OAuth entirely!

### **Use the Direct S3 Test:**

1. **Open in browser:**
   ```
   http://localhost:3001/test-s3-direct.html
   ```

2. **Select a PDF** (< 5MB)

3. **Click "Test S3 Upload"**

4. **Watch the logs** - should see:
   ```
   ✅ SUCCESS! Book uploaded to S3
   🔗 S3 Key: books/test-user-123/test-xxxx.pdf
   ```

5. **Verify in AWS S3:**
   - Go to S3 Console
   - Check `smart-reader-documents/books/test-user-123/`
   - File should be there!

**This proves S3 integration works!** 🎉

---

## 🎯 **Recommended Approach**

### **For Testing (Right Now):**
✅ Use `test-s3-direct.html` to verify S3 works

### **For Development (Later):**
✅ Update Supabase OAuth settings to include localhost

### **For Production:**
✅ Already configured correctly

---

## 📋 **What Each Solution Does**

### **Solution 1 (Supabase Settings):**
- **Pro:** Full app flow works on localhost
- **Con:** Need to update Supabase settings
- **Time:** 5 minutes

### **Solution 2 (Direct Test):**
- **Pro:** Immediate testing, no config changes
- **Con:** Only tests S3, not full app flow
- **Time:** 1 minute

---

## 🚀 **Try This NOW**

```bash
# The test page is ready at:
http://localhost:3001/test-s3-direct.html

# Open it, upload a PDF, see if S3 works!
```

This will immediately show if your S3 integration is working, independent of OAuth issues.

---

Let me know:
- Will you update Supabase OAuth? [YES/NO]
- Or test with the direct test page first? [YES/NO]
