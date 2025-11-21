/**
 * useAudioPosition Hook
 * 
 * Manages TTS playback position persistence.
 * Saves and loads position to/from Zustand store and Supabase.
 */

import { useCallback, useRef } from 'react'
import { TTSPosition } from '../store/appStore'
import { supabase } from '../../lib/supabase'

export interface AudioPositionOptions {
  documentId: string | null
  userId: string | null
  currentPage: number
  currentParagraphIndex: number
  playbackMode: 'paragraph' | 'page' | 'continue'
  getCurrentTime: () => number
  saveTTSPosition: (documentId: string, position: TTSPosition) => void
  loadTTSPosition: (documentId: string) => TTSPosition | null
}

export interface AudioPositionControls {
  savePosition: (documentId: string) => Promise<void>
  loadPosition: (documentId: string) => TTSPosition | null
}

export const useAudioPosition = ({
  documentId,
  userId,
  currentPage,
  currentParagraphIndex,
  playbackMode,
  getCurrentTime,
  saveTTSPosition,
  loadTTSPosition
}: AudioPositionOptions): AudioPositionControls => {
  const isSavingRef = useRef(false)
  
  // Save current playback position
  const savePosition = useCallback(async (docId: string) => {
    if (!docId || isSavingRef.current) return
    
    isSavingRef.current = true
    
    try {
      const position: TTSPosition = {
        page: currentPage,
        paragraphIndex: currentParagraphIndex ?? 0,
        timestamp: Date.now(),
        mode: playbackMode,
        progressSeconds: getCurrentTime()
      }
      
      // Validate position data
      if (position.page < 1 || !position.mode) {
        console.warn('useAudioPosition: Invalid position data, skipping save', position)
        return
      }
      
      // Save to Zustand store (immediate)
      saveTTSPosition(docId, position)
      
      // Save to database (async, for persistence across sessions)
      if (userId) {
        try {
          await supabase
            .from('tts_positions')
            .upsert({
              user_id: userId,
              book_id: docId,
              page: position.page,
              paragraph_index: position.paragraphIndex,
              mode: position.mode,
              progress_seconds: position.progressSeconds,
              updated_at: new Date().toISOString()
            })
          
          console.log('useAudioPosition: Position saved to database', position)
        } catch (dbError) {
          console.error('useAudioPosition: Failed to save position to database:', dbError)
          // Don't throw - local save (Zustand) already succeeded
        }
      }
    } finally {
      isSavingRef.current = false
    }
  }, [userId, currentPage, currentParagraphIndex, playbackMode, getCurrentTime, saveTTSPosition])
  
  // Load saved position
  const loadPosition = useCallback((docId: string): TTSPosition | null => {
    if (!docId) return null
    
    // Try to load from Zustand store first
    const position = loadTTSPosition(docId)
    
    if (position) {
      console.log('useAudioPosition: Loaded position from store', position)
      return position
    }
    
    // If not in store, we could load from database here
    // but that's async, so we'll handle it in a useEffect in the parent
    return null
  }, [loadTTSPosition])
  
  return {
    savePosition,
    loadPosition
  }
}

