-- Transactional helpers for Library sidebar operations

DROP FUNCTION IF EXISTS reorder_user_collections(uuid, uuid, uuid[]);
DROP FUNCTION IF EXISTS bulk_assign_books_to_collection(uuid, uuid, uuid[]);

CREATE OR REPLACE FUNCTION reorder_user_collections(
  user_uuid uuid,
  parent_uuid uuid,
  ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  collection_id uuid;
  position integer := 0;
  expected_count integer;
  actual_count integer;
BEGIN
  IF ordered_ids IS NULL OR array_length(ordered_ids, 1) = 0 THEN
    RETURN;
  END IF;

  expected_count := array_length(ordered_ids, 1);

  SELECT COUNT(*)
  INTO actual_count
  FROM unnest(ordered_ids) AS id
  JOIN public.user_collections uc
    ON uc.id = id AND uc.user_id = user_uuid;

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'One or more collections do not belong to the current user';
  END IF;

  IF parent_uuid IS NULL THEN
    SELECT COUNT(*)
    INTO actual_count
    FROM unnest(ordered_ids) AS id
    JOIN public.user_collections uc
      ON uc.id = id
    WHERE uc.parent_id IS NOT NULL;

    IF actual_count > 0 THEN
      RAISE EXCEPTION 'One or more collections are not root-level for the requested reorder';
    END IF;
  ELSE
    SELECT COUNT(*)
    INTO actual_count
    FROM unnest(ordered_ids) AS id
    JOIN public.user_collections uc
      ON uc.id = id
    WHERE uc.parent_id IS DISTINCT FROM parent_uuid;

    IF actual_count > 0 THEN
      RAISE EXCEPTION 'One or more collections do not belong to the requested parent';
    END IF;
  END IF;

  FOREACH collection_id IN ARRAY ordered_ids LOOP
    position := position + 1;

    UPDATE public.user_collections
    SET display_order = position
    WHERE id = collection_id
      AND user_id = user_uuid;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bulk_assign_books_to_collection(
  user_uuid uuid,
  collection_uuid uuid,
  book_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expected_count integer;
  actual_count integer;
BEGIN
  IF book_ids IS NULL OR array_length(book_ids, 1) = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM public.user_collections uc
  WHERE uc.id = collection_uuid
    AND uc.user_id = user_uuid;

  IF actual_count = 0 THEN
    RAISE EXCEPTION 'Collection does not belong to the current user';
  END IF;

  expected_count := array_length(book_ids, 1);

  SELECT COUNT(*)
  INTO actual_count
  FROM unnest(book_ids) AS id
  JOIN public.user_books ub
    ON ub.id = id AND ub.user_id = user_uuid;

  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'One or more books do not belong to the current user';
  END IF;

  INSERT INTO public.book_collections (book_id, collection_id)
  SELECT DISTINCT book_id, collection_uuid
  FROM unnest(book_ids) AS book_id
  ON CONFLICT (book_id, collection_id) DO NOTHING;
END;
$$;

