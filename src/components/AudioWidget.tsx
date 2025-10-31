import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, Voice, TTSPosition } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { AudioSettingsPanel } from './AudioSettingsPanel'
import { ttsCacheService, TTSCacheQuery } from '../services/ttsCacheService'
import { supabase } from '../../lib/supabase'
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
  ChevronUp
} from 'lucide-react'

interface AudioWidgetProps {
  className?: string
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ className = '' }) => {
  const { tts, updateTTS, currentDocument, pdfViewer, user, saveTTSPosition, loadTTSPosition, isRightSidebarOpen } = useAppStore()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [playbackMode, setPlaybackMode] = useState<'paragraph' | 'page' | 'continue'>('paragraph')
  const [savedPosition, setSavedPosition] = useState<TTSPosition | null>(null)
  const lastClickTimeRef = useRef<number>(0)
  const previousDocumentIdRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)

  // Extract paragraphs from current document
  useEffect(() => {
    if (currentDocument) {
      console.log('🔍 AudioWidget: Processing document', {
        documentId: currentDocument.id,
        hasPageTexts: !!currentDocument.pageTexts,
        pageTextsLength: currentDocument.pageTexts?.length || 0
      });
      
      let text = ''
      
      // Priority: pageTexts (for PDFs) > string content (for text files)
      // For PDFs, content is ArrayBuffer (binary data), so we must use pageTexts
      if (currentDocument.pageTexts && currentDocument.pageTexts.length > 0) {
        console.log('🔍 AudioWidget: Processing pageTexts', {
          pageTextsTypes: currentDocument.pageTexts.map((text, i) => ({
            index: i,
            type: typeof text,
            isString: typeof text === 'string',
            value: (String(text).substring(0, 100) + (String(text).length > 100 ? '...' : ''))
          }))
        });
        
        // Ensure all pageTexts elements are strings before joining
        const safePageTexts = currentDocument.pageTexts.map(pageText => 
          typeof pageText === 'string' ? pageText : String(pageText || '')
        )
        text = safePageTexts.join('\n\n')
        console.log('🔍 AudioWidget: Joined text', { textType: typeof text, textLength: text.length });
      } else if (currentDocument.content && typeof currentDocument.content === 'string') {
        // Fallback to string content only if pageTexts is not available
        // Check that it's actually a valid string (not "[object ArrayBuffer]")
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
      }
    }
  }, [currentDocument?.id, updateTTS])

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

  // Get current paragraph text
  const getCurrentParagraphText = useCallback((): string => {
    if (tts.paragraphs.length === 0) {
      // Fallback to page text if no paragraphs
      const currentPage = pdfViewer.currentPage || 1
      if (currentDocument?.pageTexts && currentDocument.pageTexts.length > 0) {
        const rawPageText = currentDocument.pageTexts[currentPage - 1]
        return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
      }
      return currentDocument?.content || ''
    }
    
    const index = tts.currentParagraphIndex ?? 0
    return tts.paragraphs[index] || tts.paragraphs[0] || ''
  }, [tts.paragraphs, tts.currentParagraphIndex, currentDocument, pdfViewer.currentPage])

  // Get text for page mode
  const getCurrentPageText = useCallback((): string => {
    const currentPage = pdfViewer.currentPage || 1
    if (currentDocument?.pageTexts && currentDocument.pageTexts.length > 0) {
      const rawPageText = currentDocument.pageTexts[currentPage - 1]
      return typeof rawPageText === 'string' ? rawPageText : String(rawPageText || '')
    }
    return ''
  }, [currentDocument, pdfViewer.currentPage])

  // Get all remaining text (for continue to end mode)
  const getAllRemainingText = useCallback((): string => {
    if (currentDocument?.pageTexts && currentDocument.pageTexts.length > 0) {
      const currentPage = pdfViewer.currentPage || 1
      const remainingPages = currentDocument.pageTexts.slice(currentPage - 1)
      return remainingPages
        .map(p => typeof p === 'string' ? p : String(p || ''))
        .filter(p => p.length > 0)
        .join('\n\n')
    }
    return ''
  }, [currentDocument, pdfViewer.currentPage])

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
    
    const position: TTSPosition = {
      page: pdfViewer.currentPage,
      paragraphIndex: tts.currentParagraphIndex ?? 0,
      timestamp: Date.now(),
      mode: playbackMode,
      progressSeconds: ttsManager.getCurrentTime()
    }
    
    // Save to Zustand store (immediate)
    saveTTSPosition(documentId, position)
    
    // Save to database (async, for persistence across sessions)
    if (user?.id) {
      try {
        await supabase
          .from('user_books')
          .update({ tts_last_position: position })
          .eq('id', documentId)
          .eq('user_id', user.id)
      } catch (error) {
        console.error('Failed to save TTS position to database:', error)
      }
    }
    
    isSavingRef.current = false
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
      
      // Update ref for next change
      previousDocumentIdRef.current = currentDocument?.id || null
      
      // Load saved position for new document
      if (currentDocument?.id) {
        loadSavedPosition(currentDocument.id)
      }
    }
  }, [currentDocument?.id, tts.isPlaying, saveCurrentPosition, loadSavedPosition, updateTTS])

  // Auto-save position every 5 seconds while playing
  useEffect(() => {
    if (!tts.isPlaying || !currentDocument?.id) return
    
    const interval = setInterval(() => {
      saveCurrentPosition(currentDocument.id)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [tts.isPlaying, currentDocument?.id, saveCurrentPosition])

  // Handle stop (declared early to avoid circular dependencies)
  const handleStopRef = useRef<() => void>(() => {})
  
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
  }, [updateTTS, currentDocument?.id, tts.isPlaying, saveCurrentPosition])
  
  handleStopRef.current = handleStop

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTimeRef.current
    
    if (timeSinceLastClick < 500) {
      return
    }
    
    lastClickTimeRef.current = now
    
    if (isProcessing) {
      return
    }
    
    if (tts.isPlaying) {
      // Pause (save position)
      if (currentDocument?.id) {
        await saveCurrentPosition(currentDocument.id)
      }
      ttsManager.pause()
      updateTTS({ isPlaying: false, isPaused: true }) // SET PAUSED FLAG
    } else if (tts.isPaused) { // CHECK STORE PAUSED STATE
      // Resume
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
        ttsManager.stop()
        updateTTS({ isPlaying: false, isPaused: false }) // Ensure paused is false
        
        const text = getTextForPlaybackMode(playbackMode)
        
        if (text.trim()) {
          // Check cache first if available
          let cachedAudio: ArrayBuffer | null = null
          
          if (currentDocument && currentDocument.id) {
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
                provider: 'google-cloud' // Use current provider
              }
            }
            
            cachedAudio = await ttsCacheService.getCachedAudio(cacheQuery)
            
            if (!cachedAudio) {
              // Save to cache after generating (async)
              // Note: We'll need to modify TTSManager to return generated audio
              // For now, just proceed with generation
            }
          }
          
          updateTTS({ isPlaying: true, isPaused: false })
          
          await ttsManager.speak(
            text,
            () => {
              // On end callback - save final position
              if (currentDocument?.id) {
                saveCurrentPosition(currentDocument.id)
              }
              updateTTS({ isPlaying: false, isPaused: false, currentWordIndex: null })
              
              if (tts.autoAdvanceParagraph && playbackMode === 'paragraph') {
                handleNextParagraph()
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
          
          setIsProcessing(false)
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
  }, [playbackMode, tts.isPlaying, tts.autoAdvanceParagraph, isProcessing, updateTTS, getTextForPlaybackMode, currentDocument, pdfViewer.currentPage, tts.currentParagraphIndex, tts.voiceName, tts.rate, tts.pitch, saveCurrentPosition])

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

  // Store playPause for use in other callbacks
  const handlePlayPauseRef = useRef<() => Promise<void>>(async () => {})
  handlePlayPauseRef.current = handlePlayPause

  // Handle next paragraph
  const handleNextParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex < tts.paragraphs.length - 1) {
      updateTTS({ currentParagraphIndex: currentIndex + 1 })
      
      // If playing and auto-advance enabled, start playing new paragraph
      if (tts.isPlaying && tts.autoAdvanceParagraph) {
        handleStopRef.current()
        setTimeout(() => handlePlayPauseRef.current(), 100)
      }
    }
  }, [tts.currentParagraphIndex, tts.paragraphs.length, tts.isPlaying, tts.autoAdvanceParagraph, updateTTS])

  // Handle previous paragraph
  const handlePrevParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex > 0) {
      updateTTS({ currentParagraphIndex: currentIndex - 1 })
      
      // If playing, restart with new paragraph
      if (tts.isPlaying) {
        handleStopRef.current()
        setTimeout(() => handlePlayPauseRef.current(), 100)
      }
    }
  }, [tts.currentParagraphIndex, tts.isPlaying, updateTTS])

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

  return (
    <>
      {/* Toggle Bar - Always Visible */}
      <div 
        className={`fixed bottom-4 z-60 transition-all duration-300 ${className}`}
        style={{
          right: isRightSidebarOpen ? '284px' : '1rem', // 280px sidebar + 4px gap when open, 16px default
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(10px)',
          // Ensure audio widget stays in its designated zone
          minWidth: '200px',
          maxWidth: '300px'
        }}
      >
        {/* Playback Mode Selector - Show when expanded or always visible */}
        <div className="flex items-center justify-center gap-1 px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => handlePlaybackModeChange('paragraph')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              playbackMode === 'paragraph' 
                ? 'text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: playbackMode === 'paragraph' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
          >
            Paragraph
          </button>
          <button
            onClick={() => handlePlaybackModeChange('page')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              playbackMode === 'page' 
                ? 'text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: playbackMode === 'page' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
          >
            Page
          </button>
          <button
            onClick={() => handlePlaybackModeChange('continue')}
            className={`px-2 py-1 text-xs font-medium rounded transition-all ${
              playbackMode === 'continue' 
                ? 'text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            style={{
              backgroundColor: playbackMode === 'continue' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
          >
            Continue
          </button>
        </div>

        {/* Compact Toggle Bar */}
        <div className="flex items-center gap-2 p-3">
          {/* Play/Pause Button - Main Control */}
          <button
            onClick={handlePlayPause}
            disabled={isProcessing}
            className="p-3 rounded-full transition-all shadow-md"
            style={{
              backgroundColor: isProcessing ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-md)'
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              }
            }}
            title={
              isProcessing 
                ? "Processing..." 
                : tts.isPlaying 
                  ? "Pause" 
                  : ttsManager.isPausedState()
                    ? "Resume"
                    : "Play"
            }
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-inverse)' }} />
            ) : (tts.isPlaying || tts.isPaused) ? ( // Show pause if playing OR paused
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          {/* Stop Button - Always visible in collapsed state */}
          <button
            onClick={handleStop}
            className="p-2 rounded-full transition-all"
            style={{ color: 'var(--color-text-primary)' }}
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
            <div 
              className={`w-2 h-2 rounded-full flex-shrink-0 ${tts.isPlaying ? 'animate-pulse' : ''}`}
              style={{ 
                backgroundColor: tts.isPlaying 
                  ? 'var(--color-success)' 
                  : ttsManager.isPausedState() 
                    ? 'var(--color-warning)' 
                    : 'var(--color-text-tertiary)' 
              }}
            />
            <span 
              className="text-xs truncate max-w-20"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tts.isPlaying ? 'Playing' : ttsManager.isPausedState() ? 'Paused' : 'Stopped'}
            </span>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
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
            title={isExpanded ? "Collapse controls" : "Expand controls"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

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
                onClick={handlePrevParagraph}
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
                onClick={handleStop}
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
                onClick={handleNextParagraph}
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
