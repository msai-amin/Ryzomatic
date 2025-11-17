# 🔴 Fix Both Issues: Authentication & TTS

## ✅ Fixed: UI Warning Added

**What Changed:**
- ✅ AuthModal now shows a visible warning when Supabase is not configured
- ✅ Sign-in buttons are disabled when Supabase is not available
- ✅ Clear error messages in auth service methods
- ✅ Link to get Supabase API key directly from the warning

**What You'll See:**
- When you open the auth modal, you'll see a yellow warning box explaining the issue
- Sign-in buttons will be disabled with a tooltip
- Clear instructions on how to fix it

---

## Issue 1: Authentication (CRITICAL) ❌

**Problem:** Supabase anon key is still a placeholder
**Error:** `AuthApiError: Invalid API key`

### Fix (2 minutes):

1. **Get your Supabase anon key:**
   - Go to: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api
   - Copy the "anon public" key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

2. **Update `.env.local`:**
   ```bash
   # Replace this:
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # With your actual key:
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (paste full key)
   ```

3. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

---

## Issue 2: TTS (FIXED) ✅

**Problem:** Google Cloud TTS API key is a placeholder, causing errors
**Status:** ✅ **FIXED** - TTS now gracefully falls back to native browser TTS

### What Changed:

- ✅ TTS service now detects placeholder API keys
- ✅ Automatically falls back to native browser TTS if Google Cloud TTS is not configured
- ✅ No more console errors when TTS API key is missing/placeholder
- ✅ TTS will still work using native browser voices

### Optional: Enable Google Cloud TTS (Premium Voices)

If you want premium Google Cloud TTS voices:

1. **Get Google Cloud TTS API Key:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Create an API key for Text-to-Speech API
   - Enable Text-to-Speech API for your project

2. **Update `.env.local`:**
   ```bash
   # Add or update:
   VITE_GOOGLE_CLOUD_TTS_API_KEY=your_actual_google_cloud_tts_api_key
   ```

3. **Restart dev server**

**Note:** Native browser TTS works fine without Google Cloud TTS. Google Cloud TTS is optional for premium voices.

---

## Quick Checklist

### Must Fix (Authentication):
- [ ] Get Supabase anon key from dashboard
- [ ] Update `VITE_SUPABASE_ANON_KEY` in `.env.local`
- [ ] Restart dev server
- [ ] Verify: Console shows `VITE_SUPABASE_ANON_KEY is placeholder: false`

### Optional (TTS):
- [ ] Get Google Cloud TTS API key (optional)
- [ ] Update `VITE_GOOGLE_CLOUD_TTS_API_KEY` in `.env.local` (optional)
- [ ] Restart dev server (optional)

---

## Verify Fixes

### Check Authentication:
```bash
# Run this script:
node scripts/check-env.js
```

Should show:
```
✅ VITE_SUPABASE_URL: SET
✅ VITE_SUPABASE_ANON_KEY: SET
```

### Check TTS:
- Open browser console
- Should see: `TTSManager: Using Native TTS as fallback provider`
- No errors about Google Cloud TTS
- TTS should work with native browser voices

---

## After Fixing

1. **Authentication should work:**
   - Sign in with Google OAuth
   - Should redirect to main app (not landing page)
   - No "Invalid API key" errors

2. **TTS should work:**
   - Using native browser TTS (no errors)
   - Can read PDF documents
   - Word highlighting works
   - (Optional: Premium voices if Google Cloud TTS is configured)

---

## Summary

**Critical (Must Fix):**
- ❌ Authentication: Update `VITE_SUPABASE_ANON_KEY` in `.env.local`

**Fixed (No Action Needed):**
- ✅ TTS: Now gracefully falls back to native TTS (no errors)

**Optional:**
- ⚠️ TTS: Add `VITE_GOOGLE_CLOUD_TTS_API_KEY` for premium voices (optional)

---

**Status:** 
- Authentication: ❌ Needs fix
- TTS: ✅ Fixed (works with native TTS)

---

**Last Updated:** 2025-01-28

