-- Migration: Add Rate Limiting for Public Website
-- Enables rate limiting for resource-intensive endpoints with hourly limits for new users
-- Existing users (created before today) get admin privileges with unlimited access
-- Date: 2025-01-28

-- ============================================================================
-- ADD RATE LIMITING FIELDS TO PROFILES
-- ============================================================================

-- Add is_admin field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add rate_limit_per_hour field to profiles table
-- NULL means unlimited (for admin users)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS rate_limit_per_hour INTEGER;

-- Add index for faster admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- ============================================================================
-- UPDATE EXISTING USERS TO ADMIN STATUS
-- ============================================================================

-- Mark all users created before today as admins with unlimited resources
UPDATE profiles
SET 
  is_admin = true,
  rate_limit_per_hour = NULL,  -- NULL = unlimited
  tier = 'enterprise',  -- Set tier to enterprise for unlimited resources
  credits = GREATEST(credits, 1000000)  -- Ensure high credits (at least 1M)
WHERE created_at < CURRENT_DATE;

-- ============================================================================
-- RATE LIMIT TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,  -- e.g., 'chat', 'upload', 'embedding', 'memory'
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', NOW()),  -- Start of current hour window
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint to prevent duplicate tracking entries per user/endpoint/hour
  UNIQUE(user_id, endpoint, window_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_user_endpoint ON rate_limit_tracking(user_id, endpoint, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_window_start ON rate_limit_tracking(window_start);

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD RATE LIMIT RECORDS
-- ============================================================================

-- Function to clean up rate limit tracking records older than 2 hours
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$
BEGIN
  DELETE FROM public.rate_limit_tracking
  WHERE window_start < NOW() - INTERVAL '2 hours';
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Service role can manage all rate limit tracking (for API endpoints)
CREATE POLICY "Service can manage rate limit tracking" ON rate_limit_tracking
  FOR ALL USING (true);

-- Users can read their own rate limit tracking
CREATE POLICY "Users can read own rate limit tracking" ON rate_limit_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTION TO CHECK RATE LIMIT
-- ============================================================================

-- Function to check and increment rate limit for a user/endpoint
-- Returns true if within limit, false if exceeded
CREATE OR REPLACE FUNCTION check_rate_limit(
  user_uuid UUID,
  endpoint_name TEXT,
  limit_per_hour INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_window TIMESTAMPTZ;
  current_count INTEGER;
  is_admin_user BOOLEAN;
  rate_limit_value INTEGER;
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO is_admin_user
  FROM public.profiles
  WHERE id = user_uuid;
  
  -- If admin, always allow
  IF is_admin_user THEN
    RETURN QUERY SELECT true, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- If no limit specified, check user's profile limit
  IF limit_per_hour IS NULL THEN
    SELECT rate_limit_per_hour INTO rate_limit_value
    FROM public.profiles
    WHERE id = user_uuid;
    
    -- If still NULL (admin), allow
    IF rate_limit_value IS NULL THEN
      RETURN QUERY SELECT true, NULL::INTEGER, NULL::TIMESTAMPTZ;
      RETURN;
    END IF;
  ELSE
    rate_limit_value := limit_per_hour;
  END IF;
  
  -- Get current hour window
  current_window := date_trunc('hour', NOW());
  
  -- Get or create rate limit tracking record
  INSERT INTO public.rate_limit_tracking (user_id, endpoint, window_start, request_count)
  VALUES (user_uuid, endpoint_name, current_window, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET 
    request_count = rate_limit_tracking.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO current_count;
  
  -- If no conflict, we inserted a new record
  IF current_count IS NULL THEN
    SELECT request_count INTO current_count
    FROM public.rate_limit_tracking
    WHERE user_id = user_uuid
      AND endpoint = endpoint_name
      AND window_start = current_window;
  END IF;
  
  -- Check if limit exceeded
  IF current_count > rate_limit_value THEN
    -- Calculate reset time (start of next hour)
    RETURN QUERY SELECT 
      false,
      0,
      current_window + INTERVAL '1 hour';
  ELSE
    -- Return remaining requests and reset time
    RETURN QUERY SELECT 
      true,
      rate_limit_value - current_count,
      current_window + INTERVAL '1 hour';
  END IF;
END;
$$;
