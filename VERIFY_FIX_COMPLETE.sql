-- Verify all 5 functions now have SET search_path configured
-- Run this in Supabase SQL Editor after FIX_SCHEMA_QUALIFIED_FUNCTIONS.sql

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN '❌ NO SET search_path'
        WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ HAS SET search_path'
        ELSE '⚠️ OTHER CONFIG'
    END as status,
    CASE 
        WHEN p.proconfig IS NOT NULL THEN 
            array_to_string(p.proconfig, ', ')
        ELSE 'NULL'
    END as search_path_value
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN (
        'search_annotations',
        'get_book_highlights',
        'can_perform_vision_extraction',
        'get_annotation_stats',
        'mark_page_highlights_orphaned'
    )
ORDER BY p.proname;

-- All 5 should show ✅ HAS SET search_path

