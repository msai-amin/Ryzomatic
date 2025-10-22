import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, Voice } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { AudioSettingsPanel } from './AudioSettingsPanel'
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
  const { tts, updateTTS, currentDocument, pdfViewer } = useAppStore()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const lastClickTimeRef = useRef<number>(0)

  // Extract paragraphs from current document
  useEffect(() => {
    if (currentDocument) {
      console.log('🔍 AudioWidget: Processing document', {
        documentId: currentDocument.id,
        hasPageTexts: !!currentDocument.pageTexts,
        pageTextsLength: currentDocument.pageTexts?.length || 0
      });
      
      let text = ''
      
      // Get text from content or pageTexts
      if (currentDocument.content) {
        text = currentDocument.content
        console.log('🔍 AudioWidget: Using content', { textType: typeof text, textLength: text.length });
      } else if (currentDocument.pageTexts && currentDocument.pageTexts.length > 0) {
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
      }
      
      if (text) {
        console.log('🔍 AudioWidget: About to split text', {
          textType: typeof text,
          textLength: text.length,
          hasSplit: typeof text === 'string' && 'split' in (text as any)
        });
        
        // Split by double newlines (paragraph breaks) or periods followed by newlines
        const paragraphs = text
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
      // Pause
      ttsManager.pause()
      updateTTS({ isPlaying: false })
    } else if (ttsManager.isPausedState()) {
      // Resume
      ttsManager.resume()
      updateTTS({ isPlaying: true })
    } else {
      // Start new playback
      setIsProcessing(true)
      
      try {
        ttsManager.stop()
        updateTTS({ isPlaying: false })
        
        const text = getCurrentParagraphText()
        
        if (text.trim()) {
          updateTTS({ isPlaying: true })
          
          await ttsManager.speak(
            text,
            () => {
              // On end callback - auto-advance if enabled
              updateTTS({ isPlaying: false, currentWordIndex: null })
              
              if (tts.autoAdvanceParagraph) {
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
        updateTTS({ isPlaying: false })
        setIsProcessing(false)
      }
    }
  }, [tts.isPlaying, tts.autoAdvanceParagraph, isProcessing, updateTTS, getCurrentParagraphText])

  // Handle stop
  const handleStop = useCallback(() => {
    ttsManager.stop()
    updateTTS({ isPlaying: false, currentWordIndex: null })
    setCurrentTime(0)
    setDuration(0)
    setIsProcessing(false)
  }, [updateTTS])

  // Handle previous paragraph
  const handlePrevParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex > 0) {
      updateTTS({ currentParagraphIndex: currentIndex - 1 })
      
      // If playing, restart with new paragraph
      if (tts.isPlaying) {
        handleStop()
        setTimeout(() => handlePlayPause(), 100)
      }
    }
  }, [tts.currentParagraphIndex, tts.isPlaying, updateTTS, handleStop, handlePlayPause])

  // Handle next paragraph
  const handleNextParagraph = useCallback(() => {
    const currentIndex = tts.currentParagraphIndex ?? 0
    if (currentIndex < tts.paragraphs.length - 1) {
      updateTTS({ currentParagraphIndex: currentIndex + 1 })
      
      // If playing and auto-advance enabled, start playing new paragraph
      if (tts.isPlaying && tts.autoAdvanceParagraph) {
        handleStop()
        setTimeout(() => handlePlayPause(), 100)
      }
    }
  }, [tts.currentParagraphIndex, tts.paragraphs.length, tts.isPlaying, tts.autoAdvanceParagraph, updateTTS, handleStop, handlePlayPause])

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

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-30 cursor-pointer transition-all hover:scale-105"
        onClick={() => setIsMinimized(false)}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '50%',
          padding: '12px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <ChevronUp className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
      </div>
    )
  }

  return (
    <>
      {/* Bottom-Docked Player Bar */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-30 backdrop-blur-lg transition-transform duration-300 ${className}`}
        style={{
          backgroundColor: 'rgba(var(--color-surface-rgb, 255, 255, 255), 0.95)',
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
          transform: 'translateY(0)',
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          {/* Progress Bar - Full Width on Top */}
          <div className="mb-3">
            <div
              className="w-full h-1.5 rounded-full relative cursor-pointer group"
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: 'var(--color-primary)'
                }}
              />
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
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Left Section - Playback Controls */}
            <div className="flex items-center gap-3">
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
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                disabled={isProcessing}
                className="p-4 rounded-full transition-all shadow-lg"
                style={{
                  backgroundColor: isProcessing ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-lg)'
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
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
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
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-inverse)' }} />
                ) : tts.isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
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
                <Square className="w-5 h-5" />
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
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Center Section - Info & Progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 text-xs mb-1">
                <div className="flex items-center gap-2">
                  {/* Playing Status Indicator */}
                  <div 
                    className={`w-2 h-2 rounded-full ${tts.isPlaying ? 'animate-pulse' : ''}`}
                    style={{ 
                      backgroundColor: tts.isPlaying 
                        ? 'var(--color-success)' 
                        : ttsManager.isPausedState() 
                          ? 'var(--color-warning)' 
                          : 'var(--color-text-tertiary)' 
                    }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {tts.isPlaying ? 'Playing' : ttsManager.isPausedState() ? 'Paused' : 'Stopped'}
                  </span>
                  
                  {/* Paragraph Indicator */}
                  {totalParagraphs > 0 && (
                    <span 
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ 
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      Paragraph {currentParagraphIndex + 1}/{totalParagraphs}
                    </span>
                  )}
                </div>
                
                {/* Time Display */}
                <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>{formatTime(currentTime)}</span>
                  <span className="opacity-50">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Current Voice Name */}
              {tts.voice && (
                <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                  Voice: {tts.voice.name} • Speed: {tts.rate.toFixed(1)}x
                </div>
              )}
            </div>

            {/* Right Section - Volume & Settings */}
            <div className="flex items-center gap-3">
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
                {tts.volume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
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
                <Settings className="w-5 h-5" />
              </button>

              {/* Minimize Button */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 rounded-full transition-all"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Minimize player"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel Popup */}
      <AudioSettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  )
}
