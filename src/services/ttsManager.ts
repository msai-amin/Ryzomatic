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
  resume: () => void | Promise<void>
  stop: () => void
  isSpeaking: () => boolean
  isPausedState: () => boolean
  setRate: (rate: number) => void
  setPitch: (pitch: number) => void
  setVolume: (volume: number) => void
  setVoice: (voice: any) => void
  cleanText: (text: string) => string
  splitIntoSentences: (text: string) => string[]
  getProgress?: () => number
  getCurrentTime?: () => number
  getDuration?: () => number
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
      splitIntoSentences: (text) => ttsService.splitIntoSentences(text),
      getProgress: () => ttsService.getProgress(),
      getCurrentTime: () => ttsService.getCurrentTime(),
      getDuration: () => ttsService.getDuration()
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
      splitIntoSentences: (text) => googleCloudTTSService.splitIntoSentences(text),
      getProgress: () => googleCloudTTSService.getProgress(),
      getCurrentTime: () => googleCloudTTSService.getCurrentTime(),
      getDuration: () => googleCloudTTSService.getDuration()
    })

    // Set default provider - prioritize Google Cloud TTS for better voice quality
    const nativeProvider = this.providers.get('native')
    const googleCloudProvider = this.providers.get('google-cloud')
    
    if (googleCloudProvider && googleCloudProvider.isAvailable && googleCloudProvider.isConfigured) {
      this.currentProvider = googleCloudProvider
      console.log('TTSManager: Using Google Cloud TTS as default provider (premium voices)')
    } else if (nativeProvider && nativeProvider.isAvailable) {
      this.currentProvider = nativeProvider
      console.log('TTSManager: Using Native TTS as fallback provider (supports word boundaries and progress)')
    } else {
      this.currentProvider = null
      console.warn('TTSManager: No TTS providers available')
    }
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
              // Check if voice object is valid
              if (!voice || typeof voice !== 'object') {
                return false;
              }
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
                voice && voice.name && (
                  voice.name.includes('Neural') || 
                  voice.name.includes('Studio')
                )
              ) || englishVoices.find((voice: any) => 
                voice && voice.name && voice.name.includes('Wavenet')
              ) || englishVoices[0]
            } else {
              // Fallback to any neural voice
              defaultVoice = voices.find((voice: any) => 
                voice && voice.name && (
                  voice.name.includes('Neural') || 
                  voice.name.includes('Wavenet') ||
                  voice.name.includes('Studio')
                )
              ) || voices[0]
            }
            
            if (defaultVoice) {
              // Ensure the voice has a model field if required
              const voiceWithModel = this.ensureGoogleCloudVoiceHasModel(defaultVoice)
              provider.setVoice(voiceWithModel)
              console.log('Set default Google Cloud TTS voice:', defaultVoice.name, `(${defaultVoice.languageCode})`)
              console.log('Voice object structure:', defaultVoice)
              console.log('Voice with model:', voiceWithModel)
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
    console.log('TTSManager.speak called:', {
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      hasOnEnd: !!onEnd,
      hasOnWord: !!onWord,
      currentProvider: this.currentProvider ? {
        name: this.currentProvider.name,
        type: this.currentProvider.type,
        isAvailable: this.currentProvider.isAvailable,
        isConfigured: this.currentProvider.isConfigured
      } : null
    })
    
    if (!this.currentProvider) {
      console.error('TTSManager.speak: No TTS provider available')
      throw new Error('No TTS provider available')
    }
    
    if (!text || text.trim().length === 0) {
      console.warn('TTSManager.speak: Empty or whitespace-only text provided')
      throw new Error('Cannot speak empty text')
    }
    
    // CRITICAL FIX: Stop any currently playing audio before starting new audio
    console.log('TTSManager.speak: Stopping any currently playing audio...')
    this.stop()
    
    // Small delay to ensure stop() completes before starting new playback
    // This prevents race conditions with stopRequested flags
    await new Promise(resolve => setTimeout(resolve, 50))
    
    console.log('TTSManager.speak: Calling provider.speak...')
    try {
      await this.currentProvider.speak(text, onEnd, onWord)
      console.log('TTSManager.speak: Provider.speak completed successfully')
    } catch (error) {
      console.error('TTSManager.speak: Provider.speak failed:', error)
      throw error
    }
  }

  pause(): void {
    if (this.currentProvider) {
      this.currentProvider.pause()
    }
  }

  async resume(): Promise<void> {
    if (this.currentProvider) {
      // Resume can be async for Google Cloud TTS (to handle AudioContext resume)
      if (this.currentProvider.type === 'google-cloud') {
        await (this.currentProvider.resume() as Promise<void>)
      } else {
        this.currentProvider.resume()
      }
    }
  }

  stop(): void {
    console.log('TTSManager.stop() called')
    // Stop all providers to ensure no audio is playing
    this.providers.forEach((provider, name) => {
      try {
        console.log(`TTSManager: Stopping provider ${name}`)
        provider.stop()
      } catch (error) {
        console.warn(`TTSManager: Error stopping provider ${name}:`, error)
      }
    })
    console.log('TTSManager: All providers stopped')
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
      console.log('TTSManager.setVoice called:', {
        providerType: this.currentProvider.type,
        voiceName: voice?.name,
        voiceHasModel: !!voice?.model,
        originalVoice: voice
      });
      
      // For Google Cloud TTS, ensure the voice has a model field if required
      if (this.currentProvider.type === 'google-cloud' && voice) {
        const voiceWithModel = this.ensureGoogleCloudVoiceHasModel(voice);
        console.log('TTSManager: Voice with model:', {
          originalName: voice.name,
          hasModel: !!voiceWithModel.model,
          modelValue: voiceWithModel.model,
          finalVoice: voiceWithModel
        });
        this.currentProvider.setVoice(voiceWithModel);
      } else {
        this.currentProvider.setVoice(voice);
      }
    }
  }

  // Filter out Studio voices - we only want voices that don't require model field
  private filterNonStudioVoices(voices: any[]): any[] {
    return voices.filter(voice => {
      // Exclude Studio voices and other voices that require model field
      return !voice.name.includes('Studio') && 
             !voice.name.includes('Journey') && 
             !voice.name.includes('Polyglot') &&
             voice.name !== 'Achernar' && 
             voice.name !== 'Algenib' && 
             voice.name !== 'Fenrir';
    });
  }

  // Ensure Google Cloud voice has model field - assign default model for all voices
  private ensureGoogleCloudVoiceHasModel(voice: any): any {
    if (!voice) return voice;
    
    // Create a copy of the voice object
    const voiceWithModel = { ...voice };
    
    // Always assign a model field - the API will tell us if it's not needed
    // This ensures voices like "Achird" that the API treats as Studio voices work
    if (!voiceWithModel.model) {
      voiceWithModel.model = 'gemini-2.5-flash';
    }
    
    return voiceWithModel;
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

  // Get current progress (0 to 1)
  getProgress(): number {
    if (this.currentProvider && this.currentProvider.getProgress) {
      return this.currentProvider.getProgress()
    }
    return 0
  }

  // Get current time in seconds
  getCurrentTime(): number {
    if (this.currentProvider && this.currentProvider.getCurrentTime) {
      return this.currentProvider.getCurrentTime()
    }
    return 0
  }

  // Get total duration in seconds
  getDuration(): number {
    if (this.currentProvider && this.currentProvider.getDuration) {
      return this.currentProvider.getDuration()
    }
    return 0
  }
}

// Export singleton instance
export const ttsManager = new TTSManager()
