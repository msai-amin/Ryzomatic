-- Fix security warnings: Add SET search_path = '' to all functions
-- This prevents search_path injection attacks

-- Drop existing functions that need return type changes
DROP FUNCTION IF EXISTS get_user_reading_stats(uuid);
DROP FUNCTION IF EXISTS get_collection_hierarchy(uuid, uuid);
DROP FUNCTION IF EXISTS get_library_stats(uuid);

-- Fix functions from previous migrations
CREATE OR REPLACE FUNCTION update_reading_progress(book_uuid uuid, page_num int, total_pages int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.user_books 
  SET 
    last_read_page = page_num,
    reading_progress = CASE 
      WHEN total_pages > 0 THEN LEAST(100, GREATEST(0, (page_num::numeric / total_pages::numeric) * 100))
      ELSE 0 
    END,
    last_read_at = NOW()
  WHERE id = book_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION reset_monthly_ocr_counters()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles 
  SET credits = CASE 
    WHEN tier = 'free' THEN 100
    WHEN tier = 'pro' THEN 1000
    WHEN tier = 'premium' THEN 5000
    ELSE credits
  END
  WHERE tier IN ('free', 'pro', 'premium');
END;
$$;

CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_tags 
    SET usage_count = GREATEST(usage_count - 1, 0) 
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_reading_stats(user_uuid uuid)
RETURNS TABLE (
  total_books bigint,
  total_pages_read bigint,
  average_progress numeric,
  favorite_books bigint,
  books_with_notes bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_books,
    COALESCE(SUM(last_read_page), 0) as total_pages_read,
    COALESCE(AVG(reading_progress), 0) as average_progress,
    COUNT(*) FILTER (WHERE is_favorite = true) as favorite_books,
    COUNT(*) FILTER (WHERE notes_count > 0) as books_with_notes
  FROM user_books
  WHERE user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION update_book_pomodoro_totals()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_books 
    SET pomodoro_sessions_count = pomodoro_sessions_count + 1
    WHERE id = NEW.book_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_books 
    SET pomodoro_sessions_count = GREATEST(pomodoro_sessions_count - 1, 0)
    WHERE id = OLD.book_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION search_annotations(user_uuid uuid, q text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  book_id uuid,
  page_number int,
  content text,
  position_x numeric,
  position_y numeric,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 
    an.id,
    an.book_id,
    an.page_number,
    an.content,
    an.position_x,
    an.position_y,
    an.created_at
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid
    AND (q IS NULL OR an.content ILIKE '%' || q || '%')
  ORDER BY an.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_annotation_stats(user_uuid uuid)
RETURNS TABLE (
  total_annotations bigint,
  books_with_annotations bigint,
  recent_annotations bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_annotations,
    COUNT(DISTINCT book_id) as books_with_annotations,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_annotations
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION get_pomodoro_stats_by_book(book_uuid uuid)
RETURNS TABLE (
  total_sessions bigint,
  total_time_seconds bigint,
  total_time_minutes bigint,
  total_time_hours bigint,
  average_session_minutes numeric,
  completed_sessions bigint,
  work_sessions bigint,
  break_sessions bigint,
  last_session_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_sessions,
    COALESCE(SUM(duration_seconds), 0) as total_time_seconds,
    COALESCE(SUM(duration_seconds), 0) / 60 as total_time_minutes,
    COALESCE(SUM(duration_seconds), 0) / 3600 as total_time_hours,
    COALESCE(AVG(duration_seconds), 0) / 60 as average_session_minutes,
    COUNT(*) FILTER (WHERE completed = true) as completed_sessions,
    COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak')) as break_sessions,
    MAX(started_at) as last_session_at
  FROM public.pomodoro_sessions
  WHERE book_id = book_uuid;
$$;

CREATE OR REPLACE FUNCTION get_daily_pomodoro_stats(user_uuid uuid, days_back int DEFAULT 7)
RETURNS TABLE (
  date date,
  total_sessions bigint,
  total_time_minutes bigint,
  work_sessions bigint,
  break_sessions bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    DATE(started_at) as date,
    COUNT(*) as total_sessions,
    COALESCE(SUM(duration_seconds), 0) / 60 as total_time_minutes,
    COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak')) as break_sessions
  FROM public.pomodoro_sessions
  WHERE user_id = user_uuid
    AND started_at >= NOW() - (days_back || ' days')::interval
  GROUP BY DATE(started_at)
  ORDER BY date DESC;
$$;

CREATE OR REPLACE FUNCTION get_time_of_day_patterns(user_uuid uuid, days_back int DEFAULT 30)
RETURNS TABLE (
  hour_of_day int,
  session_count bigint,
  total_time_minutes bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    EXTRACT(hour FROM started_at)::int as hour_of_day,
    COUNT(*) as session_count,
    COALESCE(SUM(duration_seconds), 0) / 60 as total_time_minutes
  FROM public.pomodoro_sessions
  WHERE user_id = user_uuid
    AND started_at >= NOW() - (days_back || ' days')::interval
  GROUP BY EXTRACT(hour FROM started_at)
  ORDER BY hour_of_day;
$$;

CREATE OR REPLACE FUNCTION get_active_pomodoro_session(user_uuid uuid)
RETURNS TABLE (
  id uuid,
  book_id uuid,
  started_at timestamptz,
  mode text,
  duration_seconds bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    ps.id,
    ps.book_id,
    ps.started_at,
    ps.mode,
    EXTRACT(epoch FROM (NOW() - ps.started_at))::bigint as duration_seconds
  FROM public.pomodoro_sessions ps
  WHERE ps.user_id = user_uuid
    AND ps.ended_at IS NULL
  ORDER BY ps.started_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_weekly_pomodoro_summary(user_uuid uuid)
RETURNS TABLE (
  week_start date,
  total_sessions bigint,
  total_time_hours numeric,
  work_sessions bigint,
  break_sessions bigint,
  average_session_minutes numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    DATE_TRUNC('week', started_at)::date as week_start,
    COUNT(*) as total_sessions,
    COALESCE(SUM(duration_seconds), 0) / 3600.0 as total_time_hours,
    COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak')) as break_sessions,
    COALESCE(AVG(duration_seconds), 0) / 60.0 as average_session_minutes
  FROM public.pomodoro_sessions
  WHERE user_id = user_uuid
    AND started_at >= NOW() - INTERVAL '8 weeks'
  GROUP BY DATE_TRUNC('week', started_at)
  ORDER BY week_start DESC;
$$;

CREATE OR REPLACE FUNCTION get_collection_hierarchy(user_uuid uuid, root_id uuid DEFAULT NULL)
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
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE collection_tree AS (
    -- Base case: root collections
    SELECT 
      c.id,
      c.name,
      c.description,
      c.parent_id,
      c.color,
      c.icon,
      c.is_favorite,
      c.display_order,
      0 as level,
      c.name as path,
      COALESCE(bc.book_count, 0) as book_count,
      c.created_at
    FROM public.user_collections c
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM public.book_collections
      GROUP BY collection_id
    ) bc ON c.id = bc.collection_id
    WHERE c.user_id = user_uuid 
      AND (root_id IS NULL OR c.id = root_id)
      AND c.parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child collections
    SELECT 
      c.id,
      c.name,
      c.description,
      c.parent_id,
      c.color,
      c.icon,
      c.is_favorite,
      c.display_order,
      ct.level + 1,
      ct.path || ' > ' || c.name,
      COALESCE(bc.book_count, 0) as book_count,
      c.created_at
    FROM public.user_collections c
    JOIN collection_tree ct ON c.parent_id = ct.id
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM public.book_collections
      GROUP BY collection_id
    ) bc ON c.id = bc.collection_id
    WHERE c.user_id = user_uuid
  )
  SELECT * FROM collection_tree
  ORDER BY level, display_order, name;
END;
$$;

CREATE OR REPLACE FUNCTION get_book_storage_stats(user_uuid uuid)
RETURNS TABLE (
  total_books bigint,
  total_size_bytes bigint,
  total_size_mb numeric,
  pdf_count bigint,
  text_count bigint,
  average_size_mb numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_books,
    COALESCE(SUM(file_size_bytes), 0) as total_size_bytes,
    COALESCE(SUM(file_size_bytes), 0) / (1024.0 * 1024.0) as total_size_mb,
    COUNT(*) FILTER (WHERE file_type = 'pdf') as pdf_count,
    COUNT(*) FILTER (WHERE file_type = 'text') as text_count,
    COALESCE(AVG(file_size_bytes), 0) / (1024.0 * 1024.0) as average_size_mb
  FROM user_books
  WHERE user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION get_library_stats(user_uuid uuid)
RETURNS TABLE (
  total_books bigint,
  total_collections bigint,
  total_tags bigint,
  favorite_books bigint,
  books_with_notes bigint,
  books_with_audio bigint,
  total_reading_time bigint,
  average_reading_progress numeric,
  most_used_tags jsonb,
  recent_activity jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.user_books WHERE user_id = user_uuid) as total_books,
    (SELECT COUNT(*) FROM public.user_collections WHERE user_id = user_uuid) as total_collections,
    (SELECT COUNT(*) FROM public.book_tags WHERE user_id = user_uuid) as total_tags,
    (SELECT COUNT(*) FROM public.user_books WHERE user_id = user_uuid AND is_favorite = TRUE) as favorite_books,
    (SELECT COUNT(*) FROM public.user_books WHERE user_id = user_uuid AND notes_count > 0) as books_with_notes,
    (SELECT COUNT(*) FROM public.user_books WHERE user_id = user_uuid AND pomodoro_sessions_count > 0) as books_with_audio,
    (SELECT COALESCE(SUM(pomodoro_sessions_count * 25), 0) FROM user_books WHERE user_id = user_uuid) as total_reading_time, -- Assuming 25 min per session
    (SELECT COALESCE(AVG(reading_progress), 0) FROM user_books WHERE user_id = user_uuid) as average_reading_progress,
    (SELECT jsonb_agg(jsonb_build_object('name', name, 'count', usage_count, 'color', color))
     FROM public.book_tags 
     WHERE user_id = user_uuid 
     ORDER BY usage_count DESC 
     LIMIT 10) as most_used_tags,
    (SELECT jsonb_agg(jsonb_build_object('book_id', id, 'title', title, 'last_read_at', last_read_at))
     FROM public.user_books 
     WHERE user_id = user_uuid 
     AND last_read_at IS NOT NULL
     ORDER BY last_read_at DESC 
     LIMIT 5) as recent_activity;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, tier, credits)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'free',
    100
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Clean up expired cache entries (if any cache tables exist)
  DELETE FROM cache_entries WHERE expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION get_user_usage_stats(user_uuid uuid)
RETURNS TABLE (
  total_actions bigint,
  total_credits_used bigint,
  actions_this_month bigint,
  credits_used_this_month bigint,
  most_used_action text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COUNT(*) as total_actions,
    COALESCE(SUM(credits_used), 0) as total_credits_used,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as actions_this_month,
    COALESCE(SUM(credits_used) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())), 0) as credits_used_this_month,
    (SELECT action_type FROM usage_records WHERE user_id = user_uuid GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 1) as most_used_action
  FROM public.usage_records
  WHERE user_id = user_uuid;
$$;
