-- Quick fix for 2-tier constraint
-- Run this immediately to fix the constraint error
-- This script drops the constraint, updates data, then recreates the constraint

BEGIN;

-- Step 1: Drop the constraint by name (most common case)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;

-- Step 2: Also try to find and drop any constraint that checks tier
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Find any check constraint that involves tier
  FOR constraint_name_var IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%tier%'
        OR pg_get_constraintdef(oid) LIKE '%free%pro%premium%enterprise%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
    RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
  END LOOP;
END $$;

-- Step 3: Now update any existing data (constraint is dropped)
UPDATE public.profiles
SET tier = CASE
  WHEN tier = 'free' THEN 'free'
  WHEN tier IN ('pro', 'premium', 'enterprise') THEN 'custom'
  WHEN tier = 'custom' THEN 'custom'
  ELSE 'free'
END,
updated_at = NOW()
WHERE tier IN ('pro', 'premium', 'enterprise') OR (tier = 'custom' AND tier IS NOT NULL);

-- Step 4: Add the new constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_tier_check 
CHECK (tier IN ('free', 'custom'));

COMMIT;
