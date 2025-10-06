import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
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
  const progressRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Update current time and duration
  useEffect(() => {
    const updateTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime)
        setDuration(audioRef.current.duration || 0)
      }
    }

    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [tts.isPlaying])

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (tts.isPlaying) {
      ttsManager.pause()
      updateTTS({ isPlaying: false })
    } else {
      try {
        // Get current document text for TTS
        const currentDoc = useAppStore.getState().currentDocument
        if (currentDoc && currentDoc.pageTexts) {
          const currentPage = useAppStore.getState().pdfViewer.currentPage
          const text = currentDoc.pageTexts[currentPage - 1] || ''
          
          if (text.trim()) {
            await ttsManager.speak(text, () => {
              updateTTS({ isPlaying: false })
            })
            updateTTS({ isPlaying: true })
          }
        }
      } catch (error) {
        console.error('TTS Error:', error)
        updateTTS({ isPlaying: false })
      }
    }
  }, [tts.isPlaying, updateTTS])

  // Handle stop
  const handleStop = useCallback(() => {
    ttsManager.stop()
    updateTTS({ isPlaying: false })
    setCurrentTime(0)
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

  // Handle progress bar click
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return
    
    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }, [duration])

  // Handle progress bar drag
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressClick(e)
  }, [handleProgressClick])

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Get progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Main Controls */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Audio Player
            </h3>
            <div className={`w-2 h-2 rounded-full ${
              tts.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div
            ref={progressRef}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer relative"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className="absolute top-0 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1 cursor-pointer hover:scale-110 transition-transform"
              style={{ left: `${progressPercentage}%`, marginLeft: '-8px' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handleStop}
            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </button>
          
          <button
            onClick={handlePlayPause}
            className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors shadow-lg"
            title={tts.isPlaying ? "Pause" : "Play"}
          >
            {tts.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={handleMuteToggle}
            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title={tts.volume > 0 ? "Mute" : "Unmute"}
          >
            {tts.volume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Expanded Controls */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              {/* Speed Control */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Speed: {tts.rate.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={tts.rate}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0.5x</span>
                  <span>2.0x</span>
                </div>
              </div>

              {/* Volume Control */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Volume: {Math.round(tts.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={tts.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  tts.isPlaying ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-gray-600 dark:text-gray-400">
                  {tts.isPlaying ? 'Playing' : 'Stopped'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  tts.volume > 0 ? 'bg-blue-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-600 dark:text-gray-400">
                  {tts.volume > 0 ? 'Unmuted' : 'Muted'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
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
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="highlightWords"
                  checked={tts.highlightCurrentWord}
                  onChange={(e) => updateTTS({ highlightCurrentWord: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="highlightWords" className="text-xs text-gray-600 dark:text-gray-400">
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
