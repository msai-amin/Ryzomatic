-- Diagnostic Query: Check Function Search Path Configuration
-- Run this in Supabase SQL Editor to see which functions lack SET search_path

-- Query all functions we're trying to fix and their search_path configuration
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    p.proconfig as configuration,
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
        'mark_page_highlights_orphaned',
        'get_collection_hierarchy',
        'cleanup_old_tts_cache',
        'increment_tts_cache_access',
        'get_similar_memories',
        'get_related_memories',
        'get_note_relationships',
        'get_document_description',
        'get_document_centric_graph'
    )
ORDER BY p.proname, pg_get_function_arguments(p.oid);

-- Also check if there are duplicate functions (qualified vs unqualified)
SELECT 
    'CHECKING FOR DUPLICATE FUNCTIONS' as diagnostic,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public')
    AND p.proname IN (
        'search_annotations',
        'get_book_highlights',
        'can_perform_vision_extraction',
        'get_annotation_stats',
        'mark_page_highlights_orphaned'
    );

-- Show exact function definitions to verify migration was applied
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
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
ORDER BY p.proname
LIMIT 1;

