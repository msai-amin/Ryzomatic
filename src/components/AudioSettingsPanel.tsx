import React, { useCallback } from 'react'
import { X, Play } from 'lucide-react'
import { useAppStore, Voice } from '../store/appStore'
import { ttsManager } from '../services/ttsManager'
import { TTSVoiceSelector } from './TTSVoiceSelector'

interface AudioSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  widgetPosition?: { x: number; y: number }
  widgetHeight?: number
  widgetWidth?: number
}

export const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({ isOpen, onClose, widgetPosition, widgetHeight = 160, widgetWidth = 260 }) => {
  const { tts, updateTTS } = useAppStore()

  // Handle speed change
  const handleSpeedChange = useCallback((speed: number) => {
    updateTTS({ rate: speed })
    ttsManager.setRate(speed)
  }, [updateTTS])

  // Handle pitch change
  const handlePitchChange = useCallback((pitch: number) => {
    updateTTS({ pitch })
    ttsManager.setPitch(pitch)
  }, [updateTTS])

  // Handle volume change
  const handleVolumeChange = useCallback((volume: number) => {
    updateTTS({ volume })
    ttsManager.setVolume(volume)
  }, [updateTTS])

  // Handle voice change
  const handleVoiceChange = useCallback(async (voice: Voice) => {
    try {
      console.log('AudioSettingsPanel: Voice change requested:', voice.name)
      ttsManager.setVoice(voice)
      updateTTS({ 
        voice: voice,
        voiceName: voice.name 
      })
    } catch (error) {
      console.error('Error changing voice:', error)
    }
  }, [updateTTS])

  // Handle voice preview
  const handleVoicePreview = useCallback(async () => {
    try {
      // Check if anything is currently playing (store state or actual TTSManager state)
      if (tts.isPlaying || ttsManager.isSpeaking()) {
        ttsManager.stop()
        updateTTS({ isPlaying: false, isPaused: false })
        return
      }

      const currentProvider = ttsManager.getCurrentProvider()
      if (currentProvider && tts.voice) {
        // Stop any existing playback
        ttsManager.stop()
        
        // CRITICAL: Ensure all settings are applied before preview
        console.log('AudioSettingsPanel: Setting voice and TTS settings for preview', {
          voice: tts.voice,
          rate: tts.rate,
          pitch: tts.pitch,
          volume: tts.volume
        })
        
        // Set voice first
        ttsManager.setVoice(tts.voice)
        
        // Apply all TTS settings to ensure they're used in the preview
        ttsManager.setRate(tts.rate)
        ttsManager.setPitch(tts.pitch)
        ttsManager.setVolume(tts.volume)
        
        // Small delay to ensure settings are applied
        await new Promise(resolve => setTimeout(resolve, 100))
        
        updateTTS({ isPlaying: true, isPaused: false })
        
        // Preview the current voice with a sample text
        const previewText = "Hello! This is how I sound when reading your documents."
        await ttsManager.speak(previewText, () => {
          // Update store when preview ends
          console.log('Voice preview completed')
          updateTTS({ isPlaying: false, isPaused: false })
        })
      } else {
        console.warn('AudioSettingsPanel: Cannot preview - no provider or voice', {
          hasProvider: !!currentProvider,
          hasVoice: !!tts.voice
        })
      }
    } catch (error) {
      console.error('Error previewing voice:', error)
      updateTTS({ isPlaying: false, isPaused: false })
    }
  }, [tts.voice, tts.rate, tts.pitch, tts.volume, tts.isPlaying, updateTTS])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div 
        className="fixed z-[100001] w-96 rounded-lg shadow-2xl animate-fadeIn"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          maxHeight: '80vh',
          overflowY: 'auto',
          // Position above the widget if widget position is provided, otherwise use default bottom-right
          ...(widgetPosition && typeof window !== 'undefined' ? {
            right: `${Math.max(16, window.innerWidth - widgetPosition.x - widgetWidth)}px`, // Align right edge with widget, min 16px from edge
            bottom: `${window.innerHeight - widgetPosition.y - widgetHeight - 16}px`, // Position above widget with 16px gap
          } : {
            bottom: '96px', // Default: 24px (bottom-24) + 72px for widget height
            right: '32px', // Default: 8px (right-8) * 4
          })
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 p-4 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            zIndex: 10
          }}
        >
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Audio Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Voice Selection */}
          <div data-onboarding="onboarding-tts-voice">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Voice Selection
              </label>
              <button
                onClick={handleVoicePreview}
                disabled={tts.isPlaying || !tts.voice}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
                onMouseEnter={(e) => {
                  if (!tts.isPlaying && tts.voice) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Preview current voice"
              >
                <Play className="w-3 h-3" />
                Preview Voice
              </button>
            </div>
            <TTSVoiceSelector
              currentVoice={tts.voice}
              onVoiceChange={handleVoiceChange}
              disabled={tts.isPlaying}
            />
          </div>

          {/* Speed Control */}
          <div data-onboarding="onboarding-tts-speed">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Playback Speed: {tts.rate.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={tts.rate}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
              style={{ 
                backgroundColor: 'var(--color-border)',
                accentColor: 'var(--color-primary)'
              }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>0.5x</span>
              <span>1.0x</span>
              <span>2.0x</span>
            </div>
          </div>

          {/* Volume Control */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
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
              style={{ 
                backgroundColor: 'var(--color-border)',
                accentColor: 'var(--color-primary)'
              }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Pitch Control */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Pitch: {tts.pitch.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={tts.pitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
              style={{ 
                backgroundColor: 'var(--color-border)',
                accentColor: 'var(--color-primary)'
              }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>Low</span>
              <span>Normal</span>
              <span>High</span>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <label htmlFor="highlightWords" className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Highlight current word
              </label>
              <input
                type="checkbox"
                id="highlightWords"
                checked={tts.highlightCurrentWord}
                onChange={(e) => updateTTS({ highlightCurrentWord: e.target.checked })}
                className="w-5 h-5 rounded focus:ring-2"
                style={{ 
                  accentColor: 'var(--color-primary)',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="autoAdvance" className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Auto-advance paragraphs
              </label>
              <input
                type="checkbox"
                id="autoAdvance"
                checked={tts.autoAdvanceParagraph}
                onChange={(e) => updateTTS({ autoAdvanceParagraph: e.target.checked })}
                className="w-5 h-5 rounded focus:ring-2"
                style={{ 
                  accentColor: 'var(--color-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

