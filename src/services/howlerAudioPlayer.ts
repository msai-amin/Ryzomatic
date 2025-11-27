/**
 * Howler Audio Player Wrapper
 * 
 * Wraps Howler.js to provide a consistent interface for TTS audio playback.
 * Handles ArrayBuffer to Blob URL conversion, word tracking, and cleanup.
 */

import { Howl } from 'howler'

export class HowlerAudioPlayer {
  private currentSound: Howl | null = null
  private blobUrl: string | null = null
  private isPaused: boolean = false
  private onEndCallback: (() => void) | null = null
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null
  private wordTrackingInterval: number | null = null
  private text: string = ''
  private startTime: number = 0
  private pausedAt: number = 0
  private totalPauseDuration: number = 0

  /**
   * Play audio from ArrayBuffer
   * @param audioBuffer - The audio data as ArrayBuffer
   * @param onEnd - Callback when playback ends
   * @param onWord - Callback for word tracking (word, charIndex)
   * @param text - The text being spoken (for word tracking)
   */
  async playAudio(
    audioBuffer: ArrayBuffer,
    onEnd?: () => void,
    onWord?: (word: string, charIndex: number) => void,
    text?: string
  ): Promise<void> {
    // Clean up previous sound
    this.cleanup()

    // Store callbacks and text
    this.onEndCallback = onEnd || null
    this.onWordCallback = onWord || null
    this.text = text || ''
    this.startTime = Date.now()
    this.pausedAt = 0
    this.totalPauseDuration = 0

    // Convert ArrayBuffer to Blob URL
    const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
    this.blobUrl = URL.createObjectURL(blob)

    return new Promise((resolve, reject) => {
      this.currentSound = new Howl({
        src: [this.blobUrl!],
        format: ['mp3'],
        html5: false, // Use Web Audio API (not HTML5 audio)
        autoplay: true,
        volume: 1.0,
        
        onload: () => {
          console.log('HowlerAudioPlayer: Audio loaded successfully')
          this.startTime = Date.now()
          this.startWordTracking()
          resolve()
        },
        
        onloaderror: (id, error) => {
          console.error('HowlerAudioPlayer: Load error', error)
          this.cleanup()
          reject(new Error(`Audio load failed: ${error}`))
        },
        
        onplay: () => {
          console.log('HowlerAudioPlayer: Playback started')
          this.isPaused = false
          // Adjust start time if we were paused
          if (this.pausedAt > 0) {
            this.totalPauseDuration += Date.now() - this.pausedAt
            this.pausedAt = 0
          }
        },
        
        onpause: () => {
          console.log('HowlerAudioPlayer: Playback paused')
          this.isPaused = true
          this.pausedAt = Date.now()
          this.stopWordTracking()
        },
        
        onend: () => {
          console.log('HowlerAudioPlayer: Playback ended')
          this.stopWordTracking()
          if (this.onEndCallback) {
            this.onEndCallback()
          }
          this.cleanup()
        },
        
        onstop: () => {
          console.log('HowlerAudioPlayer: Playback stopped')
          this.stopWordTracking()
          this.cleanup()
        }
      })
    })
  }

  pause(): void {
    if (this.currentSound && this.currentSound.playing()) {
      this.currentSound.pause()
      this.isPaused = true
    }
  }

  resume(): void {
    if (this.currentSound && this.isPaused) {
      this.currentSound.play()
      this.isPaused = false
      // Adjust pause duration when resuming
      if (this.pausedAt > 0) {
        this.totalPauseDuration += Date.now() - this.pausedAt
        this.pausedAt = 0
      }
      this.startWordTracking()
    }
  }

  stop(): void {
    if (this.currentSound) {
      this.currentSound.stop()
    }
    this.cleanup()
  }

  isSpeaking(): boolean {
    return this.currentSound?.playing() ?? false
  }

  isPausedState(): boolean {
    return this.isPaused
  }

  getCurrentTime(): number {
    if (!this.currentSound) return 0
    const seek = this.currentSound.seek()
    return typeof seek === 'number' ? seek : 0
  }

  getDuration(): number {
    if (!this.currentSound) return 0
    return this.currentSound.duration() ?? 0
  }

  getProgress(): number {
    const duration = this.getDuration()
    if (duration === 0) return 0
    const currentTime = this.getCurrentTime()
    return Math.min(currentTime / duration, 1)
  }

  setVolume(volume: number): void {
    if (this.currentSound) {
      this.currentSound.volume(volume)
    }
  }

  /**
   * Start word tracking using timing estimation
   */
  private startWordTracking(): void {
    if (!this.onWordCallback || !this.text) return

    this.stopWordTracking()

    const words = this.text.split(/\s+/).filter(w => w.length > 0)
    if (words.length === 0) return

    const estimatedDuration = this.getDuration()
    if (estimatedDuration === 0) {
      // Wait a bit for duration to be available
      setTimeout(() => this.startWordTracking(), 100)
      return
    }

    const millisecondsPerWord = (estimatedDuration * 1000) / words.length
    let currentWordIndex = 0
    const trackingStartTime = Date.now()

    this.wordTrackingInterval = window.setInterval(() => {
      if (!this.currentSound || !this.currentSound.playing()) {
        this.stopWordTracking()
        return
      }

      // Calculate elapsed time accounting for pauses
      const now = Date.now()
      const elapsed = (now - trackingStartTime - this.totalPauseDuration) / 1000 // seconds
      
      // Calculate current word index based on elapsed time
      const newWordIndex = Math.floor((elapsed * 1000) / millisecondsPerWord)

      if (newWordIndex !== currentWordIndex && newWordIndex < words.length) {
        currentWordIndex = newWordIndex
        const word = words[currentWordIndex]
        
        // Estimate character index (rough approximation)
        // Find the position of this word in the original text
        let charIndex = 0
        const wordsBefore = words.slice(0, currentWordIndex)
        if (wordsBefore.length > 0) {
          // Find where previous words end
          const textBefore = wordsBefore.join(' ')
          charIndex = this.text.indexOf(textBefore) + textBefore.length
          // Skip whitespace
          while (charIndex < this.text.length && /\s/.test(this.text[charIndex])) {
            charIndex++
          }
        }
        
        this.onWordCallback(word, charIndex)
      }
    }, 100) // Check every 100ms
  }

  /**
   * Stop word tracking
   */
  private stopWordTracking(): void {
    if (this.wordTrackingInterval !== null) {
      clearInterval(this.wordTrackingInterval)
      this.wordTrackingInterval = null
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.stopWordTracking()
    
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
    
    if (this.currentSound) {
      this.currentSound.unload()
      this.currentSound = null
    }
    
    this.isPaused = false
    this.onEndCallback = null
    this.onWordCallback = null
    this.text = ''
    this.startTime = 0
    this.pausedAt = 0
    this.totalPauseDuration = 0
  }
}

