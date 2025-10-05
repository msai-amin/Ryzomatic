# 🔍 Debug OAuth Session Issue

## Problem
- Users are created in Supabase ✅
- OAuth redirect works ✅
- But session doesn't persist ❌
- Getting 401 Unauthorized when checking user

## Debug Steps

### **Step 1: Check the OAuth Callback URL**

After Google OAuth, what URL do you see in your browser?

**Expected formats:**
```
https://smart-reader-serverless.vercel.app/?code=xxxxx#access_token=yyyyy
https://smart-reader-serverless.vercel.app/#access_token=yyyyy
https://smart-reader-serverless.vercel.app/?code=xxxxx&access_token=yyyyy
```

**If you see something different, that's the problem!**

---

### **Step 2: Check Supabase Auth Logs**

1. Go to: https://app.supabase.com/
2. Select your project
3. Go to: **Logs** → **Auth Logs**
4. Look for recent sign-in attempts
5. Check for errors like:
   - "Invalid redirect URL"
   - "Token exchange failed"
   - "Session creation failed"

---

### **Step 3: Test Session Storage**

In browser console (F12), after OAuth redirect, run:

```javascript
// Check if session is stored
console.log('Local storage:', localStorage.getItem('sb-pbfipmvtkbivnwwgukpw-auth-token'))

// Check Supabase session
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)

// Check current user
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)
```

---

### **Step 4: Check Supabase Redirect URLs Again**

Make sure your Supabase redirect URLs include:

```
https://smart-reader-serverless.vercel.app
https://smart-reader-serverless.vercel.app/**
https://smart-reader-serverless-*.vercel.app/**
```

**Important:** The `/**` is crucial for handling OAuth callback parameters!

---

## 🎯 **Most Likely Issues:**

### **Issue 1: Wrong Redirect URL Format**
If your callback URL doesn't match exactly what's in Supabase, the session won't be created.

### **Issue 2: Missing Wildcard Pattern**
If you only have `https://smart-reader-serverless.vercel.app` but not `https://smart-reader-serverless.vercel.app/**`, it won't work.

### **Issue 3: Supabase Client Configuration**
The client might not be configured to handle the OAuth callback properly.

---

## 🔧 **Quick Fixes to Try:**

### **Fix 1: Add More Redirect URL Patterns**

In Supabase Dashboard → Authentication → URL Configuration, add:

```
https://smart-reader-serverless.vercel.app
https://smart-reader-serverless.vercel.app/**
https://smart-reader-serverless.vercel.app/?
https://smart-reader-serverless.vercel.app/?*
https://smart-reader-serverless-*.vercel.app
https://smart-reader-serverless-*.vercel.app/**
```

### **Fix 2: Check Google Cloud Console**

Make sure your Google OAuth redirect URI is:
```
https://pbfipmvtkbivnwwgukpw.supabase.co/auth/v1/callback
```

### **Fix 3: Test with Different Browser**

Try in a completely different browser (Chrome vs Firefox vs Safari) to rule out browser-specific issues.

---

## 📊 **Expected Flow:**

```
1. User clicks "Continue with Google"
2. Redirects to: https://accounts.google.com/oauth/...
3. User signs in
4. Google redirects to: https://pbfipmvtkbivnwwgukpw.supabase.co/auth/v1/callback?code=...
5. Supabase processes OAuth
6. Supabase redirects to: https://smart-reader-serverless.vercel.app/?code=...&access_token=...
7. Your app receives the callback
8. Supabase client processes the session
9. User is logged in ✅
```

---

## 🆘 **Next Steps:**

1. **Tell me the exact callback URL** you see after OAuth
2. **Check Supabase Auth Logs** for errors
3. **Run the console debug commands** above
4. **Verify redirect URLs** include wildcards

With this info, I can pinpoint the exact issue!
