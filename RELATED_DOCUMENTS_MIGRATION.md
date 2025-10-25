# Related Documents Feature - Database Migration Required

## Issue
The Related Documents feature is showing errors because the required database table `document_relationships` doesn't exist yet.

## Error Messages
```
Could not find the table 'public.document_relationships' in the schema cache
Failed to load resource: the server responded with a status of 404 ()
```

## Solution
You need to run a database migration to create the `document_relationships` table and related functions.

## Steps to Fix

### Option 1: Run the Migration Script
```bash
./scripts/show-migration.sh
```

### Option 2: Manual Migration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Copy and paste the SQL from `supabase/migrations/015_add_document_relationships.sql`
5. Click **Run** to execute the migration

### Option 3: Copy SQL Directly
The migration SQL is located in:
```
supabase/migrations/015_add_document_relationships.sql
```

## What the Migration Creates

1. **`document_relationships` table** - Stores relationships between documents
2. **Indexes** - For performance optimization
3. **RLS Policies** - Row Level Security for user data isolation
4. **Functions**:
   - `get_related_documents_with_details()` - Fetches related documents with metadata
   - `get_document_relationship_stats()` - Gets relationship statistics

## Verification

After running the migration:

1. Go to **Table Editor** in Supabase dashboard
2. You should see a new table called `document_relationships`
3. The Related Documents section in the app should now work without errors

## Features After Migration

- ✅ Add related documents from library or upload new ones
- ✅ AI-powered relevance calculation
- ✅ Document preview with metadata
- ✅ Relationship management (edit/delete)
- ✅ Background processing queue for AI calculations

## Troubleshooting

If you still see errors after running the migration:

1. Check that the table exists in Supabase dashboard
2. Verify RLS policies are enabled
3. Check browser console for specific error messages
4. Ensure the user is authenticated

## Files Modified

- `supabase/migrations/015_add_document_relationships.sql` - Database schema
- `lib/supabase.ts` - Helper functions
- `src/services/documentRelevanceService.ts` - AI relevance calculation
- `api/documents/relationships.ts` - API endpoint
- `src/components/AddRelatedDocumentModal.tsx` - Add related documents UI
- `src/components/DocumentPreviewModal.tsx` - Document preview UI
- `src/components/RelatedDocumentsPanel.tsx` - Sidebar panel
- `themes/ThemedSidebar.tsx` - Sidebar integration
- `src/store/appStore.ts` - State management
- `src/services/backgroundProcessingService.ts` - Background processing
