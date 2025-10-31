-- Fix: Move vector extension from public schema to extensions schema
-- Risk Level: Low
-- Priority: Optional (best practice, no security impact)

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;

-- Verify the move worked
SELECT 
    extname as extension_name,
    n.nspname as schema_name
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'vector';

-- Expected result: vector should now be in 'extensions' schema

