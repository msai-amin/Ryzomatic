/**
 * Formula Detection Utility
 * 
 * Detects mathematical formulas in text and provides metadata
 * for conversion to LaTeX
 */

export interface DetectedFormula {
  text: string
  startIndex: number
  endIndex: number
  isBlock: boolean // true for display formulas, false for inline
  confidence: number // 0-1
}

/**
 * Enhanced regex patterns for detecting mathematical content
 */
const MATH_PATTERNS = {
  // Greek letters
  greekLetters: /[α-ωΑ-Ω]/g,
  
  // Mathematical operators and symbols
  operators: /[∑∏∫√±×÷≠≈≤≥∞∂∇]/g,
  
  // Superscripts and subscripts (Unicode)
  superscripts: /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]/g,
  subscripts: /[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/g,
  
  // Common math patterns
  fractions: /\d+\/\d+/g,
  exponents: /\^[\d\+\-]+|\^\{[^}]+\}/g,
  
  // Parentheses with equations
  equations: /\([^)]*[=<>≤≥≠≈][^)]*\)/g,
  
  // Variables with subscripts/superscripts in ASCII
  variables: /[a-zA-Z]_\{?[a-zA-Z0-9]+\}?|[a-zA-Z]\^\{?[a-zA-Z0-9\+\-]+\}?/g,
}

/**
 * Detect if a line contains mathematical content
 */
export function containsMath(text: string): boolean {
  // Check for any math patterns
  for (const pattern of Object.values(MATH_PATTERNS)) {
    if (pattern.test(text)) {
      return true
    }
  }
  
  // Check for multiple numbers with operators
  const numbersAndOperators = /\d+\s*[+\-*/=]\s*\d+/
  if (numbersAndOperators.test(text)) {
    return true
  }
  
  return false
}

/**
 * Calculate confidence score for detected formula
 */
function calculateConfidence(text: string): number {
  let score = 0
  let checks = 0
  
  // Check for Greek letters (high confidence)
  if (MATH_PATTERNS.greekLetters.test(text)) {
    score += 0.3
    checks++
  }
  
  // Check for mathematical operators
  if (MATH_PATTERNS.operators.test(text)) {
    score += 0.3
    checks++
  }
  
  // Check for superscripts/subscripts
  if (MATH_PATTERNS.superscripts.test(text) || MATH_PATTERNS.subscripts.test(text)) {
    score += 0.2
    checks++
  }
  
  // Check for fractions or exponents
  if (MATH_PATTERNS.fractions.test(text) || MATH_PATTERNS.exponents.test(text)) {
    score += 0.2
    checks++
  }
  
  // Check for equations
  if (MATH_PATTERNS.equations.test(text)) {
    score += 0.2
    checks++
  }
  
  // Check for variables with subscripts/superscripts
  if (MATH_PATTERNS.variables.test(text)) {
    score += 0.15
    checks++
  }
  
  // Normalize score
  if (checks === 0) return 0
  
  // Boost confidence if multiple indicators present
  const normalizedScore = Math.min(1, score + (checks > 2 ? 0.1 : 0))
  
  return normalizedScore
}

/**
 * Determine if formula should be displayed as block or inline
 */
function isBlockFormula(text: string, context: string): boolean {
  // Block formulas are typically:
  // 1. Longer formulas (> 40 chars)
  // 2. Start on new line with indentation
  // 3. Contain integral, summation, or product symbols
  // 4. Are standalone (not embedded in sentence)
  
  // Check length
  if (text.length > 40) return true
  
  // Check for display-style operators
  if (/[∑∏∫]/.test(text)) return true
  
  // Check if standalone (surrounded by newlines or at start/end)
  const trimmedContext = context.trim()
  const formulaPosition = trimmedContext.indexOf(text)
  
  if (formulaPosition === 0 || formulaPosition === trimmedContext.length - text.length) {
    return true
  }
  
  // Check if preceded by newline and indentation
  const beforeFormula = context.substring(Math.max(0, formulaPosition - 10), formulaPosition)
  if (/\n\s+$/.test(beforeFormula)) {
    return true
  }
  
  return false
}

/**
 * Detect formulas in text
 */
export function detectFormulas(text: string): DetectedFormula[] {
  const formulas: DetectedFormula[] = []
  
  // Split text into lines for better context
  const lines = text.split('\n')
  let currentIndex = 0
  
  for (const line of lines) {
    if (containsMath(line)) {
      // Try to extract the formula portion
      const trimmedLine = line.trim()
      
      // Skip very short lines (likely false positives)
      if (trimmedLine.length < 3) {
        currentIndex += line.length + 1 // +1 for newline
        continue
      }
      
      const confidence = calculateConfidence(trimmedLine)
      
      // Only include if confidence is above threshold
      if (confidence >= 0.3) {
        const startIndex = currentIndex + line.indexOf(trimmedLine)
        const endIndex = startIndex + trimmedLine.length
        
        formulas.push({
          text: trimmedLine,
          startIndex,
          endIndex,
          isBlock: isBlockFormula(trimmedLine, text),
          confidence,
        })
      }
    }
    
    currentIndex += line.length + 1 // +1 for newline
  }
  
  return formulas
}

/**
 * Extract formula context for better conversion
 * Returns surrounding text that might help with interpretation
 */
export function getFormulaContext(text: string, formula: DetectedFormula, contextLength: number = 100): {
  before: string
  after: string
} {
  const beforeStart = Math.max(0, formula.startIndex - contextLength)
  const afterEnd = Math.min(text.length, formula.endIndex + contextLength)
  
  return {
    before: text.substring(beforeStart, formula.startIndex).trim(),
    after: text.substring(formula.endIndex, afterEnd).trim(),
  }
}

/**
 * Merge adjacent or overlapping formulas
 */
export function mergeFormulas(formulas: DetectedFormula[]): DetectedFormula[] {
  if (formulas.length <= 1) return formulas
  
  const merged: DetectedFormula[] = []
  let current = formulas[0]
  
  for (let i = 1; i < formulas.length; i++) {
    const next = formulas[i]
    
    // If formulas are close together (within 5 characters), merge them
    if (next.startIndex - current.endIndex <= 5) {
      current = {
        text: current.text + ' ' + next.text,
        startIndex: current.startIndex,
        endIndex: next.endIndex,
        isBlock: current.isBlock || next.isBlock,
        confidence: Math.max(current.confidence, next.confidence),
      }
    } else {
      merged.push(current)
      current = next
    }
  }
  
  merged.push(current)
  return merged
}

/**
 * Simple hash function for cache keys
 */
export function hashFormula(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

