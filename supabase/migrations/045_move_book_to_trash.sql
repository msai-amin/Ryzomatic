-- Migration: Add function to move books to Trash collection
-- Uses SECURITY DEFINER to bypass RLS for reliable Trash operations
-- Date: 2025-01-27

-- ============================================================================
-- TRASH COLLECTION FUNCTION
-- ============================================================================

-- Function to move a book to Trash collection
-- This function:
-- 1. Gets or creates Trash collection for the user
-- 2. Removes book from all other collections
-- 3. Adds book to Trash collection
-- Uses SECURITY DEFINER to bypass RLS while still checking auth.uid()
CREATE OR REPLACE FUNCTION move_book_to_trash(book_id_param UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trash_collection_id UUID;
  user_id_val UUID;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Verify book belongs to user
  IF NOT EXISTS (SELECT 1 FROM public.user_books WHERE id = book_id_param AND user_id = user_id_val) THEN
    RAISE EXCEPTION 'Book not found or access denied';
  END IF;
  
  -- Get or create Trash collection
  SELECT id INTO trash_collection_id
  FROM public.user_collections
  WHERE user_id = user_id_val
    AND name = 'Trash'
  LIMIT 1;
  
  -- Create Trash collection if it doesn't exist
  IF trash_collection_id IS NULL THEN
    INSERT INTO public.user_collections (
      user_id,
      name,
      description,
      color,
      icon,
      is_favorite,
      display_order
    ) VALUES (
      user_id_val,
      'Trash',
      'Deleted books',
      '#6B7280',
      'trash-2',
      FALSE,
      9999
    )
    RETURNING id INTO trash_collection_id;
  END IF;
  
  -- Remove book from all existing collections
  DELETE FROM public.book_collections
  WHERE book_id = book_id_param
    AND collection_id != trash_collection_id;
  
  -- Add book to Trash collection (ignore if already exists)
  INSERT INTO public.book_collections (book_id, collection_id)
  VALUES (book_id_param, trash_collection_id)
  ON CONFLICT (book_id, collection_id) DO NOTHING;
  
  RETURN trash_collection_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION move_book_to_trash(UUID) TO authenticated;

