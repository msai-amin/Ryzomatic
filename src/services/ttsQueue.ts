/**
 * TTS Queue Manager
 * 
 * Implements gapless playback by managing a queue of text segments.
 * Prefetches and buffers the next segment while the current one is playing.
 */

export interface QueuedSegment {
  id: string
  text: string
  mode: 'paragraph' | 'page' | 'continue'
  index: number // Paragraph/page index
  onStart?: () => void
  onEnd?: () => void
  onWord?: (word: string, charIndex: number) => void
}

export interface TTSQueueOptions {
  prefetchCount?: number // How many segments to prefetch ahead
  onQueueEmpty?: () => void
  onSegmentStart?: (segment: QueuedSegment) => void
  onSegmentEnd?: (segment: QueuedSegment) => void
}

export class TTSQueue {
  private queue: QueuedSegment[] = []
  private currentSegment: QueuedSegment | null = null
  private isPlaying: boolean = false
  private isPaused: boolean = false
  private prefetchCount: number
  private onQueueEmpty?: () => void
  private onSegmentStart?: (segment: QueuedSegment) => void
  private onSegmentEnd?: (segment: QueuedSegment) => void
  
  constructor(options: TTSQueueOptions = {}) {
    this.prefetchCount = options.prefetchCount || 2
    this.onQueueEmpty = options.onQueueEmpty
    this.onSegmentStart = options.onSegmentStart
    this.onSegmentEnd = options.onSegmentEnd
  }
  
  /**
   * Add a segment to the queue
   */
  enqueue(segment: QueuedSegment): void {
    this.queue.push(segment)
    console.log('🎵 TTSQueue: Enqueued segment', segment.id, '| Queue size:', this.queue.length)
  }
  
  /**
   * Add multiple segments to the queue
   */
  enqueueMany(segments: QueuedSegment[]): void {
    this.queue.push(...segments)
    console.log('🎵 TTSQueue: Enqueued', segments.length, 'segments | Queue size:', this.queue.length)
  }
  
  /**
   * Get the next segment without removing it
   */
  peek(): QueuedSegment | null {
    return this.queue[0] || null
  }
  
  /**
   * Get the next N segments without removing them
   */
  peekMany(count: number): QueuedSegment[] {
    return this.queue.slice(0, count)
  }
  
  /**
   * Remove and return the next segment
   */
  dequeue(): QueuedSegment | null {
    const segment = this.queue.shift() || null
    if (segment) {
      console.log('🎵 TTSQueue: Dequeued segment', segment.id, '| Remaining:', this.queue.length)
    }
    return segment
  }
  
  /**
   * Get current segment
   */
  getCurrent(): QueuedSegment | null {
    return this.currentSegment
  }
  
  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length
  }
  
  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }
  
  /**
   * Clear the queue
   */
  clear(): void {
    console.log('🎵 TTSQueue: Clearing queue (had', this.queue.length, 'segments)')
    this.queue = []
    this.currentSegment = null
  }
  
  /**
   * Mark segment as started
   */
  markSegmentStarted(segment: QueuedSegment): void {
    this.currentSegment = segment
    this.isPlaying = true
    console.log('🎵 TTSQueue: Segment started', segment.id)
    
    if (segment.onStart) {
      segment.onStart()
    }
    
    if (this.onSegmentStart) {
      this.onSegmentStart(segment)
    }
  }
  
  /**
   * Mark segment as ended
   */
  markSegmentEnded(segment: QueuedSegment): void {
    console.log('🎵 TTSQueue: Segment ended', segment.id)
    
    if (segment.onEnd) {
      segment.onEnd()
    }
    
    if (this.onSegmentEnd) {
      this.onSegmentEnd(segment)
    }
    
    // Check if queue is now empty
    if (this.isEmpty()) {
      console.log('🎵 TTSQueue: Queue is now empty')
      this.isPlaying = false
      this.currentSegment = null
      
      if (this.onQueueEmpty) {
        this.onQueueEmpty()
      }
    }
  }
  
  /**
   * Pause playback
   */
  pause(): void {
    this.isPaused = true
    console.log('🎵 TTSQueue: Paused')
  }
  
  /**
   * Resume playback
   */
  resume(): void {
    this.isPaused = false
    console.log('🎵 TTSQueue: Resumed')
  }
  
  /**
   * Stop playback and clear queue
   */
  stop(): void {
    this.isPlaying = false
    this.isPaused = false
    this.currentSegment = null
    this.clear()
    console.log('🎵 TTSQueue: Stopped')
  }
  
  /**
   * Get playback state
   */
  getState(): {
    isPlaying: boolean
    isPaused: boolean
    queueSize: number
    currentSegment: QueuedSegment | null
  } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      queueSize: this.queue.length,
      currentSegment: this.currentSegment
    }
  }
}

/**
 * Create segments from paragraphs for queueing
 */
export function createSegmentsFromParagraphs(
  paragraphs: string[],
  startIndex: number = 0,
  mode: 'paragraph' | 'page' | 'continue' = 'paragraph'
): QueuedSegment[] {
  return paragraphs.map((text, index) => ({
    id: `${mode}-${startIndex + index}`,
    text,
    mode,
    index: startIndex + index
  }))
}

/**
 * Create a single segment
 */
export function createSegment(
  text: string,
  mode: 'paragraph' | 'page' | 'continue',
  index: number
): QueuedSegment {
  return {
    id: `${mode}-${index}`,
    text,
    mode,
    index
  }
}

