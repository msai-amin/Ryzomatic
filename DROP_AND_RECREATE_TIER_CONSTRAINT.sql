-- Simple script to drop and recreate tier constraint
-- Run this FIRST before any other operations

-- Step 1: Drop the constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;

-- Step 2: Find and drop any other constraint on tier
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
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
    BEGIN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name_var);
      RAISE NOTICE 'Dropped: %', constraint_name_var;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error dropping %: %', constraint_name_var, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 3: Add new constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_tier_check 
CHECK (tier IN ('free', 'custom'));

