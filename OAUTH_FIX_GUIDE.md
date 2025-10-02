# Google OAuth Fix Guide - Supabase Integration

## 🚨 Problem: ERR_CONNECTION_REFUSED After Google Sign-In

You're getting this error because the OAuth redirect URLs aren't properly configured.

---

## ✅ Solution: Configure OAuth Redirect URLs

### **Step 1: Configure Supabase (CRITICAL)**

1. **Go to Supabase Dashboard**: https://app.supabase.com/
2. **Select your project**
3. **Navigate to**: Authentication → URL Configuration
4. **Add Site URL**:
   - For **Production**: `https://your-app-name.vercel.app`
   - For **Local Testing**: `http://localhost:5173`

5. **Add Redirect URLs** (under "Redirect URLs"):
   ```
   http://localhost:5173
   http://localhost:5173/
   https://your-app-name.vercel.app
   https://your-app-name.vercel.app/
   ```

6. **Enable Google Provider**:
   - Go to: Authentication → Providers
   - Enable "Google"
   - Add your Google OAuth credentials:
     - **Client ID**: Your Google OAuth Client ID
     - **Client Secret**: Your Google OAuth Client Secret

### **Step 2: Configure Google Cloud Console**

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Navigate to**: APIs & Services → Credentials
3. **Click on your OAuth 2.0 Client ID**

4. **Add Authorized JavaScript Origins**:
   ```
   http://localhost:5173
   https://your-app-name.vercel.app
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co
   ```

5. **Add Authorized Redirect URIs**:
   ```
   http://localhost:5173
   https://your-app-name.vercel.app
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   **Important**: The Supabase callback URL format is:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

6. **Click "Save"**

---

## 🔍 How to Find Your Values

### **Your Supabase Project Reference**
- Go to: Supabase Dashboard → Project Settings → API
- Look for "Project URL": `https://xxxxxxxxxxxxx.supabase.co`
- The `xxxxxxxxxxxxx` part is your project reference

### **Your Vercel App URL**
- Option 1: Run `vercel` to see your deployment URL
- Option 2: Go to Vercel Dashboard → Your Project → Deployments
- It will look like: `https://smart-reader-xxxxx.vercel.app`

### **Your Google OAuth Client ID**
- Go to: [Google Cloud Console](https://console.cloud.google.com/)
- Navigate to: APIs & Services → Credentials
- Copy the Client ID (looks like: `xxxxx.apps.googleusercontent.com`)

---

## 🧪 Testing

### **Test Locally (Port 5173)**
```bash
# Start your dev server
npm run dev

# Open browser to
http://localhost:5173

# Click "Sign in with Google"
# Should now work without errors!
```

### **Test on Vercel (Production)**
```bash
# Deploy to Vercel
vercel --prod

# Open your Vercel URL
https://your-app-name.vercel.app

# Click "Sign in with Google"
# Should redirect properly!
```

---

## 🐛 Common Issues & Fixes

### **Issue 1: Still Getting localhost Error on Vercel**
**Cause**: The app is hardcoded to redirect to localhost

**Fix**: The code uses `window.location.origin` which should work automatically. If you're still having issues, add this to your Vercel environment variables:
```
VITE_APP_URL=https://your-app-name.vercel.app
```

Then update `supabaseAuthService.ts`:
```typescript
async signInWithGoogle() {
  const redirectUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  
  const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return oauthData;
}
```

### **Issue 2: "redirect_uri_mismatch" Error**
**Cause**: The redirect URL isn't in your Google Cloud Console allowed list

**Fix**: 
1. Copy the exact redirect URL from the error message
2. Add it to Google Cloud Console → Authorized Redirect URIs
3. Make sure to add the Supabase callback URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### **Issue 3: Google Sign-In Works But User Not Logged In**
**Cause**: Not handling the auth callback properly

**Fix**: Make sure you have auth state listener in your app. Check `App.tsx` for:
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_IN') {
        // Handle successful sign-in
        console.log('User signed in:', session?.user);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### **Issue 4: Works Locally But Not on Vercel**
**Cause**: Environment variables not set on Vercel

**Fix**:
```bash
# Set these in Vercel Dashboard or via CLI:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_GOOGLE_CLIENT_ID

# Then redeploy:
vercel --prod
```

---

## 📝 Quick Checklist

- [ ] Added redirect URLs to Supabase Authentication settings
- [ ] Enabled Google provider in Supabase with Client ID and Secret
- [ ] Added Supabase callback URL to Google Cloud Console
- [ ] Added your app URLs (localhost and Vercel) to Google Cloud Console
- [ ] Environment variables set on Vercel
- [ ] Tested locally on `http://localhost:5173`
- [ ] Tested on Vercel production URL

---

## 🎯 Expected Flow

1. User clicks "Sign in with Google" in your app
2. Supabase redirects to Google OAuth consent screen
3. User approves/signs in
4. Google redirects back to Supabase: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. Supabase processes the OAuth response
6. Supabase redirects back to your app: `window.location.origin`
7. Your app receives the auth session
8. User is logged in! ✅

---

## 🆘 Still Having Issues?

1. **Check browser console** for exact error messages
2. **Check Supabase logs**: Dashboard → Logs → Auth logs
3. **Verify all URLs match exactly** (no trailing slashes mismatch)
4. **Try incognito mode** to rule out cache issues
5. **Clear browser cache and cookies**

---

## 🔑 Quick Reference: What Goes Where

| Setting | Where to Configure | Example Value |
|---------|-------------------|---------------|
| Redirect URLs | Supabase Dashboard | `https://your-app.vercel.app` |
| Google Client ID | Supabase & Google Cloud | `xxxxx.apps.googleusercontent.com` |
| Google Client Secret | Supabase & Google Cloud | `GOCSPx-xxxxx` |
| Supabase Callback | Google Cloud Console | `https://xxx.supabase.co/auth/v1/callback` |
| JavaScript Origins | Google Cloud Console | `https://your-app.vercel.app` |

---

**Need Help?** Check the error message in your browser console - it usually tells you the exact URL that needs to be whitelisted!

