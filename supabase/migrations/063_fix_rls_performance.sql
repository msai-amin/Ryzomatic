-- Migration: Fix RLS Performance Issues
-- Addresses Supabase Performance Advisor warnings:
-- 1. Auth RLS Initialization Plan: Wrap auth.uid() in (select auth.uid())
-- 2. Multiple Permissive Policies: Consolidate overlapping policies
-- 3. Duplicate Indexes: Remove redundant indexes
-- Date: 2025-01-XX

-- ============================================================================
-- 1. FIX AUTH RLS INITIALIZATION PLAN
-- ============================================================================
-- Replace all auth.uid() calls with (select auth.uid()) to make them initplans
-- This prevents re-evaluation for each row, improving query performance at scale

-- ============================================================================
-- PUBLIC SCHEMA TABLES
-- ============================================================================

-- profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- usage_records
DROP POLICY IF EXISTS "Users can read own usage" ON public.usage_records;
CREATE POLICY "Users can read own usage" ON public.usage_records
  FOR SELECT USING ((select auth.uid()) = user_id);

-- user_books
DROP POLICY IF EXISTS "Users can read own books" ON public.user_books;
CREATE POLICY "Users can read own books" ON public.user_books
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own books" ON public.user_books;
CREATE POLICY "Users can create own books" ON public.user_books
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own books" ON public.user_books;
CREATE POLICY "Users can update own books" ON public.user_books
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own books" ON public.user_books;
CREATE POLICY "Users can delete own books" ON public.user_books
  FOR DELETE USING ((select auth.uid()) = user_id);

-- user_notes
DROP POLICY IF EXISTS "Users can read own notes" ON public.user_notes;
CREATE POLICY "Users can read own notes" ON public.user_notes
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own notes" ON public.user_notes;
CREATE POLICY "Users can create own notes" ON public.user_notes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.user_notes;
CREATE POLICY "Users can update own notes" ON public.user_notes
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.user_notes;
CREATE POLICY "Users can delete own notes" ON public.user_notes
  FOR DELETE USING ((select auth.uid()) = user_id);

-- annotations
DROP POLICY IF EXISTS "Allow users to view their own annotations" ON public.annotations;
CREATE POLICY "Allow users to view their own annotations" ON public.annotations
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own annotations" ON public.annotations;
CREATE POLICY "Allow users to insert their own annotations" ON public.annotations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to update their own annotations" ON public.annotations;
CREATE POLICY "Allow users to update their own annotations" ON public.annotations
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own annotations" ON public.annotations;
CREATE POLICY "Allow users to delete their own annotations" ON public.annotations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- bookmarks
DROP POLICY IF EXISTS "Allow users to view their own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow users to view their own bookmarks" ON public.bookmarks
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow users to insert their own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to update their own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow users to update their own bookmarks" ON public.bookmarks
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own bookmarks" ON public.bookmarks;
CREATE POLICY "Allow users to delete their own bookmarks" ON public.bookmarks
  FOR DELETE USING ((select auth.uid()) = user_id);

-- document_descriptions
DROP POLICY IF EXISTS "Users can read own document descriptions" ON public.document_descriptions;
CREATE POLICY "Users can read own document descriptions" ON public.document_descriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own document descriptions" ON public.document_descriptions;
CREATE POLICY "Users can create own document descriptions" ON public.document_descriptions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own document descriptions" ON public.document_descriptions;
CREATE POLICY "Users can update own document descriptions" ON public.document_descriptions
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own document descriptions" ON public.document_descriptions;
CREATE POLICY "Users can delete own document descriptions" ON public.document_descriptions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- pomodoro_sessions
DROP POLICY IF EXISTS "Users can read own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can read own pomodoro sessions" ON public.pomodoro_sessions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can create own pomodoro sessions" ON public.pomodoro_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can update own pomodoro sessions" ON public.pomodoro_sessions
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own pomodoro sessions" ON public.pomodoro_sessions;
CREATE POLICY "Users can delete own pomodoro sessions" ON public.pomodoro_sessions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- document_relationships
DROP POLICY IF EXISTS "Users can read own document relationships" ON public.document_relationships;
CREATE POLICY "Users can read own document relationships" ON public.document_relationships
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own document relationships" ON public.document_relationships;
CREATE POLICY "Users can create own document relationships" ON public.document_relationships
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own document relationships" ON public.document_relationships;
CREATE POLICY "Users can update own document relationships" ON public.document_relationships
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own document relationships" ON public.document_relationships;
CREATE POLICY "Users can delete own document relationships" ON public.document_relationships
  FOR DELETE USING ((select auth.uid()) = user_id);

-- document_content
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

-- book_series
DROP POLICY IF EXISTS "Users can read own series" ON public.book_series;
CREATE POLICY "Users can read own series" ON public.book_series
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own series" ON public.book_series;
CREATE POLICY "Users can create own series" ON public.book_series
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own series" ON public.book_series;
CREATE POLICY "Users can update own series" ON public.book_series
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own series" ON public.book_series;
CREATE POLICY "Users can delete own series" ON public.book_series
  FOR DELETE USING ((select auth.uid()) = user_id);

-- note_relationships
DROP POLICY IF EXISTS "Users can read own note relationships" ON public.note_relationships;
CREATE POLICY "Users can read own note relationships" ON public.note_relationships
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own note relationships" ON public.note_relationships;
CREATE POLICY "Users can create own note relationships" ON public.note_relationships
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own note relationships" ON public.note_relationships;
CREATE POLICY "Users can update own note relationships" ON public.note_relationships
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own note relationships" ON public.note_relationships;
CREATE POLICY "Users can delete own note relationships" ON public.note_relationships
  FOR DELETE USING ((select auth.uid()) = user_id);

-- filter_presets
DROP POLICY IF EXISTS "Users can read own filter presets" ON public.filter_presets;
CREATE POLICY "Users can read own filter presets" ON public.filter_presets
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own filter presets" ON public.filter_presets;
CREATE POLICY "Users can create own filter presets" ON public.filter_presets
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own filter presets" ON public.filter_presets;
CREATE POLICY "Users can update own filter presets" ON public.filter_presets
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own filter presets" ON public.filter_presets;
CREATE POLICY "Users can delete own filter presets" ON public.filter_presets
  FOR DELETE USING ((select auth.uid()) = user_id);

-- user_collections
DROP POLICY IF EXISTS "Users can read own collections" ON public.user_collections;
CREATE POLICY "Users can read own collections" ON public.user_collections
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own collections" ON public.user_collections;
CREATE POLICY "Users can create own collections" ON public.user_collections
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.user_collections;
CREATE POLICY "Users can update own collections" ON public.user_collections
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.user_collections;
CREATE POLICY "Users can delete own collections" ON public.user_collections
  FOR DELETE USING ((select auth.uid()) = user_id);

-- book_tags
DROP POLICY IF EXISTS "Users can read own tags" ON public.book_tags;
CREATE POLICY "Users can read own tags" ON public.book_tags
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own tags" ON public.book_tags;
CREATE POLICY "Users can create own tags" ON public.book_tags
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON public.book_tags;
CREATE POLICY "Users can update own tags" ON public.book_tags
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON public.book_tags;
CREATE POLICY "Users can delete own tags" ON public.book_tags
  FOR DELETE USING ((select auth.uid()) = user_id);

-- book_collections (junction table - no user_id column, check through related tables)
DROP POLICY IF EXISTS "Users can read own book collections" ON public.book_collections;
CREATE POLICY "Users can read own book collections" ON public.book_collections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_collections.book_id AND user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = book_collections.collection_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create own book collections" ON public.book_collections;
CREATE POLICY "Users can create own book collections" ON public.book_collections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_collections.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = book_collections.collection_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update own book collections" ON public.book_collections;
CREATE POLICY "Users can update own book collections" ON public.book_collections
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_collections.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = book_collections.collection_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete own book collections" ON public.book_collections;
CREATE POLICY "Users can delete own book collections" ON public.book_collections
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_collections.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = book_collections.collection_id AND user_id = (select auth.uid()))
  );

-- book_tag_assignments (junction table - no user_id column, check through related tables)
DROP POLICY IF EXISTS "Users can read own book tag assignments" ON public.book_tag_assignments;
CREATE POLICY "Users can read own book tag assignments" ON public.book_tag_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_tag_assignments.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.book_tags WHERE id = book_tag_assignments.tag_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create own book tag assignments" ON public.book_tag_assignments;
CREATE POLICY "Users can create own book tag assignments" ON public.book_tag_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_tag_assignments.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.book_tags WHERE id = book_tag_assignments.tag_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update own book tag assignments" ON public.book_tag_assignments;
CREATE POLICY "Users can update own book tag assignments" ON public.book_tag_assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_tag_assignments.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.book_tags WHERE id = book_tag_assignments.tag_id AND user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete own book tag assignments" ON public.book_tag_assignments;
CREATE POLICY "Users can delete own book tag assignments" ON public.book_tag_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_books WHERE id = book_tag_assignments.book_id AND user_id = (select auth.uid())) AND
    EXISTS (SELECT 1 FROM public.book_tags WHERE id = book_tag_assignments.tag_id AND user_id = (select auth.uid()))
  );

-- user_highlights
DROP POLICY IF EXISTS "Users can read own highlights" ON public.user_highlights;
CREATE POLICY "Users can read own highlights" ON public.user_highlights
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own highlights" ON public.user_highlights;
CREATE POLICY "Users can create own highlights" ON public.user_highlights
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own highlights" ON public.user_highlights;
CREATE POLICY "Users can update own highlights" ON public.user_highlights
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own highlights" ON public.user_highlights;
CREATE POLICY "Users can delete own highlights" ON public.user_highlights
  FOR DELETE USING ((select auth.uid()) = user_id);

-- embedding_metadata
DROP POLICY IF EXISTS "Users can read own embedding metadata" ON public.embedding_metadata;
CREATE POLICY "Users can read own embedding metadata" ON public.embedding_metadata
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own embedding metadata" ON public.embedding_metadata;
CREATE POLICY "Users can delete own embedding metadata" ON public.embedding_metadata
  FOR DELETE USING ((select auth.uid()) = user_id);

-- rate_limit_tracking (will be fixed in section 2 for multiple permissive policies)
DROP POLICY IF EXISTS "Users can read own rate limit tracking" ON public.rate_limit_tracking;
CREATE POLICY "Users can read own rate limit tracking" ON public.rate_limit_tracking
  FOR SELECT USING ((select auth.uid()) = user_id);

-- reading_sessions
DROP POLICY IF EXISTS "Users can read own reading sessions" ON public.reading_sessions;
CREATE POLICY "Users can read own reading sessions" ON public.reading_sessions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own reading sessions" ON public.reading_sessions;
CREATE POLICY "Users can create own reading sessions" ON public.reading_sessions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own reading sessions" ON public.reading_sessions;
CREATE POLICY "Users can update own reading sessions" ON public.reading_sessions
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own reading sessions" ON public.reading_sessions;
CREATE POLICY "Users can delete own reading sessions" ON public.reading_sessions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- document_navigation_log
DROP POLICY IF EXISTS "Users can read own navigation log" ON public.document_navigation_log;
CREATE POLICY "Users can read own navigation log" ON public.document_navigation_log
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own navigation log" ON public.document_navigation_log;
CREATE POLICY "Users can create own navigation log" ON public.document_navigation_log
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own navigation log" ON public.document_navigation_log;
CREATE POLICY "Users can delete own navigation log" ON public.document_navigation_log
  FOR DELETE USING ((select auth.uid()) = user_id);

-- reading_goals
DROP POLICY IF EXISTS "Users can read own goals" ON public.reading_goals;
CREATE POLICY "Users can read own goals" ON public.reading_goals
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own goals" ON public.reading_goals;
CREATE POLICY "Users can create own goals" ON public.reading_goals
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.reading_goals;
CREATE POLICY "Users can update own goals" ON public.reading_goals
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON public.reading_goals;
CREATE POLICY "Users can delete own goals" ON public.reading_goals
  FOR DELETE USING ((select auth.uid()) = user_id);

-- highlight_note_connections
DROP POLICY IF EXISTS "Users can read own highlight-note connections" ON public.highlight_note_connections;
CREATE POLICY "Users can read own highlight-note connections" ON public.highlight_note_connections
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own highlight-note connections" ON public.highlight_note_connections;
CREATE POLICY "Users can create own highlight-note connections" ON public.highlight_note_connections
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own highlight-note connections" ON public.highlight_note_connections;
CREATE POLICY "Users can delete own highlight-note connections" ON public.highlight_note_connections
  FOR DELETE USING ((select auth.uid()) = user_id);

-- cognitive_concepts
DROP POLICY IF EXISTS "Users can read own concepts" ON public.cognitive_concepts;
CREATE POLICY "Users can read own concepts" ON public.cognitive_concepts
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own concepts" ON public.cognitive_concepts;
CREATE POLICY "Users can create own concepts" ON public.cognitive_concepts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own concepts" ON public.cognitive_concepts;
CREATE POLICY "Users can update own concepts" ON public.cognitive_concepts
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own concepts" ON public.cognitive_concepts;
CREATE POLICY "Users can delete own concepts" ON public.cognitive_concepts
  FOR DELETE USING ((select auth.uid()) = user_id);

-- concept_occurrences
DROP POLICY IF EXISTS "Users can read own concept occurrences" ON public.concept_occurrences;
CREATE POLICY "Users can read own concept occurrences" ON public.concept_occurrences
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own concept occurrences" ON public.concept_occurrences;
CREATE POLICY "Users can create own concept occurrences" ON public.concept_occurrences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own concept occurrences" ON public.concept_occurrences;
CREATE POLICY "Users can delete own concept occurrences" ON public.concept_occurrences
  FOR DELETE USING ((select auth.uid()) = user_id);

-- pomodoro_achievements
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.pomodoro_achievements;
CREATE POLICY "Users can view their own achievements" ON public.pomodoro_achievements
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own achievements" ON public.pomodoro_achievements;
CREATE POLICY "Users can insert their own achievements" ON public.pomodoro_achievements
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own achievements" ON public.pomodoro_achievements;
CREATE POLICY "Users can update their own achievements" ON public.pomodoro_achievements
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- pomodoro_streaks
DROP POLICY IF EXISTS "Users can view their own streaks" ON public.pomodoro_streaks;
CREATE POLICY "Users can view their own streaks" ON public.pomodoro_streaks
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own streaks" ON public.pomodoro_streaks;
CREATE POLICY "Users can insert their own streaks" ON public.pomodoro_streaks
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own streaks" ON public.pomodoro_streaks;
CREATE POLICY "Users can update their own streaks" ON public.pomodoro_streaks
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- cognitive_paths
DROP POLICY IF EXISTS "Users can read own cognitive paths" ON public.cognitive_paths;
CREATE POLICY "Users can read own cognitive paths" ON public.cognitive_paths
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own cognitive paths" ON public.cognitive_paths;
CREATE POLICY "Users can create own cognitive paths" ON public.cognitive_paths
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own cognitive paths" ON public.cognitive_paths;
CREATE POLICY "Users can update own cognitive paths" ON public.cognitive_paths
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own cognitive paths" ON public.cognitive_paths;
CREATE POLICY "Users can delete own cognitive paths" ON public.cognitive_paths
  FOR DELETE USING ((select auth.uid()) = user_id);

-- peer_reviews
DROP POLICY IF EXISTS "Users can read own peer reviews" ON public.peer_reviews;
CREATE POLICY "Users can read own peer reviews" ON public.peer_reviews
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own peer reviews" ON public.peer_reviews;
CREATE POLICY "Users can create own peer reviews" ON public.peer_reviews
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own peer reviews" ON public.peer_reviews;
CREATE POLICY "Users can update own peer reviews" ON public.peer_reviews
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own peer reviews" ON public.peer_reviews;
CREATE POLICY "Users can delete own peer reviews" ON public.peer_reviews
  FOR DELETE USING ((select auth.uid()) = user_id);

-- paper_recommendations
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

-- collection_templates (will be fixed in section 2 for multiple permissive policies)
DROP POLICY IF EXISTS "Users can read own templates" ON public.collection_templates;
CREATE POLICY "Users can read own templates" ON public.collection_templates
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create templates" ON public.collection_templates;
CREATE POLICY "Users can create templates" ON public.collection_templates
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR (select auth.uid()) IS NULL);

DROP POLICY IF EXISTS "Users can update own templates" ON public.collection_templates;
CREATE POLICY "Users can update own templates" ON public.collection_templates
  FOR UPDATE USING ((select auth.uid()) = user_id AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.collection_templates;
CREATE POLICY "Users can delete own templates" ON public.collection_templates
  FOR DELETE USING ((select auth.uid()) = user_id);

-- tts_audio_cache
DROP POLICY IF EXISTS "Users can read own TTS cache" ON public.tts_audio_cache;
CREATE POLICY "Users can read own TTS cache" ON public.tts_audio_cache
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own TTS cache" ON public.tts_audio_cache;
CREATE POLICY "Users can create own TTS cache" ON public.tts_audio_cache
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own TTS cache" ON public.tts_audio_cache;
CREATE POLICY "Users can update own TTS cache" ON public.tts_audio_cache
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own TTS cache" ON public.tts_audio_cache;
CREATE POLICY "Users can delete own TTS cache" ON public.tts_audio_cache
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CHAT SCHEMA TABLES
-- ============================================================================

-- chat.conversations
DROP POLICY IF EXISTS "Users can read own conversations" ON chat.conversations;
CREATE POLICY "Users can read own conversations" ON chat.conversations
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own conversations" ON chat.conversations;
CREATE POLICY "Users can create own conversations" ON chat.conversations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON chat.conversations;
CREATE POLICY "Users can update own conversations" ON chat.conversations
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON chat.conversations;
CREATE POLICY "Users can delete own conversations" ON chat.conversations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- chat.messages
DROP POLICY IF EXISTS "Users can read own messages" ON chat.messages;
CREATE POLICY "Users can read own messages" ON chat.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create messages in own conversations" ON chat.messages;
CREATE POLICY "Users can create messages in own conversations" ON chat.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON chat.messages;
CREATE POLICY "Users can update own messages" ON chat.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own messages" ON chat.messages;
CREATE POLICY "Users can delete own messages" ON chat.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (select auth.uid())
    )
  );

-- chat.conversation_memories
DROP POLICY IF EXISTS "Users can read own memories" ON chat.conversation_memories;
CREATE POLICY "Users can read own memories" ON chat.conversation_memories
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own memories" ON chat.conversation_memories;
CREATE POLICY "Users can delete own memories" ON chat.conversation_memories
  FOR DELETE USING ((select auth.uid()) = user_id);

-- chat.memory_relationships
DROP POLICY IF EXISTS "Users can read own memory relationships" ON chat.memory_relationships;
CREATE POLICY "Users can read own memory relationships" ON chat.memory_relationships
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own memory relationships" ON chat.memory_relationships;
CREATE POLICY "Users can delete own memory relationships" ON chat.memory_relationships
  FOR DELETE USING ((select auth.uid()) = user_id);

-- chat.action_cache
DROP POLICY IF EXISTS "Users can read own action cache" ON chat.action_cache;
CREATE POLICY "Users can read own action cache" ON chat.action_cache
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own action cache" ON chat.action_cache;
CREATE POLICY "Users can create own action cache" ON chat.action_cache
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own action cache" ON chat.action_cache;
CREATE POLICY "Users can update own action cache" ON chat.action_cache
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own action cache" ON chat.action_cache;
CREATE POLICY "Users can delete own action cache" ON chat.action_cache
  FOR DELETE USING ((select auth.uid()) = user_id);

-- chat.memory_extraction_jobs (will be fixed in section 2 for multiple permissive policies)
DROP POLICY IF EXISTS "Users can read own extraction jobs" ON chat.memory_extraction_jobs;
CREATE POLICY "Users can read own extraction jobs" ON chat.memory_extraction_jobs
  FOR SELECT USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 2. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- chat.memory_extraction_jobs
-- Make service policy more specific to avoid overlap with SELECT
-- Create separate policies for INSERT, UPDATE, DELETE (SELECT handled by user policy)
DROP POLICY IF EXISTS "Service can manage extraction jobs" ON chat.memory_extraction_jobs;
CREATE POLICY "Service can insert extraction jobs" ON chat.memory_extraction_jobs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update extraction jobs" ON chat.memory_extraction_jobs
  FOR UPDATE USING (true);
CREATE POLICY "Service can delete extraction jobs" ON chat.memory_extraction_jobs
  FOR DELETE USING (true);

-- public.collection_templates
-- Combine "Anyone can read public templates" and "Users can read own templates" into single policy
DROP POLICY IF EXISTS "Anyone can read public templates" ON public.collection_templates;
DROP POLICY IF EXISTS "Users can read own templates" ON public.collection_templates;
CREATE POLICY "Users can read own templates or public templates" ON public.collection_templates
  FOR SELECT USING (
    is_public = TRUE 
    OR is_system = TRUE 
    OR (select auth.uid()) = user_id
  );

-- public.rate_limit_tracking
-- Make service policy more specific to avoid overlap with SELECT
-- Create separate policies for INSERT, UPDATE, DELETE (SELECT handled by user policy)
DROP POLICY IF EXISTS "Service can manage rate limit tracking" ON public.rate_limit_tracking;
CREATE POLICY "Service can insert rate limit tracking" ON public.rate_limit_tracking
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update rate limit tracking" ON public.rate_limit_tracking
  FOR UPDATE USING (true);
CREATE POLICY "Service can delete rate limit tracking" ON public.rate_limit_tracking
  FOR DELETE USING (true);

-- ============================================================================
-- 3. DROP DUPLICATE INDEXES
-- ============================================================================

-- chat.memory_relationships
-- Drop older, less descriptive indexes (keep idx_memory_relationships_*)
DROP INDEX IF EXISTS chat.idx_relationships_from;
DROP INDEX IF EXISTS chat.idx_relationships_to;

-- public.document_relationships
-- Drop older indexes (keep idx_doc_rel_*)
DROP INDEX IF EXISTS public.idx_doc_relationships_source;
DROP INDEX IF EXISTS public.idx_doc_relationships_user;
DROP INDEX IF EXISTS public.idx_doc_relationships_status;
DROP INDEX IF EXISTS public.idx_doc_relationships_related;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can read own templates or public templates" ON public.collection_templates IS 
  'Consolidated policy: allows reading public/system templates or user''s own templates. Optimized with (select auth.uid()) for better performance.';

COMMENT ON POLICY "Service can insert extraction jobs" ON chat.memory_extraction_jobs IS 
  'Service role can INSERT extraction jobs. SELECT is handled by user policy for better performance.';
COMMENT ON POLICY "Service can update extraction jobs" ON chat.memory_extraction_jobs IS 
  'Service role can UPDATE extraction jobs. SELECT is handled by user policy for better performance.';
COMMENT ON POLICY "Service can delete extraction jobs" ON chat.memory_extraction_jobs IS 
  'Service role can DELETE extraction jobs. SELECT is handled by user policy for better performance.';

COMMENT ON POLICY "Service can insert rate limit tracking" ON public.rate_limit_tracking IS 
  'Service role can INSERT rate limit records. SELECT is handled by user policy for better performance.';
COMMENT ON POLICY "Service can update rate limit tracking" ON public.rate_limit_tracking IS 
  'Service role can UPDATE rate limit records. SELECT is handled by user policy for better performance.';
COMMENT ON POLICY "Service can delete rate limit tracking" ON public.rate_limit_tracking IS 
  'Service role can DELETE rate limit records. SELECT is handled by user policy for better performance.';
