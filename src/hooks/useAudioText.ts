/**
 * useAudioText Hook
 * 
 * Handles intelligent text selection for TTS playback.
 * Determines whether to use original pageTexts or optimized cleanedPageTexts
 * based on Reading Mode state and availability.
 */

import { useMemo, useCallback } from 'react'
import { Document } from '../store/appStore'

export interface AudioTextOptions {
  document: Document | null
  isReadingMode: boolean
  currentPage: number
  currentParagraphIndex: number
  paragraphs: string[]
}

export interface AudioTextResult {
  // Normalized text arrays (always arrays, never undefined)
  pageTexts: string[]
  cleanedPageTexts: string[]
  
  // Text retrieval functions
  getCurrentParagraphText: () => string
  getCurrentPageText: () => string
  getAllRemainingText: () => string
  getTextForMode: (mode: 'paragraph' | 'page' | 'continue') => string
  
  // Metadata
  isUsingCleanedText: boolean
  sourceType: 'cleanedPageTexts' | 'pageTexts' | 'content'
}

export const useAudioText = ({
  document,
  isReadingMode,
  currentPage,
  currentParagraphIndex,
  paragraphs
}: AudioTextOptions): AudioTextResult => {
  
  // CRITICAL: Safe destructuring with defaults - guarantees arrays are always arrays
  const { 
    pageTexts: safePageTexts = [], 
    cleanedPageTexts: safeCleanedPageTexts = [] 
  } = document || {}
  
  // CRITICAL: Use array lengths (primitives) for dependency tracking
  const pageTextsLength = (Array.isArray(safePageTexts) ? safePageTexts.length : 0) || 0
  const cleanedPageTextsLength = (Array.isArray(safeCleanedPageTexts) ? safeCleanedPageTexts.length : 0) || 0
  
  // Normalize to always be arrays
  const normalizedPageTexts = useMemo(() => {
    return Array.isArray(safePageTexts) ? safePageTexts : []
  }, [pageTextsLength])
  
  const normalizedCleanedPageTexts = useMemo(() => {
    return Array.isArray(safeCleanedPageTexts) ? safeCleanedPageTexts : []
  }, [cleanedPageTextsLength])
  
  // Determine if we should use cleaned text
  const hasCleanedTexts = useMemo(() => {
    return isReadingMode && 
      normalizedCleanedPageTexts.length > 0 &&
      normalizedCleanedPageTexts.some(text => text !== null && text !== undefined && text.length > 0)
  }, [isReadingMode, cleanedPageTextsLength])
  
  const isUsingCleanedText = hasCleanedTexts
  const sourceTexts = isUsingCleanedText ? normalizedCleanedPageTexts : normalizedPageTexts
  const sourceType: 'cleanedPageTexts' | 'pageTexts' | 'content' = 
    isUsingCleanedText ? 'cleanedPageTexts' : 
    normalizedPageTexts.length > 0 ? 'pageTexts' : 'content'
  
  // Get text for current paragraph
  const getCurrentParagraphText = useCallback((): string => {
    // In reading mode, check if we have cleaned text for this page
    if (isReadingMode && normalizedCleanedPageTexts.length > 0) {
      const cleanedText = normalizedCleanedPageTexts[currentPage - 1]
      if (cleanedText && cleanedText !== null && cleanedText !== undefined && cleanedText.length > 0) {
        // If we have cleaned text for this page, use paragraphs from it
        // (paragraphs are already split from cleaned text in the parent component)
        const index = currentParagraphIndex ?? 0
        return paragraphs[index] || paragraphs[0] || ''
      }
    }
    
    // Fallback to original page text
    if (normalizedPageTexts.length > 0) {
      const rawPageText = normalizedPageTexts[currentPage - 1]
      if (rawPageText) {
        return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
      }
    }
    
    // Last resort: use content or paragraph from array
    const index = currentParagraphIndex ?? 0
    return paragraphs[index] || paragraphs[0] || document?.content || ''
  }, [paragraphs, currentParagraphIndex, document, currentPage, isReadingMode, pageTextsLength, cleanedPageTextsLength])
  
  // Get text for current page
  const getCurrentPageText = useCallback((): string => {
    // In reading mode, prioritize cleaned text if available
    if (isReadingMode && 
        normalizedCleanedPageTexts.length > 0 &&
        currentPage - 1 < normalizedCleanedPageTexts.length) {
      const cleanedText = normalizedCleanedPageTexts[currentPage - 1]
      if (cleanedText && cleanedText !== null && cleanedText !== undefined && cleanedText.length > 0) {
        console.log('🔍 useAudioText: Using cleaned text for page', currentPage)
        return typeof cleanedText === 'string' ? cleanedText : String(cleanedText || '')
      }
    }
    
    // Fallback to original page text
    if (normalizedPageTexts.length > 0) {
      const rawPageText = normalizedPageTexts[currentPage - 1]
      if (rawPageText) {
        console.log('🔍 useAudioText: Using original text for page', currentPage)
        return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
      }
    }
    return ''
  }, [document, currentPage, isReadingMode, pageTextsLength, cleanedPageTextsLength])
  
  // Get all remaining text (for continue to end mode)
  const getAllRemainingText = useCallback((): string => {
    // In reading mode, prioritize cleaned text if available
    if (isReadingMode && normalizedCleanedPageTexts.length > 0) {
      const remainingCleanedPages = normalizedCleanedPageTexts.slice(currentPage - 1)
      const cleanedText = remainingCleanedPages
        .map((p, index) => {
          // Use cleaned text if available, fallback to original
          if (p) {
            return typeof p === 'string' ? p : String(p || '')
          } else {
            // Fallback to original text for this page
            const originalPage = normalizedPageTexts[currentPage - 1 + index]
            return originalPage ? (typeof originalPage === 'string' ? originalPage : String(originalPage || '')) : ''
          }
        })
        .filter(p => p.length > 0)
        .join('\n\n')
      
      if (cleanedText) {
        return cleanedText
      }
    }
    
    // Fallback to original page texts
    if (normalizedPageTexts.length > 0) {
      const remainingPages = normalizedPageTexts.slice(currentPage - 1)
      return remainingPages
        .map(p => typeof p === 'string' ? p : String(p || ''))
        .filter(p => p.length > 0)
        .join('\n\n')
    }
    return ''
  }, [document, currentPage, isReadingMode, pageTextsLength, cleanedPageTextsLength])
  
  // Get text based on playback mode
  const getTextForMode = useCallback((mode: 'paragraph' | 'page' | 'continue'): string => {
    if (mode === 'paragraph') {
      return getCurrentParagraphText()
    } else if (mode === 'page') {
      return getCurrentPageText()
    } else {
      return getAllRemainingText()
    }
  }, [getCurrentParagraphText, getCurrentPageText, getAllRemainingText])
  
  return {
    pageTexts: normalizedPageTexts,
    cleanedPageTexts: normalizedCleanedPageTexts,
    getCurrentParagraphText,
    getCurrentPageText,
    getAllRemainingText,
    getTextForMode,
    isUsingCleanedText,
    sourceType
  }
}

