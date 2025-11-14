#!/bin/bash

# Script to sync local environment variables to Vercel
# Usage: ./scripts/sync-env-to-vercel.sh [production|preview|development]

set -e

ENVIRONMENT=${1:-production}

echo "🔄 Syncing environment variables to Vercel ($ENVIRONMENT environment)"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Install it with: npm install -g vercel"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel. Run: vercel login"
    exit 1
fi

# List of environment variables to sync
VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "VITE_GEMINI_API_KEY"
    "GEMINI_API_KEY"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_S3_BUCKET"
    "AWS_REGION"
    "VITE_GOOGLE_CLIENT_ID"
    "VITE_GOOGLE_API_KEY"
    "VITE_GOOGLE_CLOUD_TTS_API_KEY"
    "VITE_APP_URL"
)

# Load .env.local if it exists
if [ -f .env.local ]; then
    echo "📄 Loading variables from .env.local"
    set -a
    source .env.local
    set +a
elif [ -f .env ]; then
    echo "📄 Loading variables from .env"
    set -a
    source .env
    set +a
fi

echo ""
echo "Setting environment variables in Vercel..."
echo ""

SUCCESS_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

for var in "${VARS[@]}"; do
    # Get the value from environment
    value="${!var}"
    
    if [ -z "$value" ]; then
        echo "⏭️  Skipping $var (not set locally)"
        ((SKIP_COUNT++))
        continue
    fi
    
    echo "📝 Setting $var..."
    
    # Use vercel env add with echo to pipe the value
    if echo "$value" | vercel env add "$var" "$ENVIRONMENT" 2>/dev/null; then
        echo "✅ Set $var"
        ((SUCCESS_COUNT++))
    else
        # If it already exists, try to update it
        echo "⚠️  $var might already exist. Updating..."
        if echo "$value" | vercel env rm "$var" "$ENVIRONMENT" --yes 2>/dev/null; then
            echo "$value" | vercel env add "$var" "$ENVIRONMENT" 2>/dev/null && {
                echo "✅ Updated $var"
                ((SUCCESS_COUNT++))
            } || {
                echo "❌ Failed to update $var"
                ((ERROR_COUNT++))
            }
        else
            echo "❌ Failed to set $var"
            ((ERROR_COUNT++))
        fi
    fi
    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Summary:"
echo "   Successfully set: $SUCCESS_COUNT"
echo "   Skipped (not set locally): $SKIP_COUNT"
echo "   Errors: $ERROR_COUNT"
echo ""
echo "🚀 Next step: Redeploy your application"
echo "   Run: vercel --prod"
echo "   Or redeploy from Vercel dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

