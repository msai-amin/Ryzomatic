-- Debug and optimization utilities for production scale validation

-- Debug RPC to run EXPLAIN ANALYZE on search queries
CREATE OR REPLACE FUNCTION explain_search_query(
  user_uuid uuid,
  q text DEFAULT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_field text DEFAULT 'last_read_at'
)
RETURNS TABLE (
  query_plan text,
  execution_time_ms numeric,
  rows_returned bigint,
  buffer_hits bigint,
  buffer_reads bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  explain_result text;
  plan_record record;
BEGIN
  -- Only allow in development/staging environments
  IF current_setting('app.environment', true) NOT IN ('development', 'staging') THEN
    RAISE EXCEPTION 'EXPLAIN queries only allowed in development/staging';
  END IF;

  -- Build the actual query that would be executed
  EXECUTE format('
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
    SELECT ub.*
    FROM public.user_books ub
    WHERE ub.user_id = %L
      AND (%L IS NULL OR %L = '''' OR
        to_tsvector(''english'', coalesce(ub.title,'''') || '' '' || coalesce(ub.file_name,'''')) @@ plainto_tsquery(''english'', %L))
      AND (NOT (%L ? ''fileType'') OR ub.file_type = lower(%L->>''fileType''))
      AND (NOT (%L ? ''isFavorite'') OR ub.is_favorite = (%L->>''isFavorite'')::boolean)
      AND (NOT (%L ? ''collections'') OR EXISTS (
        SELECT 1 FROM public.book_collections bc
        WHERE bc.book_id = ub.id
          AND bc.collection_id IN (SELECT jsonb_uuid_elems(%L->''collections''))
      ))
      AND (NOT (%L ? ''tags'') OR EXISTS (
        SELECT 1 FROM public.book_tag_assignments bta
        WHERE bta.book_id = ub.id
          AND bta.tag_id IN (SELECT jsonb_uuid_elems(%L->''tags''))
      ))
    ORDER BY 
      CASE WHEN %L = ''last_read_at'' THEN ub.last_read_at END DESC NULLS LAST,
      CASE WHEN %L = ''created_at'' THEN ub.created_at END DESC NULLS LAST,
      ub.id DESC
    LIMIT 50
  ', user_uuid, q, q, q, filters, filters, filters, filters, filters, filters, sort_field, sort_field)
  INTO explain_result;

  -- Parse the JSON result
  FOR plan_record IN 
    SELECT * FROM json_to_recordset(explain_result::json) AS x(
      "Plan" json,
      "Execution Time" numeric,
      "Planning Time" numeric
    )
  LOOP
    RETURN QUERY SELECT 
      plan_record."Plan"::text as query_plan,
      plan_record."Execution Time" as execution_time_ms,
      (plan_record."Plan"->>'Actual Rows')::bigint as rows_returned,
      (plan_record."Plan"->>'Shared Hit Blocks')::bigint as buffer_hits,
      (plan_record."Plan"->>'Shared Read Blocks')::bigint as buffer_reads;
  END LOOP;
END;
$$;

-- Hierarchy caching: materialized view for collection hierarchies
-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS collection_hierarchy_cache;

CREATE MATERIALIZED VIEW collection_hierarchy_cache AS
SELECT 
  c.user_id,
  c.id,
  c.name,
  c.description,
  c.parent_id,
  c.color,
  c.icon,
  c.is_favorite,
  c.display_order,
  c.created_at,
  c.updated_at,
  COALESCE(bc.book_count, 0) as book_count,
  CASE 
    WHEN c.parent_id IS NULL THEN 0
    ELSE 1  -- Simplified depth for now
  END as level,
  CASE 
    WHEN c.parent_id IS NULL THEN c.name
    ELSE parent_c.name || ' > ' || c.name
  END as path
FROM public.user_collections c
LEFT JOIN (
  SELECT collection_id, COUNT(*) as book_count
  FROM public.book_collections
  GROUP BY collection_id
) bc ON c.id = bc.collection_id
LEFT JOIN public.user_collections parent_c ON c.parent_id = parent_c.id;

-- Index for the materialized view
CREATE INDEX IF NOT EXISTS idx_collection_hierarchy_cache_user_id ON collection_hierarchy_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_hierarchy_cache_parent_id ON collection_hierarchy_cache(parent_id);

-- Function to refresh hierarchy cache
CREATE OR REPLACE FUNCTION refresh_collection_hierarchy_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW collection_hierarchy_cache;
END;
$$;

-- Trigger to refresh cache when collections change
CREATE OR REPLACE FUNCTION trigger_refresh_hierarchy_cache()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Refresh cache asynchronously (in production, consider using pg_cron or background jobs)
  PERFORM refresh_collection_hierarchy_cache();
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for cache invalidation
DROP TRIGGER IF EXISTS refresh_hierarchy_on_collection_change ON user_collections;
CREATE TRIGGER refresh_hierarchy_on_collection_change
  AFTER INSERT OR UPDATE OR DELETE ON user_collections
  FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_hierarchy_cache();

DROP TRIGGER IF EXISTS refresh_hierarchy_on_book_collection_change ON book_collections;
CREATE TRIGGER refresh_hierarchy_on_book_collection_change
  AFTER INSERT OR UPDATE OR DELETE ON book_collections
  FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_hierarchy_cache();

-- Optimized hierarchy query using cache (moved after materialized view creation)

-- Performance monitoring: track slow queries
CREATE TABLE IF NOT EXISTS query_performance_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  query_type text NOT NULL,
  execution_time_ms numeric NOT NULL,
  rows_returned bigint,
  cache_hit boolean DEFAULT false,
  filters jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_performance_log_user_id ON query_performance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_query_performance_log_created_at ON query_performance_log(created_at);
CREATE INDEX IF NOT EXISTS idx_query_performance_log_execution_time ON query_performance_log(execution_time_ms);

-- Function to log query performance
CREATE OR REPLACE FUNCTION log_query_performance(
  user_uuid uuid,
  query_type_param text,
  execution_time_ms_param numeric,
  rows_returned_param bigint DEFAULT NULL,
  cache_hit_param boolean DEFAULT false,
  filters_param jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
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
END;
$$;

-- Optimized hierarchy query using cache
CREATE OR REPLACE FUNCTION get_collection_hierarchy_cached(user_uuid uuid, root_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  parent_id uuid,
  color text,
  icon text,
  is_favorite boolean,
  display_order int,
  level int,
  path text,
  book_count bigint,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 
    chc.id,
    chc.name,
    chc.description,
    chc.parent_id,
    chc.color,
    chc.icon,
    chc.is_favorite,
    chc.display_order,
    chc.level,
    chc.path,
    chc.book_count,
    chc.created_at
  FROM collection_hierarchy_cache chc
  WHERE chc.user_id = user_uuid
    AND (root_id IS NULL OR chc.id = root_id)
  ORDER BY chc.level, chc.display_order, chc.name;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION explain_search_query(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_collection_hierarchy_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_hierarchy_cached(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION log_query_performance(uuid, text, numeric, bigint, boolean, jsonb) TO authenticated;

-- Enable RLS on performance log
ALTER TABLE query_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own query performance logs" ON query_performance_log
  FOR SELECT USING (auth.uid() = user_id);
