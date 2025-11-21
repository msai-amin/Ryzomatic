/**
 * AudioWidget - Refactored Version (Phase 2)
 * 
 * A floating, draggable audio player for TTS playback.
 * Now uses extracted hooks for cleaner architecture.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
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

// Import our new hooks
import { useAudioText } from '../hooks/useAudioText'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { useDraggable } from '../hooks/useDraggable'
import { useAudioPosition } from '../hooks/useAudioPosition'

interface AudioWidgetProps {
  className?: string
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ className = '' }) => {
  // ===== STORE STATE =====
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
    setAudioWidgetPosition
  } = useAppStore()
  
  // ===== LOCAL STATE =====
  const widgetRef = useRef<HTMLDivElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('audioWidgetExpanded')
    return stored === null ? true : stored === 'true'
  })
  const [playbackMode, setPlaybackMode] = useState<'paragraph' | 'page' | 'continue'>('paragraph')
  const previousDocumentIdRef = useRef<string | null>(null)
  
  // Persist expanded/collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('audioWidgetExpanded', String(isExpanded))
    }
  }, [isExpanded])
  
  // ===== CUSTOM HOOKS =====
  
  // Text selection logic
  const audioText = useAudioText({
    document: currentDocument,
    isReadingMode: pdfViewer.readingMode,
    currentPage: pdfViewer.currentPage || 1,
    currentParagraphIndex: tts.currentParagraphIndex ?? 0,
    paragraphs: tts.paragraphs
  })
  
  // Position persistence
  const audioPosition = useAudioPosition({
    documentId: currentDocument?.id || null,
    userId: user?.id || null,
    currentPage: pdfViewer.currentPage || 1,
    currentParagraphIndex: tts.currentParagraphIndex ?? 0,
    playbackMode,
    getCurrentTime: () => ttsManager.getCurrentTime?.() || 0,
    saveTTSPosition,
    loadTTSPosition
  })
  
  // Player controls
  const audioPlayer = useAudioPlayer({
    tts,
    updateTTS,
    documentId: currentDocument?.id || null,
    userId: user?.id || null,
    currentPage: pdfViewer.currentPage || 1,
    voiceName: tts.voiceName || 'default',
    rate: tts.rate,
    pitch: tts.pitch,
    onPositionSave: audioPosition.savePosition
  })
  
  // Draggable functionality
  const draggable = useDraggable({
    initialPosition: audioWidgetPosition,
    onPositionChange: setAudioWidgetPosition,
    elementRef: widgetRef,
    sidebarWidth: rightSidebarWidth || 280,
    isSidebarOpen: isRightSidebarOpen
  })
  
  // ===== PARAGRAPH EXTRACTION =====
  // Extract paragraphs from document text when document changes
  useEffect(() => {
    if (!currentDocument || !currentDocument.id) {
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
      return
    }
    
    const currentDocId = currentDocument.id
    if (previousDocumentIdRef.current && previousDocumentIdRef.current !== currentDocId) {
      console.log('🔊 AudioWidget: Document changed, resetting paragraphs')
      previousDocumentIdRef.current = currentDocId
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
      return
    }
    
    previousDocumentIdRef.current = currentDocId
    
    // Get all text from the document
    const { pageTexts, cleanedPageTexts, isUsingCleanedText } = audioText
    const sourceTexts = isUsingCleanedText ? cleanedPageTexts : pageTexts
    
    if (sourceTexts.length === 0) {
      // Try fallback to content
      if (currentDocument.content && typeof currentDocument.content === 'string') {
        const contentStr = String(currentDocument.content)
        if (contentStr && !contentStr.startsWith('[object ') && contentStr.length > 10) {
          const paragraphs = contentStr
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0)
          updateTTS({ paragraphs, currentParagraphIndex: 0 })
          return
        }
      }
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
      return
    }
    
    // Join all pages and split into paragraphs
    const allText = sourceTexts
      .map(text => typeof text === 'string' ? text : String(text || ''))
      .filter(text => text.length > 0)
      .join('\n\n')
    
    if (allText) {
      const paragraphs = allText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      updateTTS({ paragraphs, currentParagraphIndex: 0 })
      console.log('🔊 AudioWidget: Extracted', paragraphs.length, 'paragraphs from', isUsingCleanedText ? 'cleaned' : 'original', 'text')
    } else {
      updateTTS({ paragraphs: [], currentParagraphIndex: 0 })
    }
  }, [currentDocument?.id, audioText.pageTexts.length, audioText.cleanedPageTexts.length, pdfViewer.readingMode, updateTTS])
  
  // ===== PLAYBACK HANDLERS =====
  
  const handlePlayPause = useCallback(async () => {
    if (tts.isPlaying || ttsManager.isSpeaking()) {
      // Pause
      await audioPlayer.pause()
    } else if (tts.isPaused || ttsManager.isPausedState()) {
      // Resume
      await audioPlayer.resume()
    } else {
      // Start new playback
      const text = audioText.getTextForMode(playbackMode)
      if (text.trim()) {
        await audioPlayer.play(text, playbackMode)
      }
    }
  }, [tts.isPlaying, tts.isPaused, playbackMode, audioPlayer, audioText])
  
  const handleStop = useCallback(() => {
    audioPlayer.stop()
  }, [audioPlayer])
  
  const handleNextParagraph = useCallback(() => {
    audioPlayer.handleNextParagraph()
    // If playing, restart with new paragraph
    if (tts.isPlaying) {
      setTimeout(async () => {
        const text = audioText.getTextForMode(playbackMode)
        if (text.trim()) {
          await audioPlayer.play(text, playbackMode)
        }
      }, 100)
    }
  }, [audioPlayer, tts.isPlaying, playbackMode, audioText])
  
  const handlePrevParagraph = useCallback(() => {
    audioPlayer.handlePreviousParagraph()
    // If playing, restart with new paragraph
    if (tts.isPlaying) {
      setTimeout(async () => {
        const text = audioText.getTextForMode(playbackMode)
        if (text.trim()) {
          await audioPlayer.play(text, playbackMode)
        }
      }, 100)
    }
  }, [audioPlayer, tts.isPlaying, playbackMode, audioText])
  
  const handlePlaybackModeChange = useCallback((newMode: 'paragraph' | 'page' | 'continue') => {
    const wasPlaying = tts.isPlaying
    
    // Stop current playback
    if (wasPlaying) {
      ttsManager.stop()
      updateTTS({ isPlaying: false })
    }
    
    // Update mode
    setPlaybackMode(newMode)
  }, [tts.isPlaying, updateTTS])
  
  const handleVolumeToggle = useCallback(() => {
    const newVolume = tts.volume > 0 ? 0 : 0.8
    updateTTS({ volume: newVolume })
    ttsManager.setVolume(newVolume)
  }, [tts.volume, updateTTS])
  
  // ===== SYNC STATE =====
  // Sync TTS state periodically
  useEffect(() => {
    const syncState = () => {
      const actualIsSpeaking = ttsManager.isSpeaking()
      const actualIsPaused = ttsManager.isPausedState()
      
      if (actualIsSpeaking && !tts.isPlaying && !actualIsPaused) {
        updateTTS({ isPlaying: true, isPaused: false })
      } else if (!actualIsSpeaking && tts.isPlaying && !actualIsPaused) {
        updateTTS({ isPlaying: false, isPaused: false })
      } else if (actualIsPaused && !tts.isPaused) {
        updateTTS({ isPaused: true })
      }
    }
    
    const interval = setInterval(syncState, 500)
    return () => clearInterval(interval)
  }, [tts.isPlaying, tts.isPaused, updateTTS])
  
  // Update time/duration periodically
  useEffect(() => {
    if (!tts.isPlaying) return
    
    const updateProgress = () => {
      const currentTime = ttsManager.getCurrentTime?.() || 0
      const duration = ttsManager.getDuration?.() || 0
      // Store in local state if needed, or just use directly from ttsManager
    }
    
    const interval = setInterval(updateProgress, 100)
    return () => clearInterval(interval)
  }, [tts.isPlaying])
  
  // ===== UTILITY FUNCTIONS =====
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  
  const currentTime = ttsManager.getCurrentTime?.() || 0
  const duration = ttsManager.getDuration?.() || 0
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  
  const currentParagraphIndex = tts.currentParagraphIndex ?? 0
  const totalParagraphs = tts.paragraphs.length
  
  // ===== RENDER =====
  
  if (!currentDocument) {
    return null // Don't render if no document
  }
  
  return (
    <>
      {/* Main Widget */}
      <div
        ref={widgetRef}
        className={`fixed z-[100000] transition-shadow duration-300 ${draggable.isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
        style={{
          left: `${draggable.position.x}px`,
          top: `${draggable.position.y}px`,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          boxShadow: draggable.isDragging ? '0 12px 32px rgba(0,0,0,0.25)' : 'var(--shadow-lg)',
          backdropFilter: 'blur(10px)',
          minWidth: '180px',
          maxWidth: '260px',
          width: 'min(260px, calc(100vw - 32px))',
          userSelect: 'none',
          touchAction: draggable.isDragging ? 'none' : 'auto'
        }}
        onMouseDown={draggable.handleMouseDown}
      >
        {/* Playback Mode Selector */}
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
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Compact Control Bar */}
        <div className="flex items-center gap-2 p-1.5">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={audioPlayer.isProcessing}
            className="p-2 rounded-full transition-all shadow-md"
            style={{
              backgroundColor: audioPlayer.isProcessing ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              cursor: audioPlayer.isProcessing ? 'not-allowed' : 'pointer'
            }}
            title={
              audioPlayer.isProcessing 
                ? "Processing..." 
                : (tts.isPaused || ttsManager.isPausedState())
                  ? "Resume"
                  : tts.isPlaying
                    ? "Pause"
                    : "Play"
            }
          >
            {audioPlayer.isProcessing ? (
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" />
            ) : (tts.isPaused || ttsManager.isPausedState()) ? (
              <Play className="w-5 h-5" />
            ) : tts.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStop}
            className="p-2 rounded-full transition-all"
            style={{ color: 'var(--color-text-primary)' }}
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
              className="text-xs truncate max-w-24"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tts.isPlaying ? 'Playing' : ttsManager.isPausedState() ? 'Paused' : 'Ready'}
            </span>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full transition-all"
            style={{ color: 'var(--color-text-primary)' }}
            title={isExpanded ? "Collapse controls" : "Expand controls"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Minimal progress when collapsed */}
        {!isExpanded && (
          <div className="px-2 pb-1">
            <div
              className="w-full h-1 rounded-full"
              style={{ backgroundColor: 'var(--color-border)' }}
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
                className="w-full h-1.5 rounded-full relative"
                style={{ backgroundColor: 'var(--color-border)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ 
                    width: `${progressPercentage}%`,
                    backgroundColor: 'var(--color-primary)'
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handlePrevParagraph}
                disabled={currentParagraphIndex === 0}
                className="p-2 rounded-full transition-all disabled:opacity-30"
                title="Previous paragraph"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={handleStop}
                className="p-2 rounded-full transition-all"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextParagraph}
                disabled={currentParagraphIndex >= totalParagraphs - 1}
                className="p-2 rounded-full transition-all disabled:opacity-30"
                title="Next paragraph"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={handleVolumeToggle}
                className="p-2 rounded-full transition-all"
                title={tts.volume > 0 ? `Volume: ${Math.round(tts.volume * 100)}%` : "Unmute"}
              >
                {tts.volume > 0 ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-full transition-all"
                style={{ 
                  color: showSettings ? 'var(--color-primary)' : 'var(--color-text-primary)'
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

      {/* Settings Panel */}
      <AudioSettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  )
}

