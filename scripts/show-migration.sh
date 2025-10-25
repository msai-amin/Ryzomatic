#!/bin/bash

# Script to display the migration SQL that needs to be applied to Supabase
# This will show the SQL that needs to be run in the Supabase dashboard

echo "🚀 Document Relationships Migration"
echo "=================================="
echo ""
echo "The Related Documents feature requires a database migration."
echo "Please run the following SQL in your Supabase dashboard:"
echo ""
echo "📋 Instructions:"
echo "1. Go to https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to SQL Editor"
echo "4. Copy and paste the SQL below"
echo "5. Click 'Run' to execute"
echo ""
echo "=" | head -c 80
echo ""
echo ""

# Display the migration SQL
cat supabase/migrations/015_add_document_relationships.sql

echo ""
echo "=" | head -c 80
echo ""
echo "✅ After running this SQL, the Related Documents feature will work properly."
echo ""
echo "🔍 To verify the migration worked:"
echo "1. Go to Table Editor in Supabase dashboard"
echo "2. You should see a new table called 'document_relationships'"
echo "3. The Related Documents section should now work in the app"
