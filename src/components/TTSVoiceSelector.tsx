import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Volume2, Loader2, Globe } from 'lucide-react'
import { ttsManager } from '../services/ttsManager'

interface Voice {
  name: string
  languageCode?: string
  locale?: string
  gender: string
  type?: string
}

interface TTSVoiceSelectorProps {
  currentVoice?: Voice | null
  onVoiceChange: (voice: Voice) => void
  disabled?: boolean
}

// Get flag emoji or globe icon for Azure TTS voices
const getVoiceIcon = (voiceName: string): string | React.ReactNode => {
  // Multilingual voices use globe icon
  if (voiceName.includes('Multilingual')) {
    return <Globe className="w-4 h-4" />
  }
  
  // Map locales to flag emojis
  if (voiceName.startsWith('en-US-')) {
    return '🇺🇸' // US flag
  }
  if (voiceName.startsWith('en-GB-')) {
    return '🇬🇧' // UK flag
  }
  if (voiceName.startsWith('en-AU-')) {
    return '🇦🇺' // Australia flag
  }
  if (voiceName.startsWith('en-IE-')) {
    return '🇮🇪' // Ireland flag
  }
  
  // Default: no icon
  return null
}

export const TTSVoiceSelector: React.FC<TTSVoiceSelectorProps> = ({
  currentVoice,
  onVoiceChange,
  disabled = false
}) => {
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAzureProvider, setIsAzureProvider] = useState(false)

  const loadVoices = useCallback(async () => {
    if (voices.length > 0) return // Already loaded
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Check if current provider is Azure
      const currentProvider = ttsManager.getCurrentProvider()
      const isAzure = currentProvider?.type === 'azure'
      setIsAzureProvider(isAzure)
      
      const availableVoices = await ttsManager.getVoices()
      setVoices(availableVoices)
    } catch (err) {
      console.error('Failed to load voices:', err)
      setError('Failed to load voices')
    } finally {
      setIsLoading(false)
    }
  }, [voices.length])

  useEffect(() => {
    loadVoices()
  }, [loadVoices])

  const handleVoiceSelect = useCallback((voice: Voice) => {
    onVoiceChange(voice)
    setIsOpen(false)
  }, [onVoiceChange])

  const getVoiceDisplayName = (voice: Voice) => {
    // For Azure TTS, show only the voice name with flag/globe
    if (isAzureProvider) {
      return voice.name
    }
    
    // For other providers, show full details
    const gender = voice.gender === 'FEMALE' ? '♀' : voice.gender === 'MALE' ? '♂' : ''
    const type = voice.type || (voice.name.includes('Neural') ? 'Neural' : 
                               voice.name.includes('Wavenet') ? 'Wavenet' : 
                               voice.name.includes('Studio') ? 'Studio' : 'Standard')
    return `${voice.name} ${gender} (${type})`
  }

  const getVoiceQuality = (voice: Voice) => {
    if (voice.name.includes('Neural') || voice.name.includes('Studio')) return 'high'
    if (voice.name.includes('Wavenet')) return 'medium'
    return 'standard'
  }

  const groupedVoices = voices.reduce((acc, voice) => {
    const quality = getVoiceQuality(voice)
    if (!acc[quality]) acc[quality] = []
    acc[quality].push(voice)
    return acc
  }, {} as Record<string, Voice[]>)

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-gray-500" />
          <span className="text-gray-700 flex items-center gap-2">
            {isLoading ? 'Loading voices...' : 
             currentVoice ? (
               <>
                 {isAzureProvider && getVoiceIcon(currentVoice.name) && (
                   <span>{getVoiceIcon(currentVoice.name)}</span>
                 )}
                 <span>{getVoiceDisplayName(currentVoice)}</span>
               </>
             ) : 
             'Select voice'}
          </span>
        </div>
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {error ? (
            <div className="px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : voices.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No voices available
            </div>
          ) : (
            <div className="py-1">
              {Object.entries(groupedVoices).map(([quality, qualityVoices]) => (
                <div key={quality}>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">
                    {quality} Quality
                  </div>
                  {qualityVoices.map((voice) => {
                    const voiceIcon = isAzureProvider ? getVoiceIcon(voice.name) : null
                    return (
                      <button
                        key={voice.name}
                        onClick={() => handleVoiceSelect(voice)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:outline-none focus:bg-gray-100 ${
                          currentVoice?.name === voice.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {voiceIcon && (
                              <span className="flex-shrink-0">{voiceIcon}</span>
                            )}
                            <span className="truncate">{getVoiceDisplayName(voice)}</span>
                          </div>
                          {currentVoice?.name === voice.name && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
