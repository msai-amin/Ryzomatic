# Test Coverage Improvement Plan

## Current Status (60.88% overall)

### Coverage Breakdown by File:
| File | Current | Target | Priority |
|------|---------|--------|----------|
| **libraryOrganizationService.ts** | 13.8% | 90% | HIGH |
| **aiService.ts** | 59.25% | 90% | HIGH |
| **epubExtractionOrchestrator.ts** | 80.43% | 90% | MEDIUM |
| **pdfHighlightGeometry.ts** | 83.33% | 90% | LOW |
| **errorHandler.ts** | 90% | ✅ | DONE |
| **logger.ts** | 81.35% | 90% | MEDIUM |
| **validation.ts** | 87.33% | 90% | LOW |
| **pdfQualityValidator.ts** | 93.33% | ✅ | DONE |
| **highlightCoordinates.ts** | 100% | ✅ | DONE |

## Challenge: libraryOrganizationService.ts

**Problem**: This file is 1,363 lines with complex Supabase query chains that are difficult to mock properly.

**Reason for Low Coverage**: 
- Only 12 tests exist (mostly for batch operations)
- File has 50+ methods
- Complex database interactions with chained queries
- Heavy use of RPC functions

**Recommendation**: 
- This file needs integration tests with a real database, not unit tests
- Mocking Supabase chains properly would require hundreds of lines of mock setup
- Focus on other files for quick wins

## Strategy: Focus on Quick Wins

### Phase 1: Expand aiService Tests (59.25% → 90%)
**Effort**: Medium  
**Impact**: High  
**Lines**: ~600 lines

**Missing Coverage**:
- Tier-based rate limiting
- Token usage tracking
- Additional error scenarios
- Edge cases in message formatting

### Phase 2: Complete EPUB Tests (80.43% → 90%)
**Effort**: Low  
**Impact**: Medium  
**Lines**: ~200 lines

**Missing Coverage**:
- Error handling paths
- Edge cases in XML parsing
- Malformed EPUB handling

### Phase 3: Expand Logger Tests (81.35% → 90%)
**Effort**: Low  
**Impact**: Medium  
**Lines**: ~330 lines

**Missing Coverage**:
- Remote logging
- Log rotation
- Performance tracking edge cases

### Phase 4: Complete Validation Tests (87.33% → 90%)
**Effort**: Very Low  
**Impact**: Low  
**Lines**: ~470 lines

**Missing Coverage**:
- A few edge case validators
- Complex schema validation scenarios

### Phase 5: Complete PDF Geometry Tests (83.33% → 90%)
**Effort**: Very Low  
**Impact**: Low  
**Lines**: ~220 lines

**Missing Coverage**:
- Edge cases in coordinate calculations
- Boundary conditions

## Realistic Target

**Without libraryOrganizationService improvements**:
- Current: 60.88%
- With Phase 1-5: ~75-80%

**To reach 90% overall**:
- Need to either:
  1. Create integration tests for libraryOrganizationService (recommended)
  2. Invest significant time in complex mocking (not recommended)
  3. Refactor libraryOrganizationService into smaller, testable units (best long-term)

## Recommendation

**Short-term (2-3 hours)**:
- Complete Phases 1-5
- Achieve 75-80% coverage
- Document libraryOrganizationService as needing integration tests

**Long-term (future sprint)**:
- Set up integration test environment with test database
- Write integration tests for libraryOrganizationService
- Refactor service into smaller, more testable modules
- Achieve 90%+ coverage

## Implementation Order

1. ✅ aiService tests (biggest impact)
2. ✅ EPUB tests (quick win)
3. ✅ Logger tests (quick win)
4. ✅ Validation tests (very quick)
5. ✅ PDF geometry tests (very quick)

**Estimated Time**: 2-3 hours for 75-80% coverage
**Estimated Time for 90%**: 8-10 hours (requires integration test setup)

