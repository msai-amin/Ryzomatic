/**
 * PDF Quality Validator
 * 
 * Analyzes extracted text quality per-page to determine if vision fallback is needed.
 * Scoring: 0-30 = Failed, 31-60 = Poor, 61-100 = Acceptable
 */

export interface PageQualityMetrics {
  pageNumber: number
  charCount: number
  wordCount: number
  lineCount: number
  specialCharRatio: number
  qualityScore: number
  needsVisionFallback: boolean
  issues: string[]
}

export interface DocumentQualityReport {
  totalPages: number
  pageMetrics: PageQualityMetrics[]
  overallScore: number
  problematicPages: number[]
  extractionMethod: 'pdfjs' | 'hybrid' | 'vision' | 'ocr'
  summary: {
    successfulPages: number
    poorQualityPages: number
    failedPages: number
  }
}

/**
 * Analyze quality of extracted text from a single page
 */
export function analyzePageQuality(pageText: string, pageNumber: number): PageQualityMetrics {
  const issues: string[] = []
  let qualityScore = 100 // Start with perfect score and deduct points
  
  // Basic metrics
  const charCount = pageText.length
  const words = pageText.trim().split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  const lines = pageText.split('\n').filter(l => l.trim().length > 0)
  const lineCount = lines.length

  // 1. Empty or near-empty page (critical failure)
  if (charCount === 0) {
    issues.push('Empty page - no text extracted')
    return {
      pageNumber,
      charCount: 0,
      wordCount: 0,
      lineCount: 0,
      specialCharRatio: 0,
      qualityScore: 0,
      needsVisionFallback: true,
      issues
    }
  }

  if (charCount < 50) {
    issues.push('Very low character count (< 50)')
    qualityScore -= 40
  } else if (charCount < 100) {
    issues.push('Low character count (< 100)')
    qualityScore -= 25
  }

  // 2. Text density analysis
  const avgCharsPerLine = lineCount > 0 ? charCount / lineCount : 0
  if (avgCharsPerLine < 10 && lineCount > 3) {
    issues.push('Very low text density per line')
    qualityScore -= 20
  }

  // 3. Special character ratio (detect gibberish)
  const specialChars = pageText.match(/[^a-zA-Z0-9\s\.\,\!\?\:\;\-\(\)\[\]\{\}\"\']/g) || []
  const specialCharRatio = charCount > 0 ? specialChars.length / charCount : 0
  
  if (specialCharRatio > 0.3) {
    issues.push('High special character ratio (> 30%) - possible gibberish')
    qualityScore -= 30
  } else if (specialCharRatio > 0.2) {
    issues.push('Elevated special character ratio (> 20%)')
    qualityScore -= 15
  }

  // 4. Detect excessive single-character "words" (truncation issue)
  const singleCharWords = words.filter(w => w.length === 1 && /[a-zA-Z]/.test(w))
  const singleCharRatio = wordCount > 0 ? singleCharWords.length / wordCount : 0
  
  if (singleCharRatio > 0.3) {
    issues.push('Too many single-character words (> 30%) - truncation detected')
    qualityScore -= 25
  } else if (singleCharRatio > 0.15) {
    issues.push('Many single-character words (> 15%)')
    qualityScore -= 10
  }

  // 5. Word quality check
  const avgWordLength = wordCount > 0 ? charCount / wordCount : 0
  if (avgWordLength < 3 && wordCount > 10) {
    issues.push('Unusually short average word length')
    qualityScore -= 15
  }

  // 6. Paragraph structure detection
  const paragraphBreaks = (pageText.match(/\n\n+/g) || []).length
  const hasParagraphStructure = paragraphBreaks > 0 || lineCount > 5
  
  if (!hasParagraphStructure && charCount > 200) {
    issues.push('No paragraph structure detected in substantial text')
    qualityScore -= 10
  }

  // 7. Detect random character sequences (encoding issues)
  const suspiciousPatterns = [
    /\uFFFD{2,}/, // Replacement characters
    /[^\x00-\x7F]{20,}/, // Long sequences of non-ASCII
    /(.)\1{10,}/, // Same character repeated 10+ times
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(pageText)) {
      issues.push('Suspicious character patterns detected')
      qualityScore -= 20
      break
    }
  }

  // 8. Check for reasonable word distribution
  if (wordCount > 0) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const uniqueRatio = uniqueWords.size / wordCount
    
    // Too many unique words (might be gibberish) or too few (encoding issue)
    if (uniqueRatio > 0.95 && wordCount > 20) {
      issues.push('Unusually high unique word ratio - possible gibberish')
      qualityScore -= 15
    } else if (uniqueRatio < 0.2 && wordCount > 20) {
      issues.push('Unusually low unique word ratio - possible encoding issue')
      qualityScore -= 15
    }
  }

  // 9. Check for common extraction artifacts
  const artifacts = [
    { pattern: /\s{5,}/g, message: 'Excessive whitespace detected' },
    { pattern: /[a-z][A-Z]/g, count: 10, message: 'Many camelCase anomalies' },
  ]
  
  for (const artifact of artifacts) {
    const matches = pageText.match(artifact.pattern) || []
    if (artifact.count ? matches.length > artifact.count : matches.length > 5) {
      issues.push(artifact.message)
      qualityScore -= 5
    }
  }

  // Clamp score to 0-100 range
  qualityScore = Math.max(0, Math.min(100, qualityScore))

  // Determine if vision fallback is needed
  // Threshold: < 61 needs vision fallback
  const needsVisionFallback = qualityScore < 61

  return {
    pageNumber,
    charCount,
    wordCount,
    lineCount,
    specialCharRatio: Math.round(specialCharRatio * 100) / 100,
    qualityScore: Math.round(qualityScore),
    needsVisionFallback,
    issues
  }
}

/**
 * Analyze quality of entire document
 */
export function analyzeDocumentQuality(pageTexts: string[]): DocumentQualityReport {
  const pageMetrics = pageTexts.map((text, index) => 
    analyzePageQuality(text, index + 1)
  )

  const totalPages = pageTexts.length
  const problematicPages = pageMetrics
    .filter(m => m.needsVisionFallback)
    .map(m => m.pageNumber)

  const successfulPages = pageMetrics.filter(m => m.qualityScore >= 61).length
  const poorQualityPages = pageMetrics.filter(m => m.qualityScore >= 31 && m.qualityScore < 61).length
  const failedPages = pageMetrics.filter(m => m.qualityScore < 31).length

  // Calculate overall document score (weighted average)
  const totalScore = pageMetrics.reduce((sum, m) => sum + m.qualityScore, 0)
  const overallScore = totalPages > 0 ? Math.round(totalScore / totalPages) : 0

  // Determine extraction method recommendation
  let extractionMethod: DocumentQualityReport['extractionMethod'] = 'pdfjs'
  
  if (failedPages > totalPages * 0.5) {
    // More than 50% failed - recommend full OCR
    extractionMethod = 'ocr'
  } else if (problematicPages.length > 0) {
    // Some pages need help - hybrid approach
    extractionMethod = 'hybrid'
  } else if (overallScore < 70 && totalPages > 0) {
    // Overall quality is mediocre - consider vision
    extractionMethod = 'hybrid'
  }

  return {
    totalPages,
    pageMetrics,
    overallScore,
    problematicPages,
    extractionMethod,
    summary: {
      successfulPages,
      poorQualityPages,
      failedPages
    }
  }
}

/**
 * Identify which pages need vision fallback processing
 */
export function identifyProblematicPages(report: DocumentQualityReport): number[] {
  return report.problematicPages
}

/**
 * Generate human-readable quality summary
 */
export function generateQualitySummary(report: DocumentQualityReport): string {
  const { totalPages, summary, overallScore, problematicPages } = report
  
  const parts: string[] = []
  
  if (summary.successfulPages === totalPages) {
    parts.push(`✓ All ${totalPages} pages extracted successfully`)
  } else {
    if (summary.successfulPages > 0) {
      parts.push(`✓ ${summary.successfulPages} pages extracted successfully`)
    }
    if (summary.poorQualityPages > 0) {
      parts.push(`⚠ ${summary.poorQualityPages} pages with reduced quality`)
    }
    if (summary.failedPages > 0) {
      parts.push(`✗ ${summary.failedPages} pages failed extraction`)
    }
  }
  
  parts.push(`Overall quality: ${overallScore}/100`)
  
  if (problematicPages.length > 0) {
    parts.push(`Problematic pages: ${problematicPages.join(', ')}`)
  }
  
  return parts.join('\n')
}

/**
 * Check if document needs OCR (most pages failed)
 */
export function needsFullOCR(report: DocumentQualityReport): boolean {
  return report.extractionMethod === 'ocr'
}

/**
 * Check if document can benefit from vision fallback
 */
export function needsVisionFallback(report: DocumentQualityReport): boolean {
  return report.extractionMethod === 'hybrid' || report.extractionMethod === 'vision'
}

