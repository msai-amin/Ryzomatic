-- Migration: Fix Auth RLS Initialization Plan Warnings
-- Fixes RLS policies that re-evaluate auth.uid() for each row
-- Date: 2025-01-27

-- ============================================================================
-- FIX DOCUMENT_CONTENT RLS POLICIES
-- ============================================================================

-- Drop and recreate policies with (select auth.uid()) to make them initplans
-- This prevents re-evaluation for each row, improving query performance at scale

DROP POLICY IF EXISTS "Users can read own document content" ON public.document_content;
CREATE POLICY "Users can read own document content" ON public.document_content
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own document content" ON public.document_content;
CREATE POLICY "Users can create own document content" ON public.document_content
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own document content" ON public.document_content;
CREATE POLICY "Users can update own document content" ON public.document_content
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own document content" ON public.document_content;
CREATE POLICY "Users can delete own document content" ON public.document_content
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- FIX PAPER_RECOMMENDATIONS RLS POLICIES
-- ============================================================================

-- Drop and recreate policies with (select auth.uid()) to make them initplans
-- This prevents re-evaluation for each row, improving query performance at scale

DROP POLICY IF EXISTS "Users can read own paper recommendations" ON public.paper_recommendations;
CREATE POLICY "Users can read own paper recommendations" ON public.paper_recommendations
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own paper recommendations" ON public.paper_recommendations;
CREATE POLICY "Users can create own paper recommendations" ON public.paper_recommendations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own paper recommendations" ON public.paper_recommendations;
CREATE POLICY "Users can update own paper recommendations" ON public.paper_recommendations
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own paper recommendations" ON public.paper_recommendations;
CREATE POLICY "Users can delete own paper recommendations" ON public.paper_recommendations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can read own document content" ON public.document_content IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can create own document content" ON public.document_content IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can update own document content" ON public.document_content IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can delete own document content" ON public.document_content IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can read own paper recommendations" ON public.paper_recommendations IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can create own paper recommendations" ON public.paper_recommendations IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can update own paper recommendations" ON public.paper_recommendations IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';

COMMENT ON POLICY "Users can delete own paper recommendations" ON public.paper_recommendations IS 
  'RLS policy using initplan (select auth.uid()) for optimal performance';
