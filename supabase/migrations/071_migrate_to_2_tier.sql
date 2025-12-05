-- Migration: Convert 4-tier pricing to 2-tier (free, custom)
-- This migration:
-- 1. Migrates existing users (pro/premium/enterprise → custom)
-- 2. Updates tier CHECK constraint
-- 3. Updates all tier-based functions

BEGIN;

-- Step 1: Migrate existing users to new tier structure
-- Free users stay free, all paid users become 'custom'
UPDATE profiles
SET tier = CASE
  WHEN tier = 'free' THEN 'free'
  WHEN tier IN ('pro', 'premium', 'enterprise') THEN 'custom'
  ELSE 'free' -- Default to free for any unexpected values
END,
updated_at = NOW()
WHERE tier IN ('pro', 'premium', 'enterprise');

-- Step 2: Drop the old CHECK constraint (handle both named and inline constraints)
DO $$
BEGIN
  -- Drop named constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_tier_check' 
    AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_tier_check;
  END IF;
  
  -- Also check for inline constraint in table definition
  -- This is handled by recreating the constraint below
END $$;

-- Step 3: Add new CHECK constraint with only 'free' and 'custom'
-- Use IF NOT EXISTS pattern by dropping first (already done above)
ALTER TABLE profiles 
ADD CONSTRAINT profiles_tier_check 
CHECK (tier IN ('free', 'custom'));

-- Step 4: Update check_vision_extraction_eligibility function
CREATE OR REPLACE FUNCTION check_vision_extraction_eligibility(
  user_id UUID,
  page_count INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  current_count INT,
  tier_limit INT,
  user_credits NUMERIC,
  credits_required NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  user_credits NUMERIC;
  user_vision_count INT;
  tier_limit INT;
  credits_required NUMERIC;
BEGIN
  -- Get user profile
  SELECT tier, credits, vision_pages_monthly
  INTO user_tier, user_credits, user_vision_count
  FROM profiles
  WHERE id = user_id;

  -- If user not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT, 0, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Determine tier limits (free: 100 pages/month, custom: unlimited)
  tier_limit := CASE user_tier
    WHEN 'free' THEN 100
    WHEN 'custom' THEN -1 -- unlimited
    ELSE 100 -- default to free tier
  END;

  -- Calculate credits needed (0.1 per page, except custom tier)
  credits_required := CASE 
    WHEN user_tier = 'custom' THEN 0
    ELSE page_count * 0.1
  END;

  -- Check monthly limit (if not unlimited)
  IF tier_limit != -1 AND (user_vision_count + page_count) > tier_limit THEN
    RETURN QUERY SELECT 
      false,
      'Monthly vision extraction limit exceeded'::TEXT,
      user_vision_count,
      tier_limit,
      user_credits,
      credits_required;
    RETURN;
  END IF;

  -- Check credits (if not custom tier)
  IF user_tier != 'custom' AND user_credits < credits_required THEN
    RETURN QUERY SELECT 
      false,
      'Insufficient credits'::TEXT,
      user_vision_count,
      tier_limit,
      user_credits,
      credits_required;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT 
    true,
    'Allowed'::TEXT,
    user_vision_count,
    tier_limit,
    user_credits,
    credits_required;
END;
$$;

-- Step 5: Update can_perform_vision_extraction function (if it exists)
CREATE OR REPLACE FUNCTION can_perform_vision_extraction(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  monthly_count BIGINT;
  user_tier TEXT;
  tier_limit INT;
BEGIN
  -- Get user's tier and current monthly count
  SELECT 
    p.tier,
    COUNT(*)
  INTO user_tier, monthly_count
  FROM public.profiles p
  LEFT JOIN public.vision_usage vu ON vu.user_id = user_uuid 
    AND DATE_TRUNC('month', vu.extraction_date) = DATE_TRUNC('month', CURRENT_DATE)
  WHERE p.id = user_uuid
  GROUP BY p.tier;
  
  -- Tier limits: free (100/month), custom (unlimited)
  IF user_tier = 'custom' THEN
    RETURN TRUE; -- Custom tier has unlimited
  END IF;
  
  -- Free tier limit: 100 pages per month
  RETURN monthly_count < 100;
END;
$$;

-- Step 6: Update default credits for free tier users (increase to 200)
UPDATE profiles
SET credits = 200
WHERE tier = 'free' AND credits < 200;

COMMIT;

