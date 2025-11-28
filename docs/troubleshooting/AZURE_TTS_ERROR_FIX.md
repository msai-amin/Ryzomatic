# Azure TTS "Failed to fetch voices" Error - Fix Guide

**Error:** `Error fetching Azure voices: Error: Failed to fetch voices`

## Root Cause

This error is **NOT caused by failed GitHub Actions workflows**. It's a runtime configuration issue with your Azure TTS setup.

The error occurs because:
1. Your app calls `/api/azure-tts` (a serverless function) to fetch voices
2. The serverless function requires `AZURE_TTS_KEY` environment variable (without `VITE_` prefix)
3. If the environment variable is missing or incorrect, the proxy returns an error
4. The client-side code catches this error and displays the message you see

## Quick Fix

### Step 1: Check Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `smart-reader-serverless`
3. Navigate to **Settings → Environment Variables**
4. Check if you have **BOTH** of these variables set:

| Variable Name | Purpose | Required For |
|--------------|---------|--------------|
| `VITE_AZURE_TTS_KEY` | Client-side initialization | ✅ Browser app |
| `AZURE_TTS_KEY` | Serverless API proxy | ✅ `/api/azure-tts` endpoint |

**Critical:** Serverless functions in Vercel **cannot** access `VITE_` prefixed variables. You need `AZURE_TTS_KEY` (without prefix) for the API endpoint.

### Step 2: Add Missing Environment Variable

If `AZURE_TTS_KEY` is missing:

1. In Vercel Dashboard → Settings → Environment Variables
2. Click **"Add New"**
3. Enter:
   - **Key:** `AZURE_TTS_KEY`
   - **Value:** (same value as your `VITE_AZURE_TTS_KEY`)
   - **Environment:** Select **Production**, **Preview**, and **Development**
4. Click **"Save"**

### Step 3: Redeploy

After adding the variable:

1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Select **"Redeploy"**
4. Wait for deployment to complete

### Step 4: Verify Fix

1. Open your app in browser
2. Open browser DevTools (F12) → Console tab
3. The error should be gone
4. You should see: `AzureTTSService.getVoices: Available voices: X neural voices`

## Why This Happens

### Environment Variable Prefixes in Vercel

- **`VITE_` prefix:** Exposed to browser (client-side)
  - Used by: React app, client-side code
  - Example: `VITE_AZURE_TTS_KEY`
  
- **No prefix:** Only available in serverless functions (server-side)
  - Used by: `/api/*` endpoints, serverless functions
  - Example: `AZURE_TTS_KEY`

### Architecture Flow

```
Browser (client-side)
  ↓ calls
/api/azure-tts (serverless function)
  ↓ needs
AZURE_TTS_KEY (environment variable)
  ↓ calls
Azure Speech Services API
  ↓ returns
Voice list
```

If `AZURE_TTS_KEY` is missing, the proxy endpoint returns:
```json
{
  "error": "Azure TTS not configured",
  "hint": "Set AZURE_TTS_KEY (without VITE_ prefix) in environment variables"
}
```

## Troubleshooting

### Check 1: API Endpoint is Deployed

Test the endpoint directly:
```bash
curl https://your-app.vercel.app/api/azure-tts?region=eastus
```

**Expected (missing config):**
```json
{"error":"Azure TTS not configured","hint":"Set AZURE_TTS_KEY..."}
```

**Expected (configured):**
```json
[{...voices array...}]
```

### Check 2: Environment Variables in Vercel

1. Vercel Dashboard → Settings → Environment Variables
2. Verify both variables exist:
   - ✅ `VITE_AZURE_TTS_KEY` (for client)
   - ✅ `AZURE_TTS_KEY` (for API)

### Check 3: Variable Values Match

Both variables should have the **same value** (your Azure Speech Services key).

### Check 4: Deployment Logs

1. Vercel Dashboard → Deployments
2. Click on latest deployment
3. Check **"Functions"** tab for `/api/azure-tts`
4. Look for errors in logs

## Alternative: Disable Azure TTS (Temporary Fix)

If you don't want to use Azure TTS right now:

1. The app will automatically fall back to:
   - Native browser TTS (if available)
   - Google Cloud TTS (if configured)
2. The error won't break the app, but you'll see warnings in console

## Related Issues

### Error: "Azure TTS subscription key not configured"
- **Cause:** Missing `VITE_AZURE_TTS_KEY` in client-side
- **Fix:** Add `VITE_AZURE_TTS_KEY` in Vercel environment variables

### Error: "Failed to fetch voices: 401"
- **Cause:** Invalid or expired Azure subscription key
- **Fix:** Update `AZURE_TTS_KEY` and `VITE_AZURE_TTS_KEY` with valid key

### Error: "Failed to fetch voices: 404"
- **Cause:** Wrong Azure region or endpoint
- **Fix:** Check `AZURE_TTS_REGION` matches your Azure resource region

## Still Not Working?

1. **Check browser console** for detailed error messages
2. **Check Vercel function logs** for API endpoint errors
3. **Verify Azure subscription** is active and has Speech Services enabled
4. **Test Azure API directly** using Azure portal or curl

## Summary

✅ **The issue:** Missing `AZURE_TTS_KEY` environment variable in Vercel  
✅ **The fix:** Add `AZURE_TTS_KEY` (same value as `VITE_AZURE_TTS_KEY`)  
✅ **Not caused by:** Failed GitHub Actions workflows  

The error will persist until you:
1. Add `AZURE_TTS_KEY` to Vercel environment variables
2. Redeploy your application
