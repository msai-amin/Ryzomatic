-- Library Organization Migration
-- Adds collections, tags, and enhanced metadata for scalable library management

-- Collections/Folders Table
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES user_collections(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#3B82F6', -- Hex color for collection
  icon TEXT DEFAULT 'folder', -- Icon name for collection
  is_favorite BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags Table
CREATE TABLE IF NOT EXISTS book_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280', -- Hex color for tag
  category TEXT DEFAULT 'general', -- For future annotation integration
  usage_count INTEGER DEFAULT 0, -- Denormalized for performance
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate tag names per user
);

-- Book-Collection Junction Table
CREATE TABLE IF NOT EXISTS book_collections (
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  collection_id UUID REFERENCES user_collections(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  display_order INTEGER DEFAULT 0,
  PRIMARY KEY (book_id, collection_id)
);

-- Book-Tag Junction Table
CREATE TABLE IF NOT EXISTS book_tag_assignments (
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES book_tags(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (book_id, tag_id)
);

-- Enhance user_books table with new metadata columns
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS notes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pomodoro_sessions_count INTEGER DEFAULT 0;

-- Update file_size_bytes from existing file_size column
UPDATE user_books 
SET file_size_bytes = file_size 
WHERE file_size_bytes IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_parent_id ON user_collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_hierarchy ON user_collections(user_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_display_order ON user_collections(user_id, display_order);

CREATE INDEX IF NOT EXISTS idx_book_tags_user_id ON book_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_book_tags_name ON book_tags(user_id, name);
CREATE INDEX IF NOT EXISTS idx_book_tags_category ON book_tags(user_id, category);
CREATE INDEX IF NOT EXISTS idx_book_tags_usage_count ON book_tags(user_id, usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_book_collections_book_id ON book_collections(book_id);
CREATE INDEX IF NOT EXISTS idx_book_collections_collection_id ON book_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_book_collections_display_order ON book_collections(collection_id, display_order);

CREATE INDEX IF NOT EXISTS idx_book_tag_assignments_book_id ON book_tag_assignments(book_id);
CREATE INDEX IF NOT EXISTS idx_book_tag_assignments_tag_id ON book_tag_assignments(tag_id);

-- Enhanced indexes for user_books
CREATE INDEX IF NOT EXISTS idx_user_books_is_favorite ON user_books(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_books_file_type ON user_books(user_id, file_type);
CREATE INDEX IF NOT EXISTS idx_user_books_reading_progress ON user_books(user_id, reading_progress);
CREATE INDEX IF NOT EXISTS idx_user_books_composite ON user_books(user_id, is_favorite, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_books_file_size ON user_books(user_id, file_size_bytes);

-- Full-text search index for books
CREATE INDEX IF NOT EXISTS idx_books_search ON user_books USING gin(to_tsvector('english', title || ' ' || file_name));

-- Row Level Security (RLS)
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_collections
DROP POLICY IF EXISTS "Users can read own collections" ON user_collections;
CREATE POLICY "Users can read own collections" ON user_collections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own collections" ON user_collections;
CREATE POLICY "Users can create own collections" ON user_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON user_collections;
CREATE POLICY "Users can update own collections" ON user_collections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON user_collections;
CREATE POLICY "Users can delete own collections" ON user_collections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for book_tags
DROP POLICY IF EXISTS "Users can read own tags" ON book_tags;
CREATE POLICY "Users can read own tags" ON book_tags
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own tags" ON book_tags;
CREATE POLICY "Users can create own tags" ON book_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON book_tags;
CREATE POLICY "Users can update own tags" ON book_tags
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON book_tags;
CREATE POLICY "Users can delete own tags" ON book_tags
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for book_collections
DROP POLICY IF EXISTS "Users can read own book collections" ON book_collections;
CREATE POLICY "Users can read own book collections" ON book_collections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM user_collections WHERE id = collection_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create own book collections" ON book_collections;
CREATE POLICY "Users can create own book collections" ON book_collections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM user_collections WHERE id = collection_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own book collections" ON book_collections;
CREATE POLICY "Users can update own book collections" ON book_collections
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM user_collections WHERE id = collection_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own book collections" ON book_collections;
CREATE POLICY "Users can delete own book collections" ON book_collections
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM user_collections WHERE id = collection_id AND user_id = auth.uid())
  );

-- RLS Policies for book_tag_assignments
DROP POLICY IF EXISTS "Users can read own book tag assignments" ON book_tag_assignments;
CREATE POLICY "Users can read own book tag assignments" ON book_tag_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM book_tags WHERE id = tag_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create own book tag assignments" ON book_tag_assignments;
CREATE POLICY "Users can create own book tag assignments" ON book_tag_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM book_tags WHERE id = tag_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own book tag assignments" ON book_tag_assignments;
CREATE POLICY "Users can update own book tag assignments" ON book_tag_assignments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM book_tags WHERE id = tag_id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own book tag assignments" ON book_tag_assignments;
CREATE POLICY "Users can delete own book tag assignments" ON book_tag_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_books WHERE id = book_id AND user_id = auth.uid()) AND
    EXISTS (SELECT 1 FROM book_tags WHERE id = tag_id AND user_id = auth.uid())
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_collections_updated_at ON user_collections;
CREATE TRIGGER update_user_collections_updated_at BEFORE UPDATE ON user_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_book_tags_updated_at ON book_tags;
CREATE TRIGGER update_book_tags_updated_at BEFORE UPDATE ON book_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE book_tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE book_tags 
    SET usage_count = GREATEST(usage_count - 1, 0) 
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update tag usage count
DROP TRIGGER IF EXISTS update_tag_usage_on_assignment ON book_tag_assignments;
CREATE TRIGGER update_tag_usage_on_assignment
  AFTER INSERT OR DELETE ON book_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Function to get collection hierarchy
CREATE OR REPLACE FUNCTION get_collection_hierarchy(user_uuid UUID, root_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  parent_id UUID,
  color TEXT,
  icon TEXT,
  is_favorite BOOLEAN,
  display_order INTEGER,
  level INTEGER,
  path TEXT,
  book_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
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
    FROM user_collections c
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM book_collections
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
    FROM user_collections c
    JOIN collection_tree ct ON c.parent_id = ct.id
    LEFT JOIN (
      SELECT collection_id, COUNT(*) as book_count
      FROM book_collections
      GROUP BY collection_id
    ) bc ON c.id = bc.collection_id
    WHERE c.user_id = user_uuid
  )
  SELECT * FROM collection_tree
  ORDER BY level, display_order, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get library statistics
CREATE OR REPLACE FUNCTION get_library_stats(user_uuid UUID)
RETURNS TABLE (
  total_books BIGINT,
  total_collections BIGINT,
  total_tags BIGINT,
  favorite_books BIGINT,
  books_with_notes BIGINT,
  books_with_audio BIGINT,
  total_reading_time BIGINT,
  average_reading_progress DECIMAL(5,2),
  most_used_tags JSONB,
  recent_activity JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM user_books WHERE user_id = user_uuid) as total_books,
    (SELECT COUNT(*) FROM user_collections WHERE user_id = user_uuid) as total_collections,
    (SELECT COUNT(*) FROM book_tags WHERE user_id = user_uuid) as total_tags,
    (SELECT COUNT(*) FROM user_books WHERE user_id = user_uuid AND is_favorite = TRUE) as favorite_books,
    (SELECT COUNT(*) FROM user_books WHERE user_id = user_uuid AND notes_count > 0) as books_with_notes,
    (SELECT COUNT(*) FROM user_books WHERE user_id = user_uuid AND pomodoro_sessions_count > 0) as books_with_audio,
    (SELECT COALESCE(SUM(pomodoro_sessions_count * 25), 0) FROM user_books WHERE user_id = user_uuid) as total_reading_time, -- Assuming 25 min per session
    (SELECT COALESCE(AVG(reading_progress), 0) FROM user_books WHERE user_id = user_uuid) as average_reading_progress,
    (SELECT jsonb_agg(jsonb_build_object('name', name, 'count', usage_count, 'color', color))
     FROM book_tags 
     WHERE user_id = user_uuid 
     ORDER BY usage_count DESC 
     LIMIT 10) as most_used_tags,
    (SELECT jsonb_agg(jsonb_build_object('book_id', id, 'title', title, 'last_read_at', last_read_at))
     FROM user_books 
     WHERE user_id = user_uuid 
     AND last_read_at IS NOT NULL
     ORDER BY last_read_at DESC 
     LIMIT 5) as recent_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default collections for existing users
INSERT INTO user_collections (user_id, name, description, color, icon, is_favorite)
SELECT DISTINCT 
  user_id,
  'Favorites',
  'Your favorite books',
  '#F59E0B',
  'star',
  TRUE
FROM user_books
WHERE user_id NOT IN (SELECT user_id FROM user_collections WHERE name = 'Favorites');

-- Add comment for documentation
COMMENT ON TABLE user_collections IS 'User collections/folders for organizing books hierarchically';
COMMENT ON TABLE book_tags IS 'User-defined tags for categorizing books';
COMMENT ON TABLE book_collections IS 'Many-to-many relationship between books and collections';
COMMENT ON TABLE book_tag_assignments IS 'Many-to-many relationship between books and tags';
