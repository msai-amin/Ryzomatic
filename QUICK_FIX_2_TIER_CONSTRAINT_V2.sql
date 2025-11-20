-- Quick fix for 2-tier constraint - VERSION 2
-- Run this in Supabase SQL Editor
-- This version drops constraint in a separate step to avoid transaction issues

-- STEP 1: Drop the constraint (run this first)
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Try direct drop first
  BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_tier_check;
    RAISE NOTICE 'Dropped constraint: profiles_tier_check';
  EXCEPTION WHEN undefined_object THEN
    -- Constraint doesn't exist with that name, find it
    NULL;
  END;
  
  -- Find and drop any constraint that checks tier
  FOR constraint_name_var IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%tier%'
        OR pg_get_constraintdef(oid) LIKE '%free%pro%premium%enterprise%'
        OR conname LIKE '%tier%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name_var);
      RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop constraint: %', constraint_name_var;
    END;
  END LOOP;
END $$;

-- STEP 2: Update data (run this after step 1)
UPDATE public.profiles
SET tier = CASE
  WHEN tier = 'free' THEN 'free'
  WHEN tier IN ('pro', 'premium', 'enterprise') THEN 'custom'
  WHEN tier = 'custom' THEN 'custom'
  ELSE 'free'
END,
updated_at = NOW()
WHERE tier IN ('pro', 'premium', 'enterprise') OR tier = 'custom';

-- STEP 3: Add new constraint (run this after step 2)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_tier_check 
CHECK (tier IN ('free', 'custom'));

