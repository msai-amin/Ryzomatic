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

    // Validate audio buffer
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      throw new Error('Empty audio buffer provided')
    }

    // Check if it looks like MP3 (starts with ID3 tag or MP3 sync word)
    const view = new Uint8Array(audioBuffer.slice(0, 4))
    const isID3 = view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33 // "ID3"
    const isMP3 = view[0] === 0xFF && (view[1] === 0xFB || view[1] === 0xF3) // MP3 sync word
    
    console.log('HowlerAudioPlayer: Audio buffer validation', {
      size: audioBuffer.byteLength,
      firstBytes: Array.from(view).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
      isID3,
      isMP3,
      looksValid: isID3 || isMP3
    })

    // Convert ArrayBuffer to Blob URL
    // Use audio/mpeg (standard MIME type) instead of audio/mp3
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    this.blobUrl = URL.createObjectURL(blob)

    console.log('HowlerAudioPlayer: Created blob URL', {
      blobSize: audioBuffer.byteLength,
      blobType: blob.type,
      blobUrl: this.blobUrl.substring(0, 50) + '...'
    })

    let resolvePromise: (() => void) | null = null
    let rejectPromise: ((error: Error) => void) | null = null
    let playbackStarted = false

    return new Promise((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject

      this.currentSound = new Howl({
        src: [this.blobUrl!],
        format: ['mp3', 'mpeg'], // Try both formats
        html5: true, // Use HTML5 audio for better blob URL support
        autoplay: true,
        volume: 1.0,
        
        onload: () => {
          console.log('HowlerAudioPlayer: Audio loaded successfully')
          this.startTime = Date.now()
          this.startWordTracking()
          
          // CRITICAL FIX: Explicitly call play() to ensure playback starts
          // autoplay: true with html5: true may be blocked by browser policies
          // Explicit play() call ensures playback starts even if autoplay fails
          if (this.currentSound) {
            const playId = this.currentSound.play()
            if (playId === undefined) {
              console.warn('HowlerAudioPlayer: play() returned undefined, audio may be blocked')
              // Try again after a short delay in case it's a timing issue
              setTimeout(() => {
                if (this.currentSound && !this.currentSound.playing()) {
                  const retryId = this.currentSound.play()
                  if (retryId === undefined) {
                    console.error('HowlerAudioPlayer: play() failed after retry, audio may be blocked by browser policy')
                    if (rejectPromise) {
                      rejectPromise(new Error('Audio playback blocked by browser autoplay policy'))
                      rejectPromise = null
                      resolvePromise = null
                    }
                  } else {
                    console.log('HowlerAudioPlayer: Playback started on retry')
                  }
                }
              }, 100)
            } else {
              console.log('HowlerAudioPlayer: play() called successfully, playback should start')
            }
          }
          // Don't resolve here - wait for playback to end
        },
        
        onloaderror: (id, error) => {
          console.error('HowlerAudioPlayer: Load error', error)
          this.cleanup()
          if (rejectPromise) {
            rejectPromise(new Error(`Audio load failed: ${error}`))
            rejectPromise = null
            resolvePromise = null
          }
        },
        
        onplay: () => {
          console.log('HowlerAudioPlayer: Playback started')
          playbackStarted = true
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
          // Resolve the promise when playback ends (for sequential chunk playback)
          if (resolvePromise) {
            resolvePromise()
            resolvePromise = null
            rejectPromise = null
          }
          this.cleanup()
        },
        
        onstop: () => {
          console.log('HowlerAudioPlayer: Playback stopped')
          this.stopWordTracking()
          // Resolve even if stopped (so next chunk can start)
          if (resolvePromise) {
            resolvePromise()
            resolvePromise = null
            rejectPromise = null
          }
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
    
    if (this.currentSound) {
      // CRITICAL FIX: Stop and unload properly to prevent HTML5 audio pool exhaustion
      // Stop the sound first to release the audio element immediately
      try {
        if (this.currentSound.playing()) {
          this.currentSound.stop()
        }
      } catch (error) {
        console.warn('HowlerAudioPlayer: Error stopping sound during cleanup', error)
      }
      
      // Unload to release all resources
      try {
        this.currentSound.unload()
      } catch (error) {
        console.warn('HowlerAudioPlayer: Error unloading sound during cleanup', error)
      }
      
      this.currentSound = null
    }
    
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
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

