#!/bin/bash

# Quick script to set Vercel environment variables from local .env files
# This script will read from .env.local or .env and set them in Vercel

set -e

ENV_FILE=""
if [ -f .env.local ]; then
    ENV_FILE=".env.local"
elif [ -f .env ]; then
    ENV_FILE=".env"
else
    echo "❌ No .env.local or .env file found"
    echo "Please create .env.local with your environment variables"
    exit 1
fi

echo "📄 Reading from $ENV_FILE"
echo ""

# Source the env file
set -a
source "$ENV_FILE"
set +a

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Install it with: npm install -g vercel"
    exit 1
fi

# Critical variables that must be set
CRITICAL_VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
)

# Important variables
IMPORTANT_VARS=(
    "SUPABASE_SERVICE_ROLE_KEY"
    "GEMINI_API_KEY"
    "VITE_GEMINI_API_KEY"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_S3_BUCKET"
    "AWS_REGION"
)

# Optional variables
OPTIONAL_VARS=(
    "VITE_GOOGLE_CLIENT_ID"
    "VITE_GOOGLE_API_KEY"
    "VITE_GOOGLE_CLOUD_TTS_API_KEY"
    "VITE_AZURE_TTS_KEY"
    "VITE_AZURE_TTS_REGION"
    "VITE_APP_URL"
)

echo "🚀 Setting environment variables in Vercel..."
echo "Environment: production"
echo ""

set_var() {
    local var_name=$1
    local value="${!var_name}"
    
    if [ -z "$value" ]; then
        return 1
    fi
    
    echo "Setting $var_name..."
    # Use printf to handle special characters
    printf '%s' "$value" | vercel env add "$var_name" production 2>&1 | grep -v "already exists" || {
        # If it already exists, remove and re-add
        echo "  Updating existing value..."
        vercel env rm "$var_name" production --yes 2>/dev/null || true
        printf '%s' "$value" | vercel env add "$var_name" production 2>&1 | grep -v "already exists" || true
    }
    echo "  ✅ Done"
    return 0
}

SUCCESS=0
SKIPPED=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔴 CRITICAL Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for var in "${CRITICAL_VARS[@]}"; do
    if set_var "$var"; then
        ((SUCCESS++))
    else
        echo "  ⚠️  $var not found in $ENV_FILE"
        ((SKIPPED++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🟡 IMPORTANT Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for var in "${IMPORTANT_VARS[@]}"; do
    if set_var "$var"; then
        ((SUCCESS++))
    else
        echo "  ⏭️  Skipping $var (not set)"
        ((SKIPPED++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🟢 OPTIONAL Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for var in "${OPTIONAL_VARS[@]}"; do
    if set_var "$var"; then
        ((SUCCESS++))
    else
        echo "  ⏭️  Skipping $var (not set)"
        ((SKIPPED++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Summary:"
echo "   Successfully set: $SUCCESS variables"
echo "   Skipped: $SKIPPED variables"
echo ""
echo "🚀 Next steps:"
echo "   1. Verify variables: vercel env ls"
echo "   2. Redeploy: vercel --prod"
echo "   Or redeploy from Vercel dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

