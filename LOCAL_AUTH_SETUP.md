# 🔐 Local Authentication Setup Guide

## Quick Setup

### Step 1: Get Supabase Credentials

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw
   - Or: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api

2. **Copy the API Keys:**
   - **Project URL**: `https://pbfipmvtkbivnwwgukpw.supabase.co` ✅ (already in `.env.local`)
   - **anon public key**: Copy from "Project API keys" section
   - **service_role key**: Copy from "Project API keys" section (⚠️ Keep secret!)

3. **Update `.env.local`:**
   ```bash
   # Replace the placeholder values
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (paste your actual key)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (paste your actual key)
   ```

### Step 2: Configure OAuth Redirect URLs (for Google Sign-In)

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/auth/url-configuration

2. **Add Localhost to Redirect URLs:**
   - Find **"Redirect URLs"** section
   - Add these URLs:
     ```
     http://localhost:3001
     http://localhost:3001/*
     http://localhost:3001/auth/callback
     ```
   - Click **"Save"**

3. **Update Site URL (Optional for Development):**
   - Set **"Site URL"** to: `http://localhost:3001`
   - ⚠️ **Remember to change back to production URL when done!**

### Step 3: Restart Dev Server

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run dev
```

The app should now work with authentication on `http://localhost:3001`!

---

## Testing Authentication

### Test Email/Password Sign-Up

1. **Open the app:** http://localhost:3001
2. **Click "Sign Up"**
3. **Enter email and password**
4. **Check your email** for confirmation link
5. **Click confirmation link**
6. **Sign in** with your credentials

### Test Google OAuth

1. **Open the app:** http://localhost:3001
2. **Click "Sign in with Google"**
3. **Select your Google account**
4. **Authorize the app**
5. **You should be redirected back to localhost:3001** ✅

---

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Solution:**
- Make sure `.env.local` exists in the project root
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the dev server after adding/updating `.env.local`

### Issue: "OAuth redirect goes to production instead of localhost"

**Solution:**
1. Check Supabase redirect URLs include `http://localhost:3001`
2. Verify `VITE_APP_URL=http://localhost:3001` in `.env.local`
3. Clear browser cache and try again
4. Check browser console for OAuth errors

### Issue: "Authentication works but features don't load"

**Solution:**
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set for server-side operations
- Check that database tables exist and RLS policies are configured
- Verify API routes are working (check browser network tab)

### Issue: "Can't sign in with Google"

**Solution:**
1. Verify Google OAuth is enabled in Supabase:
   - Go to: Authentication → Providers → Google
   - Make sure "Enable Google provider" is checked
   - Add your Google OAuth credentials if needed

2. Check redirect URLs include localhost:
   - Go to: Authentication → URL Configuration
   - Add `http://localhost:3001` to redirect URLs

3. Verify `VITE_GOOGLE_CLIENT_ID` is set (optional, for Google Drive features)

---

## Optional: Get Other API Keys

### Google OAuth Client ID (for Google Drive integration)
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (if not exists)
3. Add `http://localhost:3001` to authorized redirect URIs
4. Copy Client ID to `.env.local` as `VITE_GOOGLE_CLIENT_ID`

### Gemini API Key (for AI features)
1. Go to: https://aistudio.google.com/app/apikey
2. Create API key
3. Copy to `.env.local` as `VITE_GEMINI_API_KEY`

### OpenAI API Key (for AI features)
1. Go to: https://platform.openai.com/api-keys
2. Create API key
3. Copy to `.env.local` as `VITE_OPENAI_API_KEY`

---

## Security Notes

⚠️ **Important:**
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Keep all API keys secret
- Use different keys for development and production

---

## Quick Reference

**Supabase Dashboard:**
- Project: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw
- API Keys: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api
- Auth Config: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/auth/url-configuration

**Local App:**
- URL: http://localhost:3001
- Env File: `.env.local`

**Required Variables:**
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_ANON_KEY` ⚠️ (need to add)
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (need to add)

---

**Last Updated:** 2025-01-28
**Status:** Ready for local development (just need to add API keys!)

