-- Tighten the usage_records INSERT policy.
--
-- The original policy from 001_initial_schema.sql was:
--   CREATE POLICY "Service can insert usage records" ON usage_records
--     FOR INSERT WITH CHECK (true);
--
-- WITH CHECK (true) allowed anyone with the anon key to insert arbitrary
-- usage_records rows (including with someone else's user_id). The service
-- role inserts performed by API handlers bypass RLS, so they're unaffected;
-- the client-side inserts (e.g. src/services/visionUsageService.ts) already
-- attach the correct user_id, so they also keep working.

DROP POLICY IF EXISTS "Service can insert usage records" ON public.usage_records;

CREATE POLICY "Users can insert own usage records" ON public.usage_records
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
