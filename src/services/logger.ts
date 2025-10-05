/**
 * Comprehensive Logging System
 * Provides structured logging with different levels, contexts, and performance tracking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  documentId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private performanceMetrics: PerformanceMetrics[] = [];
  private sessionId: string;

  private constructor() {
    this.logLevel = this.getLogLevelFromEnv();
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandling();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'FATAL': return LogLevel.FATAL;
      default: return import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandling(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.error('Global error caught', {
        component: 'Global',
        action: 'ErrorHandler',
        error: event.error,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          message: event.message
        }
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        component: 'Global',
        action: 'PromiseRejection',
        error: event.reason,
        metadata: {
          promise: event.promise
        }
      });
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        sessionId: this.sessionId
      },
      error,
      duration,
      metadata
    };
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output based on level
    const consoleMethod = this.getConsoleMethod(entry.level);
    const formattedMessage = this.formatMessage(entry);
    
    if (entry.error) {
      consoleMethod(formattedMessage, entry.error);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG: return console.debug;
      case LogLevel.INFO: return console.info;
      case LogLevel.WARN: return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL: return console.error;
      default: return console.log;
    }
  }

  private formatMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const context = entry.context ? ` [${entry.context.component || 'Unknown'}]` : '';
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    return `[${levelName}]${context}${duration} ${entry.message}`;
  }

  // Public logging methods
  public debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context, undefined, undefined, metadata));
    }
  }

  public info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog(this.createLogEntry(LogLevel.INFO, message, context, undefined, undefined, metadata));
    }
  }

  public warn(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog(this.createLogEntry(LogLevel.WARN, message, context, error, undefined, metadata));
    }
  }

  public error(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLog(this.createLogEntry(LogLevel.ERROR, message, context, error, undefined, metadata));
    }
  }

  public fatal(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.addLog(this.createLogEntry(LogLevel.FATAL, message, context, error, undefined, metadata));
    }
  }

  // Performance tracking
  public async trackPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let result: T;

    try {
      result = await fn();
      success = true;
      return result;
    } catch (error) {
      this.error(`Performance tracking failed for operation: ${operation}`, context, error as Error, metadata);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      const metric: PerformanceMetrics = {
        operation,
        duration,
        success,
        metadata
      };
      
      this.performanceMetrics.push(metric);
      
      // Keep only recent metrics
      if (this.performanceMetrics.length > 500) {
        this.performanceMetrics = this.performanceMetrics.slice(-500);
      }

      this.info(`Performance: ${operation}`, {
        ...context,
        action: 'Performance'
      }, {
        ...metadata,
        duration: Math.round(duration),
        success
      });
    }
  }

  // Utility methods
  public getLogs(filter?: { level?: LogLevel; component?: string; since?: Date }): LogEntry[] {
    let filteredLogs = this.logs;

    if (filter) {
      if (filter.level !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.level >= filter.level!);
      }
      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.context?.component === filter.component);
      }
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filter.since!);
      }
    }

    return filteredLogs;
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

  public clearLogs(): void {
    this.logs = [];
    this.performanceMetrics = [];
  }

  public exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      logs: this.logs,
      performanceMetrics: this.performanceMetrics
    }, null, 2);
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { component: 'Logger', action: 'SetLogLevel' }, { newLevel: LogLevel[level] });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for common use cases
export const logDebug = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.debug(message, context, metadata);

export const logInfo = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  logger.info(message, context, metadata);

export const logWarn = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>) => 
  logger.warn(message, context, error, metadata);

export const logError = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>) => 
  logger.error(message, context, error, metadata);

export const logFatal = (message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>) => 
  logger.fatal(message, context, error, metadata);

export const trackPerformance = <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext,
  metadata?: Record<string, any>
): Promise<T> => logger.trackPerformance(operation, fn, context, metadata);
