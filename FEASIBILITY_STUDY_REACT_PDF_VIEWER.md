# Feasibility Study: Migrating to @react-pdf-viewer/highlight

## Executive Summary

This document evaluates the feasibility of migrating from our current custom PDF.js + `react-pdf-highlighter-extended` implementation to `@react-pdf-viewer/highlight` plugin.

**Recommendation: ⚠️ HIGH RISK - Requires significant refactoring**

While `@react-pdf-viewer/highlight` offers a cleaner API and handles coordinate conversion internally, migrating would require replacing our entire PDF rendering system, which has deep integration with our app's features.

---

## Current Implementation Analysis

### Current Stack
- **PDF Rendering**: `pdfjs-dist` v5.4.296 (direct PDF.js)
- **Highlighting Library**: `react-pdf-highlighter-extended` v8.1.0 (coordinate utilities only)
- **Rendering Approach**: Custom canvas rendering with manual text layer management
- **Coordinate System**: Absolute pixels (x, y, width, height) with complex scaling
- **Current Issues**: 
  - Highlight coordinates are off-screen (y: 12167)
  - Complex coordinate conversion pipeline causing errors
  - Visibility issues in continuous mode

### Key Features We Currently Support
1. ✅ **Reading Mode**: Custom reading mode that converts PDF to text
2. ✅ **Zoom Controls**: Custom zoom implementation (0.5x - 3x)
3. ✅ **Rotation**: 90° rotation support
4. ✅ **Single/Continuous Page Mode**: Toggle between modes
5. ✅ **Custom Toolbar**: Integrated with app theme and controls
6. ✅ **Search**: Custom search implementation
7. ✅ **Text-to-Speech**: Integrated TTS with page text
8. ✅ **Formula Rendering**: Custom LaTeX formula extraction and rendering
9. ✅ **Typography Settings**: Custom font, size, spacing controls
10. ✅ **Notes Integration**: Custom notes panel with AI features
11. ✅ **Context Menu**: AI-powered context menu for selected text
12. ✅ **OCR Support**: Custom OCR integration for scanned PDFs
13. ✅ **Highlight Management**: Custom highlight panel with colors
14. ✅ **Audio Widget**: Draggable audio widget overlay

---

## @react-pdf-viewer/highlight Analysis

### What It Offers
- **Clean API**: Declarative highlight rendering with `renderHighlights` prop
- **Automatic Coordinate Conversion**: Uses percentage-based coordinates (not pixels)
- **Text Selection**: Built-in text selection handling
- **Highlight Areas**: Provides `HighlightArea` interface with percentages
- **Selection Data**: Tracks text selection with `SelectionData` structure
- **Integration**: Works with `@react-pdf-viewer/core` Viewer component
- **Rotation Support**: Handles rotation automatically via `getCssProperties`

### Coordinate System
```typescript
interface HighlightArea {
  height: number;    // Percentage (0-100)
  left: number;      // Percentage (0-100)
  pageIndex: number; // Zero-based page index
  top: number;       // Percentage (0-100)
  width: number;     // Percentage (0-100)
}
```

**Key Advantage**: Percentage-based coordinates eliminate scaling issues!

### What We'd Need to Change
1. **Replace PDF Rendering**: Switch from custom `pdfjs-dist` to `@react-pdf-viewer/core`
2. **Replace Viewer Component**: Entire `PDFViewer.tsx` component needs rewrite
3. **Migrate Highlight Data**: Convert existing highlights from pixel coordinates to percentages
4. **Update Services**: Modify `highlightService.ts` to use `HighlightArea` format
5. **Database Migration**: Update `position_data` JSONB schema to use percentages
6. **Feature Compatibility**: Verify all features work with `react-pdf-viewer`

---

## Compatibility Analysis

### ✅ Likely Compatible Features
- **Highlighting**: Core feature, that's why we're considering it
- **Rotation**: Supported via `rotation` prop
- **Zoom**: Supported via `zoom` prop
- **Page Navigation**: Supported via `currentPage` prop
- **Search**: Has `@react-pdf-viewer/search` plugin
- **Scroll Mode**: Has `@react-pdf-viewer/scroll-mode` plugin

### ⚠️ Requires Investigation
- **Reading Mode**: Need to check if we can extract text and render in custom reading mode
- **Custom Toolbar**: May need to build custom toolbar or use `@react-pdf-viewer/toolbar`
- **Formula Rendering**: Need to check if we can overlay LaTeX formulas
- **Typography Settings**: Need to check if we can apply custom fonts/styles
- **OCR Integration**: Need to check if we can integrate OCR with react-pdf-viewer
- **Notes Panel**: Should work, but integration may need changes
- **Context Menu**: Should work, but need to check selection handling
- **Audio Widget**: Should work as overlay component

### ❌ Potential Issues
- **Bundle Size**: `react-pdf-viewer` + plugins may be larger than current setup
- **Customization**: Less control over rendering pipeline
- **Learning Curve**: Team needs to learn new API
- **Migration Effort**: Significant refactoring required

---

## Migration Complexity Assessment

### Phase 1: Basic Integration (2-3 weeks)
1. Install `@react-pdf-viewer/core` and `@react-pdf-viewer/highlight`
2. Replace `PDFViewer.tsx` with basic `Viewer` component
3. Implement basic highlighting with `renderHighlights`
4. Test highlight creation and rendering

### Phase 2: Feature Parity (3-4 weeks)
1. Integrate all plugins (search, scroll-mode, zoom, etc.)
2. Migrate highlight data from pixels to percentages
3. Update database schema and migration scripts
4. Implement custom toolbar
5. Integrate reading mode
6. Test all existing features

### Phase 3: Advanced Features (2-3 weeks)
1. Integrate formula rendering
2. Integrate OCR
3. Integrate typography settings
4. Integrate notes panel
5. Integrate context menu
6. Integrate audio widget
7. Performance optimization

### Phase 4: Testing & Polish (1-2 weeks)
1. Comprehensive testing
2. Bug fixes
3. Performance optimization
4. Documentation

**Total Estimated Time: 8-12 weeks**

---

## Data Migration Strategy

### Current Highlight Format
```typescript
{
  position_data: {
    x: number,           // Absolute pixels
    y: number,           // Absolute pixels
    width: number,       // Absolute pixels
    height: number,      // Absolute pixels
    scaledRects: [...],  // Scaled coordinates
    // ... complex coordinate system
  }
}
```

### New Highlight Format
```typescript
{
  position_data: {
    highlightAreas: [
      {
        height: number,    // Percentage (0-100)
        left: number,      // Percentage (0-100)
        pageIndex: number, // Zero-based
        top: number,       // Percentage (0-100)
        width: number,     // Percentage (0-100)
      }
    ],
    selectionData: {
      startPageIndex: number,
      startOffset: number,
      startDivIndex: number,
      endPageIndex: number,
      endOffset: number,
      endDivIndex: number,
    }
  }
}
```

### Migration Script Required
1. Read all existing highlights from database
2. For each highlight, convert pixel coordinates to percentages
3. Calculate page dimensions at time of highlight creation
4. Convert to `HighlightArea` format
5. Update database records
6. Verify migration accuracy

**Risk**: If page dimensions aren't stored, conversion may be inaccurate.

---

## Bundle Size Impact

### Current Dependencies
- `pdfjs-dist`: ~2.5 MB (uncompressed)
- `react-pdf-highlighter-extended`: ~500 KB (uncompressed)
- **Total**: ~3 MB (uncompressed)

### New Dependencies (Estimated)
- `@react-pdf-viewer/core`: ~1.5 MB (uncompressed)
- `@react-pdf-viewer/highlight`: ~200 KB (uncompressed)
- `@react-pdf-viewer/search`: ~100 KB (uncompressed)
- `@react-pdf-viewer/scroll-mode`: ~50 KB (uncompressed)
- `@react-pdf-viewer/zoom`: ~50 KB (uncompressed)
- **Total**: ~1.9 MB (uncompressed)

**Note**: Bundle size may actually decrease, but need to verify with actual build.

---

## Risk Assessment

### High Risk Items
1. **Feature Compatibility**: Not all features may work with react-pdf-viewer
2. **Data Migration**: Converting coordinates may lose accuracy
3. **Custom Features**: Reading mode, formula rendering may need significant rework
4. **Timeline**: 8-12 weeks is a significant commitment
5. **Breaking Changes**: May break existing user workflows

### Medium Risk Items
1. **Performance**: Need to verify performance with large PDFs
2. **Customization**: Less control over rendering may limit future features
3. **Learning Curve**: Team needs to learn new API

### Low Risk Items
1. **Bundle Size**: Likely to decrease or stay similar
2. **Maintenance**: Well-maintained library with active community
3. **Documentation**: Good documentation available

---

## Alternative: Fix Current Implementation

### Option A: Fix Coordinate Conversion (Recommended)
**Time Estimate: 1-2 weeks**

1. Debug current coordinate conversion pipeline
2. Fix `scaledToViewport` conversion issues
3. Simplify coordinate system
4. Add comprehensive tests
5. Fix rendering in continuous mode

**Pros**:
- Minimal disruption
- Keep existing features
- Faster implementation
- Lower risk

**Cons**:
- May not solve all coordinate issues
- Still have complex coordinate system

### Option B: Hybrid Approach
**Time Estimate: 2-3 weeks**

1. Keep current PDF rendering
2. Use `@react-pdf-viewer/highlight` for highlight rendering only
3. Convert highlights to percentage format
4. Render highlights as overlays

**Pros**:
- Keep existing PDF rendering
- Use proven highlight rendering
- Lower risk than full migration

**Cons**:
- May have integration issues
- Still need coordinate conversion
- More complex architecture

---

## Recommendation

### Primary Recommendation: **Fix Current Implementation (Option A)**

**Rationale**:
1. **Lower Risk**: Fixing coordinate conversion is less risky than full migration
2. **Faster**: 1-2 weeks vs 8-12 weeks
3. **Preserve Features**: Keep all existing features that work
4. **Less Disruption**: Minimal changes to codebase
5. **Proven Approach**: We understand the current codebase

### Secondary Recommendation: **Hybrid Approach (Option B)** (If Option A fails)

**Rationale**:
1. **Best of Both Worlds**: Keep PDF rendering, use proven highlight rendering
2. **Moderate Risk**: Less risk than full migration
3. **Moderate Time**: 2-3 weeks implementation
4. **Proven Highlight Rendering**: Uses library's highlight rendering

### Tertiary Recommendation: **Full Migration** (Only if Options A & B fail)

**Rationale**:
1. **Clean Slate**: Start fresh with proven library
2. **Long-term Solution**: Better maintainability
3. **High Risk**: Significant refactoring required
4. **Long Timeline**: 8-12 weeks implementation

---

## Next Steps (If Approved)

### Phase 1: Proof of Concept (1 week)
1. Create feature branch: `feat/react-pdf-viewer-migration`
2. Install `@react-pdf-viewer/core` and `@react-pdf-viewer/highlight`
3. Create minimal `PDFViewerV2.tsx` component
4. Implement basic PDF rendering with highlighting
5. Test with one PDF document
6. Compare with current implementation

### Phase 2: Evaluation (1 week)
1. Test feature compatibility
2. Measure bundle size impact
3. Test performance with large PDFs
4. Evaluate migration complexity
5. Present findings to team

### Phase 3: Decision
1. Review proof of concept
2. Make go/no-go decision
3. If go: proceed with full migration
4. If no-go: proceed with Option A or B

---

## Questions to Answer Before Migration

1. **Can we extract text for reading mode?** 
   - Need to verify if `react-pdf-viewer` exposes text content
   
2. **Can we overlay LaTeX formulas?**
   - Need to check if we can render custom overlays
   
3. **Can we customize typography?**
   - Need to check if we can apply custom fonts/styles
   
4. **Can we integrate OCR?**
   - Need to check if we can replace PDF content with OCR results
   
5. **What's the actual bundle size?**
   - Need to measure with actual build
   
6. **How accurate is coordinate conversion?**
   - Need to test migration script with real data
   
7. **Can we maintain current UX?**
   - Need to verify all UI/UX features work

---

## References

- [@react-pdf-viewer/highlight Documentation](https://react-pdf-viewer.dev/plugins/highlight/)
- [@react-pdf-viewer/core Documentation](https://react-pdf-viewer.dev/)
- [Current Implementation: PDFViewer.tsx](../src/components/PDFViewer.tsx)
- [Current Highlight Service: highlightService.ts](../src/services/highlightService.ts)
- [Current Database Schema: 015_add_highlights_table.sql](../supabase/migrations/015_add_highlights_table.sql)

---

## Conclusion

While `@react-pdf-viewer/highlight` offers a cleaner API and solves coordinate conversion issues, migrating would require significant refactoring (8-12 weeks) and may break existing features. 

**Recommendation**: Fix the current coordinate conversion issues first (1-2 weeks). If that fails, consider a hybrid approach (2-3 weeks). Only proceed with full migration if both alternatives fail.

The current issues (highlight coordinates off-screen) are likely fixable with proper debugging and simplification of the coordinate conversion pipeline, rather than requiring a complete rewrite.

