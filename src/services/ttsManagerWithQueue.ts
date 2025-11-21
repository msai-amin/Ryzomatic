/**
 * TTS Manager with Queue Support
 * 
 * Extends the base TTSManager with gapless playback capabilities.
 * Manages a queue of text segments and automatically plays the next one
 * when the current segment finishes.
 */

import { ttsManager as baseTTSManager } from './ttsManager'
import { TTSQueue, QueuedSegment, createSegment } from './ttsQueue'

class TTSManagerWithQueue {
  private queue: TTSQueue
  private isQueueMode: boolean = false
  private autoAdvance: boolean = true
  
  constructor() {
    this.queue = new TTSQueue({
      prefetchCount: 2,
      onQueueEmpty: () => {
        console.log('🎵 TTSManagerWithQueue: Queue empty, playback complete')
        this.isQueueMode = false
      },
      onSegmentStart: (segment) => {
        console.log('🎵 TTSManagerWithQueue: Starting segment', segment.id)
      },
      onSegmentEnd: (segment) => {
        console.log('🎵 TTSManagerWithQueue: Segment ended', segment.id)
        
        // Auto-advance to next segment if enabled
        if (this.autoAdvance && !this.queue.isEmpty()) {
          this.playNextInQueue()
        }
      }
    })
  }
  
  /**
   * Play a single text segment (legacy mode - no queue)
   */
  async speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    // If in queue mode, stop queue first
    if (this.isQueueMode) {
      this.stopQueue()
    }
    
    return baseTTSManager.speak(text, onEnd, onWord)
  }
  
  /**
   * Start queue-based playback with multiple segments
   */
  async startQueue(segments: QueuedSegment[]): Promise<void> {
    console.log('🎵 TTSManagerWithQueue: Starting queue with', segments.length, 'segments')
    
    // Stop any current playback
    this.stop()
    
    // Clear and populate queue
    this.queue.clear()
    this.queue.enqueueMany(segments)
    
    // Enable queue mode
    this.isQueueMode = true
    this.autoAdvance = true
    
    // Start playing first segment
    await this.playNextInQueue()
  }
  
  /**
   * Play the next segment in the queue
   */
  private async playNextInQueue(): Promise<void> {
    const segment = this.queue.dequeue()
    
    if (!segment) {
      console.log('🎵 TTSManagerWithQueue: No more segments in queue')
      this.isQueueMode = false
      return
    }
    
    // Mark segment as started
    this.queue.markSegmentStarted(segment)
    
    // Play the segment
    try {
      await baseTTSManager.speak(
        segment.text,
        // onEnd callback
        () => {
          // Mark segment as ended
          this.queue.markSegmentEnded(segment)
          
          // Call segment's onEnd if provided
          if (segment.onEnd) {
            segment.onEnd()
          }
          
          // Auto-advance is handled by queue's onSegmentEnd
        },
        // onWord callback
        segment.onWord
      )
    } catch (error) {
      console.error('🎵 TTSManagerWithQueue: Error playing segment', segment.id, error)
      this.queue.markSegmentEnded(segment)
      
      // Try to continue with next segment
      if (this.autoAdvance && !this.queue.isEmpty()) {
        await this.playNextInQueue()
      }
    }
  }
  
  /**
   * Add a segment to the queue (for dynamic queueing)
   */
  enqueueSegment(segment: QueuedSegment): void {
    this.queue.enqueue(segment)
    
    // If not currently playing, start
    if (!this.isQueueMode || !baseTTSManager.isSpeaking()) {
      this.isQueueMode = true
      this.playNextInQueue()
    }
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    baseTTSManager.pause()
    this.queue.pause()
  }
  
  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    this.queue.resume()
    await baseTTSManager.resume()
  }
  
  /**
   * Stop playback (legacy mode)
   */
  stop(): void {
    baseTTSManager.stop()
    
    if (this.isQueueMode) {
      this.stopQueue()
    }
  }
  
  /**
   * Stop queue-based playback
   */
  stopQueue(): void {
    console.log('🎵 TTSManagerWithQueue: Stopping queue')
    baseTTSManager.stop()
    this.queue.stop()
    this.isQueueMode = false
  }
  
  /**
   * Skip to next segment in queue
   */
  async skipToNext(): Promise<void> {
    if (!this.isQueueMode) {
      console.warn('🎵 TTSManagerWithQueue: Not in queue mode, cannot skip')
      return
    }
    
    // Stop current segment
    baseTTSManager.stop()
    
    // Play next segment
    await this.playNextInQueue()
  }
  
  /**
   * Check if speaking
   */
  isSpeaking(): boolean {
    return baseTTSManager.isSpeaking()
  }
  
  /**
   * Check if paused
   */
  isPausedState(): boolean {
    return baseTTSManager.isPausedState()
  }
  
  /**
   * Check if in queue mode
   */
  isInQueueMode(): boolean {
    return this.isQueueMode
  }
  
  /**
   * Get queue state
   */
  getQueueState() {
    return this.queue.getState()
  }
  
  /**
   * Set rate
   */
  setRate(rate: number): void {
    baseTTSManager.setRate(rate)
  }
  
  /**
   * Set pitch
   */
  setPitch(pitch: number): void {
    baseTTSManager.setPitch(pitch)
  }
  
  /**
   * Set volume
   */
  setVolume(volume: number): void {
    baseTTSManager.setVolume(volume)
  }
  
  /**
   * Set voice
   */
  setVoice(voice: any): void {
    baseTTSManager.setVoice(voice)
  }
  
  /**
   * Get voices
   */
  async getVoices(): Promise<any[]> {
    return baseTTSManager.getVoices()
  }
  
  /**
   * Get current time
   */
  getCurrentTime(): number {
    return baseTTSManager.getCurrentTime?.() || 0
  }
  
  /**
   * Get duration
   */
  getDuration(): number {
    return baseTTSManager.getDuration?.() || 0
  }
  
  /**
   * Get progress
   */
  getProgress(): number {
    return baseTTSManager.getProgress?.() || 0
  }
  
  /**
   * Set provider
   */
  async setProvider(providerType: 'native' | 'google-cloud'): Promise<boolean> {
    return baseTTSManager.setProvider(providerType)
  }
  
  /**
   * Get current provider
   */
  getCurrentProvider() {
    return baseTTSManager.getCurrentProvider()
  }
  
  /**
   * Get available providers
   */
  getAvailableProviders() {
    return baseTTSManager.getAvailableProviders()
  }
}

// Export singleton instance
export const ttsManagerWithQueue = new TTSManagerWithQueue()

// Also export the class for testing
export { TTSManagerWithQueue }

