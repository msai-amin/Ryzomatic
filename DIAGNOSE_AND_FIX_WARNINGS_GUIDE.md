# Diagnose and Fix Persistent Database Warnings

## Problem

After running migration 024 successfully, the Supabase database linter still reports 5 warnings for the same functions.

## Root Cause Investigation

### Step 1: Run Diagnostic Query

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `DIAGNOSE_FUNCTION_SEARCH_PATH.sql`
3. Execute the query
4. Review the results

**What to Look For:**

The diagnostic will show:
- Which functions have `SET search_path` configured
- Which functions lack the configuration
- Exact function definitions currently in the database
- Any duplicate function signatures

### Expected Findings

If the issue is schema qualification mismatch, you'll see:

```
function_name          | status
-----------------------|------------------
search_annotations     | ❌ NO SET search_path
public.search_annotations | ✅ HAS SET search_path
```

This indicates **two functions exist** with the same logical name but different schemas/qualifications.

## Solution

### Step 2: Apply the Fix

Run the `FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql` script:

1. Copy the entire contents of `FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql`
2. Paste into Supabase SQL Editor
3. Execute

This script:
- **Drops** any existing versions of the 5 problematic functions
- **Recreates** them with explicit `public.` schema qualification
- Adds `SET search_path = public, pg_temp` to each
- Grants proper permissions
- Adds documentation comments

### Step 3: Verify

1. Wait 1-2 minutes for the linter to refresh
2. Run Supabase Database Linter again
3. Expected result: Only 1 warning remains (vector extension)

## Why This Happened

### PostgreSQL Function Resolution

In PostgreSQL, these are **different functions**:
```sql
CREATE FUNCTION search_annotations(...)     -- Unqualified
CREATE FUNCTION public.search_annotations(...)  -- Qualified
```

Even though `search_annotations` defaults to the `public` schema, PostgreSQL treats them as separate entities if created differently.

### Migration History

Migration 024 created functions without explicit schema qualification:
```sql
CREATE OR REPLACE FUNCTION search_annotations(...)
```

But earlier migrations (009, 012, 013, 017) created them with `public.` prefix:
```sql
CREATE OR REPLACE FUNCTION public.search_annotations(...)
```

The Supabase linter may be checking specifically for `public.function_name` signatures.

## Files Created

1. **DIAGNOSE_FUNCTION_SEARCH_PATH.sql** - Diagnostic queries to investigate
2. **FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql** - Corrective SQL with explicit schema
3. **DIAGNOSE_AND_FIX_WARNINGS_GUIDE.md** - This file

## Alternative: Check Linter Cache

If the fix doesn't work immediately:

1. Wait 5-10 minutes
2. Refresh the Supabase Dashboard
3. Re-run the Database Linter manually

The linter may have a caching delay.

## Prevention

For future migrations, always use explicit schema qualification:
```sql
CREATE OR REPLACE FUNCTION public.function_name(...)
```

Not:
```sql
CREATE OR REPLACE FUNCTION function_name(...)  -- Ambiguous
```

## Summary

**Problem**: Functions created without explicit `public.` prefix weren't being detected by linter  
**Solution**: Recreate with explicit `public.function_name` and `SET search_path`  
**Files**: Use `FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql` to apply the fix  
**Result**: Only vector extension warning should remain

