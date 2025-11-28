import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore, Voice, TTSPosition } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { ttsManagerWithQueue } from '../services/ttsManagerWithQueue'
import { createSegmentsFromParagraphs } from '../services/ttsQueue'
import { AudioSettingsPanel } from './AudioSettingsPanel'
import { ttsCacheService, TTSCacheQuery } from '../services/ttsCacheService'
import { supabase } from '../../lib/supabase'
import { Tooltip } from './Tooltip'
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  ZapOff,
  X
} from 'lucide-react'

interface AudioWidgetProps {
  className?: string
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ className = '' }) => {
  // Version marker to verify live bundle
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔊 AudioWidget version:', 'v5-always-render-debug');
      console.log('🔊 AudioWidget: Mounted at ThemedApp level');
    }
  }, []);
  const {
    tts,
    updateTTS,
    currentDocument,
    pdfViewer,
    user,
    saveTTSPosition,
    loadTTSPosition,
    isRightSidebarOpen,
    rightSidebarWidth,
    audioWidgetPosition,
    setAudioWidgetPosition,
    audioWidgetVisible,
    setAudioWidgetVisible
  } = useAppStore()
  
  // Debug: Log rendering state - ALWAYS log, even if no document
  useEffect(() => {
    console.log('🔊 AudioWidget: Render state', {
      hasDocument: !!currentDocument,
      documentId: currentDocument?.id || 'NO_DOCUMENT',
      documentName: currentDocument?.name || 'NO_DOCUMENT',
      readingMode: pdfViewer.readingMode,
      hasPageTexts: !!currentDocument?.pageTexts,
      hasCleanedPageTexts: !!currentDocument?.cleanedPageTexts,
      pageTextsLength: currentDocument?.pageTexts?.length || 0,
      cleanedPageTextsLength: currentDocument?.cleanedPageTexts?.length || 0,
      isVisible: !!currentDocument,
      willRender: !!currentDocument
    });
  }, [currentDocument?.id, pdfViewer.readingMode, currentDocument?.pageTexts?.length, currentDocument?.cleanedPageTexts?.length]);
  
  // CRITICAL: Normalize IDs to prevent React comparison error
  const normalizedDocumentId = currentDocument?.id ?? ''
  const normalizedUserId = user?.id ?? ''
  
  // CRITICAL FIX: Safe destructuring with defaults - guarantees arrays are always arrays
  // Level 1 Guard: Default currentDocument to {} if null/undefined
  // Level 2 Guard: Default pageTexts and cleanedPageTexts to [] if missing
  // This ensures React's dependency comparison never accesses .length on undefined
  const { 
    pageTexts: safePageTexts = [], 
    cleanedPageTexts: safeCleanedPageTexts = [] 
  } = currentDocument || {}
  
  // CRITICAL: Use array lengths (primitives) instead of arrays in dependency arrays
  // React's 'co' function crashes when arrays are used in dependency arrays and
  // the previous dependency array is undefined. Use primitive numbers (lengths) instead.
  // CRITICAL: Ensure length is always a number, never undefined
  const pageTextsLengthPrimitive = (Array.isArray(safePageTexts) ? safePageTexts.length : 0) || 0
  const cleanedPageTextsLengthPrimitive = (Array.isArray(safeCleanedPageTexts) ? safeCleanedPageTexts.length : 0) || 0
  
  // CRITICAL FIX: Normalize pageTexts and cleanedPageTexts to always be arrays
  // React's dependency comparison function accesses .length on arrays, so undefined causes errors
  // Use useMemo to create stable references that are always arrays
  // CRITICAL: Use length primitives in dependency arrays, not arrays themselves
  const normalizedPageTexts = useMemo(() => {
    return Array.isArray(safePageTexts) ? safePageTexts : []
  }, [pageTextsLengthPrimitive]) // Use length (number) instead of array
  
  const normalizedCleanedPageTexts = useMemo(() => {
    return Array.isArray(safeCleanedPageTexts) ? safeCleanedPageTexts : []
  }, [cleanedPageTextsLengthPrimitive]) // Use length (number) instead of array
  
  // CRITICAL: Normalize currentDocument to ensure all array properties are always arrays
  // This prevents React's dependency comparison from accessing .length on undefined
  // We create a normalized version that's safe to use in dependency arrays
  // CRITICAL: Use length primitives instead of arrays in dependency array
  const normalizedDocument = useMemo(() => {
    if (!currentDocument) return null
    return {
      ...currentDocument,
      pageTexts: normalizedPageTexts,
      cleanedPageTexts: normalizedCleanedPageTexts
    }
  }, [currentDocument, pageTextsLengthPrimitive, cleanedPageTextsLengthPrimitive]) // Use length (number) instead of arrays
  
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetSizeRef = useRef({ width: 280, height: 160 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') {
      return audioWidgetPosition
    }
    if (audioWidgetPosition.x !== 0 || audioWidgetPosition.y !== 0) {
      return audioWidgetPosition
    }
    const viewportWidth = window.innerWidth || 1200
    const viewportHeight = window.innerHeight || 800
    return {
      x: Math.max(16, viewportWidth - widgetSizeRef.current.width - 24),
      y: Math.max(16, viewportHeight - widgetSizeRef.current.height - 24)
    }
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pauseRequestedDuringBuffering, setPauseRequestedDuringBuffering] = useState(false)
  const pauseRequestedDuringBufferingRef = useRef(false)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('audioWidgetExpanded')
    return stored === null ? true : stored === 'true'
  })
  const [playbackMode, setPlaybackMode] = useState<'paragraph' | 'page' | 'continue'>('paragraph')
  const [gaplessMode, setGaplessMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem('audioWidgetGaplessMode')
    return stored === 'true'
  })
  
  // Persist expanded/collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('audioWidgetExpanded', String(isExpanded))
    }
  }, [isExpanded])
  
  // Persist gapless mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('audioWidgetGaplessMode', String(gaplessMode))
    }
  }, [gaplessMode])
  const [savedPosition, setSavedPosition] = useState<TTSPosition | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const previousDocumentIdRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)
  const playbackStartedRef = useRef<boolean>(false)

  const clampPosition = useCallback(
    (pos: { x: number; y: number }) => {
      if (typeof window === 'undefined') {
        return pos
      }
      const viewportWidth = window.innerWidth || 1200
      const viewportHeight = window.innerHeight || 800
      const measuredWidth = widgetRef.current?.offsetWidth ?? widgetSizeRef.current.width
      const measuredHeight = widgetRef.current?.offsetHeight ?? widgetSizeRef.current.height
      const sidebarGuard = isRightSidebarOpen ? (rightSidebarWidth || 280) + 24 : 24
      const maxX = Math.max(16, viewportWidth - measuredWidth - sidebarGuard)
      const maxY = Math.max(16, viewportHeight - measuredHeight - 24)
      const clampedX = Math.min(Math.max(pos.x, 16), maxX)
      const clampedY = Math.min(Math.max(pos.y, 16), maxY)
      return { x: clampedX, y: clampedY }
    },
    [isRightSidebarOpen, rightSidebarWidth]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const measure = () => {
      if (!widgetRef.current) return
      widgetSizeRef.current = {
        width: widgetRef.current.offsetWidth || widgetSizeRef.current.width,
        height: widgetRef.current.offsetHeight || widgetSizeRef.current.height
      }
    }
    measure()
  }, [])

  // Ref to prevent infinite loops from position updates
  const isUpdatingPositionRef = useRef(false)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isUpdatingPositionRef.current) return // Prevent infinite loops
    if (audioWidgetPosition.x === 0 && audioWidgetPosition.y === 0) {
      isUpdatingPositionRef.current = true
      const widgetWidth = widgetRef.current?.offsetWidth ?? widgetSizeRef.current.width
      const widgetHeight = widgetRef.current?.offsetHeight ?? widgetSizeRef.current.height
      const sidebarGuard = isRightSidebarOpen ? (rightSidebarWidth || 280) + 24 : 24
      const defaultPos = {
        x: (window.innerWidth || 1200) - widgetWidth - sidebarGuard,
        y: (window.innerHeight || 800) - widgetHeight - 24
      }
      const clamped = clampPosition(defaultPos)
      setPosition(clamped)
      // Only update store if position actually changed
      if (Math.abs(clamped.x - audioWidgetPosition.x) > 0.5 || Math.abs(clamped.y - audioWidgetPosition.y) > 0.5) {
        setAudioWidgetPosition(clamped)
      }
      isUpdatingPositionRef.current = false
    }
  }, [audioWidgetPosition.x, audioWidgetPosition.y, clampPosition, isRightSidebarOpen, rightSidebarWidth, setAudioWidgetPosition])

  useEffect(() => {
    if (isDragging) return
    if (isUpdatingPositionRef.current) return // Prevent infinite loops
    if (audioWidgetPosition.x === 0 && audioWidgetPosition.y === 0) return
    setPosition(prev => {
      if (Math.abs(prev.x - audioWidgetPosition.x) < 0.5 && Math.abs(prev.y - audioWidgetPosition.y) < 0.5) {
        return prev
      }
      return clampPosition(audioWidgetPosition)
    })
  }, [audioWidgetPosition.x, audioWidgetPosition.y, clampPosition, isDragging])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    if (!widgetRef.current) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      widgetSizeRef.current = {
        width: width || widgetSizeRef.current.width,
        height: height || widgetSizeRef.current.height
      }
      setPosition(prev => {
        const clamped = clampPosition(prev)
        if (Math.abs(clamped.x - prev.x) < 0.5 && Math.abs(clamped.y - prev.y) < 0.5) {
          return prev
        }
        return clamped
      })
    })

    observer.observe(widgetRef.current)
    return () => observer.disconnect()
  }, [clampPosition])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      if (isUpdatingPositionRef.current) return // Prevent infinite loops
      isUpdatingPositionRef.current = true
      setPosition(prev => {
        const clamped = clampPosition(prev)
        if (Math.abs(clamped.x - prev.x) < 0.5 && Math.abs(clamped.y - prev.y) < 0.5) {
          isUpdatingPositionRef.current = false
          return prev
        }
        // Only update store if position actually changed significantly
        if (Math.abs(clamped.x - prev.x) > 1 || Math.abs(clamped.y - prev.y) > 1) {
          setAudioWidgetPosition(clamped)
        }
        isUpdatingPositionRef.current = false
        return clamped
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampPosition, setAudioWidgetPosition])

  useEffect(() => {
    if (!widgetRef.current) return
    widgetSizeRef.current = {
      width: widgetRef.current.offsetWidth || widgetSizeRef.current.width,
      height: widgetRef.current.offsetHeight || widgetSizeRef.current.height
    }
    setPosition(prev => clampPosition(prev))
  }, [isExpanded, clampPosition])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isDragging) return
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
    }
  }, [isDragging])

  useEffect(() => {
    if (isUpdatingPositionRef.current) return // Prevent infinite loops
    isUpdatingPositionRef.current = true
    setPosition(prev => {
      const clamped = clampPosition(prev)
      if (Math.abs(clamped.x - prev.x) < 0.5 && Math.abs(clamped.y - prev.y) < 0.5) {
        isUpdatingPositionRef.current = false
        return prev
      }
      // Only update store if position actually changed
      if (Math.abs(clamped.x - prev.x) > 1 || Math.abs(clamped.y - prev.y) > 1) {
        setAudioWidgetPosition(clamped)
      }
      isUpdatingPositionRef.current = false
      return clamped
    })
  }, [isRightSidebarOpen, rightSidebarWidth, clampPosition, setAudioWidgetPosition])

  const handlePointerMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging) return
      const rawPosition = {
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y
      }
      setPosition(prev => {
        const clamped = clampPosition(rawPosition)
        if (Math.abs(clamped.x - prev.x) < 0.5 && Math.abs(clamped.y - prev.y) < 0.5) {
          return prev
        }
        return clamped
      })
    },
    [isDragging, clampPosition]
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isDragging) return
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      const rawPosition = {
        x: touch.clientX - dragOffsetRef.current.x,
        y: touch.clientY - dragOffsetRef.current.y
      }
      setPosition(prev => {
        const clamped = clampPosition(rawPosition)
        if (Math.abs(clamped.x - prev.x) < 0.5 && Math.abs(clamped.y - prev.y) < 0.5) {
          return prev
        }
        return clamped
      })
    },
    [isDragging, clampPosition]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    isUpdatingPositionRef.current = true
    setPosition(prev => {
      const clamped = clampPosition(prev)
      // Always update store on drag end
      setAudioWidgetPosition(clamped)
      isUpdatingPositionRef.current = false
      return clamped
    })
  }, [isDragging, clampPosition, setAudioWidgetPosition])

  useEffect(() => {
    if (!isDragging) return

    const pointerMove = (event: MouseEvent) => handlePointerMove(event)
    const pointerUp = () => handlePointerUp()

    document.addEventListener('mousemove', pointerMove)
    document.addEventListener('mouseup', pointerUp)
    document.addEventListener('mouseleave', pointerUp)

    return () => {
      document.removeEventListener('mousemove', pointerMove)
      document.removeEventListener('mouseup', pointerUp)
      document.removeEventListener('mouseleave', pointerUp)
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  useEffect(() => {
    if (!isDragging) return
    const touchMove = (event: TouchEvent) => handleTouchMove(event)
    const touchEnd = () => handlePointerUp()

    document.addEventListener('touchmove', touchMove, { passive: false })
    document.addEventListener('touchend', touchEnd)
    document.addEventListener('touchcancel', touchEnd)

    return () => {
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', touchEnd)
      document.removeEventListener('touchcancel', touchEnd)
    }
  }, [isDragging, handleTouchMove, handlePointerUp])

  const handleWidgetMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select, [data-no-drag]')) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y
    }
  }

  const handleWidgetTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button, input, textarea, select, [data-no-drag]')) {
      return
    }
    const touch = event.touches[0]
    if (!touch) return
    event.preventDefault()
    setIsDragging(true)
    dragOffsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    }
  }

  // Extract paragraphs from current document
  useEffect(() => {
    // CRITICAL: Early return if currentDocument is null/undefined to prevent crashes
    // This prevents accessing properties on null during state transitions
    if (!currentDocument || !currentDocument.id) {
      // Clear paragraphs if no document
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
      return
    }
    
    // CRITICAL: Use optional chaining to prevent crashes if currentDocument becomes null
    console.log('🔍 AudioWidget: Processing document', {
      documentId: currentDocument?.id || 'null',
      hasPageTexts: !!currentDocument?.pageTexts,
      pageTextsLength: currentDocument?.pageTexts?.length || 0,
      hasCleanedPageTexts: !!currentDocument?.cleanedPageTexts,
      cleanedPageTextsLength: currentDocument?.cleanedPageTexts?.length || 0,
      readingMode: pdfViewer.readingMode,
      previousDocumentId: previousDocumentIdRef.current
    });
    
    // CRITICAL: Ensure we're processing the current document, not a stale one
    // If document ID changed but paragraphs extraction hasn't reset yet, wait
    // CRITICAL: Use optional chaining to prevent crashes if currentDocument becomes null
    const currentDocId = currentDocument?.id
    if (previousDocumentIdRef.current && previousDocumentIdRef.current !== currentDocId) {
      console.log('🔍 AudioWidget: Document ID changed, waiting for reset')
      // The document change useEffect will reset paragraphs, so return early here
      return
    }
    
    let text = ''
    
    // In reading mode, prioritize cleaned text if available
    // Check if cleanedPageTexts exists, has length > 0, AND has at least one non-null entry
    // CRITICAL: Use normalized arrays to prevent undefined.length errors
    const hasCleanedTexts = pdfViewer.readingMode && 
      normalizedCleanedPageTexts.length > 0 &&
      normalizedCleanedPageTexts.some(text => text !== null && text !== undefined && text.length > 0)
    
    // In reading mode, if we don't have pageTexts yet, wait for them to load
    // This prevents using old paragraphs from previous document
    if (pdfViewer.readingMode && !hasCleanedTexts && normalizedPageTexts.length === 0) {
      console.log('🔍 AudioWidget: Waiting for pageTexts or cleanedPageTexts in reading mode')
      // Reset paragraphs to empty to clear old ones
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
      return
    }
    
    const useCleanedText = hasCleanedTexts
    // CRITICAL: Use normalized arrays to ensure we never have undefined
    const sourceTexts = useCleanedText ? normalizedCleanedPageTexts : normalizedPageTexts
    const sourceType = useCleanedText ? 'cleanedPageTexts' : 'pageTexts'
    
    // CRITICAL: Use optional chaining to prevent crashes if currentDocument becomes null
    console.log('🔍 AudioWidget: Text source decision', {
      readingMode: pdfViewer.readingMode,
      hasCleanedPageTexts: !!currentDocument?.cleanedPageTexts,
      cleanedPageTextsLength: currentDocument?.cleanedPageTexts?.length || 0,
      hasNonNullCleanedText: currentDocument?.cleanedPageTexts?.some(text => text !== null && text !== undefined && text.length > 0) || false,
      useCleanedText,
      sourceType,
      documentId: currentDocument?.id || 'null'
    })
    
    // Priority: cleanedPageTexts (in reading mode) > pageTexts (for PDFs) > string content (for text files)
    // For PDFs, content is ArrayBuffer (binary data), so we must use pageTexts or cleanedPageTexts
    // CRITICAL: sourceTexts is always an array (normalized), so we can safely check length
    if (sourceTexts.length > 0) {
      console.log(`🔍 AudioWidget: Processing ${sourceType}`, {
        pageTextsTypes: sourceTexts.map((text, i) => ({
          index: i,
          type: typeof text,
          isString: typeof text === 'string',
          value: (String(text).substring(0, 100) + (String(text).length > 100 ? '...' : ''))
        }))
      });
      
      // Ensure all pageTexts elements are strings before joining
      // Filter out null values (pages that don't have cleaned text)
      const safePageTexts = sourceTexts
        .map(pageText => {
          if (pageText === null || pageText === undefined) return null
          return typeof pageText === 'string' ? pageText : String(pageText || '')
        })
        .filter((pageText): pageText is string => pageText !== null && pageText.length > 0)
      
      text = safePageTexts.join('\n\n')
      console.log('🔍 AudioWidget: Joined text', { textType: typeof text, textLength: text.length, sourceType });
    } else if (currentDocument?.content && typeof currentDocument.content === 'string') {
      // Fallback to string content only if pageTexts is not available
      // Check that it's actually a valid string (not "[object ArrayBuffer]")
      // CRITICAL: Use optional chaining to prevent crashes if currentDocument becomes null
      const contentStr = String(currentDocument.content);
      if (contentStr && !contentStr.startsWith('[object ') && contentStr.length > 10) {
        console.log('🔍 AudioWidget: Using string content (no pageTexts available)', {
          contentType: typeof currentDocument.content,
          textLength: contentStr.length
        });
        text = contentStr;
      } else {
        console.warn('🔍 AudioWidget: Content appears to be invalid (likely ArrayBuffer converted to string), skipping');
      }
    }
    
    if (text) {
      // Ensure text is a string before splitting
      const safeText = typeof text === 'string' ? text : String(text || '')
      
      console.log('🔍 AudioWidget: About to split text', {
        originalTextType: typeof text,
        originalTextValue: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        safeTextType: typeof safeText,
        safeTextLength: safeText.length,
        safeTextValue: safeText.substring(0, 200) + (safeText.length > 200 ? '...' : ''),
        isString: typeof safeText === 'string'
      });
      
      // Additional safety check
      if (typeof safeText !== 'string') {
        console.error('🔍 AudioWidget: safeText is not a string!', {
          type: typeof safeText,
          value: safeText,
          constructor: (safeText as any)?.constructor?.name
        });
        return;
      }
      
      // Split by double newlines (paragraph breaks) or periods followed by newlines
      const paragraphs = safeText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      console.log('🔍 AudioWidget: Split successful', {
        paragraphsCount: paragraphs.length,
        paragraphsTypes: paragraphs.map((p, i) => ({ index: i, type: typeof p, value: (String(p).substring(0, 50) + (String(p).length > 50 ? '...' : '')) }))
      });
      
      updateTTS({ paragraphs, currentParagraphIndex: 0 })
      // CRITICAL: Use optional chaining to prevent crashes if currentDocument becomes null
      console.log('🔍 AudioWidget: Paragraphs updated for document', currentDocument?.id || 'null', 'from', sourceType)
    } else {
      // No text available - clear paragraphs
      console.log('🔍 AudioWidget: No text available, clearing paragraphs')
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
    }
  }, [normalizedDocumentId, cleanedPageTextsLengthPrimitive, pageTextsLengthPrimitive, pdfViewer.readingMode, updateTTS]) // Use length (number) instead of arrays

  // Sync store state with TTSManager's actual state periodically
  useEffect(() => {
    const syncState = () => {
      const actualIsSpeaking = ttsManager.isSpeaking()
      const actualIsPaused = ttsManager.isPausedState()
      
      // Sync if there's a mismatch between store and actual state
      if (actualIsSpeaking && !tts.isPlaying && !actualIsPaused) {
        // TTSManager is playing but store says it's not - update store
        updateTTS({ isPlaying: true, isPaused: false })
      } else if (!actualIsSpeaking && tts.isPlaying && !actualIsPaused) {
        // TTSManager is not playing but store says it is - update store
        updateTTS({ isPlaying: false, isPaused: false })
      } else if (actualIsPaused && !tts.isPaused) {
        // TTSManager is paused but store doesn't know - update store
        updateTTS({ isPlaying: false, isPaused: true })
      } else if (!actualIsPaused && tts.isPaused && !actualIsSpeaking) {
        // TTSManager is not paused but store says it is - update store
        updateTTS({ isPlaying: false, isPaused: false })
      }
    }
    
    // Sync state every 500ms
    const interval = setInterval(syncState, 500)
    return () => clearInterval(interval)
  }, [tts.isPlaying, tts.isPaused, updateTTS])

  // Update current time and duration from TTS manager
  useEffect(() => {
    const updateTime = () => {
      if (tts.isPlaying || ttsManager.isPausedState()) {
        const time = ttsManager.getCurrentTime()
        const dur = ttsManager.getDuration()
        setCurrentTime(time)
        setDuration(dur)
      } else if (!ttsManager.isPausedState()) {
        setCurrentTime(0)
        setDuration(0)
      }
    }

    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [tts.isPlaying])

  // CRITICAL FIX: Sync TTS settings from store to TTS manager
  // This ensures AudioSettingsPanel changes are applied to the player
  useEffect(() => {
    const currentProvider = ttsManager.getCurrentProvider()
    if (currentProvider) {
      // Apply all settings from store to TTS manager
      if (tts.voice) {
        ttsManager.setVoice(tts.voice)
      }
      ttsManager.setRate(tts.rate)
      ttsManager.setPitch(tts.pitch)
      ttsManager.setVolume(tts.volume)
      
      console.log('AudioWidget: Synced TTS settings', {
        rate: tts.rate,
        pitch: tts.pitch,
        volume: tts.volume,
        voiceName: tts.voiceName
      })
    }
  }, [tts.rate, tts.pitch, tts.volume, tts.voice, tts.voiceName])

  // Get current paragraph text
  const getCurrentParagraphText = useCallback((): string => {
    if (tts.paragraphs.length === 0) {
      // Fallback to page text if no paragraphs
      const currentPage = pdfViewer.currentPage || 1
      
      // In reading mode, prioritize cleaned text if available
      // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
      if (pdfViewer.readingMode && 
          normalizedCleanedPageTexts.length > 0 &&
          currentPage - 1 < normalizedCleanedPageTexts.length) {
        const cleanedText = normalizedCleanedPageTexts[currentPage - 1]
        if (cleanedText && cleanedText !== null && cleanedText !== undefined && cleanedText.length > 0) {
          return typeof cleanedText === 'string' ? cleanedText : String(cleanedText || '')
        }
      }
      
    // Fallback to original page text
    // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
    if (normalizedPageTexts.length > 0) {
      const rawPageText = normalizedPageTexts[currentPage - 1]
        if (rawPageText) {
          return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
        }
      }
      return currentDocument?.content || ''
    }
    
    const index = tts.currentParagraphIndex ?? 0
    return tts.paragraphs[index] || tts.paragraphs[0] || ''
  }, [tts.paragraphs, tts.currentParagraphIndex, normalizedDocumentId, pdfViewer.currentPage, pdfViewer.readingMode])

  // Get text for page mode
  const getCurrentPageText = useCallback((): string => {
    const currentPage = pdfViewer.currentPage || 1
    
    // In reading mode, prioritize cleaned text if available
    // Check if we have cleaned text for this specific page
    // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
    if (pdfViewer.readingMode && 
        normalizedCleanedPageTexts.length > 0 &&
        currentPage - 1 < normalizedCleanedPageTexts.length) {
      const cleanedText = normalizedCleanedPageTexts[currentPage - 1]
      if (cleanedText && cleanedText !== null && cleanedText !== undefined && cleanedText.length > 0) {
        console.log('🔍 AudioWidget: Using cleaned text for page', currentPage)
        return typeof cleanedText === 'string' ? cleanedText : String(cleanedText || '')
      }
    }
    
    // Fallback to original page text
    // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
    if (normalizedPageTexts.length > 0) {
      const rawPageText = normalizedPageTexts[currentPage - 1]
      if (rawPageText) {
        console.log('🔍 AudioWidget: Using original text for page', currentPage)
        return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
      }
    }
    return ''
  }, [normalizedDocumentId, pdfViewer.currentPage, pdfViewer.readingMode, pageTextsLengthPrimitive, cleanedPageTextsLengthPrimitive]) // Use length (number) instead of arrays

  // Get all remaining text (for continue to end mode)
  const getAllRemainingText = useCallback((): string => {
    const currentPage = pdfViewer.currentPage || 1
    
    // In reading mode, prioritize cleaned text if available
    // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
    if (pdfViewer.readingMode && normalizedCleanedPageTexts.length > 0) {
      const remainingCleanedPages = normalizedCleanedPageTexts.slice(currentPage - 1)
      const cleanedText = remainingCleanedPages
        .map((p, index) => {
          // Use cleaned text if available, fallback to original
          if (p) {
            return typeof p === 'string' ? p : String(p || '')
          } else {
            // Fallback to original text for this page
            // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
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
    // CRITICAL: Use normalized arrays instead of accessing currentDocument directly
    if (normalizedPageTexts.length > 0) {
      const remainingPages = normalizedPageTexts.slice(currentPage - 1)
      return remainingPages
        .map(p => typeof p === 'string' ? p : String(p || ''))
        .filter(p => p.length > 0)
        .join('\n\n')
    }
    return ''
  }, [normalizedDocumentId, pdfViewer.currentPage, pdfViewer.readingMode, pageTextsLengthPrimitive, cleanedPageTextsLengthPrimitive]) // Use length (number) instead of arrays

  // Get text based on playback mode
  const getTextForPlaybackMode = useCallback((mode: 'paragraph' | 'page' | 'continue'): string => {
    if (mode === 'paragraph') {
      return getCurrentParagraphText()
    } else if (mode === 'page') {
      return getCurrentPageText()
    } else {
      return getAllRemainingText()
    }
  }, [getCurrentParagraphText, getCurrentPageText, getAllRemainingText])

  // Save current playback position to store and database
  const saveCurrentPosition = useCallback(async (documentId: string) => {
    if (!documentId || isSavingRef.current) return
    
    isSavingRef.current = true
    
    try {
      const position: TTSPosition = {
        page: pdfViewer.currentPage,
        paragraphIndex: tts.currentParagraphIndex ?? 0,
        timestamp: Date.now(),
        mode: playbackMode,
        progressSeconds: ttsManager.getCurrentTime()
      }
      
      // Validate position data
      if (position.page < 1 || !position.mode) {
        console.warn('AudioWidget: Invalid position data, skipping save', position)
        return
      }
      
      // Save to Zustand store (immediate)
      saveTTSPosition(documentId, position)
      
      // Save to database (async, for persistence across sessions)
      if (user?.id) {
        // Retry logic for database saves
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { error } = await supabase
              .from('user_books')
              .update({ tts_last_position: position })
              .eq('id', documentId)
              .eq('user_id', user.id)
            
            if (!error) break
            
            if (attempt === 2) {
              console.error('AudioWidget: Failed to save TTS position after retries:', error)
              throw error
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch (err) {
            if (attempt === 2) {
              console.error('AudioWidget: Database save error:', err)
            }
          }
        }
      }
    } finally {
      isSavingRef.current = false
    }
  }, [playbackMode, pdfViewer.currentPage, tts.currentParagraphIndex, user, saveTTSPosition])

  // Load saved position from store or database
  const loadSavedPosition = useCallback(async (documentId: string) => {
    if (!documentId) return
    
    // Try Zustand store first
    let position = loadTTSPosition(documentId)
    
    // If not in store, fetch from database
    if (!position && user?.id) {
      try {
        const { data } = await supabase
          .from('user_books')
          .select('tts_last_position')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single()
        
        if (data?.tts_last_position) {
          position = data.tts_last_position as TTSPosition
        }
      } catch (error) {
        console.error('Failed to load TTS position from database:', error)
      }
    }
    
    // Restore position if found
    if (position) {
      setPlaybackMode(position.mode)
      setSavedPosition(position)
      updateTTS({ 
        currentParagraphIndex: position.paragraphIndex 
      })
      // Note: Page is already set by document viewer
    }
  }, [user, updateTTS, loadTTSPosition])

  // Detect document changes and stop audio
  useEffect(() => {
    if (currentDocument?.id !== previousDocumentIdRef.current) {
      // Document switched - stop audio immediately
      if (tts.isPlaying && previousDocumentIdRef.current) {
        console.log('🔄 Document changed - stopping audio')
        
        // Save position before stopping
        saveCurrentPosition(previousDocumentIdRef.current)
        
        // Stop audio
        ttsManager.stop()
        updateTTS({ isPlaying: false, currentWordIndex: null })
      }
      
      // CRITICAL: Reset paragraphs immediately when document changes
      // This ensures old paragraphs don't persist
      updateTTS({ paragraphs: [], currentParagraphIndex: 0, currentWordIndex: null })
      
      // Update ref for next change
      previousDocumentIdRef.current = currentDocument?.id || null
      
      // Load saved position for new document
      if (currentDocument?.id) {
        loadSavedPosition(currentDocument.id)
      }
    }
  }, [normalizedDocumentId, tts.isPlaying, saveCurrentPosition, loadSavedPosition, updateTTS])

  // Auto-save position every 5 seconds while playing
  useEffect(() => {
    if (!tts.isPlaying || !currentDocument?.id) return
    
    const interval = setInterval(() => {
      saveCurrentPosition(currentDocument.id)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [tts.isPlaying, normalizedDocumentId, saveCurrentPosition])

  // Handle stop (declared early to avoid circular dependencies)
  const handleStopRef = useRef<() => void>(() => {})
  
  // Handle next/previous paragraph refs (declared early to avoid circular dependencies)
  // Initialize with no-op functions to prevent "before initialization" errors
  const handleNextParagraphRef = useRef<() => void>(() => {
    console.warn('handleNextParagraph called before initialization')
  })
  const handlePrevParagraphRef = useRef<() => void>(() => {
    console.warn('handlePrevParagraph called before initialization')
  })
  
  // Handle play/pause ref (declared early to avoid circular dependencies)
  const handlePlayPauseRef = useRef<() => Promise<void>>(async () => {
    console.warn('handlePlayPause called before initialization')
  })
  
  const handleStop = useCallback(async () => {
    // Save position before stopping (only if actually playing)
    if (currentDocument?.id && tts.isPlaying) {
      await saveCurrentPosition(currentDocument.id)
    }
    
    ttsManager.stop()
    updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
    setCurrentTime(0)
    setDuration(0)
    setIsProcessing(false)
  }, [updateTTS, normalizedDocumentId, tts.isPlaying, saveCurrentPosition])
  
  // Update refs in useEffect to avoid initialization order issues
  useEffect(() => {
    handleStopRef.current = handleStop
  }, [handleStop])

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTimeRef.current
    
    if (timeSinceLastClick < 500) {
      return
    }
    
    lastClickTimeRef.current = now
    
    // Allow pause during buffering
    if (isProcessing && (tts.isPlaying || ttsManager.isSpeaking())) {
      // User wants to pause during buffering
      // Set flag to pause once buffering completes
      // Buffering will continue in background, but playback will be paused when ready
      pauseRequestedDuringBufferingRef.current = true
      setPauseRequestedDuringBuffering(true)
      if (currentDocument?.id) {
        await saveCurrentPosition(currentDocument.id)
      }
      ttsManager.pause()
      updateTTS({ isPlaying: false, isPaused: true })
      // Don't return - allow buffering to continue, but keep playback paused
      // The speak() promise will continue, but audio will be paused when it starts
      return
    }
    
    // Don't allow starting new playback if already processing
    if (isProcessing && !tts.isPlaying && !ttsManager.isSpeaking()) {
      return
    }
    
    if (tts.isPlaying || ttsManager.isSpeaking()) {
      // Pause (save position)
      if (currentDocument?.id) {
        await saveCurrentPosition(currentDocument.id)
      }
      ttsManager.pause()
      updateTTS({ isPlaying: false, isPaused: true }) // SET PAUSED FLAG
      pauseRequestedDuringBufferingRef.current = false
      setPauseRequestedDuringBuffering(false)
    } else if (tts.isPaused || ttsManager.isPausedState()) { // CHECK STORE PAUSED STATE OR TTS MANAGER STATE
      // Resume
      pauseRequestedDuringBufferingRef.current = false
      setPauseRequestedDuringBuffering(false)
      try {
        await ttsManager.resume()
        updateTTS({ isPlaying: true, isPaused: false }) // CLEAR PAUSED FLAG
      } catch (error) {
        console.error('AudioWidget: Failed to resume playback:', error)
        updateTTS({ isPlaying: false, isPaused: false })
      }
    } else {
      // Start new playback with caching
      setIsProcessing(true)
      
      try {
        // Don't call stop() here - TTSManager.speak() already calls stop() internally
        // Calling it here causes stopRequested flag to be set incorrectly
        updateTTS({ isPlaying: false, isPaused: false }) // Ensure paused is false
        
        const text = getTextForPlaybackMode(playbackMode)
        
        if (text.trim()) {
          // Check if TTS provider is configured before starting playback
          // CRITICAL: Declare currentProvider BEFORE using it to avoid initialization error
          const currentProvider = ttsManager.getCurrentProvider()
          const allProviders = ttsManager.getProviders()
          const configuredProviders = ttsManager.getConfiguredProviders()
          
          // Check cache first if available
          let cachedAudio: ArrayBuffer | null = null
          
          if (currentDocument && currentDocument.id) {
            // Get current provider type for cache query
            const providerType = currentProvider?.type || 'google-cloud'
            
            const cacheQuery: TTSCacheQuery = {
              bookId: currentDocument.id,
              text,
              scopeType: playbackMode === 'paragraph' ? 'paragraph' : playbackMode === 'page' ? 'page' : 'document',
              pageNumber: pdfViewer.currentPage,
              paragraphIndex: playbackMode === 'paragraph' ? tts.currentParagraphIndex : undefined,
              voiceSettings: {
                voiceName: tts.voiceName || 'default',
                speakingRate: tts.rate,
                pitch: tts.pitch,
                provider: providerType as 'google-cloud' | 'azure' // Use current provider
              }
            }
            
            console.log('AudioWidget: Cache query', {
              provider: providerType,
              textLength: text.length,
              playbackMode
            })
            
            cachedAudio = await ttsCacheService.getCachedAudio(cacheQuery)
            
            if (!cachedAudio) {
              // Save to cache after generating (async)
              // Note: We'll need to modify TTSManager to return generated audio
              // For now, just proceed with generation
            }
          }
          
          console.log('AudioWidget: TTS Provider Status', {
            currentProvider: currentProvider ? {
              name: currentProvider.name,
              type: currentProvider.type,
              isAvailable: currentProvider.isAvailable,
              isConfigured: currentProvider.isConfigured
            } : null,
            allProviders: allProviders.map(p => ({ name: p.name, type: p.type, isAvailable: p.isAvailable, isConfigured: p.isConfigured })),
            configuredProviders: configuredProviders.map(p => ({ name: p.name, type: p.type }))
          })
          
          if (!currentProvider || !currentProvider.isConfigured) {
            console.error('AudioWidget: No TTS provider configured', {
              hasProvider: !!currentProvider,
              isConfigured: currentProvider?.isConfigured,
              providerType: currentProvider?.type,
              allProvidersCount: allProviders.length,
              configuredProvidersCount: configuredProviders.length
            })
            setIsProcessing(false)
            updateTTS({ isPlaying: false, isPaused: false })
            // Show user-friendly error message
            alert('Text-to-speech is not configured. Please check your TTS settings.')
            return
          }
          
          // Validate text before attempting to speak
          if (!text || text.trim().length === 0) {
            console.warn('AudioWidget: No text available for playback', {
              textLength: text?.length || 0,
              playbackMode,
              hasParagraphs: tts.paragraphs.length > 0
            })
            setIsProcessing(false)
            updateTTS({ isPlaying: false, isPaused: false })
            return
          }
          
          console.log('AudioWidget: Starting playback', {
            textLength: text.length,
            playbackMode,
            provider: currentProvider.type,
            voiceName: tts.voiceName
          })
          
          // Reset playback started flag
          playbackStartedRef.current = false
          
          // Set initial state - will be updated after buffering completes
          // Don't set playing state yet if pause was requested
          if (!pauseRequestedDuringBufferingRef.current) {
            updateTTS({ isPlaying: true, isPaused: false })
          } else {
            updateTTS({ isPlaying: false, isPaused: true })
          }
          
          // CRITICAL FIX: Ensure TTS settings are applied before playback
          // This ensures AudioSettingsPanel changes take effect immediately
          // Note: currentProvider is already declared above, so we reuse it
          if (currentProvider) {
            if (tts.voice) {
              ttsManager.setVoice(tts.voice)
            }
            ttsManager.setRate(tts.rate)
            ttsManager.setPitch(tts.pitch)
            ttsManager.setVolume(tts.volume)
          }
          
          try {
            // Start speak() but don't await it yet - we need to check if playback started
            // The speak() call will continue buffering even if pause was requested
            const speakPromise = ttsManager.speak(
              text,
              () => {
                console.log('AudioWidget: onEnd callback fired', {
                  playbackStarted: playbackStartedRef.current,
                  isSpeaking: ttsManager.isSpeaking(),
                  wasPlaying: tts.isPlaying,
                  playbackMode
                })
                
                // Only update state if playback actually started
                // This prevents bounce-back if onEnd fires immediately due to errors
                if (!playbackStartedRef.current) {
                  console.warn('AudioWidget: onEnd fired before playback started, ignoring to prevent bounce-back')
                  updateTTS({ isPlaying: false, isPaused: false })
                  return
                }
                
                // On end callback - save final position
                if (currentDocument?.id) {
                  saveCurrentPosition(currentDocument.id)
                }
                
                // Gapless mode: Auto-advance without stopping
                if (gaplessMode && tts.autoAdvanceParagraph && playbackMode === 'paragraph') {
                const currentIndex = tts.currentParagraphIndex ?? 0
                if (currentIndex < tts.paragraphs.length - 1) {
                  // Move to next paragraph
                  updateTTS({ currentParagraphIndex: currentIndex + 1, currentWordIndex: null })
                  
                  // Get next paragraph text
                  const nextText = tts.paragraphs[currentIndex + 1]
                  if (nextText && nextText.trim()) {
                    // Continue playing immediately (gapless)
                    ttsManager.speak(
                      nextText,
                      () => {
                        // Recursive call for continuous playback
                        if (currentDocument?.id) {
                          saveCurrentPosition(currentDocument.id)
                        }
                        updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
                      },
                      (word, charIndex) => {
                        const safeText = typeof nextText === 'string' ? nextText : String(nextText || '')
                        const words = safeText.slice(0, charIndex + 1).split(/\s+/)
                        const wordIndex = words.length - 1
                        updateTTS({ currentWordIndex: wordIndex })
                      }
                    )
                  } else {
                    updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
                  }
                } else {
                  // End of document
                  updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
                }
              } else {
                // Normal mode: Stop and optionally advance
                updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
                
                if (tts.autoAdvanceParagraph && playbackMode === 'paragraph') {
                  // Inline next paragraph logic to avoid circular dependency
                  const currentIndex = tts.currentParagraphIndex ?? 0
                  if (currentIndex < tts.paragraphs.length - 1) {
                    updateTTS({ currentParagraphIndex: currentIndex + 1 })
                  }
                }
              }
            },
            (word, charIndex) => {
              // Ensure text is a string before splitting
              const safeText = typeof text === 'string' ? text : String(text || '')
              const words = safeText.slice(0, charIndex + 1).split(/\s+/)
              const wordIndex = words.length - 1
              updateTTS({ currentWordIndex: wordIndex })
            }
            )
            
            // CRITICAL: Check if playback started WHILE speak() is running, not after it completes
            // speak() only completes when audio finishes, so we check during playback
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Check if pause was requested during buffering
            // Use ref to get current value since state updates are async
            if (pauseRequestedDuringBufferingRef.current) {
              // Pause was requested during buffering - ensure it stays paused
              ttsManager.pause()
              updateTTS({ isPlaying: false, isPaused: true })
              pauseRequestedDuringBufferingRef.current = false
              setPauseRequestedDuringBuffering(false)
              playbackStartedRef.current = false
              setIsProcessing(false)
              // Don't return - let speak() continue in background (buffering continues)
              // But playback will remain paused
            } else {
              // Check if TTS is actually speaking after the delay
              if (ttsManager.isSpeaking()) {
                playbackStartedRef.current = true
                console.log('AudioWidget: Playback confirmed active')
                // Update state to playing if not already set
                if (!tts.isPlaying) {
                  updateTTS({ isPlaying: true, isPaused: false })
                }
              } else {
                console.warn('AudioWidget: speak() called but TTS is not speaking after 200ms - audio may have ended immediately or failed to start')
                // Don't reset state here - let onEnd handle it if it fires
                playbackStartedRef.current = false
              }
            }
            
            // Now await the speak promise (which will complete when audio finishes)
            await speakPromise
            
            console.log('AudioWidget: speak() call completed')
            setIsProcessing(false)
          } catch (speakError) {
            // If speak() fails, reset state immediately
            console.error('AudioWidget: speak() failed:', speakError)
            updateTTS({ isPlaying: false, isPaused: false })
            setIsProcessing(false)
            // Re-throw to be caught by outer catch block for additional logging
            throw speakError
          }
        } else {
          console.warn('No text available for playback')
          setIsProcessing(false)
        }
      } catch (error) {
        console.error('AudioWidget: TTS Error:', error)
        updateTTS({ isPlaying: false, isPaused: false })
        setIsProcessing(false)
      }
    }
  }, [playbackMode, gaplessMode, tts.isPlaying, tts.autoAdvanceParagraph, tts.paragraphs, isProcessing, updateTTS, getTextForPlaybackMode, normalizedDocumentId, pdfViewer.currentPage, tts.currentParagraphIndex, tts.voiceName, tts.rate, tts.pitch, saveCurrentPosition, currentDocument?.id])

  // Handle playback mode change
  const handlePlaybackModeChange = useCallback((newMode: 'paragraph' | 'page' | 'continue') => {
    const wasPlaying = tts.isPlaying
    
    // Stop current playback (don't restart automatically)
    if (wasPlaying) {
      ttsManager.stop()
      updateTTS({ isPlaying: false })
    }
    
    // Update mode
    setPlaybackMode(newMode)
    
    // User must press play again to start with new mode
    // This follows industry standards (e.g., Spotify, Audible)
  }, [tts.isPlaying, updateTTS])

  // Handle next paragraph
  const handleNextParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex < tts.paragraphs.length - 1) {
      updateTTS({ currentParagraphIndex: currentIndex + 1 })
      
      // If playing and auto-advance enabled, start playing new paragraph
      // Note: We don't auto-play here to avoid circular dependency
      // User can manually press play if they want to continue
    }
  }, [tts.currentParagraphIndex, tts.paragraphs.length, tts.isPlaying, tts.autoAdvanceParagraph, updateTTS])

  // Handle previous paragraph
  const handlePrevParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex > 0) {
      updateTTS({ currentParagraphIndex: currentIndex - 1 })
      
      // If playing, stop playback
      // Note: We don't auto-restart here to avoid circular dependency
      // User can manually press play if they want to continue
      if (tts.isPlaying) {
        ttsManager.stop()
        updateTTS({ isPlaying: false, isPaused: false })
      }
    }
  }, [tts.currentParagraphIndex, tts.isPlaying, updateTTS])

  // Update all refs in useEffect to avoid initialization order issues
  // This MUST be after all function definitions
  // Note: We don't include functions in dependency array to avoid circular dependency issues
  // Refs are updated on every render, which is fine since they're just references
  useEffect(() => {
    handlePlayPauseRef.current = handlePlayPause
    handleNextParagraphRef.current = handleNextParagraph
    handlePrevParagraphRef.current = handlePrevParagraph
  })

  // Handle volume toggle
  const handleVolumeToggle = useCallback(() => {
    const newVolume = tts.volume > 0 ? 0 : 0.8
    updateTTS({ volume: newVolume })
    ttsManager.setVolume(newVolume)
  }, [tts.volume, updateTTS])

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Get progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  // Get current paragraph info
  const currentParagraphIndex = tts.currentParagraphIndex ?? 0
  const totalParagraphs = tts.paragraphs.length

  // TEMPORARY: Always render for debugging - check console for state
  console.log('🔊 AudioWidget: About to render', {
    hasDocument: !!currentDocument,
    documentId: currentDocument?.id || 'NONE',
    documentName: currentDocument?.name || 'NONE',
    willRender: true
  });

  return (
    <>
      {/* Toggle Bar - Always Visible - HIGHEST Z-INDEX to stay above all modals */}
      <div
        id="onboarding-audio-widget"
        data-onboarding="onboarding-audio-widget"
        ref={widgetRef}
        className={`fixed z-[100000] transition-shadow duration-300 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.25)' : 'var(--shadow-lg)',
          backdropFilter: 'blur(10px)',
          minWidth: '180px',
          maxWidth: '260px',
          width: 'min(260px, calc(100vw - 32px))',
          userSelect: 'none',
          touchAction: isDragging ? 'none' : 'auto'
        }}
        onMouseDown={handleWidgetMouseDown}
        onTouchStart={handleWidgetTouchStart}
      >
        {/* Playback Mode Selector - Show when expanded or always visible */}
        {isExpanded && (
          <div className="flex items-center justify-between px-3 pt-1 pb-1 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePlaybackModeChange('paragraph')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                  playbackMode === 'paragraph' 
                    ? 'text-blue-500 ring-1 ring-blue-500/40 bg-[rgba(59,130,246,0.12)]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-pressed={playbackMode === 'paragraph'}
                aria-label="Paragraph mode"
              >
                Paragraph
              </button>
              <button
                onClick={() => handlePlaybackModeChange('page')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                  playbackMode === 'page' 
                    ? 'text-blue-500 ring-1 ring-blue-500/40 bg-[rgba(59,130,246,0.12)]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-pressed={playbackMode === 'page'}
                aria-label="Page mode"
              >
                Page
              </button>
              <button
                onClick={() => handlePlaybackModeChange('continue')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                  playbackMode === 'continue' 
                    ? 'text-blue-500 ring-1 ring-blue-500/40 bg-[rgba(59,130,246,0.12)]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-pressed={playbackMode === 'continue'}
                aria-label="Continue mode"
              >
                Continue
              </button>
            </div>
            
            {/* Gapless Mode Toggle */}
            <button
              onClick={() => setGaplessMode(!gaplessMode)}
              className={`p-1.5 rounded transition-all ${
                gaplessMode 
                  ? 'text-green-500 bg-green-500/10' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title={gaplessMode ? "Gapless playback enabled (seamless transitions)" : "Enable gapless playback"}
              aria-label={gaplessMode ? "Disable gapless playback" : "Enable gapless playback"}
            >
              {gaplessMode ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Compact Toggle Bar */}
        <div className="flex items-center gap-2 p-1.5">
          {/* Play/Pause Button - Main Control */}
          <button
            data-onboarding="onboarding-tts-play"
            onClick={() => handlePlayPauseRef.current()}
            className="p-2 rounded-full transition-all shadow-md"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)'
            }}
            aria-label={tts.isPlaying ? 'Pause' : 'Play'}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            title={
              (tts.isPaused || ttsManager.isPausedState())
                ? "Resume"
                : tts.isPlaying
                  ? "Pause"
                  : "Play"
            }
          >
            {/* Always show Play/Pause icon - never show loading spinner */}
            {(tts.isPaused || ttsManager.isPausedState()) ? (
              <Play className="w-5 h-5" />
            ) : tts.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          {/* Stop Button - Always visible in collapsed state */}
          <button
            onClick={() => handleStopRef.current()}
            className="p-2 rounded-full transition-all"
            style={{ color: 'var(--color-text-primary)' }}
            aria-label="Stop"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
              e.currentTarget.style.color = 'var(--color-error)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 min-w-0">
            {isProcessing && !tts.isPaused && !ttsManager.isPausedState() ? (
              <>
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="text-xs truncate max-w-24" style={{ color: 'var(--color-primary)' }}>
                  Buffering...
                </span>
              </>
            ) : (
              <>
                <div 
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${tts.isPlaying ? 'animate-pulse' : ''}`}
                  style={{ 
                    backgroundColor: tts.isPlaying 
                      ? 'var(--color-success)' 
                      : ttsManager.isPausedState() || tts.isPaused
                        ? 'var(--color-warning)' 
                        : 'var(--color-text-tertiary)' 
                  }}
                />
                <span 
                  className="text-xs truncate max-w-24"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {tts.isPlaying ? 'Playing' : (ttsManager.isPausedState() || tts.isPaused) ? 'Paused' : 'Ready'}
                </span>
              </>
            )}
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full transition-all"
            style={{ color: 'var(--color-text-primary)' }}
            aria-label={isExpanded ? 'Collapse controls' : 'Expand controls'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            title={isExpanded ? "Collapse controls" : "Expand controls"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <Tooltip content="Close Audio Widget" position="top">
            <button
              onClick={() => {
                handleStopRef.current()
                setAudioWidgetVisible(false)
              }}
              className="p-2 rounded-full transition-all"
              style={{ color: 'var(--color-text-primary)' }}
              aria-label="Close Audio Widget"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-primary)'
              }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Minimal progress indicator when collapsed */}
        {!isExpanded && (
          <div className="px-2 pb-1">
            <div
              className="w-full h-1 rounded-full"
              style={{ backgroundColor: 'var(--color-border)' }}
              title={`${Math.round(progressPercentage)}%`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--color-primary)' }}
              />
            </div>
          </div>
        )}

        {/* Expanded Controls */}
        {isExpanded && (
          <div 
            className="border-t px-3 py-3 space-y-3"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {/* Progress Bar */}
            <div className="space-y-2">
              <div
                className="w-full h-1.5 rounded-full relative cursor-pointer group"
                style={{ backgroundColor: 'var(--color-border)' }}
              >
                {/* Current playback progress */}
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ 
                    width: `${progressPercentage}%`,
                    backgroundColor: 'var(--color-primary)'
                  }}
                />
                
                {/* Saved position marker (if different from current) */}
                {savedPosition && duration > 0 && savedPosition.progressSeconds && savedPosition.progressSeconds !== currentTime && (
                  <div
                    className="absolute top-0 w-1 h-full bg-yellow-400 opacity-60"
                    style={{ left: `${(savedPosition.progressSeconds / duration) * 100}%` }}
                    title="Last saved position"
                  />
                )}
                
                {/* Current position indicator */}
                <div
                  className="absolute top-0 w-3 h-3 rounded-full transform -translate-y-1/2 transition-transform group-hover:scale-125"
                  style={{ 
                    left: `${progressPercentage}%`, 
                    marginLeft: '-6px',
                    top: '50%',
                    backgroundColor: 'var(--color-primary)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </div>
              
              {/* Time Display */}
              <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Previous Paragraph */}
              <button
                onClick={() => handlePrevParagraphRef.current()}
                disabled={currentParagraphIndex === 0}
                className="p-2 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  if (currentParagraphIndex > 0) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Previous paragraph"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Stop */}
              <button
                onClick={() => handleStopRef.current()}
                className="p-2 rounded-full transition-all"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error-light)'
                  e.currentTarget.style.color = 'var(--color-error)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>

              {/* Next Paragraph */}
              <button
                onClick={() => handleNextParagraphRef.current()}
                disabled={currentParagraphIndex >= totalParagraphs - 1}
                className="p-2 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  if (currentParagraphIndex < totalParagraphs - 1) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Next paragraph"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Volume Control */}
              <button
                onClick={handleVolumeToggle}
                className="p-2 rounded-full transition-all"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title={tts.volume > 0 ? `Volume: ${Math.round(tts.volume * 100)}%` : "Unmute"}
              >
                {tts.volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Settings Button */}
              <button
                data-onboarding="onboarding-tts-settings"
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full transition-all"
                style={{ 
                  color: showSettings ? 'var(--color-primary)' : 'var(--color-text-primary)',
                  backgroundColor: showSettings ? 'var(--color-primary-light)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!showSettings) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  if (!showSettings) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Audio settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Paragraph Info */}
            {totalParagraphs > 0 && (
              <div className="text-center">
                <span 
                  className="px-2 py-1 rounded text-xs"
                  style={{ 
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)'
                  }}
                >
                  Paragraph {currentParagraphIndex + 1}/{totalParagraphs}
                </span>
              </div>
            )}

            {/* Voice Info */}
            {tts.voice && (
              <div className="text-xs text-center truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                {tts.voice.name} • {tts.rate.toFixed(1)}x
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Panel Popup */}
      <AudioSettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  )
}
