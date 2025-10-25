/**
 * PDF Extraction Retry Logic
 * 
 * Robust retry mechanisms with exponential backoff for vision API calls
 * Implements graceful degradation and error recovery strategies
 */

import { logger } from '../services/logger';

export interface RetryOptions {
  maxAttempts?: number // Default: 3
  initialDelay?: number // Default: 1000ms
  maxDelay?: number // Default: 10000ms
  backoffMultiplier?: number // Default: 2
  timeout?: number // Default: 30000ms
  onRetry?: (attempt: number, error: Error) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalTime: number
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    timeout = 30000,
    onRetry
  } = options

  const startTime = Date.now()
  let lastError: Error | undefined
  let attempt = 0

  for (attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      })

      // Race between function execution and timeout
      const data = await Promise.race([fn(), timeoutPromise])

      // Success!
      return {
        success: true,
        data,
        attempts: attempt,
        totalTime: Date.now() - startTime
      }

    } catch (error) {
      lastError = error as Error
      
      logger.warn(`Attempt ${attempt}/${maxAttempts} failed`, {
        component: 'RetryLogic',
        action: 'retryWithBackoff'
      }, error as Error)

      // If this was the last attempt, don't wait
      if (attempt === maxAttempts) {
        break
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError)
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      )

      // Add jitter (±20%) to prevent thundering herd
      const jitter = delay * 0.2 * (Math.random() * 2 - 1)
      const finalDelay = Math.max(0, delay + jitter)

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, finalDelay))
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: attempt,
    totalTime: Date.now() - startTime
  }
}

/**
 * Retry vision API call with specialized error handling
 */
export async function retryVisionExtraction<T>(
  fn: () => Promise<T>,
  context: { pageNumber: number; documentId?: string }
): Promise<T | null> {
  const logContext = {
    component: 'VisionRetry',
    action: 'retryVisionExtraction',
    pageNumber: context.pageNumber,
    documentId: context.documentId
  }

  logger.info('Starting vision extraction with retry', logContext)

  const result = await retryWithBackoff(fn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    timeout: 30000,
    onRetry: (attempt, error) => {
      logger.info(`Retrying vision extraction (attempt ${attempt})`, logContext, {
        error: error.message
      })
    }
  })

  if (result.success && result.data) {
    logger.info('Vision extraction succeeded', logContext, {
      attempts: result.attempts,
      totalTime: result.totalTime
    })
    return result.data
  }

  // Handle specific error cases
  if (result.error) {
    const errorMessage = result.error.message.toLowerCase()

    // Rate limit error - could queue for later
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      logger.warn('Vision API rate limit hit', logContext, result.error, {
        attempts: result.attempts
      })
    }
    // Timeout error - try with smaller image next time
    else if (errorMessage.includes('timeout')) {
      logger.warn('Vision API timeout', logContext, result.error, {
        attempts: result.attempts,
        suggestion: 'Try smaller image size'
      })
    }
    // API error - service might be down
    else if (errorMessage.includes('api') || errorMessage.includes('service')) {
      logger.error('Vision API service error', logContext, result.error, {
        attempts: result.attempts
      })
    }
    // Unknown error
    else {
      logger.error('Vision extraction failed with unknown error', logContext, result.error, {
        attempts: result.attempts
      })
    }
  }

  logger.warn('Vision extraction failed after all retries', logContext, undefined, {
    attempts: result.attempts,
    totalTime: result.totalTime
  })

  return null
}

/**
 * Batch retry for multiple pages with concurrency control
 */
export async function retryBatchVisionExtraction<T>(
  tasks: Array<{ pageNumber: number; fn: () => Promise<T> }>,
  options: {
    concurrency?: number // Default: 3
    continueOnError?: boolean // Default: true
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<number, T | null>> {
  const {
    concurrency = 3,
    continueOnError = true,
    onProgress
  } = options

  const results = new Map<number, T | null>()
  const queue = [...tasks]
  let completed = 0

  logger.info('Starting batch vision extraction', {
    component: 'VisionRetry',
    action: 'retryBatchVisionExtraction'
  }, {
    totalTasks: tasks.length,
    concurrency
  })

  // Process tasks with concurrency limit
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (!task) break

      try {
        const result = await retryVisionExtraction(task.fn, { pageNumber: task.pageNumber })
        results.set(task.pageNumber, result)
      } catch (error) {
        logger.error(`Page ${task.pageNumber} failed`, {
          component: 'VisionRetry',
          action: 'retryBatchVisionExtraction'
        }, error as Error)
        
        if (!continueOnError) {
          throw error
        }
        results.set(task.pageNumber, null)
      }

      completed++
      if (onProgress) {
        onProgress(completed, tasks.length)
      }
    }
  })

  await Promise.all(workers)

  logger.info('Batch vision extraction completed', {
    component: 'VisionRetry',
    action: 'retryBatchVisionExtraction'
  }, {
    total: tasks.length,
    successful: Array.from(results.values()).filter(v => v !== null).length,
    failed: Array.from(results.values()).filter(v => v === null).length
  })

  return results
}

/**
 * Circuit breaker for vision API
 * Prevents overwhelming the service with requests when it's failing
 */
export class VisionCircuitBreaker {
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private readonly threshold: number = 5, // Open after 5 failures
    private readonly timeout: number = 60000, // 60s timeout
    private readonly successThreshold: number = 2 // Close after 2 successes in half-open
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const context = {
      component: 'CircuitBreaker',
      action: 'execute'
    }

    // Check if circuit is open
    if (this.state === 'open') {
      const now = Date.now()
      if (now - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable')
      }
      // Try to recover
      this.state = 'half-open'
      this.successCount = 0
      logger.info('Circuit breaker entering HALF-OPEN state', context)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    const context = {
      component: 'CircuitBreaker',
      action: 'onSuccess'
    }

    this.failureCount = 0
    
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed'
        logger.info('Circuit breaker CLOSED - service recovered', context)
      }
    }
  }

  private onFailure() {
    const context = {
      component: 'CircuitBreaker',
      action: 'onFailure'
    }

    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.state === 'half-open') {
      this.state = 'open'
      logger.warn('Circuit breaker OPEN - service still failing', context, undefined, {
        failureCount: this.failureCount
      })
    } else if (this.failureCount >= this.threshold) {
      this.state = 'open'
      logger.warn('Circuit breaker OPEN - too many failures', context, undefined, {
        failureCount: this.failureCount,
        threshold: this.threshold
      })
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    }
  }

  reset() {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = 0
  }
}

// Global circuit breaker instance for vision API
export const visionCircuitBreaker = new VisionCircuitBreaker(5, 60000, 2)

