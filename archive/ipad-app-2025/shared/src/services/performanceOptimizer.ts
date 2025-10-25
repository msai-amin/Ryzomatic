/**
 * Performance Optimization Service
 * Provides caching, debouncing, throttling, and other performance optimizations
 */

import { logger, LogContext } from './logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export interface DebounceOptions {
  delay: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface ThrottleOptions {
  delay: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage?: number;
  timestamp: number;
}

class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private throttleLastExecuted: Map<string, number> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private maxCacheSize: number = 1000;
  private maxMetricsSize: number = 500;

  private constructor() {
    this.setupCleanupInterval();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  private setupCleanupInterval(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000);
  }

  // Cache Management
  public setCache<T>(key: string, value: T, ttl: number = 300000): void { // 5 minutes default
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'setCache'
    };

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    logger.debug(`Cache entry set: ${key}`, context, { ttl, cacheSize: this.cache.size });
  }

  public getCache<T>(key: string): T | null {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'getCache'
    };

    const entry = this.cache.get(key);
    if (!entry) {
      logger.debug(`Cache miss: ${key}`, context);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      logger.debug(`Cache entry expired: ${key}`, context);
      return null;
    }

    logger.debug(`Cache hit: ${key}`, context);
    return entry.value as T;
  }

  public deleteCache(key: string): boolean {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'deleteCache'
    };

    const deleted = this.cache.delete(key);
    logger.debug(`Cache entry deleted: ${key}`, context, { deleted });
    return deleted;
  }

  public clearCache(): void {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'clearCache'
    };

    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared`, context, { clearedEntries: size });
  }

  private cleanupExpiredCache(): void {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'cleanupExpiredCache'
    };

    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up expired cache entries`, context, { cleanedCount });
    }
  }

  // Debouncing
  public debounce<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    options: DebounceOptions
  ): T {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'debounce'
    };

    const { delay, leading = false, trailing = true } = options;

    return ((...args: Parameters<T>) => {
      const timer = this.debounceTimers.get(key);
      
      if (timer) {
        clearTimeout(timer);
      }

      if (leading && !timer) {
        logger.debug(`Debounce leading execution: ${key}`, context);
        return func(...args);
      }

      const newTimer = setTimeout(() => {
        if (trailing) {
          logger.debug(`Debounce trailing execution: ${key}`, context);
          func(...args);
        }
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, newTimer);
    }) as T;
  }

  public cancelDebounce(key: string): void {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'cancelDebounce'
    };

    const timer = this.debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
      logger.debug(`Debounce cancelled: ${key}`, context);
    }
  }

  // Throttling
  public throttle<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    options: ThrottleOptions
  ): T {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'throttle'
    };

    const { delay, leading = true, trailing = true } = options;

    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const lastExecuted = this.throttleLastExecuted.get(key) || 0;
      const timeSinceLastExecution = now - lastExecuted;

      if (timeSinceLastExecution >= delay) {
        if (leading) {
          logger.debug(`Throttle leading execution: ${key}`, context);
          this.throttleLastExecuted.set(key, now);
          return func(...args);
        }
      }

      if (trailing) {
        const timer = this.throttleTimers.get(key);
        if (!timer) {
          const newTimer = setTimeout(() => {
            logger.debug(`Throttle trailing execution: ${key}`, context);
            this.throttleLastExecuted.set(key, Date.now());
            func(...args);
            this.throttleTimers.delete(key);
          }, delay - timeSinceLastExecution);

          this.throttleTimers.set(key, newTimer);
        }
      }
    }) as T;
  }

  public cancelThrottle(key: string): void {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'cancelThrottle'
    };

    const timer = this.throttleTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.throttleTimers.delete(key);
      logger.debug(`Throttle cancelled: ${key}`, context);
    }
  }

  // Performance Monitoring
  public trackPerformance<T>(
    operation: string,
    fn: () => T,
    context?: LogContext
  ): T {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = fn();
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      const metric: PerformanceMetrics = {
        operation,
        duration: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        timestamp: Date.now()
      };

      this.addPerformanceMetric(metric);

      logger.debug(`Performance tracked: ${operation}`, context, {
        duration: Math.round(metric.duration),
        memoryDelta: metric.memoryUsage
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const metric: PerformanceMetrics = {
        operation,
        duration: endTime - startTime,
        timestamp: Date.now()
      };

      this.addPerformanceMetric(metric);

      logger.error(`Performance tracking failed: ${operation}`, context, error as Error);
      throw error;
    }
  }

  public async trackAsyncPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    try {
      const result = await fn();
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      const metric: PerformanceMetrics = {
        operation,
        duration: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        timestamp: Date.now()
      };

      this.addPerformanceMetric(metric);

      logger.debug(`Async performance tracked: ${operation}`, context, {
        duration: Math.round(metric.duration),
        memoryDelta: metric.memoryUsage
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const metric: PerformanceMetrics = {
        operation,
        duration: endTime - startTime,
        timestamp: Date.now()
      };

      this.addPerformanceMetric(metric);

      logger.error(`Async performance tracking failed: ${operation}`, context, error as Error);
      throw error;
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  private addPerformanceMetric(metric: PerformanceMetrics): void {
    this.performanceMetrics.push(metric);

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.maxMetricsSize) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsSize);
    }
  }

  public getPerformanceMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.performanceMetrics.filter(metric => metric.operation === operation);
    }
    return this.performanceMetrics;
  }

  public getAveragePerformance(operation: string): number {
    const metrics = this.getPerformanceMetrics(operation);
    if (metrics.length === 0) return 0;

    const totalDuration = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalDuration / metrics.length;
  }

  public getPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    // Group metrics by operation
    const operationGroups: Record<string, PerformanceMetrics[]> = {};
    this.performanceMetrics.forEach(metric => {
      if (!operationGroups[metric.operation]) {
        operationGroups[metric.operation] = [];
      }
      operationGroups[metric.operation].push(metric);
    });

    // Calculate stats for each operation
    Object.entries(operationGroups).forEach(([operation, metrics]) => {
      const durations = metrics.map(m => m.duration);
      const memoryUsages = metrics.map(m => m.memoryUsage || 0);

      stats[operation] = {
        count: metrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        averageMemoryUsage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
        lastExecuted: Math.max(...metrics.map(m => m.timestamp))
      };
    });

    return stats;
  }

  // Utility Methods
  public clearAll(): void {
    const context: LogContext = {
      component: 'PerformanceOptimizer',
      action: 'clearAll'
    };

    this.clearCache();
    this.clearDebounceTimers();
    this.clearThrottleTimers();
    this.performanceMetrics = [];

    logger.info(`Performance optimizer cleared`, context);
  }

  private clearDebounceTimers(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  private clearThrottleTimers(): void {
    this.throttleTimers.forEach(timer => clearTimeout(timer));
    this.throttleTimers.clear();
    this.throttleLastExecuted.clear();
  }

  public getStats(): Record<string, any> {
    return {
      cache: {
        size: this.cache.size,
        maxSize: this.maxCacheSize
      },
      debounce: {
        activeTimers: this.debounceTimers.size
      },
      throttle: {
        activeTimers: this.throttleTimers.size
      },
      performance: {
        metricsCount: this.performanceMetrics.length,
        maxMetrics: this.maxMetricsSize
      }
    };
  }
}

// Export singleton instance
export const performanceOptimizer = PerformanceOptimizer.getInstance();

// Convenience functions
export const setCache = <T>(key: string, value: T, ttl?: number) =>
  performanceOptimizer.setCache(key, value, ttl);

export const getCache = <T>(key: string): T | null =>
  performanceOptimizer.getCache<T>(key);

export const debounce = <T extends (...args: any[]) => any>(
  key: string,
  func: T,
  options: DebounceOptions
): T => performanceOptimizer.debounce(key, func, options);

export const throttle = <T extends (...args: any[]) => any>(
  key: string,
  func: T,
  options: ThrottleOptions
): T => performanceOptimizer.throttle(key, func, options);

export const trackPerformance = <T>(
  operation: string,
  fn: () => T,
  context?: LogContext
): T => performanceOptimizer.trackPerformance(operation, fn, context);

export const trackAsyncPerformance = <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> => performanceOptimizer.trackAsyncPerformance(operation, fn, context);
