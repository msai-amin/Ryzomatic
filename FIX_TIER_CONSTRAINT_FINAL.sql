-- Fixed: Update data FIRST, then add constraint
-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Find and drop ALL check constraints on profiles.tier
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Loop through all check constraints on profiles table
  FOR constraint_record IN
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'  -- Check constraint type
  LOOP
    -- Check if this constraint involves the tier column
    IF constraint_record.constraint_definition LIKE '%tier%' 
       OR constraint_record.constraint_definition LIKE '%free%pro%premium%enterprise%'
       OR constraint_record.constraint_definition LIKE '%free%custom%' THEN
      
      -- Drop this constraint
      BEGIN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_record.constraint_name);
        RAISE NOTICE 'Successfully dropped constraint: % (definition: %)', 
          constraint_record.constraint_name, 
          constraint_record.constraint_definition;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping constraint %: %', constraint_record.constraint_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- Step 2: Update ALL rows FIRST (before adding constraint)
-- This ensures no rows violate the new constraint
UPDATE public.profiles
SET tier = CASE
  WHEN tier = 'free' THEN 'free'
  WHEN tier = 'custom' THEN 'custom'
  WHEN tier IN ('pro', 'premium', 'enterprise') THEN 'custom'
  ELSE 'free'  -- Default any unexpected values to 'free'
END,
updated_at = NOW()
WHERE tier IS NOT NULL;  -- Update all rows with non-null tier

-- Step 3: Verify no invalid tiers remain (optional check)
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.profiles
  WHERE tier IS NOT NULL 
    AND tier NOT IN ('free', 'custom');
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % rows with invalid tier values. Please fix manually.', invalid_count;
  END IF;
END $$;

-- Step 4: Now add the new constraint (all data is valid)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_tier_check 
CHECK (tier IN ('free', 'custom'));

COMMIT;
