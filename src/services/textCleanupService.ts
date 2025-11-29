import { Document } from '../store/appStore'
import { supabase } from '../../lib/supabase'
import { logger } from './logger'

export interface CleanupPreferences {
  reorganizeParagraphs: boolean
  removeFormulae: boolean
  removeFootnotes: boolean
  removeSideNotes: boolean
  removeHeadersFooters: boolean
  simplifyFormatting: boolean
  reorganizationStyle: 'logical' | 'chronological' | 'topic-based'
  optimizeForTTS: boolean
}

export interface CleanupProgress {
  current: number
  total: number
}

export interface CleanupOptions {
  document: Document
  preferences: CleanupPreferences
  pageNumbers?: number[]
  onProgress?: (progress: CleanupProgress) => void
  userId?: string | null
  existingCleaned?: string[] | null
}

export interface CleanupResult {
  cleanedTexts: string[]
  processedPages: number[]
}

export const TTS_OPTIMIZE_PREFERENCES: CleanupPreferences = Object.freeze({
  reorganizeParagraphs: false,
  removeFormulae: false,
  removeFootnotes: false,
  removeSideNotes: false,
  removeHeadersFooters: false,
  simplifyFormatting: false,
  reorganizationStyle: 'logical',
  optimizeForTTS: true
})

const normalise = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return String(value)
  } catch {
    return ''
  }
}

export const cleanupDocumentText = async ({
  document,
  preferences,
  pageNumbers,
  onProgress,
  userId,
  existingCleaned
}: CleanupOptions): Promise<CleanupResult> => {
  const originalTexts =
    document.pageTexts && document.pageTexts.length > 0
      ? document.pageTexts.map(normalise)
      : document.cleanedPageTexts && document.cleanedPageTexts.length > 0
        ? document.cleanedPageTexts.map(normalise)
        : document.content
          ? [normalise(document.content)]
          : []

  if (originalTexts.length === 0) {
    throw new Error('Document does not contain any extractable text.')
  }

  const totalSegments = originalTexts.length
  const cleanedTexts = existingCleaned && existingCleaned.length === totalSegments
    ? existingCleaned.map(normalise)
    : new Array(totalSegments).fill('') as string[]

  const targetPages = pageNumbers && pageNumbers.length > 0
    ? Array.from(new Set(pageNumbers)).filter((page) => page >= 1 && page <= totalSegments).sort((a, b) => a - b)
    : Array.from({ length: totalSegments }, (_, index) => index + 1)

  if (targetPages.length === 0) {
    throw new Error('No valid pages selected for cleanup.')
  }

  const processedPages: number[] = []

  // Use a sliding window approach with constant concurrency
  // This maintains a pool of concurrent requests rather than waiting for entire batches
  // MAX_CONCURRENT controls how many API calls run simultaneously
  const MAX_CONCURRENT = 15 // Increased from batch size of 5 for much better performance
  
  const processPage = async (pageNumber: number, arrayIndex: number, globalIndex: number): Promise<void> => {
    const originalText = originalTexts[arrayIndex] ?? ''

    if (!originalText.trim()) {
      cleanedTexts[arrayIndex] = originalText
      processedPages.push(pageNumber)
      onProgress?.({ current: globalIndex + 1, total: targetPages.length })
      return
    }

    try {
      const response = await fetch('/api/text/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: originalText,
          preferences
        })
      })

      if (!response.ok) {
        throw new Error(`Cleanup API error: ${response.status}`)
      }

      const payload = await response.json() as { cleanedText?: string; success?: boolean }
      cleanedTexts[arrayIndex] = normalise(payload.cleanedText && payload.cleanedText.length > 0 ? payload.cleanedText : originalText)
      processedPages.push(pageNumber)
      onProgress?.({ current: globalIndex + 1, total: targetPages.length })
    } catch (error) {
      logger.error('Text cleanup failed', { component: 'textCleanupService', pageNumber }, error as Error)
      cleanedTexts[arrayIndex] = originalText
      processedPages.push(pageNumber)
      onProgress?.({ current: globalIndex + 1, total: targetPages.length })
    }
  }

  // Sliding window: maintain MAX_CONCURRENT concurrent requests
  // As soon as one completes, start the next one
  let currentIndex = 0
  const allPromises: Promise<void>[] = []
  
  const startNext = (): Promise<void> => {
    if (currentIndex >= targetPages.length) {
      return Promise.resolve()
    }
    
    const pageNumber = targetPages[currentIndex]
    const arrayIndex = pageNumber - 1
    const globalIndex = currentIndex
    currentIndex++
    
    return processPage(pageNumber, arrayIndex, globalIndex).then(() => {
      // Start next page as soon as this one completes
      return startNext()
    }).catch(() => {
      // Even on error, continue with next page
      return startNext()
    })
  }
  
  // Start initial batch of concurrent requests
  const initialBatch = Math.min(MAX_CONCURRENT, targetPages.length)
  for (let i = 0; i < initialBatch; i++) {
    allPromises.push(startNext())
  }
  
  // Wait for all requests to complete
  await Promise.all(allPromises)
  
  logger.info('Text cleanup completed', { 
    component: 'textCleanupService', 
    totalPages: targetPages.length,
    processedPages: processedPages.length,
    maxConcurrent: MAX_CONCURRENT
  })

  const finalCleanedTexts = cleanedTexts.map((text, index) =>
    text && text.length > 0 ? text : existingCleaned?.[index] ?? originalTexts[index] ?? ''
  )

  if (userId && processedPages.length > 0) {
    try {
      await supabase
        .from('user_books')
        .update({ page_texts_cleaned: finalCleanedTexts })
        .eq('id', document.id)
        .eq('user_id', userId)
    } catch (error) {
      logger.warn('Failed to persist cleaned text to Supabase', { component: 'textCleanupService' }, error as Error)
    }
  }

  return {
    cleanedTexts: finalCleanedTexts,
    processedPages
  }
}

