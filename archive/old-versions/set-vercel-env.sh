#!/bin/bash

# Script to set Vercel environment variables
# Run this script and paste your actual values when prompted

echo "🚀 Setting up Vercel Environment Variables"
echo "============================================"
echo ""
echo "You'll be prompted to enter each value."
echo "Get these from your Supabase Dashboard: https://app.supabase.com/"
echo ""

# Critical variables for frontend (VITE_ prefix is required!)
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# Optional: Google OAuth (for Google Drive features)
echo ""
echo "Optional: Google OAuth Client ID (press Enter to skip)"
vercel env add VITE_GOOGLE_CLIENT_ID production

# Backend variables for API routes
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GEMINI_API_KEY production
vercel env add AWS_ACCESS_KEY_ID production
vercel env add AWS_SECRET_ACCESS_KEY production
vercel env add AWS_S3_BUCKET production
vercel env add AWS_REGION production

echo ""
echo "✅ Environment variables set!"
echo "Now redeploy with: vercel --prod"

