# 🔍 Check Supabase Configuration

## Critical: Verify Your Supabase Settings

Your app is trying to authenticate but the session isn't persisting. This is likely a Supabase configuration issue.

---

## ✅ **Check These Settings in Supabase Dashboard:**

### **1. Go to Supabase Dashboard**
https://app.supabase.com/ → Select your project: `pbfipmvtkbivnwwgukpw`

---

### **2. Check Authentication → URL Configuration**

Navigate to: **Authentication** → **URL Configuration**

#### **Site URL should be:**
```
https://smart-reader-serverless.vercel.app
```

#### **Redirect URLs should include:**
```
https://smart-reader-serverless.vercel.app
https://smart-reader-serverless.vercel.app/**
https://smart-reader-serverless-8q4ixr3vv-vstyle-ltds-projects.vercel.app
https://smart-reader-serverless-8q4ixr3vv-vstyle-ltds-projects.vercel.app/**
```

**Note:** Add BOTH your main Vercel domain AND the deployment-specific URL

---

### **3. Check Authentication → Providers → Google**

Navigate to: **Authentication** → **Providers** → **Google**

#### **Verify:**
- ✅ **Enabled** toggle is ON
- ✅ **Client ID (for OAuth)** is filled in (from Google Cloud Console)
- ✅ **Client Secret (for OAuth)** is filled in (from Google Cloud Console)
- ✅ **Authorized Client IDs** section is empty (unless you have specific requirements)

---

### **4. Check Google Cloud Console**

Go to: https://console.cloud.google.com/ → APIs & Services → Credentials

#### **Your OAuth 2.0 Client → Authorized redirect URIs should include:**

```
https://pbfipmvtkbivnwwgukpw.supabase.co/auth/v1/callback
```

This is the **Supabase callback URL** that handles the OAuth response from Google.

**Format:** `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

---

## 🧪 **Test the Flow:**

After verifying all settings above:

1. Go to: https://smart-reader-serverless.vercel.app
2. Open browser console (F12)
3. Click "Get Started"
4. Click "Continue with Google"
5. **Watch for:**
   - Does it redirect to Google? ✅
   - After Google approval, does it redirect back? ✅
   - Check console for errors

---

## 📊 **Expected Flow:**

```
Your App (Vercel)
    ↓ User clicks "Continue with Google"
Google OAuth Consent Screen
    ↓ User approves
Supabase Callback URL
    ↓ Processes OAuth, creates session
Your App (Vercel) - User logged in ✅
```

---

## ❌ **Common Issues:**

| Issue | Cause | Fix |
|-------|-------|-----|
| Redirects to localhost | Site URL is localhost | Set to Vercel URL |
| "redirect_uri_mismatch" | Callback URL not in Google Console | Add Supabase callback URL |
| Session doesn't persist | Redirect URL not whitelisted | Add to Supabase redirect URLs |
| "Auth session missing" | Stale OAuth callback | Try fresh sign-in |

---

## 🔧 **Quick Fix Commands:**

If you need to update Vercel deployment URL in Supabase, you can't do it via API, so:

1. **Go to Supabase Dashboard manually**
2. Update the URLs
3. **No need to redeploy your app** after changing Supabase settings

---

## 🆘 **Still Not Working?**

Check Supabase logs:
1. Supabase Dashboard → **Logs** → **Auth Logs**
2. Look for recent sign-in attempts
3. Check for error messages

Also check your browser Network tab (F12 → Network):
- Look for calls to `supabase.co/auth/v1/token`
- Check if they return 200 or error

