/**
 * PDF Extraction Robustness Tests
 * 
 * Comprehensive test suite for the 3-tier extraction system
 * Tests quality detection, vision fallback, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  analyzePageQuality, 
  analyzeDocumentQuality,
  identifyProblematicPages,
  needsFullOCR,
  needsVisionFallback,
  generateQualitySummary
} from '../src/utils/pdfQualityValidator'

describe('PDF Quality Validator', () => {
  describe('analyzePageQuality', () => {
    it('should give perfect score for high-quality text', () => {
      const highQualityText = `
This is a well-formatted document with proper paragraphs and structure.
The text flows naturally with appropriate spacing and punctuation.

Here is another paragraph that demonstrates good formatting.
Words are properly spaced and the content is readable.

Tables and lists work well:
- Item one
- Item two
- Item three
      `.trim()

      const result = analyzePageQuality(highQualityText, 1)

      expect(result.qualityScore).toBeGreaterThan(80)
      expect(result.needsVisionFallback).toBe(false)
      expect(result.issues.length).toBe(0)
    })

    it('should detect empty pages', () => {
      const result = analyzePageQuality('', 1)

      expect(result.qualityScore).toBe(0)
      expect(result.needsVisionFallback).toBe(true)
      expect(result.issues).toContain('Empty page - no text extracted')
    })

    it('should detect low character count', () => {
      const shortText = 'abc'
      const result = analyzePageQuality(shortText, 1)

      expect(result.qualityScore).toBeLessThan(61)
      expect(result.needsVisionFallback).toBe(true)
      expect(result.charCount).toBe(3)
    })

    it('should detect high special character ratio (gibberish)', () => {
      const gibberishText = '¶¶¶§§§†††‡‡‡%%%###@@@!!!~~~^^^&&&***((()))'
      const result = analyzePageQuality(gibberishText, 1)

      expect(result.specialCharRatio).toBeGreaterThan(0.5)
      expect(result.needsVisionFallback).toBe(true)
      expect(result.issues.some(issue => issue.includes('special character'))).toBe(true)
    })

    it('should detect excessive single-character words (truncation)', () => {
      const truncatedText = 'a b c d e f g h i j k l m n o p q r s t u v w x y z'
      const result = analyzePageQuality(truncatedText, 1)

      expect(result.needsVisionFallback).toBe(true)
      expect(result.issues.some(issue => issue.includes('single-character'))).toBe(true)
    })

    it('should detect encoding issues with replacement characters', () => {
      const encodingIssueText = 'This text has \uFFFD\uFFFD\uFFFD encoding problems \uFFFD\uFFFD'
      const result = analyzePageQuality(encodingIssueText, 1)

      expect(result.qualityScore).toBeLessThan(80)
      expect(result.issues.some(issue => issue.includes('Suspicious character patterns'))).toBe(true)
    })

    it('should handle mixed quality text appropriately', () => {
      const mixedText = `
This is some good text with proper formatting.

But then we have s o m e issues w i t h spacing.

And some §†‡ special ¶¶¶ characters mixed in.
      `.trim()

      const result = analyzePageQuality(mixedText, 1)

      expect(result.qualityScore).toBeGreaterThan(30)
      expect(result.qualityScore).toBeLessThan(80)
    })
  })

  describe('analyzeDocumentQuality', () => {
    it('should recommend pdfjs for high-quality document', () => {
      const pages = [
        'This is page one with good quality text and proper formatting.',
        'Page two continues with excellent readability and structure.',
        'The third page maintains consistent quality throughout.'
      ]

      const report = analyzeDocumentQuality(pages)

      expect(report.extractionMethod).toBe('pdfjs')
      expect(report.problematicPages.length).toBe(0)
      expect(report.overallScore).toBeGreaterThan(80)
    })

    it('should recommend hybrid for mixed quality document', () => {
      const pages = [
        'This is a good quality page with proper text.',
        '', // Empty page
        'Another good page here.',
        'a b c d e f g h', // Low quality page
        'Final page with good content.'
      ]

      const report = analyzeDocumentQuality(pages)

      expect(report.extractionMethod).toBe('hybrid')
      expect(report.problematicPages.length).toBeGreaterThan(0)
      expect(report.summary.successfulPages).toBeGreaterThan(0)
      expect(report.summary.failedPages).toBeGreaterThan(0)
    })

    it('should recommend ocr for very poor quality document', () => {
      const pages = [
        '', // Empty
        'a b c', // Very short
        '§§§†††', // Gibberish
        'x y z', // Very short
        '' // Empty
      ]

      const report = analyzeDocumentQuality(pages)

      expect(report.extractionMethod).toBe('ocr')
      expect(report.overallScore).toBeLessThan(50)
    })

    it('should identify all problematic pages correctly', () => {
      const pages = [
        'Good page',
        '', // Bad - page 2
        'Good page',
        'a b c d', // Bad - page 4
        'Good page',
        '§§§†††‡‡‡', // Bad - page 6
        'Good page'
      ]

      const report = analyzeDocumentQuality(pages)
      const problematic = identifyProblematicPages(report)

      expect(problematic).toContain(2)
      expect(problematic).toContain(4)
      expect(problematic).toContain(6)
      expect(problematic.length).toBe(3)
    })

    it('should generate accurate summary', () => {
      const pages = [
        'Good page one',
        'Good page two',
        '', // Failed
        'Good page four',
        'a b c' // Poor
      ]

      const report = analyzeDocumentQuality(pages)
      const summary = generateQualitySummary(report)

      expect(summary).toContain('pages extracted successfully')
      expect(summary).toContain('Overall quality')
    })
  })

  describe('Helper Functions', () => {
    it('needsFullOCR should return true for OCR recommendation', () => {
      const pages = ['', '', '', ''] // All empty
      const report = analyzeDocumentQuality(pages)

      expect(needsFullOCR(report)).toBe(true)
    })

    it('needsVisionFallback should return true for hybrid recommendation', () => {
      const pages = [
        'Good text',
        '', // Bad
        'Good text'
      ]
      const report = analyzeDocumentQuality(pages)

      expect(needsVisionFallback(report)).toBe(true)
    })

    it('needsVisionFallback should return false for good quality', () => {
      const pages = [
        'Good quality text with proper formatting.',
        'Another page of high quality content.',
        'Consistent quality throughout.'
      ]
      const report = analyzeDocumentQuality(pages)

      expect(needsVisionFallback(report)).toBe(false)
    })
  })
})

describe('Edge Cases', () => {
  it('should handle single-page documents', () => {
    const pages = ['Single page document with good content']
    const report = analyzeDocumentQuality(pages)

    expect(report.totalPages).toBe(1)
    expect(report.extractionMethod).toBe('pdfjs')
  })

  it('should handle very long text', () => {
    const longText = 'word '.repeat(10000) // 10,000 words
    const result = analyzePageQuality(longText, 1)

    expect(result.qualityScore).toBeGreaterThan(60)
    expect(result.needsVisionFallback).toBe(false)
  })

  it('should handle unicode characters correctly', () => {
    const unicodeText = `
こんにちは世界
Hello World
مرحبا بالعالم
Привет мир
    `.trim()

    const result = analyzePageQuality(unicodeText, 1)

    // Unicode should not be penalized as gibberish
    expect(result.qualityScore).toBeGreaterThan(40)
  })

  it('should handle text with many numbers', () => {
    const numericText = `
Financial Report 2024
Revenue: $1,234,567.89
Profit: $234,567.89
Growth: 15.3%
Table 1: Quarterly Results
Q1: 100,000
Q2: 125,000
Q3: 150,000
Q4: 175,000
    `.trim()

    const result = analyzePageQuality(numericText, 1)

    expect(result.qualityScore).toBeGreaterThan(70)
    expect(result.needsVisionFallback).toBe(false)
  })

  it('should handle code snippets appropriately', () => {
    const codeText = `
function example() {
  const x = 10;
  return x * 2;
}

class MyClass {
  constructor() {
    this.value = 0;
  }
}
    `.trim()

    const result = analyzePageQuality(codeText, 1)

    // Code should have decent quality score
    expect(result.qualityScore).toBeGreaterThan(50)
  })
})

describe('Real-World Scenarios', () => {
  it('should handle academic paper abstract', () => {
    const academicText = `
Abstract

In this study, we investigate the effects of machine learning algorithms on natural language processing tasks. Our methodology involves training multiple neural network architectures on large-scale datasets. Results indicate significant improvements in accuracy (p < 0.05) when using transformer-based models compared to traditional approaches.

Keywords: machine learning, NLP, transformers, deep learning
    `.trim()

    const result = analyzePageQuality(academicText, 1)

    expect(result.qualityScore).toBeGreaterThan(80)
    expect(result.needsVisionFallback).toBe(false)
  })

  it('should detect scanned PDF with poor OCR', () => {
    const poorOcrText = 'I h e q u i c k b r o w n f o x j u m p s o v e r t h e I a z y d o g'
    const result = analyzePageQuality(poorOcrText, 1)

    expect(result.needsVisionFallback).toBe(true)
    expect(result.issues.some(issue => issue.includes('single-character'))).toBe(true)
  })

  it('should handle legal document with proper formatting', () => {
    const legalText = `
ARTICLE I
DEFINITIONS AND INTERPRETATION

1.1 Definitions. The following terms shall have the meanings set forth below:

(a) "Agreement" means this entire document including all exhibits and schedules.
(b) "Party" means either party to this Agreement.
(c) "Effective Date" means the date first written above.

1.2 Interpretation. Headings are for convenience only and shall not affect interpretation.
    `.trim()

    const result = analyzePageQuality(legalText, 1)

    expect(result.qualityScore).toBeGreaterThan(75)
    expect(result.needsVisionFallback).toBe(false)
  })

  it('should handle table-heavy document', () => {
    const tableText = `
Product Comparison Table

| Product | Price | Rating | Stock |
|---------|-------|--------|-------|
| Item A  | $10   | 4.5    | 100   |
| Item B  | $15   | 4.8    | 50    |
| Item C  | $20   | 4.2    | 75    |

All prices in USD. Ratings out of 5.0.
    `.trim()

    const result = analyzePageQuality(tableText, 1)

    expect(result.qualityScore).toBeGreaterThan(60)
  })
})

// Note: Integration tests for vision API and orchestrator
// would require mocking external services (Gemini API, S3, Supabase)
// Those should be added in a separate integration test suite

