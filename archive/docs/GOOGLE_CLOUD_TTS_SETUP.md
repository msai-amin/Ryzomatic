# 🎤 Google Cloud TTS Setup Guide

## Overview
This guide will help you set up Google Cloud Text-to-Speech API for premium neural voices in your Smart Reader application.

---

## 🚀 Quick Setup (3 Steps)

### **Step 1: Get Google Cloud TTS API Key**

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Create/Select Project**: 
   - If you don't have a project, click "New Project"
   - Name it something like "smart-reader-tts"
3. **Enable Text-to-Speech API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Cloud Text-to-Speech API"
   - Click "Enable"
4. **Create API Key**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key (starts with `AIza...`)

### **Step 2: Set Environment Variable**

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to: [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `smart-reader-serverless`
3. Go to: **Settings** → **Environment Variables**
4. Click **"Add"**
5. Set:
   - **Name**: `VITE_GOOGLE_CLOUD_TTS_API_KEY`
   - **Value**: Your API key from Step 1
   - **Environment**: Production
6. Click **"Save"**

**Option B: Via CLI**
```bash
vercel env add VITE_GOOGLE_CLOUD_TTS_API_KEY production
# Paste your API key when prompted
```

### **Step 3: Redeploy**

```bash
vercel --prod
```

---

## 💰 Pricing & Costs

### **Google Cloud TTS Pricing**
- **Cost**: $4.00 per 1 million characters
- **Typical Document**: 2,000-10,000 characters
- **Cost per Document**: ~$0.01 - $0.05
- **Free Tier**: $300 credit for new accounts

### **Cost Examples**
| Document Type | Characters | Cost |
|---------------|------------|------|
| Short Article | 2,000 | $0.008 |
| Medium Article | 5,000 | $0.02 |
| Long Article | 10,000 | $0.04 |
| Book Chapter | 20,000 | $0.08 |

---

## 🎯 Features Available

### **With Google Cloud TTS**
✅ **Neural Voices**: High-quality, natural-sounding voices  
✅ **Consistent Quality**: Same voice quality across all devices  
✅ **Advanced Controls**: Fine-tuned rate, pitch, and volume  
✅ **Multiple Languages**: 40+ languages and accents  
✅ **Gender Selection**: Male and female voices  

### **Without Google Cloud TTS (Native Only)**
✅ **Free**: No API costs  
✅ **Offline**: Works without internet  
✅ **System Voices**: Uses device's built-in voices  
✅ **Word Highlighting**: Real-time word-by-word highlighting  

---

## 🔧 Configuration

### **Environment Variables**
```bash
# Required for Google Cloud TTS
VITE_GOOGLE_CLOUD_TTS_API_KEY=your_api_key_here
```

### **API Key Security**
- ✅ **Safe**: API key is exposed to frontend (this is normal for TTS)
- ✅ **Rate Limited**: Google automatically rate-limits requests
- ✅ **Usage Tracking**: Monitor usage in Google Cloud Console
- ⚠️ **Cost Control**: Set up billing alerts in Google Cloud Console

---

## 🎮 How to Use

### **In the App**
1. **Open TTS Settings**: Click speaker icon → settings gear
2. **Choose Provider**: 
   - **Native Browser TTS**: Free, offline
   - **Google Cloud TTS**: Premium, online
3. **Select Voice**: Choose from available voices
4. **Adjust Settings**: Speed, pitch, volume
5. **Preview**: Test voices before selecting

### **Voice Selection**
- **Female Voices**: Natural, clear pronunciation
- **Male Voices**: Deep, professional tone
- **Neural Voices**: Most natural-sounding (Google Cloud only)

---

## 🐛 Troubleshooting

### **"Google Cloud TTS API key not configured"**
- Make sure `VITE_GOOGLE_CLOUD_TTS_API_KEY` is set in Vercel
- Redeploy after setting the variable
- Check the variable name (must start with `VITE_`)

### **"TTS synthesis failed"**
- Verify the API key is correct
- Check if Text-to-Speech API is enabled
- Ensure you have billing enabled (required for TTS API)

### **"No voices available"**
- Check your internet connection
- Verify API key permissions
- Try refreshing the page

### **High Costs**
- Set up billing alerts in Google Cloud Console
- Monitor usage in the console
- Consider using Native TTS for development

---

## 📊 Monitoring Usage

### **Google Cloud Console**
1. Go to: [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: "APIs & Services" → "Dashboard"
3. Select: "Cloud Text-to-Speech API"
4. View: Usage statistics and costs

### **Billing Alerts**
1. Go to: "Billing" → "Budgets & Alerts"
2. Create: New budget alert
3. Set: Threshold (e.g., $10/month)
4. Configure: Email notifications

---

## 🎯 Best Practices

### **Development**
- Use **Native TTS** for development (free)
- Use **Google Cloud TTS** for production (premium quality)

### **Production**
- Set up billing alerts
- Monitor usage regularly
- Consider caching for repeated content
- Use appropriate voice for your audience

### **Cost Optimization**
- Use Native TTS for short previews
- Use Google Cloud TTS for full document reading
- Implement user preferences for voice selection

---

## ✅ Verification

After setup, verify everything works:

1. **Deploy**: `vercel --prod`
2. **Test**: Open your app in production
3. **Check**: TTS settings show both providers
4. **Select**: Google Cloud TTS provider
5. **Preview**: Test a voice
6. **Confirm**: High-quality audio plays

---

## 🆘 Support

### **Common Issues**
- **API Key**: Must start with `AIza...`
- **Billing**: Required for TTS API (even with free credits)
- **Quotas**: Default quota is 1M characters/month
- **Regions**: TTS works globally

### **Getting Help**
- **Google Cloud Docs**: [Text-to-Speech API](https://cloud.google.com/text-to-speech/docs)
- **Vercel Docs**: [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- **Project Issues**: Check the GitHub repository

---

## 🎉 Success!

Once configured, users can enjoy:
- **Premium neural voices** for natural reading
- **Consistent quality** across all devices
- **Advanced voice controls** for personalized experience
- **Professional audio output** for documents

The app will automatically fall back to Native TTS if Google Cloud TTS is not available, ensuring a seamless experience for all users.
