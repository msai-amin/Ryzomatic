# Paper Recommendations from OpenAlex - Implementation Summary

## Overview

Successfully integrated OpenAlex paper recommendation system into the Smart Reader platform, enabling users to discover relevant academic papers based on their current documents using citation graph analysis and hybrid ranking algorithms.

## What Was Built

### Phase 1: Database Schema ✅

**File**: `supabase/migrations/061_paper_recommendations.sql`

Created `paper_recommendations` table to cache OpenAlex recommendations:
- Stores paper metadata (title, authors, abstract, citations, etc.)
- Links recommendations to user documents
- Tracks user feedback (relevant/not relevant/saved)
- Includes recommendation scores and reasons
- Full-text search support
- Row-level security policies

**Helper Functions**:
- `get_paper_recommendations()` - Retrieve cached recommendations with filtering
- `update_paper_recommendation_feedback()` - Update user feedback
- `is_paper_in_library()` - Check if paper already exists in user's library

### Phase 2: Service Layer ✅

**File**: `src/services/openAlexRecommendationService.ts`

Comprehensive service for OpenAlex integration:
- **Search Papers**: Search OpenAlex by query string
- **Related Works**: Get recommendations from citation graph (`related_works`)
- **Cited By**: Get papers that cite the seed paper
- **Caching**: Store recommendations in database
- **Hybrid Ranking**: Multi-factor scoring algorithm

**Key Features**:
- Polite pool support (10x faster with email)
- Automatic deduplication against user library
- Error handling and logging
- Abstract reconstruction from inverted index

### Phase 3: API Endpoint ✅

**File**: `api/recommendations/openalex.ts`

Serverless API endpoint for paper recommendations:
- `GET/POST /api/recommendations/openalex?action=get-recommendations` - Get recommendations for a document
- `GET/POST /api/recommendations/openalex?action=search` - Search papers
- `POST /api/recommendations/openalex?action=update-feedback` - Update user feedback

**Features**:
- Authentication via Supabase tokens
- CORS support
- Automatic caching of results
- Error handling

### Phase 4: UI Component ✅

**File**: `src/components/PaperRecommendationsPanel.tsx`

React component for displaying paper recommendations:
- Displays recommendations in card format
- Shows metadata (year, citations, venue, authors)
- Abstract preview with line clamping
- Recommendation score visualization
- Filter controls (year, citations, open access)
- Recommendation type selector (Related Works / Cited By)
- User feedback buttons (Mark Relevant)
- Direct links to open access papers

### Phase 5: Sidebar Integration ✅

**File**: `themes/ThemedSidebar.tsx`

Integrated into sidebar:
- New collapsible "Paper Recommendations" section
- Appears after "Related Documents" section
- Only shows when a document is open
- Uses Sparkles icon for visual distinction

### Phase 6: Hybrid Ranking Algorithm ✅

**Enhanced Scoring System**:

The recommendation system uses a hybrid ranking algorithm combining multiple signals:

1. **Citation Graph Similarity (30%)**: Direct relationship in citation graph
2. **Citation Count (25%)**: Paper quality signal (logarithmic scale)
3. **Recency (15%)**: Recent papers get higher scores
4. **Topic Overlap (15%)**: Shared topics with seed paper
5. **Open Access (10%)**: Accessibility bonus
6. **Venue Quality (5%)**: Publication venue indicator

**Scoring Functions**:
- `calculateCitationScore()` - Citation graph relevance
- `calculateCitationCountScore()` - Normalized citation count (log scale)
- `calculateRecencyScore()` - Time-based scoring
- `calculateOpenAccessScore()` - Accessibility bonus
- `calculateTopicOverlapScore()` - Topic matching
- `calculateVenueScore()` - Venue quality indicator

## How It Works

### User Flow

1. **User opens a document** in the platform
2. **Sidebar shows "Paper Recommendations"** section
3. **User expands the section** to see recommendations
4. **System fetches recommendations**:
   - Checks if document has OpenAlex ID or DOI in metadata
   - Calls OpenAlex API to get related works or cited-by papers
   - Applies hybrid ranking algorithm
   - Caches results in database
5. **User can**:
   - Filter by year, citations, open access
   - Switch between "Related Works" and "Cited By"
   - Mark papers as relevant/not relevant
   - Click to open papers (if open access available)
   - See recommendation scores and reasons

### Recommendation Types

1. **Related Works** (default): Papers connected in the citation graph
2. **Cited By**: Papers that cite the current document

### Filtering Options

- **Min Year**: Filter by publication year
- **Min Citations**: Filter by minimum citation count
- **Open Access Only**: Show only freely available papers

## Quality Improvements Implemented

### 1. Hybrid Ranking Algorithm
- Combines 6 different signals for better relevance
- Weighted scoring system (tunable)
- Normalized scores (0-100)

### 2. Multi-Source Recommendations
- Related works (citation graph)
- Cited by (forward citations)
- Extensible for future: co-citation, author-based, venue-based

### 3. Smart Filtering
- Excludes papers already in user's library
- Year range filtering
- Citation count threshold
- Open access preference

### 4. User Feedback Loop
- Track user feedback (relevant/not relevant)
- Can be used to improve future recommendations
- Visual indicators for user feedback

### 5. Caching Strategy
- Recommendations cached for 7 days
- Reduces API calls
- Faster load times for repeated views

## Technical Decisions

### Why OpenAlex?
- ✅ Free and open API
- ✅ Comprehensive citation graph
- ✅ No API key required (polite pool optional)
- ✅ Large coverage (200M+ papers)

### Why Hybrid Ranking?
- ✅ Better than single-signal ranking
- ✅ Balances multiple relevance factors
- ✅ Tunable weights for different use cases
- ✅ Extensible for future improvements

### Why Database Caching?
- ✅ Reduces external API calls
- ✅ Faster response times
- ✅ Enables user feedback tracking
- ✅ Supports offline viewing of cached results

## Future Enhancements

### Short-term (Next Sprint)
1. **Semantic Similarity**: Integrate with existing embedding system
2. **Co-citation Recommendations**: Papers frequently cited together
3. **Author-based Recommendations**: Papers by same authors
4. **Venue-based Recommendations**: Papers from same venue

### Medium-term (Next Month)
1. **Personalization**: Learn from user's reading patterns
2. **Topic-based Recommendations**: Based on user's highlighted topics
3. **Import to Library**: One-click import of recommended papers
4. **Recommendation Explanations**: More detailed reasoning

### Long-term (Next Quarter)
1. **ML-based Ranking**: Train model on user feedback
2. **Collaborative Filtering**: Recommendations based on similar users
3. **Reading Time Prediction**: Estimate reading time for papers
4. **Paper Comparison**: Side-by-side comparison of papers

## Usage

### For Users

1. Open any document in your library
2. Expand "Paper Recommendations" in the sidebar
3. Browse recommendations, apply filters as needed
4. Click "Read" to open open-access papers
5. Mark papers as relevant to improve future recommendations

### For Developers

**Get recommendations for a document**:
```typescript
import { openAlexRecommendationService } from './services/openAlexRecommendationService';

openAlexRecommendationService.setCurrentUser(userId);
const recommendations = await openAlexRecommendationService.getRelatedWorksRecommendations(
  openAlexId,
  20, // limit
  userEmail // for polite pool
);
```

**Search papers**:
```typescript
const results = await openAlexRecommendationService.searchPapers(
  'machine learning',
  20,
  userEmail
);
```

**Update feedback**:
```typescript
await openAlexRecommendationService.updateFeedback(
  recommendationId,
  'relevant',
  false
);
```

## Files Created/Modified

### New Files
1. `supabase/migrations/061_paper_recommendations.sql` - Database schema
2. `src/services/openAlexRecommendationService.ts` - Service layer
3. `api/recommendations/openalex.ts` - API endpoint
4. `src/components/PaperRecommendationsPanel.tsx` - UI component
5. `docs/features/paper-recommendations/IMPLEMENTATION.md` - This file

### Modified Files
1. `themes/ThemedSidebar.tsx` - Added Paper Recommendations section

## Testing

### Manual Testing Checklist
- [ ] Open a document with DOI/OpenAlex ID
- [ ] Expand Paper Recommendations section
- [ ] Verify recommendations load
- [ ] Test filtering (year, citations, open access)
- [ ] Switch between "Related Works" and "Cited By"
- [ ] Mark a paper as relevant
- [ ] Click "Read" button for open access papers
- [ ] Verify caching (refresh and check speed)

### Edge Cases
- [ ] Document without DOI/OpenAlex ID
- [ ] No recommendations found
- [ ] API error handling
- [ ] Network timeout
- [ ] Invalid OpenAlex ID

## Performance Considerations

- **API Rate Limits**: OpenAlex allows 10 requests/second (100k/day) without polite pool
- **Caching**: Recommendations cached for 7 days to reduce API calls
- **Batch Processing**: Can fetch up to 25 related works at once
- **Lazy Loading**: Recommendations only load when section is expanded

## Security

- **Authentication**: All API calls require Supabase auth token
- **Row-Level Security**: Database policies ensure users only see their own recommendations
- **Input Validation**: All user inputs validated and sanitized
- **Error Handling**: Graceful degradation on API failures

## Next Steps

1. **Run Migration**: Apply `061_paper_recommendations.sql` to Supabase
2. **Test Integration**: Verify API endpoint works in production
3. **Monitor Usage**: Track recommendation quality and user engagement
4. **Iterate**: Adjust ranking weights based on user feedback
5. **Expand**: Add more recommendation sources (co-citation, author-based, etc.)
