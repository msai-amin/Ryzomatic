import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, Voice } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { TTSVoiceSelector } from './TTSVoiceSelector'
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  RotateCcw,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface AudioWidgetProps {
  className?: string
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ className = '' }) => {
  const { tts, updateTTS } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // CRITICAL: Prevent multiple simultaneous requests
  const [isExtractingText, setIsExtractingText] = useState(false) // Show when text extraction is happening
  const progressRef = useRef<HTMLDivElement>(null)
  const lastClickTimeRef = useRef<number>(0) // CRITICAL: Debounce rapid clicks

  // Update current time and duration from TTS manager
  useEffect(() => {
    let logCount = 0; // Only log first few times for debugging
    
    const updateTime = () => {
      // Update time when playing OR paused (to show current position)
      if (tts.isPlaying || ttsManager.isPausedState()) {
        const time = ttsManager.getCurrentTime()
        const dur = ttsManager.getDuration()
        const progress = ttsManager.getProgress()
        
        // Debug: Log first few updates with explicit values
        if (logCount < 5) {
          console.log(`AudioWidget progress update: time=${time.toFixed(1)}s, duration=${dur.toFixed(1)}s, progress=${(progress * 100).toFixed(1)}%`);
          logCount++;
        }
        
        setCurrentTime(time)
        setDuration(dur)
      } else if (!ttsManager.isPausedState()) {
        // Only reset if not paused
        setCurrentTime(0)
        setDuration(0)
      }
    }

    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [tts.isPlaying])

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTimeRef.current
    
    // CRITICAL FIX: Debounce rapid clicks (minimum 500ms between clicks)
    if (timeSinceLastClick < 500) {
      console.log('AudioWidget: Click too soon, debouncing...', { timeSinceLastClick })
      return
    }
    
    lastClickTimeRef.current = now
    
    // CRITICAL FIX: Prevent multiple simultaneous requests
    if (isProcessing) {
      console.log('AudioWidget: Already processing a request, ignoring...')
      return
    }
    
    console.log('AudioWidget: handlePlayPause called, current state:', { 
      isPlaying: tts.isPlaying, 
      isProcessing 
    })
    
    if (tts.isPlaying) {
      console.log('AudioWidget: Currently playing, pausing...')
      // Pause the current playback
      ttsManager.pause()
      updateTTS({ isPlaying: false })
    } else if (ttsManager.isPausedState()) {
      console.log('AudioWidget: Resuming from pause...')
      // Resume from pause
      ttsManager.resume()
      updateTTS({ isPlaying: true })
    } else {
      // CRITICAL FIX: Set processing state to prevent multiple requests
      setIsProcessing(true)
      
      try {
        // CRITICAL FIX: Stop any audio that might be playing before starting new audio
        console.log('AudioWidget: Starting new audio, stopping any existing audio first...')
        ttsManager.stop()
        updateTTS({ isPlaying: false })
        
        // Additional safety check: ensure no audio is still playing
        if (ttsManager.isSpeaking()) {
          console.warn('AudioWidget: Audio still playing after stop, waiting...')
          // Wait a bit and try again
          await new Promise(resolve => setTimeout(resolve, 100))
          if (ttsManager.isSpeaking()) {
            console.error('AudioWidget: Audio still playing after stop, aborting new audio')
            setIsProcessing(false)
            return
          }
        }
        
        // Get current document text for TTS
        const currentDoc = useAppStore.getState().currentDocument
        const currentPage = useAppStore.getState().pdfViewer.currentPage || 1 // Fallback to page 1 if not set
        
        console.log('AudioWidget: TTS Debug Info:', {
          hasCurrentDoc: !!currentDoc,
          docType: currentDoc?.type,
          hasPageTexts: !!currentDoc?.pageTexts,
          pageTextsLength: currentDoc?.pageTexts?.length || 0,
          currentPage,
          pdfViewerState: useAppStore.getState().pdfViewer,
          pageTextsSample: currentDoc?.pageTexts?.slice(0, 3).map((text, i) => ({
            page: i + 1,
            length: text?.length || 0,
            preview: text?.substring(0, 50) || 'empty',
            isEmpty: !text || text.trim().length === 0
          }))
        })
        
        if (currentDoc && currentDoc.pageTexts && currentDoc.pageTexts.length > 0) {
          let text = currentDoc.pageTexts[currentPage - 1] || ''
          
          console.log('AudioWidget: Text for TTS:', {
            pageNumber: currentPage,
            textLength: text.length,
            textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            isEmpty: text.trim().length === 0
          })
          
          // If no text available, try to find text in other pages
          if (!text.trim()) {
            console.log('AudioWidget: No text on current page, searching for text in other pages...')
            
            // Look for the first page with text
            for (let i = 0; i < currentDoc.pageTexts.length; i++) {
              const pageText = currentDoc.pageTexts[i]
              if (pageText && pageText.trim().length > 0) {
                text = pageText
                console.log(`AudioWidget: Found text on page ${i + 1}, using it for TTS`)
                break
              }
            }
          }
          
          if (text.trim()) {
            await ttsManager.speak(
              text,
              () => {
                updateTTS({ isPlaying: false, currentWordIndex: null });
              },
              (word, charIndex) => {
                // Find word index from charIndex
                const words = text.slice(0, charIndex + 1).split(/\s+/);
                const wordIndex = words.length - 1;
                
                // Debug: Log word updates with explicit values
                if (wordIndex < 10) {
                  console.log(`AudioWidget updating wordIndex=${wordIndex}, word="${word.substring(0, 20)}", charIndex=${charIndex}`);
                }
                
                updateTTS({ currentWordIndex: wordIndex });
              }
            );
            updateTTS({ isPlaying: true });
          } else {
            console.warn('AudioWidget: No text available for TTS in any page')
          }
        } else {
          console.warn('AudioWidget: Missing document or page data for TTS', {
            hasCurrentDoc: !!currentDoc,
            docType: currentDoc?.type,
            hasPageTexts: !!currentDoc?.pageTexts,
            pageTextsLength: currentDoc?.pageTexts?.length || 0,
            currentPage: currentPage
          })
          
          // Show user-friendly message
          alert('🔊 Audio not available\n\nText extraction is still in progress. Please wait a moment and try again.\n\nIf the issue persists, the PDF may not have extractable text.')
        }
      } catch (error) {
        console.error('AudioWidget: TTS Error:', error)
        updateTTS({ isPlaying: false })
      } finally {
        // CRITICAL: Always reset processing state
        setIsProcessing(false)
      }
    }
  }, [tts.isPlaying, updateTTS, isProcessing])

  // Handle stop
  const handleStop = useCallback(() => {
    console.log('AudioWidget: Stop button clicked')
    ttsManager.stop()
    updateTTS({ isPlaying: false, currentWordIndex: null })
    setCurrentTime(0)
    setDuration(0)
    setIsProcessing(false) // CRITICAL: Reset processing state
  }, [updateTTS])

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    updateTTS({ rate: speed })
    ttsManager.setRate(speed)
  }, [updateTTS])

  // Handle volume change
  const handleVolumeChange = useCallback((volume: number) => {
    updateTTS({ volume })
    ttsManager.setVolume(volume)
  }, [updateTTS])

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    const newVolume = tts.volume > 0 ? 0 : 1
    handleVolumeChange(newVolume)
  }, [tts.volume, handleVolumeChange])

  // Handle voice change
  const handleVoiceChange = useCallback(async (voice: Voice) => {
    try {
      console.log('AudioWidget: Voice change requested:', {
        voiceName: voice.name,
        voiceType: voice.type,
        hasModel: !!voice.model,
        voiceObject: voice
      });
      
      // Use TTSManager.setVoice to ensure proper model assignment
      ttsManager.setVoice(voice)
      
      // Update the store
      updateTTS({ 
        voice: voice,
        voiceName: voice.name 
      })
      
      console.log('AudioWidget: Voice changed to:', voice.name)
    } catch (error) {
      console.error('Error changing voice:', error)
    }
  }, [updateTTS])

  // Handle voice preview
  const handleVoicePreview = useCallback(async () => {
    try {
      const currentProvider = ttsManager.getCurrentProvider()
      if (currentProvider && tts.voice) {
        // Stop any current speech
        currentProvider.stop()
        
        // Preview the current voice with a sample text
        const previewText = "Hello! This is how I sound when reading your documents."
        await currentProvider.speak(previewText, () => {
          console.log('Voice preview completed')
        })
      }
    } catch (error) {
      console.error('Error previewing voice:', error)
    }
  }, [tts.voice])

  // Note: Progress bar is read-only for TTS
  // TTS doesn't support seeking to arbitrary positions

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Get progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  
  // Debug: Log progress bar state when playing
  useEffect(() => {
    if (tts.isPlaying) {
      const debugTimer = setTimeout(() => {
        console.log(`📊 Progress bar state: currentTime=${currentTime.toFixed(1)}s, duration=${duration.toFixed(1)}s, percentage=${progressPercentage.toFixed(1)}%`);
      }, 2000); // Log after 2 seconds of playback
      
      return () => clearTimeout(debugTimer);
    }
  }, [tts.isPlaying, currentTime, duration, progressPercentage]);

  return (
    <div 
      className={`rounded-lg shadow-lg ${className}`}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Main Controls */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Audio Player
            </h3>
            <div 
              className={`w-2 h-2 rounded-full ${tts.isPlaying ? 'animate-pulse-slow' : ''}`}
              style={{ 
                backgroundColor: tts.isPlaying 
                  ? 'var(--color-success)' 
                  : ttsManager.isPausedState() 
                    ? 'var(--color-warning)' 
                    : 'var(--color-text-tertiary)' 
              }}
            />
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar (Read-only) */}
        <div className="mb-3">
          <div
            ref={progressRef}
            className="w-full h-2 rounded-full relative"
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
              className="absolute top-0 w-4 h-4 rounded-full transform -translate-y-1 transition-transform"
              style={{ 
                left: `${progressPercentage}%`, 
                marginLeft: '-8px',
                backgroundColor: 'var(--color-primary)'
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            <span>{formatTime(currentTime)}</span>
            <span className="text-xs opacity-70">{progressPercentage.toFixed(0)}%</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleStop}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </button>
          
          <button
            onClick={handlePlayPause}
            disabled={isProcessing || isExtractingText}
            className="p-3 rounded-full transition-colors shadow-lg"
            style={{
              backgroundColor: (isProcessing || isExtractingText) ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              cursor: (isProcessing || isExtractingText) ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-lg)'
            }}
            onMouseEnter={(e) => {
              if (!isProcessing && !isExtractingText) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
            }}
            onMouseLeave={(e) => {
              if (!isProcessing && !isExtractingText) e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
            title={
              isProcessing 
                ? "Processing..." 
                : isExtractingText
                  ? "Extracting text for audio..."
                : tts.isPlaying 
                  ? "Pause" 
                  : ttsManager.isPausedState()
                    ? "Resume"
                    : "Play"
            }
          >
            {(isProcessing || isExtractingText) ? (
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-text-inverse)' }} />
            ) : tts.isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={handleMuteToggle}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={tts.volume > 0 ? "Mute" : "Unmute"}
          >
            {tts.volume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Current Voice Display */}
        {tts.voice && (
          <div className="mt-3 text-center">
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Current Voice
            </div>
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {tts.voice.name}
            </div>
          </div>
        )}

        {/* Expanded Controls */}
        {isExpanded && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            {/* Voice Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Voice Selection
                </label>
                <button
                  onClick={handleVoicePreview}
                  disabled={tts.isPlaying || !tts.voice}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (!tts.isPlaying && tts.voice) e.currentTarget.style.opacity = '0.8'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                  title="Preview current voice"
                >
                  <Play className="w-3 h-3" />
                  Preview
                </button>
              </div>
              <TTSVoiceSelector
                currentVoice={tts.voice}
                onVoiceChange={handleVoiceChange}
                disabled={tts.isPlaying}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Speed Control */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Speed: {tts.rate.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={tts.rate}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                  style={{ backgroundColor: 'var(--color-border)' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span>0.5x</span>
                  <span>2.0x</span>
                </div>
              </div>

              {/* Volume Control */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Volume: {Math.round(tts.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={tts.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                  style={{ backgroundColor: 'var(--color-border)' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full"
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
              </div>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tts.volume > 0 ? 'var(--color-primary)' : 'var(--color-error)' }}
                />
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {tts.volume > 0 ? 'Unmuted' : 'Muted'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Pitch: {tts.pitch.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={tts.pitch}
                  onChange={(e) => {
                    updateTTS({ pitch: parseFloat(e.target.value) })
                    ttsManager.setPitch(parseFloat(e.target.value))
                  }}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                  style={{ backgroundColor: 'var(--color-border)' }}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="highlightWords"
                  checked={tts.highlightCurrentWord}
                  onChange={(e) => updateTTS({ highlightCurrentWord: e.target.checked })}
                  className="w-4 h-4 rounded focus:ring-2"
                  style={{ 
                    accentColor: 'var(--color-primary)',
                  }}
                />
                <label htmlFor="highlightWords" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Highlight current word
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
