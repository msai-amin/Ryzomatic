-- Feature flags and monitoring for production rollout

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  rollout_percentage numeric DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  user_whitelist uuid[] DEFAULT '{}',
  environment text DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Insert feature flags for new search system
INSERT INTO public.feature_flags (name, description, enabled, rollout_percentage, environment) VALUES
('new_search_rpc', 'Use new search_user_books RPC instead of PostgREST queries', false, 0, 'production'),
('keyset_pagination', 'Use cursor-based pagination instead of offset', false, 0, 'production'),
('hierarchy_cache', 'Use materialized view for collection hierarchy', false, 0, 'production'),
('performance_logging', 'Log query performance metrics', true, 100, 'production')
ON CONFLICT (name) DO NOTHING;

-- Function to check if feature is enabled for user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  feature_name text,
  user_uuid uuid DEFAULT NULL,
  environment_param text DEFAULT 'production'
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  flag_record feature_flags%ROWTYPE;
  user_hash numeric;
BEGIN
  -- Get feature flag
  SELECT * INTO flag_record 
  FROM public.feature_flags 
  WHERE name = feature_name 
    AND environment = environment_param;
  
  -- Feature doesn't exist
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Feature disabled
  IF NOT flag_record.enabled THEN
    RETURN false;
  END IF;
  
  -- No user context - check rollout percentage
  IF user_uuid IS NULL THEN
    RETURN flag_record.rollout_percentage = 100;
  END IF;
  
  -- Check whitelist first
  IF user_uuid = ANY(flag_record.user_whitelist) THEN
    RETURN true;
  END IF;
  
  -- Check rollout percentage using user ID hash
  user_hash := ('x' || substr(md5(user_uuid::text), 1, 8))::bit(32)::int % 100;
  
  RETURN user_hash < flag_record.rollout_percentage;
END;
$$;

-- Performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type text NOT NULL CHECK (alert_type IN ('slow_query', 'large_payload', 'high_error_rate')),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  query_type text,
  execution_time_ms numeric,
  payload_size_bytes bigint,
  error_count bigint,
  threshold_value numeric,
  message text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_user_id ON performance_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_created_at ON performance_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);

-- Function to check and create performance alerts
CREATE OR REPLACE FUNCTION check_performance_alerts(
  user_uuid uuid,
  query_type_param text,
  execution_time_ms_param numeric,
  payload_size_bytes_param bigint DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  slow_query_threshold numeric := 500; -- 500ms
  large_payload_threshold bigint := 200 * 1024; -- 200KB
  recent_error_count bigint;
BEGIN
  -- Check for slow queries
  IF execution_time_ms_param > slow_query_threshold THEN
    INSERT INTO public.performance_alerts (
      alert_type, user_id, query_type, execution_time_ms, threshold_value, message
    ) VALUES (
      'slow_query', 
      user_uuid, 
      query_type_param, 
      execution_time_ms_param, 
      slow_query_threshold,
      format('Query %s took %s ms (threshold: %s ms)', query_type_param, execution_time_ms_param, slow_query_threshold)
    );
  END IF;
  
  -- Check for large payloads
  IF payload_size_bytes_param IS NOT NULL AND payload_size_bytes_param > large_payload_threshold THEN
    INSERT INTO public.performance_alerts (
      alert_type, user_id, query_type, payload_size_bytes, threshold_value, message
    ) VALUES (
      'large_payload', 
      user_uuid, 
      query_type_param, 
      payload_size_bytes_param, 
      large_payload_threshold,
      format('Query %s returned %s bytes (threshold: %s bytes)', query_type_param, payload_size_bytes_param, large_payload_threshold)
    );
  END IF;
  
  -- Check for high error rate (last 5 minutes)
  SELECT COUNT(*) INTO recent_error_count
  FROM public.query_performance_log
  WHERE user_id = user_uuid
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND execution_time_ms > 1000; -- Consider >1s as error
    
  IF recent_error_count > 5 THEN
    INSERT INTO public.performance_alerts (
      alert_type, user_id, query_type, error_count, threshold_value, message
    ) VALUES (
      'high_error_rate', 
      user_uuid, 
      query_type_param, 
      recent_error_count, 
      5,
      format('User has %s slow queries in last 5 minutes', recent_error_count)
    );
  END IF;
END;
$$;

-- Enhanced performance logging with alerts
CREATE OR REPLACE FUNCTION log_query_performance_with_alerts(
  user_uuid uuid,
  query_type_param text,
  execution_time_ms_param numeric,
  rows_returned_param bigint DEFAULT NULL,
  cache_hit_param boolean DEFAULT false,
  filters_param jsonb DEFAULT NULL,
  payload_size_bytes_param bigint DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Log the performance data
  INSERT INTO public.query_performance_log (
    user_id, 
    query_type, 
    execution_time_ms, 
    rows_returned, 
    cache_hit, 
    filters
  ) VALUES (
    user_uuid,
    query_type_param,
    execution_time_ms_param,
    rows_returned_param,
    cache_hit_param,
    filters_param
  );
  
  -- Check for alerts (only for non-cache hits)
  IF NOT cache_hit_param THEN
    PERFORM check_performance_alerts(
      user_uuid, 
      query_type_param, 
      execution_time_ms_param, 
      payload_size_bytes_param
    );
  END IF;
END;
$$;

-- Function to get user's performance summary
CREATE OR REPLACE FUNCTION get_user_performance_summary(user_uuid uuid, days_back int DEFAULT 7)
RETURNS TABLE (
  total_queries bigint,
  avg_execution_time_ms numeric,
  p95_execution_time_ms numeric,
  cache_hit_rate numeric,
  slow_query_count bigint,
  large_payload_count bigint,
  active_alerts bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_queries,
    COALESCE(AVG(execution_time_ms), 0) as avg_execution_time_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 0) as p95_execution_time_ms,
    COALESCE(COUNT(*) FILTER (WHERE cache_hit = true)::numeric / COUNT(*)::numeric * 100, 0) as cache_hit_rate,
    COUNT(*) FILTER (WHERE execution_time_ms > 500) as slow_query_count,
    COUNT(*) FILTER (WHERE execution_time_ms > 1000) as large_payload_count,
    (SELECT COUNT(*) FROM public.performance_alerts WHERE user_id = user_uuid AND resolved = false) as active_alerts
  FROM public.query_performance_log
  WHERE user_id = user_uuid
    AND created_at >= NOW() - (days_back || ' days')::interval;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_feature_enabled(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_performance_alerts(uuid, text, numeric, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION log_query_performance_with_alerts(uuid, text, numeric, bigint, boolean, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_performance_summary(uuid, int) TO authenticated;

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read feature flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Users can read own performance alerts" ON performance_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own performance alerts" ON performance_alerts FOR UPDATE USING (auth.uid() = user_id);
