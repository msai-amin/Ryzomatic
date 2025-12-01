/**
 * Formula Service
 * 
 * Converts mathematical expressions to LaTeX using Gemini AI
 * with intelligent caching and batch processing
 */

import { DetectedFormula, hashFormula } from '../utils/formulaDetector'

interface CachedLatex {
  latex: string
  timestamp: number
  confidence: number
}

interface ConversionResult {
  latex: string
  confidence: number
  fromCache: boolean
}

const CACHE_KEY_PREFIX = 'formula-cache-'
const CACHE_EXPIRY_DAYS = 30
const MAX_CACHE_SIZE_MB = 5
const RATE_LIMIT_MS = 2000 // 30 requests per minute = 2s per request for better performance

class FormulaService {
  private lastRequestTime = 0
  private requestQueue: Array<() => Promise<void>> = []
  private isProcessingQueue = false

  /**
   * Get cached LaTeX for a formula
   */
  getCachedLatex(formulaText: string): string | null {
    try {
      const cacheKey = CACHE_KEY_PREFIX + hashFormula(formulaText)
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const parsedCache: CachedLatex = JSON.parse(cached)
      
      // Check if cache is expired
      const age = Date.now() - parsedCache.timestamp
      const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      
      if (age > maxAge) {
        localStorage.removeItem(cacheKey)
        return null
      }
      
      return parsedCache.latex
    } catch (error) {
      console.warn('Failed to retrieve cached LaTeX:', error)
      return null
    }
  }

  /**
   * Cache LaTeX conversion
   */
  private cacheLatex(formulaText: string, latex: string, confidence: number): void {
    try {
      const cacheKey = CACHE_KEY_PREFIX + hashFormula(formulaText)
      const cacheData: CachedLatex = {
        latex,
        timestamp: Date.now(),
        confidence,
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      
      // Check cache size and clean if necessary
      this.cleanCacheIfNeeded()
    } catch (error) {
      console.warn('Failed to cache LaTeX:', error)
    }
  }

  /**
   * Clean old cache entries if size exceeds limit
   */
  private cleanCacheIfNeeded(): void {
    try {
      // Estimate cache size
      let totalSize = 0
      const cacheEntries: Array<{ key: string; timestamp: number; size: number }> = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          const value = localStorage.getItem(key)
          if (value) {
            const size = value.length * 2 // Approximate bytes (UTF-16)
            totalSize += size
            
            try {
              const parsed: CachedLatex = JSON.parse(value)
              cacheEntries.push({ key, timestamp: parsed.timestamp, size })
            } catch {
              // Invalid entry, remove it
              localStorage.removeItem(key)
            }
          }
        }
      }
      
      // If cache is too large, remove oldest entries
      const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024
      if (totalSize > maxSizeBytes) {
        // Sort by timestamp (oldest first)
        cacheEntries.sort((a, b) => a.timestamp - b.timestamp)
        
        // Remove oldest until under limit
        let removed = 0
        for (const entry of cacheEntries) {
          if (totalSize - removed < maxSizeBytes * 0.8) break // Target 80% of max
          
          localStorage.removeItem(entry.key)
          removed += entry.size
        }
        
        console.log(`Cleaned ${cacheEntries.length} old formula cache entries`)
      }
    } catch (error) {
      console.warn('Failed to clean cache:', error)
    }
  }

  /**
   * Rate limiting: wait before making next request
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastRequestTime = Date.now()
  }

  /**
   * Convert a single formula to LaTeX using Gemini API
   */
  async convertFormulaToLatex(
    formulaText: string,
    context?: { before?: string; after?: string }
  ): Promise<ConversionResult> {
    // Check cache first
    const cached = this.getCachedLatex(formulaText)
    if (cached) {
      return {
        latex: cached,
        confidence: 1.0,
        fromCache: true,
      }
    }

    try {
      // Wait for rate limit
      await this.waitForRateLimit()

      // Build prompt with context
      let prompt = `Convert this mathematical expression to LaTeX code. Return ONLY the LaTeX code without any explanations, markdown formatting, or code blocks.

Expression: ${formulaText}`

      if (context?.before || context?.after) {
        prompt += `\n\nContext:`
        if (context.before) prompt += `\nBefore: "${context.before.substring(context.before.length - 50)}"`
        if (context.after) prompt += `\nAfter: "${context.after.substring(0, 50)}"`
      }

      prompt += `\n\nExamples:
- Input: "x^2 + y^2 = 1" → Output: x^{2} + y^{2} = 1
- Input: "∫ f(x) dx" → Output: \\int f(x) \\, dx
- Input: "∑(i=1 to n) i" → Output: \\sum_{i=1}^{n} i`

      // Call formula conversion API endpoint
      const response = await fetch('/api/utils?action=convert-formula', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'convert-formula',
          message: prompt,
        }),
      })

      if (!response.ok) {
        // Fallback for development when API is not available
        if (response.status === 404 && import.meta.env.DEV) {
          console.warn('Formula conversion API not available in development, using fallback')
          // Simple fallback conversion for common patterns
          let latex = formulaText
          
          // Basic LaTeX conversions
          latex = latex.replace(/\^(\d+)/g, '^{$1}') // x^2 -> x^{2}
          latex = latex.replace(/\^([a-zA-Z])/g, '^{$1}') // x^a -> x^{a}
          latex = latex.replace(/\^\{([^}]+)\}/g, '^{$1}') // Already correct
          latex = latex.replace(/\_(\d+)/g, '_{$1}') // x_2 -> x_{2}
          latex = latex.replace(/\_([a-zA-Z])/g, '_{$1}') // x_a -> x_{a}
          latex = latex.replace(/\_\{([^}]+)\}/g, '_{$1}') // Already correct
          latex = latex.replace(/\*(\d+)/g, ' \\cdot $1') // 2*3 -> 2 \cdot 3
          latex = latex.replace(/\*\*/g, '^') // ** -> ^
          latex = latex.replace(/\//g, ' \\div ') // / -> \div
          latex = latex.replace(/\+\+/g, ' \\pm ') // ++ -> \pm
          latex = latex.replace(/\-\-/g, ' \\mp ') // -- -> \mp
          latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}') // sqrt(x) -> \sqrt{x}
          latex = latex.replace(/sum\(/g, '\\sum_{') // sum( -> \sum_{
          latex = latex.replace(/int\(/g, '\\int_{') // int( -> \int_{
          latex = latex.replace(/pi/g, '\\pi') // pi -> \pi
          latex = latex.replace(/alpha/g, '\\alpha') // alpha -> \alpha
          latex = latex.replace(/beta/g, '\\beta') // beta -> \beta
          latex = latex.replace(/gamma/g, '\\gamma') // gamma -> \gamma
          latex = latex.replace(/delta/g, '\\delta') // delta -> \delta
          latex = latex.replace(/epsilon/g, '\\epsilon') // epsilon -> \epsilon
          latex = latex.replace(/theta/g, '\\theta') // theta -> \theta
          latex = latex.replace(/lambda/g, '\\lambda') // lambda -> \lambda
          latex = latex.replace(/mu/g, '\\mu') // mu -> \mu
          latex = latex.replace(/sigma/g, '\\sigma') // sigma -> \sigma
          latex = latex.replace(/tau/g, '\\tau') // tau -> \tau
          latex = latex.replace(/phi/g, '\\phi') // phi -> \phi
          latex = latex.replace(/omega/g, '\\omega') // omega -> \omega
          
          return {
            latex,
            confidence: 0.7,
            fromCache: false,
          }
        }
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = await response.json()
      let latex = data.response || formulaText

      // Clean up the response
      latex = this.cleanLatexResponse(latex)

      // Cache the result
      this.cacheLatex(formulaText, latex, 0.9)

      return {
        latex,
        confidence: 0.9,
        fromCache: false,
      }
    } catch (error) {
      console.error('Failed to convert formula to LaTeX:', error)
      
      // Fallback: return original text
      return {
        latex: formulaText,
        confidence: 0.3,
        fromCache: false,
      }
    }
  }

  /**
   * Clean LaTeX response from AI
   */
  private cleanLatexResponse(latex: string): string {
    // Remove markdown code blocks
    latex = latex.replace(/```latex\n?/g, '').replace(/```\n?/g, '')
    
    // Remove explanatory text (common patterns)
    latex = latex.replace(/^(LaTeX code:|Output:|Result:)\s*/i, '')
    latex = latex.replace(/\n.*explanation.*/gi, '')
    
    // Trim whitespace
    latex = latex.trim()
    
    // If still contains multiple lines, take the first substantial line
    if (latex.includes('\n')) {
      const lines = latex.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (lines.length > 0) {
        latex = lines[0]
      }
    }
    
    return latex
  }

  /**
   * Convert multiple formulas with batch processing
   */
  async convertMultipleFormulas(
    formulas: DetectedFormula[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, ConversionResult>> {
    const results = new Map<string, ConversionResult>()
    
    // Process formulas in smaller batches to avoid overwhelming the API
    const batchSize = 5
    const batches = []
    for (let i = 0; i < formulas.length; i += batchSize) {
      batches.push(formulas.slice(i, i + batchSize))
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (formula) => {
        try {
          const result = await this.convertFormulaToLatex(formula.text)
          return { formula: formula.text, result }
        } catch (error) {
          console.error(`Failed to convert formula "${formula.text}":`, error)
          return {
            formula: formula.text,
            result: {
              latex: formula.text,
              confidence: 0.3,
              fromCache: false,
            }
          }
        }
      })
      
      // Wait for all formulas in this batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Store results
      batchResults.forEach(({ formula, result }) => {
        results.set(formula, result)
      })
      
      // Update progress
      if (onProgress) {
        onProgress(results.size, formulas.length)
      }
      
      // Small delay between batches to be respectful to the API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    count: number
    totalSize: number
    oldestEntry: number | null
  } {
    let count = 0
    let totalSize = 0
    let oldestTimestamp: number | null = null

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          count++
          totalSize += value.length * 2

          try {
            const parsed: CachedLatex = JSON.parse(value)
            if (!oldestTimestamp || parsed.timestamp < oldestTimestamp) {
              oldestTimestamp = parsed.timestamp
            }
          } catch {
            // Invalid entry
          }
        }
      }
    }

    return {
      count,
      totalSize,
      oldestEntry: oldestTimestamp,
    }
  }

  /**
   * Clear all cached formulas
   */
  clearCache(): void {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key)
      }
    }

    keys.forEach(key => localStorage.removeItem(key))
    console.log(`Cleared ${keys.length} cached formulas`)
  }
}

// Export singleton instance
export const formulaService = new FormulaService()

// Export helper functions
export async function convertFormulaToLatex(
  formulaText: string,
  context?: { before?: string; after?: string }
): Promise<ConversionResult> {
  return formulaService.convertFormulaToLatex(formulaText, context)
}

export async function convertMultipleFormulas(
  formulas: DetectedFormula[],
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, ConversionResult>> {
  return formulaService.convertMultipleFormulas(formulas, onProgress)
}

export function getCachedLatex(formulaText: string): string | null {
  return formulaService.getCachedLatex(formulaText)
}

export function getCacheStats() {
  return formulaService.getCacheStats()
}

export function clearFormulaCache() {
  return formulaService.clearCache()
}

