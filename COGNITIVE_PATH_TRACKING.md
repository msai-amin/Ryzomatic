# Cognitive Path Tracking System

## Overview

This migration (`053_cognitive_path_tracking.sql`) implements a comprehensive system to track user learning journeys, reading flow, and concept connections. The graph now traces **cognitive paths** - how users actually think, learn, and connect ideas - not just document similarity.

## What Was Added

### 1. **Reading Sessions** (`reading_sessions`)
Tracks temporal flow of reading:
- When user starts/ends reading a document
- Pages read during session
- Highlights and notes created
- Links to previous/next sessions (reading flow chain)
- Session type (reading, reviewing, research, study)

**Use Case**: "Show me my reading journey this week"

### 2. **Document Navigation Log** (`document_navigation_log`)
Tracks how users move between documents:
- Which document they came from
- Which document they went to
- What triggered navigation (related doc click, note link, highlight, search)
- Time spent on previous document

**Use Case**: "Show me how I navigated from Document A → B → C"

### 3. **Highlight-to-Note Connections** (`highlight_note_connections`)
Tracks idea development:
- When user creates a note from a highlight
- Connection type (expanded, questioned, summarized, related)
- Links highlights and notes explicitly

**Use Case**: "Show me all notes I created from highlights"

### 4. **Cognitive Concepts** (`cognitive_concepts`)
Extracted ideas that appear across documents:
- Concept text (e.g., "machine learning", "quantum physics")
- Vector embedding for similarity matching
- First appearance tracking
- Frequency and importance scores

**Use Case**: "Show me all documents/notes/highlights about 'machine learning'"

### 5. **Concept Occurrences** (`concept_occurrences`)
Tracks where concepts appear:
- In which document/note/highlight
- Context text
- Page number
- Timestamp

**Use Case**: "Show me the evolution of my understanding of concept X"

### 6. **Cognitive Paths** (`cognitive_paths`)
Explicit learning journeys:
- Ordered sequence of documents/notes/highlights
- Path type (reading_flow, research_trail, concept_exploration, study_session)
- Statistics (total items, documents, notes, highlights)

**Use Case**: "Show me my research trail on topic X"

### 7. **Enhanced Document Relationships**
Added cognitive metadata to `document_relationships`:
- `cognitive_path_type`: similarity, reading_flow, concept_link, note_connection, highlight_chain, research_path
- `path_strength`: How strong is this cognitive connection
- `first_connected_at`: When did user first connect these
- `connection_count`: How many times user connected them

## Database Schema

### Core Tables

```
user_books (Files)
    │
    ├─── document_descriptions (1:1)
    │
    ├─── reading_sessions (1:many)
    │
    ├─── document_navigation_log (1:many as source/target)
    │
    ├─── user_highlights (1:many)
    │       │
    │       └─── highlight_note_connections (1:many)
    │               │
    │               └─── user_notes (many:1)
    │
    ├─── user_notes (1:many)
    │
    └─── document_relationships (1:many)
            │
            └─── Enhanced with cognitive_path_type

cognitive_concepts (Concepts)
    │
    └─── concept_occurrences (1:many)
            │
            ├─── Links to documents
            ├─── Links to notes
            └─── Links to highlights

cognitive_paths (Learning Journeys)
    └─── path_items JSONB (ordered sequence)
```

## Key Functions

### `get_cognitive_path_graph(book_uuid, user_uuid, include_types)`
Returns complete cognitive graph for a document:
- All connected documents (via similarity, reading flow, concepts)
- All connected notes
- All connected highlights
- All connected concepts
- Edge types and strengths

**Example**:
```sql
SELECT * FROM get_cognitive_path_graph(
  'document-id-here',
  'user-id-here',
  ARRAY['document', 'note', 'highlight', 'concept']
);
```

### `get_reading_flow(user_uuid, limit_count)`
Returns reading flow sequence showing how user navigated between documents.

**Example**:
```sql
SELECT * FROM get_reading_flow('user-id-here', 50);
```

### `get_concept_connections(concept_uuid, user_uuid)`
Returns all places where a concept appears (documents, notes, highlights).

**Example**:
```sql
SELECT * FROM get_concept_connections('concept-id-here', 'user-id-here');
```

## Integration Points

### Frontend Integration

1. **Track Document Opens**:
   ```typescript
   // When user opens a document
   await supabase.from('document_navigation_log').insert({
     user_id: userId,
     from_document_id: previousDocId,
     to_document_id: currentDocId,
     navigation_type: 'manual_open',
     time_spent_seconds: timeOnPreviousDoc
   });
   ```

2. **Track Reading Sessions**:
   ```typescript
   // Start session
   const { data: session } = await supabase.from('reading_sessions').insert({
     user_id: userId,
     book_id: documentId,
     session_type: 'reading',
     start_time: new Date().toISOString()
   }).select().single();

   // End session
   await supabase.from('reading_sessions').update({
     end_time: new Date().toISOString(),
     duration_seconds: elapsedSeconds,
     highlights_created: highlightsCount,
     notes_created: notesCount
   }).eq('id', session.id);
   ```

3. **Link Highlights to Notes**:
   ```typescript
   // When user creates note from highlight
   await supabase.from('highlight_note_connections').insert({
     user_id: userId,
     highlight_id: highlightId,
     note_id: noteId,
     connection_type: 'expanded'
   });

   // Update highlight
   await supabase.from('user_highlights').update({
     has_note: true,
     linked_note_id: noteId
   }).eq('id', highlightId);

   // Update note
   await supabase.from('user_notes').update({
     source_highlight_id: highlightId,
     created_from_highlight: true
   }).eq('id', noteId);
   ```

4. **Extract Concepts** (Background Job):
   ```typescript
   // Extract concepts from highlights/notes using AI
   const concepts = await extractConcepts(text);
   
   for (const concept of concepts) {
     // Upsert concept
     const { data: conceptRecord } = await supabase
       .from('cognitive_concepts')
       .upsert({
         user_id: userId,
         concept_text: concept.text,
         concept_embedding: concept.embedding,
         first_seen_in_highlight_id: highlightId,
         frequency: 1
       }, { onConflict: 'user_id,concept_text' })
       .select()
       .single();

     // Create occurrence
     await supabase.from('concept_occurrences').insert({
       user_id: userId,
       concept_id: conceptRecord.id,
       occurrence_type: 'highlight',
       occurrence_id: highlightId,
       context_text: context
     });
   }
   ```

## Graph Visualization Enhancements

### Edge Types (Color Coding)
- **Blue**: Similarity (content-based)
- **Green**: Reading Flow (temporal sequence)
- **Orange**: Concept Link (shared concept)
- **Purple**: Note Connection (notes connect them)
- **Pink**: Highlight Chain (highlights connect them)
- **Red**: Research Path (user researched while reading)

### Node Types
- **Documents**: Large circles
- **Notes**: Medium squares
- **Highlights**: Small diamonds
- **Concepts**: Star shapes

### Edge Strength
- Thickness represents `edge_strength` (0-100)
- Stronger connections = thicker edges

## Example Cognitive Path

```
User reads Document A (Machine Learning Basics)
  ↓ [reading_flow, strength: 90]
  ↓ Highlights "neural networks"
  ↓ [highlight_created]
  ↓ Creates Note: "Want to learn more about this"
  ↓ [note_connection, strength: 85]
  ↓ Clicks related Document B (Deep Learning)
  ↓ [reading_flow, strength: 90]
  ↓ Highlights "backpropagation" in B
  ↓ [concept extracted: "neural networks"]
  ↓ [concept_link, strength: 80]
  ↓ Creates Note connecting A and B
  ↓ [note_connection, strength: 85]
  ↓ Reads Document C (same concept)
  ↓ [concept_link, strength: 75]

Result: Graph shows:
- A → B (reading flow, 90%)
- A → B (concept link, "neural networks", 80%)
- Highlight A → Note A (idea development, 85%)
- Note A → Document B (research path, 85%)
- Concept "neural networks" connects A, B, C
```

## Benefits

1. **Learning Journey Visualization**: See how understanding evolved over time
2. **Concept Tracking**: Follow ideas across documents, notes, and highlights
3. **Reading Flow**: Understand navigation patterns and research trails
4. **Idea Development**: Track how highlights become notes, notes become connections
5. **Research Trails**: See how research questions were answered
6. **Personalized Graph**: Shows YOUR cognitive paths, not just similarity

## Next Steps

1. **Frontend Integration**: Update graph components to use `get_cognitive_path_graph()`
2. **Concept Extraction**: Implement AI service to extract concepts from highlights/notes
3. **Session Tracking**: Add hooks to track document opens/closes
4. **Path Visualization**: Update D3.js graph to show different edge types
5. **Analytics**: Build dashboards showing learning patterns

## Migration Notes

- Migration is **backward compatible** - existing data remains unchanged
- New columns use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for safety
- All tables have proper RLS policies
- Indexes optimized for common queries
- Vector index on `cognitive_concepts.concept_embedding` for fast similarity search

