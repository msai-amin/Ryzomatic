#!/bin/bash

# Supabase Security Fixes Application Script
# This script helps apply the security fixes for Supabase warnings

echo "🔒 Supabase Security Fixes Application Script"
echo "=============================================="

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run this from your project root."
    exit 1
fi

echo "✅ Supabase project detected"

# Check if project is linked to remote
echo "🔍 Checking project status..."
if supabase status &> /dev/null; then
    echo "✅ Local Supabase instance detected"
    echo "📝 Applying security migration to local instance..."
    supabase db push
elif supabase projects list &> /dev/null; then
    echo "✅ Remote Supabase project detected"
    echo "📝 Applying security migration to remote instance..."
    supabase db push
else
    echo "⚠️  No active Supabase instance found."
    echo ""
    echo "Please choose one of the following options:"
    echo ""
    echo "Option 1: Apply to Remote Supabase Project"
    echo "1. Link your project: supabase link --project-ref YOUR_PROJECT_REF"
    echo "2. Run this script again"
    echo ""
    echo "Option 2: Apply to Local Supabase Instance"
    echo "1. Start Docker Desktop"
    echo "2. Start local instance: supabase start"
    echo "3. Run this script again"
    echo ""
    echo "Option 3: Manual Application"
    echo "1. Copy the migration file: supabase/migrations/012_comprehensive_security_fixes.sql"
    echo "2. Apply it manually in your Supabase Dashboard SQL Editor"
    echo ""
    exit 1
fi

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed. Please check the error messages above."
    echo ""
    echo "If you're getting dependency errors, try:"
    echo "1. Check if all tables exist"
    echo "2. Apply migrations in order"
    echo "3. Use the manual SQL approach in Supabase Dashboard"
    exit 1
fi

echo ""
echo "🎉 Security fixes applied successfully!"
echo ""
echo "Next steps:"
echo "1. Go to your Supabase Dashboard"
echo "2. Navigate to Authentication → Settings"
echo "3. Enable 'Check for leaked passwords' in Password Strength section"
echo "4. Run Database → Linter to verify warnings are resolved"
echo ""
echo "For detailed instructions, see: SUPABASE_SECURITY_FIX_GUIDE.md"
