/**
 * TTS Manager
 * Manages both native and Google Cloud TTS services
 */

import { ttsService } from './ttsService'
import { googleCloudTTSService } from './googleCloudTTSService'
import { TTSSettings } from '../store/appStore'

export interface TTSProvider {
  name: string
  type: 'native' | 'google-cloud'
  isAvailable: boolean
  isConfigured: boolean
  getVoices: () => Promise<any[]>
  speak: (text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
  isSpeaking: () => boolean
  isPausedState: () => boolean
  setRate: (rate: number) => void
  setPitch: (pitch: number) => void
  setVolume: (volume: number) => void
  setVoice: (voice: any) => void
  cleanText: (text: string) => string
  splitIntoSentences: (text: string) => string[]
}

class TTSManager {
  private providers: Map<string, TTSProvider> = new Map()
  private currentProvider: TTSProvider | null = null

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // Native TTS Provider
    this.providers.set('native', {
      name: 'Native Browser TTS',
      type: 'native',
      isAvailable: ttsService.isSupported(),
      isConfigured: true,
      getVoices: async () => ttsService.getVoices(),
      speak: async (text, onEnd, onWord) => ttsService.speak(text, onEnd, onWord),
      pause: () => ttsService.pause(),
      resume: () => ttsService.resume(),
      stop: () => ttsService.stop(),
      isSpeaking: () => ttsService.isSpeaking(),
      isPausedState: () => ttsService.isPausedState(),
      setRate: (rate) => ttsService.setRate(rate),
      setPitch: (pitch) => ttsService.setPitch(pitch),
      setVolume: (volume) => ttsService.setVolume(volume),
      setVoice: (voice) => ttsService.setVoice(voice),
      cleanText: (text) => ttsService.cleanText(text),
      splitIntoSentences: (text) => ttsService.splitIntoSentences(text)
    })

    // Google Cloud TTS Provider
    this.providers.set('google-cloud', {
      name: 'Google Cloud TTS',
      type: 'google-cloud',
      isAvailable: googleCloudTTSService.isSupported(),
      isConfigured: googleCloudTTSService.isConfigured(),
      getVoices: async () => googleCloudTTSService.getVoices(),
      speak: async (text, onEnd, onWord) => googleCloudTTSService.speak(text, onEnd, onWord),
      pause: () => googleCloudTTSService.pause(),
      resume: () => googleCloudTTSService.resume(),
      stop: () => googleCloudTTSService.stop(),
      isSpeaking: () => googleCloudTTSService.isSpeaking(),
      isPausedState: () => googleCloudTTSService.isPausedState(),
      setRate: (rate) => googleCloudTTSService.setSpeakingRate(rate),
      setPitch: (pitch) => googleCloudTTSService.setPitch(pitch),
      setVolume: (volume) => googleCloudTTSService.setVolumeGain(volume),
      setVoice: (voice) => googleCloudTTSService.setVoice(voice),
      cleanText: (text) => googleCloudTTSService.cleanText(text),
      splitIntoSentences: (text) => googleCloudTTSService.splitIntoSentences(text)
    })

    // Set default provider
    this.currentProvider = this.providers.get('native') || null
  }

  getProviders(): TTSProvider[] {
    return Array.from(this.providers.values())
  }

  getAvailableProviders(): TTSProvider[] {
    return this.getProviders().filter(provider => provider.isAvailable)
  }

  getConfiguredProviders(): TTSProvider[] {
    return this.getProviders().filter(provider => provider.isAvailable && provider.isConfigured)
  }

  getCurrentProvider(): TTSProvider | null {
    return this.currentProvider
  }

  async setProvider(providerType: 'native' | 'google-cloud'): Promise<boolean> {
    const provider = this.providers.get(providerType)
    if (provider && provider.isAvailable && provider.isConfigured) {
      this.currentProvider = provider
      
      // For Google Cloud TTS, set a default voice if none is selected
      if (providerType === 'google-cloud') {
        try {
          const voices = await provider.getVoices()
          console.log('Available Google Cloud TTS voices:', voices.slice(0, 3)) // Show first 3 voices
          if (voices.length > 0) {
            // Prefer English voices first, then neural voices
            const englishVoices = voices.filter((voice: any) => {
              // Check if languageCode exists and starts with 'en-'
              if (voice.languageCode && voice.languageCode.startsWith('en-')) {
                return true;
              }
              // Fallback: check if voice name contains English language codes
              if (voice.name && /en-[A-Z]{2}/.test(voice.name)) {
                return true;
              }
              return false;
            })
            
            let defaultVoice = null
            
            if (englishVoices.length > 0) {
              // Find the best English voice (prefer neural/studio voices)
              defaultVoice = englishVoices.find((voice: any) => 
                voice.name && (
                  voice.name.includes('Neural') || 
                  voice.name.includes('Studio')
                )
              ) || englishVoices.find((voice: any) => 
                voice.name && voice.name.includes('Wavenet')
              ) || englishVoices[0]
            } else {
              // Fallback to any neural voice
              defaultVoice = voices.find((voice: any) => 
                voice.name && (
                  voice.name.includes('Neural') || 
                  voice.name.includes('Wavenet') ||
                  voice.name.includes('Studio')
                )
              ) || voices[0]
            }
            
            if (defaultVoice) {
              provider.setVoice(defaultVoice)
              console.log('Set default Google Cloud TTS voice:', defaultVoice.name, `(${defaultVoice.languageCode})`)
              console.log('Voice object structure:', defaultVoice)
            }
          }
        } catch (error) {
          console.warn('Failed to set default voice for Google Cloud TTS:', error)
        }
      }
      
      return true
    }
    return false
  }

  async getVoices(): Promise<any[]> {
    if (!this.currentProvider) {
      return []
    }
    return await this.currentProvider.getVoices()
  }

  async speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No TTS provider available')
    }
    return await this.currentProvider.speak(text, onEnd, onWord)
  }

  pause(): void {
    if (this.currentProvider) {
      this.currentProvider.pause()
    }
  }

  resume(): void {
    if (this.currentProvider) {
      this.currentProvider.resume()
    }
  }

  stop(): void {
    if (this.currentProvider) {
      this.currentProvider.stop()
    }
  }

  isSpeaking(): boolean {
    return this.currentProvider ? this.currentProvider.isSpeaking() : false
  }

  isPausedState(): boolean {
    return this.currentProvider ? this.currentProvider.isPausedState() : false
  }

  setRate(rate: number): void {
    if (this.currentProvider) {
      this.currentProvider.setRate(rate)
    }
  }

  setPitch(pitch: number): void {
    if (this.currentProvider) {
      this.currentProvider.setPitch(pitch)
    }
  }

  setVolume(volume: number): void {
    if (this.currentProvider) {
      this.currentProvider.setVolume(volume)
    }
  }

  setVoice(voice: any): void {
    if (this.currentProvider) {
      this.currentProvider.setVoice(voice)
    }
  }

  cleanText(text: string): string {
    return this.currentProvider ? this.currentProvider.cleanText(text) : text
  }

  splitIntoSentences(text: string): string[] {
    return this.currentProvider ? this.currentProvider.splitIntoSentences(text) : [text]
  }

  // Get provider-specific settings
  getProviderSettings(providerType: 'native' | 'google-cloud'): any {
    switch (providerType) {
      case 'native':
        return ttsService.getSettings()
      case 'google-cloud':
        return googleCloudTTSService.getSettings()
      default:
        return null
    }
  }

  // Update provider-specific settings
  updateProviderSettings(providerType: 'native' | 'google-cloud', settings: any): void {
    switch (providerType) {
      case 'native':
        if (settings.rate !== undefined) ttsService.setRate(settings.rate)
        if (settings.pitch !== undefined) ttsService.setPitch(settings.pitch)
        if (settings.volume !== undefined) ttsService.setVolume(settings.volume)
        if (settings.voice !== undefined) ttsService.setVoice(settings.voice)
        break
      case 'google-cloud':
        if (settings.speakingRate !== undefined) googleCloudTTSService.setSpeakingRate(settings.speakingRate)
        if (settings.pitch !== undefined) googleCloudTTSService.setPitch(settings.pitch)
        if (settings.volumeGainDb !== undefined) googleCloudTTSService.setVolumeGain(settings.volumeGainDb)
        if (settings.voice !== undefined) googleCloudTTSService.setVoice(settings.voice)
        break
    }
  }

  // Get estimated cost for Google Cloud TTS
  getEstimatedCost(text: string): number {
    if (this.currentProvider?.type === 'google-cloud') {
      return googleCloudTTSService.getEstimatedCost(text)
    }
    return 0 // Native TTS is free
  }
}

// Export singleton instance
export const ttsManager = new TTSManager()
