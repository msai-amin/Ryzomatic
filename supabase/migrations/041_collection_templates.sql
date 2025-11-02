-- Migration: Collection Templates for Pre-Configured Organization
-- Enables users to create collection structures from templates
-- Date: 2025-01-27

-- ============================================================================
-- COLLECTION TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS collection_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#3B82F6',
  
  -- Template structure (hierarchical collections)
  structure JSONB NOT NULL DEFAULT '[]',
  
  -- Visibility
  is_public BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE, -- System templates (cannot be deleted)
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate template names per user
  -- NULL user_id = global template
  UNIQUE(user_id, name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_collection_templates_user ON collection_templates(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_collection_templates_public ON collection_templates(is_public, is_system)
WHERE is_public = TRUE OR is_system = TRUE;

CREATE INDEX IF NOT EXISTS idx_collection_templates_usage ON collection_templates(usage_count DESC NULLS LAST)
WHERE user_id IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE collection_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collection_templates
CREATE POLICY "Anyone can read public templates" ON collection_templates
  FOR SELECT USING (is_public = TRUE OR is_system = TRUE);

CREATE POLICY "Users can read own templates" ON collection_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create templates" ON collection_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL); -- NULL for global templates

CREATE POLICY "Users can update own templates" ON collection_templates
  FOR UPDATE USING (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own templates" ON collection_templates
  FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_collection_templates_updated_at
BEFORE UPDATE ON collection_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create collections from template
CREATE OR REPLACE FUNCTION create_collections_from_template(template_id_param UUID, user_id_param UUID)
RETURNS TABLE (
  collection_id UUID,
  template_collection_name TEXT,
  created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  template_structure JSONB;
  collection_item JSONB;
  parent_id_val UUID := NULL;
  created_id UUID;
BEGIN
  -- Get template structure
  SELECT structure INTO template_structure
  FROM public.collection_templates
  WHERE id = template_id_param
    AND (user_id = user_id_param OR user_id IS NULL OR is_public = TRUE);
  
  IF template_structure IS NULL THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;
  
  -- Increment usage count
  UPDATE public.collection_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id_param;
  
  -- Create collections from structure
  FOR collection_item IN SELECT * FROM jsonb_array_elements(template_structure)
  LOOP
    -- Insert collection
    INSERT INTO public.user_collections (
      user_id,
      name,
      description,
      parent_id,
      color,
      icon,
      is_favorite,
      display_order
    ) VALUES (
      user_id_param,
      collection_item->>'name',
      collection_item->>'description',
      parent_id_val,
      COALESCE(collection_item->>'color', '#3B82F6'),
      COALESCE(collection_item->>'icon', 'folder'),
      COALESCE((collection_item->>'is_favorite')::BOOLEAN, FALSE),
      COALESCE((collection_item->>'display_order')::INTEGER, 0)
    )
    RETURNING id INTO created_id;
    
    RETURN QUERY SELECT created_id, collection_item->>'name', TRUE;
    
    parent_id_val := created_id; -- For sequential structure
  END LOOP;
END;
$$;

-- Function to get popular templates
CREATE OR REPLACE FUNCTION get_popular_templates(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  usage_count INTEGER,
  is_system BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    id,
    name,
    description,
    icon,
    color,
    usage_count,
    is_system
  FROM public.collection_templates
  WHERE is_public = TRUE OR is_system = TRUE
  ORDER BY usage_count DESC, name ASC
  LIMIT limit_count;
$$;

-- ============================================================================
-- SYSTEM TEMPLATES
-- ============================================================================

-- Academic Library Template
INSERT INTO collection_templates (name, description, icon, color, is_system, structure)
VALUES (
  'Academic Library',
  'Organize by subjects, courses, and semesters',
  'graduation-cap',
  '#3B82F6',
  TRUE,
  '[
    {"name": "Mathematics", "icon": "calculator", "color": "#EF4444", "description": "Math books and notes", "is_favorite": false, "display_order": 1},
    {"name": "Science", "icon": "flask", "color": "#10B981", "description": "Physics, chemistry, biology", "is_favorite": false, "display_order": 2},
    {"name": "Literature", "icon": "book-open", "color": "#8B5CF6", "description": "Novels, poetry, essays", "is_favorite": false, "display_order": 3},
    {"name": "History", "icon": "clock", "color": "#F59E0B", "description": "Historical documents and books", "is_favorite": false, "display_order": 4},
    {"name": "Language Learning", "icon": "languages", "color": "#06B6D4", "description": "Language study materials", "is_favorite": false, "display_order": 5},
    {"name": "Research Papers", "icon": "file-text", "color": "#6366F1", "description": "Research papers and articles", "is_favorite": false, "display_order": 6}
  ]'::jsonb
)
ON CONFLICT (user_id, name) DO NOTHING;

-- Fiction Library Template
INSERT INTO collection_templates (name, description, icon, color, is_system, structure)
VALUES (
  'Fiction Library',
  'Organize by genres and authors',
  'book-marked',
  '#8B5CF6',
  TRUE,
  '[
    {"name": "Fantasy", "icon": "sparkles", "color": "#8B5CF6", "description": "Fantasy novels", "is_favorite": false, "display_order": 1},
    {"name": "Science Fiction", "icon": "rocket", "color": "#06B6D4", "description": "Sci-Fi books", "is_favorite": false, "display_order": 2},
    {"name": "Mystery", "icon": "search", "color": "#6366F1", "description": "Mystery and thriller", "is_favorite": false, "display_order": 3},
    {"name": "Romance", "icon": "heart", "color": "#EC4899", "description": "Romance novels", "is_favorite": false, "display_order": 4},
    {"name": "Classics", "icon": "award", "color": "#F59E0B", "description": "Classic literature", "is_favorite": false, "display_order": 5}
  ]'::jsonb
)
ON CONFLICT (user_id, name) DO NOTHING;

-- Professional Development Template
INSERT INTO collection_templates (name, description, icon, color, is_system, structure)
VALUES (
  'Professional Development',
  'Organize business and self-improvement books',
  'briefcase',
  '#10B981',
  TRUE,
  '[
    {"name": "Leadership", "icon": "users", "color": "#3B82F6", "description": "Leadership books", "is_favorite": false, "display_order": 1},
    {"name": "Productivity", "icon": "check-circle", "color": "#10B981", "description": "Productivity and time management", "is_favorite": false, "display_order": 2},
    {"name": "Marketing", "icon": "trending-up", "color": "#8B5CF6", "description": "Marketing and sales", "is_favorite": false, "display_order": 3},
    {"name": "Technology", "icon": "code", "color": "#6366F1", "description": "Tech and programming", "is_favorite": false, "display_order": 4},
    {"name": "Finance", "icon": "dollar-sign", "color": "#F59E0B", "description": "Finance and investing", "is_favorite": false, "display_order": 5}
  ]'::jsonb
)
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE collection_templates IS 
  'Pre-configured collection structures for quick library organization';

COMMENT ON COLUMN collection_templates.structure IS 
  'JSONB array of collection definitions with name, description, icon, color, etc.';

COMMENT ON COLUMN collection_templates.is_public IS 
  'Whether template is visible to all users';

COMMENT ON COLUMN collection_templates.is_system IS 
  'System templates cannot be deleted and are always available';

COMMENT ON FUNCTION create_collections_from_template IS 
  'Creates a set of collections from a template structure. Returns created collection IDs.';

COMMENT ON FUNCTION get_popular_templates IS 
  'Returns most popular public and system templates for quick access';

