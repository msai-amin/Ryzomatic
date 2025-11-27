# 🔧 Set Vercel Environment Variables

## Problem
Your app is deployed but can't connect to Supabase because environment variables aren't set.

---

## 🚀 Quick Fix (Choose One Method)

### **Method 1: Via Vercel Dashboard** (Easier)

1. **Go to**: https://vercel.com/dashboard
2. **Click** your project: `smart-reader-serverless`
3. **Go to**: Settings → Environment Variables
4. **Add these variables** (click "Add" for each):

#### **Critical Variables (Required):**

| Variable Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `VITE_SUPABASE_URL` | `https://pbfipmvtkbivnwwgukpw.supabase.co` | ✅ You have this! |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Supabase Dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Supabase Dashboard → Settings → API → service_role |
| `GEMINI_API_KEY` | Your Gemini key | Google AI Studio |
| `AWS_ACCESS_KEY_ID` | Your AWS key | AWS Console |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret | AWS Console |
| `AWS_S3_BUCKET` | Your bucket name | AWS Console |
| `AWS_REGION` | `us-east-1` | AWS Console |

#### **Optional Variables:**

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | Only if using Google Drive features |
| `VITE_GOOGLE_CLOUD_TTS_API_KEY` | Your Google Cloud TTS API Key | For premium TTS voices |
| `VITE_AZURE_TTS_KEY` | Your Azure Speech Services Key | For Azure TTS voices (optional) |
| `VITE_AZURE_TTS_REGION` | Your Azure region (e.g., `eastus`) | Azure region where Speech Services is deployed |
| `VITE_APP_URL` | `https://smart-reader-serverless-pb4xfa1w1-vstyle-ltds-projects.vercel.app` | Your production URL |

5. **Select "Production"** for each variable
6. **Click "Save"**
7. **Go to**: Deployments → Click the three dots → "Redeploy"

---

### **Method 2: Via CLI** (Faster if you have values ready)

Run these commands one at a time and paste your actual values:

```bash
# CRITICAL: Supabase URL (Frontend)
vercel env add VITE_SUPABASE_URL production
# Paste: https://pbfipmvtkbivnwwgukpw.supabase.co

# CRITICAL: Supabase Anon Key (Frontend)
vercel env add VITE_SUPABASE_ANON_KEY production
# Paste: Your anon key from Supabase Dashboard

# Backend: Supabase Service Role Key
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: Your service role key

# Backend: Gemini API Key
vercel env add GEMINI_API_KEY production
# Paste: Your Gemini API key

# Backend: AWS Credentials
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add AWS_S3_BUCKET production
vercel env add AWS_REGION production
# For AWS_REGION, enter: us-east-1

# Optional: Google OAuth
vercel env add VITE_GOOGLE_CLIENT_ID production
# Or press Ctrl+C to skip

# Optional: Google Cloud TTS
vercel env add VITE_GOOGLE_CLOUD_TTS_API_KEY production
# Or press Ctrl+C to skip

# Optional: Azure TTS
vercel env add VITE_AZURE_TTS_KEY production
# Paste: Your Azure Speech Services subscription key
vercel env add VITE_AZURE_TTS_REGION production
# Paste: Your Azure region (e.g., eastus)
# Or press Ctrl+C to skip
```

Then redeploy:
```bash
vercel --prod
```

---

## 📍 Where to Find Each Value

### **Supabase Credentials**
1. Go to: https://app.supabase.com/
2. Select your project
3. Go to: **Settings** → **API**
4. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon public** → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role** → Use for `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### **Gemini API Key**
1. Go to: https://makersuite.google.com/app/apikey
2. Create or copy your API key
3. Use for `GEMINI_API_KEY`

### **AWS Credentials**
1. Go to: https://console.aws.amazon.com/iam/
2. Navigate to your IAM user
3. Go to Security Credentials
4. Create/copy Access Key
5. Your bucket name should be something like `smart-reader-documents`

### **Google OAuth Client ID** (Optional)
1. Go to: https://console.cloud.google.com/
2. APIs & Services → Credentials
3. Copy your OAuth 2.0 Client ID

### **Google Cloud TTS API Key** (Optional)
1. Go to: https://console.cloud.google.com/
2. APIs & Services → Credentials
3. Click "Create Credentials" → "API Key"
4. Copy the generated API key
5. **Important**: Enable the "Cloud Text-to-Speech API" for this key
6. Use for `VITE_GOOGLE_CLOUD_TTS_API_KEY`

### **Azure Text-to-Speech** (Optional)
1. Go to: https://portal.azure.com
2. Create a "Speech Services" resource (or use existing)
3. Go to your Speech Services resource → **Keys and Endpoint**
4. Copy:
   - **Key 1** or **Key 2** → Use for `VITE_AZURE_TTS_KEY`
   - **Location/Region** → Use for `VITE_AZURE_TTS_REGION` (e.g., `eastus`, `westus`)

---

## ✅ After Setting Variables

Once all variables are set:

```bash
# Redeploy to production
vercel --prod
```

Wait for deployment to complete, then test:
1. Open your site in incognito mode
2. Try signing in with Google
3. Should now work! ✅

---

## 🐛 Troubleshooting

### Still seeing "Google Client ID is not configured"?
- This is optional. If you're not using Google Drive features, ignore it.
- Or set `VITE_GOOGLE_CLIENT_ID` to empty string

### "Auth session missing"?
- Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- **Important**: They must have the `VITE_` prefix for frontend access!
- Redeploy after setting variables

### How to verify variables are set?
```bash
vercel env ls
```

---

## 🎯 Minimum Required Variables

For basic auth to work, you need AT MINIMUM:

✅ `VITE_SUPABASE_URL`  
✅ `VITE_SUPABASE_ANON_KEY`  

Set these two first, then redeploy and test!

