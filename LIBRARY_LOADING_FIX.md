# 🔧 Fix Library Loading Error

## Problem
Library loading is failing because the `search_user_books` database function has an incorrect SQL structure (missing the CTE clause).

## Solution
Run the SQL fix to correct the function definition.

---

## Quick Fix Steps

### Step 1: Go to Supabase Dashboard
1. Open: https://app.supabase.com/project/pbfipmvtkbivnwwgukpw
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New query"**

### Step 2: Copy and Run This SQL

```sql
-- Fix search_user_books RPC function
-- This ensures the function is properly defined with the correct SQL structure

CREATE OR REPLACE FUNCTION search_user_books(
  user_uuid uuid,
  q text DEFAULT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_field text DEFAULT 'last_read_at',
  sort_order text DEFAULT 'desc',
  after jsonb DEFAULT NULL,
  page_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  title text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  total_pages int,
  reading_progress numeric,
  last_read_page int,
  last_read_at timestamptz,
  is_favorite boolean,
  notes_count int,
  pomodoro_sessions_count int,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH base AS (
    SELECT ub.*
    FROM public.user_books ub
    WHERE ub.user_id = user_uuid
      AND (q IS NULL OR q = '' OR
        to_tsvector('english', coalesce(ub.title,'') || ' ' || coalesce(ub.file_name,'')) @@ plainto_tsquery('english', q))
      AND (NOT (filters ? 'fileType') OR ub.file_type = lower(filters->>'fileType'))
      AND (NOT (filters ? 'isFavorite') OR ub.is_favorite = (filters->>'isFavorite')::boolean)
      AND (NOT (filters ? 'hasNotes') OR (
        CASE WHEN (filters->>'hasNotes')::boolean THEN ub.notes_count > 0 ELSE ub.notes_count = 0 END))
      AND (NOT (filters ? 'hasAudio') OR (
        CASE WHEN (filters->>'hasAudio')::boolean THEN ub.pomodoro_sessions_count > 0 ELSE ub.pomodoro_sessions_count = 0 END))
      AND (NOT (filters ? 'readingProgress') OR (
        ub.reading_progress >= ((filters->'readingProgress'->>'min')::numeric) AND
        ub.reading_progress <= ((filters->'readingProgress'->>'max')::numeric)))
      AND (NOT (filters ? 'fileSizeRange') OR (
        ub.file_size_bytes >= ((filters->'fileSizeRange'->>'min')::bigint) AND
        ub.file_size_bytes <= ((filters->'fileSizeRange'->>'max')::bigint)))
      AND (NOT (filters ? 'dateRange') OR (
        ub.created_at >= ((filters->'dateRange'->>'start')::timestamptz) AND
        ub.created_at <= ((filters->'dateRange'->>'end')::timestamptz)))
      AND (NOT (filters ? 'collections') OR EXISTS (
        SELECT 1 FROM public.book_collections bc
        WHERE bc.book_id = ub.id
          AND bc.collection_id IN (SELECT public.jsonb_uuid_elems(filters->'collections'))))
      AND (NOT (filters ? 'tags') OR EXISTS (
        SELECT 1 FROM public.book_tag_assignments bta
        WHERE bta.book_id = ub.id
          AND bta.tag_id IN (SELECT public.jsonb_uuid_elems(filters->'tags'))))
      AND (after IS NULL OR (
        (sort_field = 'last_read_at' AND (
          (ub.last_read_at, ub.id) < (((after->>'last_read_at')::timestamptz), (after->>'id')::uuid))) OR
        (sort_field = 'created_at' AND (
          (ub.created_at, ub.id) < (((after->>'created_at')::timestamptz), (after->>'id')::uuid)))))
  )
  SELECT
    b.id,
    b.title,
    b.file_name,
    b.file_type,
    b.file_size_bytes,
    b.total_pages,
    b.reading_progress,
    b.last_read_page,
    b.last_read_at,
    b.is_favorite,
    b.notes_count,
    b.pomodoro_sessions_count,
    b.created_at,
    b.updated_at
  FROM base b
  ORDER BY
    CASE WHEN sort_field = 'last_read_at' THEN b.last_read_at END DESC NULLS LAST,
    CASE WHEN sort_field = 'created_at' THEN b.created_at END DESC NULLS LAST,
    b.id DESC
  LIMIT COALESCE(page_limit, 50);
$$;

-- Grant execute permissions
REVOKE ALL ON FUNCTION search_user_books(uuid, text, jsonb, text, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_user_books(uuid, text, jsonb, text, text, jsonb, int) TO anon, authenticated, service_role;
```

### Step 3: Click "Run" Button
You should see: **"Success. No rows returned"** ✅

---

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Read the SQL file
cat supabase/migrations/009_search_rpcs.sql

# Or apply the entire migration
supabase db push
```

---

## Verification

After running the SQL, verify the fix:

1. **Refresh your application** in the browser
2. **Open the library** (click Library button)
3. **Check browser console** - there should be NO errors
4. **Your books should load** successfully

---

## Expected Console Logs (Good Signs)

```
[INFO] LibrarySearchService initialized
[INFO] Search completed
[INFO] Collections retrieved
```

## Error Messages to Watch For

If you still see errors, they might look like:

❌ `syntax error at or near "SELECT"`  
❌ `relation "base" does not exist`  
❌ `Failed to search books: function execution error`

These mean the SQL fix hasn't been applied yet.

---

## What This Fix Does

- ✅ Corrects the SQL structure with proper `WITH base AS` clause
- ✅ Ensures proper user filtering with `SET search_path = ''`
- ✅ Grants proper execute permissions
- ✅ Enables library search to work correctly

---

## Need Help?

If the error persists after running this SQL:
1. Take a screenshot of the browser console error
2. Copy the full error message
3. Check the Supabase logs in the dashboard

