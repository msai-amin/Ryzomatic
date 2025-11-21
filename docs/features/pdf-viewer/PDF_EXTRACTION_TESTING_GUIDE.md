# PDF Text Extraction - Testing Guide

## Quick Test Checklist

### ✅ Basic Functionality
- [ ] Single-column PDF uploads successfully
- [ ] Text appears in correct reading order
- [ ] Paragraph breaks are preserved
- [ ] Line breaks appear naturally

### ✅ Multi-Column Support
- [ ] Two-column academic paper displays correctly
- [ ] Left column appears before right column
- [ ] Column separator (`---`) appears between columns
- [ ] Text within each column is in correct order

### ✅ Reading Mode Integration
- [ ] Reading mode displays structured text
- [ ] Paragraphs are visually separated
- [ ] No jumbled or out-of-order text
- [ ] Word highlighting works correctly

### ✅ TTS Integration
- [ ] TTS reads text in correct order
- [ ] Natural pauses at paragraph breaks
- [ ] Proper flow through multi-column layouts
- [ ] Word highlighting syncs with audio

### ✅ Canvas Independence
- [ ] PDF canvas view renders correctly
- [ ] Text selection works on canvas
- [ ] No alignment issues
- [ ] Highlighting works on canvas

## Test Cases

### Test 1: Single-Column Document

**Sample:** Simple document, novel, or single-column article

**Expected Results:**
1. Text flows naturally from top to bottom
2. Paragraphs are separated by blank lines
3. Reading mode displays clean, readable text
4. No random spaces or breaks in sentences

**How to Test:**
1. Upload a single-column PDF
2. Enter reading mode (`M` key)
3. Verify text order and paragraph breaks
4. Enable TTS and listen for natural pauses

### Test 2: Two-Column Academic Paper

**Sample:** Research paper, journal article

**Expected Results:**
1. Left column text appears first (complete)
2. Column separator: `---`
3. Right column text appears second (complete)
4. Within each column: top-to-bottom order
5. Paragraph structure preserved in each column

**How to Test:**
1. Upload a two-column research paper
2. Enter reading mode
3. Verify left column comes before right
4. Check for column separator
5. Verify no text from columns is interleaved

### Test 3: Complex Multi-Column

**Sample:** Newspaper, magazine, newsletter

**Expected Results:**
1. Columns detected automatically
2. Reasonable reading order (may not be perfect)
3. Column separators between detected columns
4. No severely jumbled text

**How to Test:**
1. Upload a multi-column document
2. Enter reading mode
3. Verify columns are separated
4. Check if reading order makes sense
5. Note: Perfect order not guaranteed for complex layouts

### Test 4: Mixed Content

**Sample:** PDF with text, images, tables, headers/footers

**Expected Results:**
1. Text extracted from readable areas
2. Images don't break text flow
3. Headers/footers may appear (acceptable)
4. Overall text remains readable

**How to Test:**
1. Upload a PDF with mixed content
2. Verify main text is extractable
3. Check reading mode for reasonable output
4. Image captions may or may not align (acceptable)

### Test 5: Edge Cases

#### Empty/Sparse Pages
**Expected:** Empty string or minimal text, no errors

#### Scanned PDFs
**Expected:** OCR prompt appears, extraction handles gracefully

#### Rotated Text
**Expected:** Best-effort extraction, may need manual adjustment

#### Tables
**Expected:** Table data extracted left-to-right, top-to-bottom

## Comparison Testing

### Before vs After

**Before Enhancement:**
```
Introduction Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Results The study found significant improvements. 
Discussion These findings suggest important implications.
```

**After Enhancement:**
```
Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

Results

The study found significant improvements.

Discussion

These findings suggest important implications.
```

## Performance Testing

### Metrics to Check

1. **Upload Time**: Should be similar to before (< 100ms overhead per page)
2. **Memory Usage**: No significant increase
3. **Reading Mode Load**: Instant (no processing needed)
4. **TTS Startup**: Same as before

### Large Document Test

**Sample:** 100+ page PDF

**Expected:**
- Upload completes successfully
- Progress indicator works
- All pages processed
- No memory issues
- Reading mode works for any page

## Debugging Failed Tests

### Text Order Issues

If text appears in wrong order:

1. **Check PDF Structure:**
   - Some PDFs have unusual internal ordering
   - May need adjustment to column detection threshold
   
2. **Verify Column Detection:**
   - Add console.log to `detectColumns()` function
   - Check detected column boundaries
   
3. **Adjust Thresholds:**
   - Column gap threshold (currently 100px)
   - Line tolerance (currently 2px or 20% font size)

### Missing Paragraph Breaks

If paragraphs run together:

1. **Check Font Size Calculation:**
   - Verify median font size is reasonable
   - Check Y-gap calculations
   
2. **Adjust Gap Thresholds:**
   - Line break: currently 1.2x font height
   - Paragraph: currently 2.0x font height
   - Section: currently 3.0x font height

### Extra Paragraph Breaks

If too many breaks appear:

1. **Lower Thresholds:**
   - Increase line break threshold from 1.2 to 1.5
   - Increase paragraph threshold from 2.0 to 2.5
   
2. **Check for Artifacts:**
   - Some PDFs have invisible elements
   - May need filtering of empty items

## Regression Testing

### Ensure No Breaking Changes

- [ ] Existing PDFs still open correctly
- [ ] Canvas rendering unchanged
- [ ] PDF zoom/rotation works
- [ ] Highlighting feature works
- [ ] Notes feature works
- [ ] Search works
- [ ] Download works
- [ ] All keyboard shortcuts work

## User Acceptance Testing

### Ask Users to Test:

1. Upload their typical PDFs
2. Enter reading mode
3. Provide feedback on:
   - Text order
   - Paragraph structure
   - Overall readability
   - TTS naturalness
   - Any issues or concerns

## Known Limitations

### Current Implementation Cannot Handle:

1. **Complex Column Flows**: Newspaper-style column wrapping
2. **Nested Columns**: Sidebars within columns
3. **Circular Text**: Text following non-linear paths
4. **Vertical Text**: Asian language vertical orientation
5. **Artistic Layouts**: Text following shapes or curves

These are acceptable limitations for the initial implementation.

## Success Criteria

The implementation is successful if:

1. ✅ 90%+ of single-column PDFs extract correctly
2. ✅ 80%+ of two-column PDFs extract in proper order
3. ✅ Paragraph breaks appear for 90%+ of documents
4. ✅ No regression in existing features
5. ✅ Canvas rendering remains unchanged
6. ✅ Performance impact < 5% on upload time
7. ✅ User feedback is positive

## Reporting Issues

If you find issues, please report:

1. **PDF Type**: Single/multi-column, source
2. **Issue Description**: What's wrong with the extraction
3. **Expected vs Actual**: What you expected vs what you got
4. **Steps to Reproduce**: How to replicate the issue
5. **Screenshot**: If applicable

## Next Steps After Testing

Based on test results:

1. **If all tests pass**: Mark implementation as stable
2. **If minor issues**: Adjust thresholds and retest
3. **If major issues**: Review algorithm and revise
4. **If edge cases fail**: Document as known limitations

## Automated Testing (Future)

Consider adding:
- Unit tests for `pdfTextExtractor.ts` functions
- Integration tests with sample PDFs
- Regression tests for common PDF types
- Performance benchmarks

