/**
 * useAudioPlayer Hook
 * 
 * Manages TTS playback state and controls.
 * Handles play/pause/stop/seek operations and integrates with TTSManager.
 */

import { useState, useCallback, useRef } from 'react'
import { ttsManager } from '../services/ttsManager'
import { TTSState } from '../store/appStore'
import { ttsCacheService, TTSCacheQuery } from '../services/ttsCacheService'

export interface AudioPlayerOptions {
  tts: TTSState
  updateTTS: (updates: Partial<TTSState>) => void
  documentId: string | null
  userId: string | null
  currentPage: number
  voiceName: string
  rate: number
  pitch: number
  onPositionSave?: (documentId: string) => Promise<void>
}

export interface AudioPlayerControls {
  // State
  isProcessing: boolean
  currentTime: number
  duration: number
  
  // Controls
  play: (text: string, mode: 'paragraph' | 'page' | 'continue') => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => void
  seek: (time: number) => void
  
  // Callbacks
  handlePlayPause: () => Promise<void>
  handleStop: () => void
  handleNextParagraph: () => void
  handlePreviousParagraph: () => void
}

export const useAudioPlayer = ({
  tts,
  updateTTS,
  documentId,
  userId,
  currentPage,
  voiceName,
  rate,
  pitch,
  onPositionSave
}: AudioPlayerOptions): AudioPlayerControls => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  const lastClickTimeRef = useRef<number>(0)
  
  // Play audio with caching support
  const play = useCallback(async (text: string, mode: 'paragraph' | 'page' | 'continue') => {
    if (!text.trim()) {
      console.warn('useAudioPlayer: No text available for playback')
      return
    }
    
    setIsProcessing(true)
    
    try {
      // Check cache first if available
      let cachedAudio: ArrayBuffer | null = null
      
      if (documentId) {
        const cacheQuery: TTSCacheQuery = {
          bookId: documentId,
          text,
          scopeType: mode === 'paragraph' ? 'paragraph' : mode === 'page' ? 'page' : 'document',
          pageNumber: currentPage,
          paragraphIndex: mode === 'paragraph' ? tts.currentParagraphIndex : undefined,
          voiceSettings: {
            voiceName: voiceName || 'default',
            speakingRate: rate,
            pitch: pitch,
            provider: 'google-cloud'
          }
        }
        
        cachedAudio = await ttsCacheService.getCachedAudio(cacheQuery)
      }
      
      updateTTS({ isPlaying: true, isPaused: false })
      
      await ttsManager.speak(
        text,
        // onEnd callback
        () => {
          if (documentId && onPositionSave) {
            onPositionSave(documentId)
          }
          updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
          
          // Auto-advance if enabled and in paragraph mode
          if (tts.autoAdvanceParagraph && mode === 'paragraph') {
            handleNextParagraph()
          }
        },
        // onWord callback
        (word, charIndex) => {
          const safeText = typeof text === 'string' ? text : String(text || '')
          const words = safeText.slice(0, charIndex + 1).split(/\s+/)
          const wordIndex = words.length - 1
          updateTTS({ currentWordIndex: wordIndex })
        }
      )
      
      setIsProcessing(false)
    } catch (error) {
      console.error('useAudioPlayer: TTS Error:', error)
      updateTTS({ isPlaying: false, isPaused: false })
      setIsProcessing(false)
    }
  }, [documentId, userId, currentPage, voiceName, rate, pitch, tts.currentParagraphIndex, tts.autoAdvanceParagraph, updateTTS, onPositionSave])
  
  // Pause playback
  const pause = useCallback(async () => {
    if (documentId && onPositionSave) {
      await onPositionSave(documentId)
    }
    ttsManager.pause()
    updateTTS({ isPlaying: false, isPaused: true })
  }, [documentId, updateTTS, onPositionSave])
  
  // Resume playback
  const resume = useCallback(async () => {
    try {
      await ttsManager.resume()
      updateTTS({ isPlaying: true, isPaused: false })
    } catch (error) {
      console.error('useAudioPlayer: Failed to resume playback:', error)
      updateTTS({ isPlaying: false, isPaused: false })
    }
  }, [updateTTS])
  
  // Stop playback
  const stop = useCallback(() => {
    ttsManager.stop()
    updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
  }, [updateTTS])
  
  // Seek to specific time
  const seek = useCallback((time: number) => {
    // TTSManager doesn't support seeking yet, but we can add it
    console.log('useAudioPlayer: Seek not yet implemented', time)
  }, [])
  
  // Handle play/pause toggle
  const handlePlayPause = useCallback(async () => {
    const now = Date.now()
    
    // Debounce rapid clicks
    if (now - lastClickTimeRef.current < 300) {
      return
    }
    
    lastClickTimeRef.current = now
    
    if (isProcessing) {
      return
    }
    
    if (tts.isPlaying || ttsManager.isSpeaking()) {
      await pause()
    } else if (tts.isPaused || ttsManager.isPausedState()) {
      await resume()
    }
    // Note: Starting new playback is handled by the parent component
    // because it needs to know the playback mode and get the text
  }, [isProcessing, tts.isPlaying, tts.isPaused, pause, resume])
  
  // Handle stop
  const handleStop = useCallback(() => {
    stop()
  }, [stop])
  
  // Handle next paragraph
  const handleNextParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex < tts.paragraphs.length - 1) {
      updateTTS({ currentParagraphIndex: currentIndex + 1 })
      
      // If playing and auto-advance enabled, restart playback
      // (This will be handled by the parent component)
    }
  }, [tts.currentParagraphIndex, tts.paragraphs.length, updateTTS])
  
  // Handle previous paragraph
  const handlePreviousParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex > 0) {
      updateTTS({ currentParagraphIndex: currentIndex - 1 })
      
      // If playing, restart playback
      // (This will be handled by the parent component)
    }
  }, [tts.currentParagraphIndex, updateTTS])
  
  return {
    isProcessing,
    currentTime,
    duration,
    play,
    pause,
    resume,
    stop,
    seek,
    handlePlayPause,
    handleStop,
    handleNextParagraph,
    handlePreviousParagraph
  }
}

