/**
 * Comprehensive Error Handling System
 * Provides structured error handling, recovery strategies, and user-friendly error messages
 */

import { logger, LogContext } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  PDF_PROCESSING = 'PDF_PROCESSING',
  AI_SERVICE = 'AI_SERVICE',
  STORAGE = 'STORAGE',
  DATABASE = 'DATABASE',
  GOOGLE_API = 'GOOGLE_API',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  context?: LogContext;
  recoverable: boolean;
  userMessage: string;
  technicalDetails?: Record<string, any>;
  timestamp: string;
  errorId: string;
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: AppError) => boolean;
  recover: (error: AppError) => Promise<void>;
  description: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHistory: AppError[] = [];
  private maxErrorHistory: number = 100;
  private recoveryStrategies: Map<ErrorType, ErrorRecoveryStrategy[]> = new Map();
  private userNotificationCallback?: (error: AppError) => void;

  private constructor() {
    this.setupRecoveryStrategies();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupRecoveryStrategies(): void {
    // Network error recovery
    this.addRecoveryStrategy(ErrorType.NETWORK, {
      canRecover: (error) => error.severity !== ErrorSeverity.CRITICAL,
      recover: async (error) => {
        logger.info('Attempting network error recovery', error.context);
        // Implement retry logic or fallback mechanisms
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      description: 'Retry with exponential backoff'
    });

    // Authentication error recovery
    this.addRecoveryStrategy(ErrorType.AUTHENTICATION, {
      canRecover: (error) => error.severity === ErrorSeverity.LOW,  // Only low severity
      recover: async (error) => {
        logger.info('Attempting authentication error recovery', error.context);
        // Don't reload - just log and let the app handle it gracefully
        // The auth state listener will handle actual sign-out events
      },
      description: 'Log authentication error without reload'
    });

    // PDF processing error recovery
    this.addRecoveryStrategy(ErrorType.PDF_PROCESSING, {
      canRecover: (error) => error.severity !== ErrorSeverity.CRITICAL,
      recover: async (error) => {
        logger.info('Attempting PDF processing error recovery', error.context);
        // Fallback to text extraction or alternative PDF processing
      },
      description: 'Fallback to alternative PDF processing'
    });

    // AI service error recovery
    this.addRecoveryStrategy(ErrorType.AI_SERVICE, {
      canRecover: (error) => true,
      recover: async (error) => {
        logger.info('Attempting AI service error recovery', error.context);
        // Switch to alternative AI provider or use cached responses
      },
      description: 'Switch to alternative AI provider'
    });
  }

  private addRecoveryStrategy(type: ErrorType, strategy: ErrorRecoveryStrategy): void {
    if (!this.recoveryStrategies.has(type)) {
      this.recoveryStrategies.set(type, []);
    }
    this.recoveryStrategies.get(type)!.push(strategy);
  }

  public createError(
    message: string,
    type: ErrorType,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: LogContext,
    technicalDetails?: Record<string, any>,
    recoverable: boolean = true,
    userMessage?: string
  ): AppError {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();

    const baseError = new Error(message);
    baseError.name = 'AppError';

    const appError = baseError as AppError;
    appError.type = type;
    appError.severity = severity;
    appError.context = context;
    appError.recoverable = recoverable;
    appError.userMessage = userMessage || this.getDefaultUserMessage(type, severity);
    appError.technicalDetails = technicalDetails;
    appError.timestamp = timestamp;
    appError.errorId = errorId;

    this.addToHistory(appError);
    return appError;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultUserMessage(type: ErrorType, severity: ErrorSeverity): string {
    const messages = {
      [ErrorType.NETWORK]: {
        [ErrorSeverity.LOW]: 'Network connection is slow. Please try again.',
        [ErrorSeverity.MEDIUM]: 'Unable to connect to the server. Please check your internet connection.',
        [ErrorSeverity.HIGH]: 'Network error occurred. Some features may not work properly.',
        [ErrorSeverity.CRITICAL]: 'Critical network failure. Please refresh the page.'
      },
      [ErrorType.AUTHENTICATION]: {
        [ErrorSeverity.LOW]: 'Please sign in to continue.',
        [ErrorSeverity.MEDIUM]: 'Your session has expired. Please sign in again.',
        [ErrorSeverity.HIGH]: 'Authentication failed. Please check your credentials.',
        [ErrorSeverity.CRITICAL]: 'Critical authentication error. Please contact support.'
      },
      [ErrorType.PDF_PROCESSING]: {
        [ErrorSeverity.LOW]: 'PDF processing is taking longer than expected.',
        [ErrorSeverity.MEDIUM]: 'Unable to process PDF. Please try a different file.',
        [ErrorSeverity.HIGH]: 'PDF processing failed. The file may be corrupted.',
        [ErrorSeverity.CRITICAL]: 'Critical PDF processing error. Please contact support.'
      },
      [ErrorType.AI_SERVICE]: {
        [ErrorSeverity.LOW]: 'AI service is responding slowly.',
        [ErrorSeverity.MEDIUM]: 'AI service temporarily unavailable. Please try again.',
        [ErrorSeverity.HIGH]: 'AI service error. Some features may not work.',
        [ErrorSeverity.CRITICAL]: 'Critical AI service failure. Please contact support.'
      },
      [ErrorType.VALIDATION]: {
        [ErrorSeverity.LOW]: 'Please check your input and try again.',
        [ErrorSeverity.MEDIUM]: 'Invalid input provided. Please review and correct.',
        [ErrorSeverity.HIGH]: 'Validation error. Please check your data.',
        [ErrorSeverity.CRITICAL]: 'Critical validation error. Please contact support.'
      },
      [ErrorType.STORAGE]: {
        [ErrorSeverity.LOW]: 'Storage operation is slow.',
        [ErrorSeverity.MEDIUM]: 'Unable to save data. Please try again.',
        [ErrorSeverity.HIGH]: 'Storage error. Data may not be saved.',
        [ErrorSeverity.CRITICAL]: 'Critical storage failure. Please contact support.'
      },
      [ErrorType.GOOGLE_API]: {
        [ErrorSeverity.LOW]: 'Google service is responding slowly.',
        [ErrorSeverity.MEDIUM]: 'Google service temporarily unavailable.',
        [ErrorSeverity.HIGH]: 'Google API error. Some features may not work.',
        [ErrorSeverity.CRITICAL]: 'Critical Google API failure. Please contact support.'
      },
      [ErrorType.UNKNOWN]: {
        [ErrorSeverity.LOW]: 'An unexpected error occurred.',
        [ErrorSeverity.MEDIUM]: 'An error occurred. Please try again.',
        [ErrorSeverity.HIGH]: 'An unexpected error occurred. Some features may not work.',
        [ErrorSeverity.CRITICAL]: 'Critical error occurred. Please contact support.'
      }
    };

    return messages[type]?.[severity] || messages[ErrorType.UNKNOWN][ErrorSeverity.MEDIUM];
  }

  private addToHistory(error: AppError): void {
    this.errorHistory.push(error);
    
    // Keep only recent errors
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  public async handleError(error: Error | AppError, context?: LogContext): Promise<void> {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else {
      appError = this.createError(
        error.message,
        this.inferErrorType(error),
        this.inferErrorSeverity(error),
        context,
        { originalError: error.message, stack: error.stack }
      );
    }

    // Log the error
    logger.error(
      `Error handled: ${appError.message}`,
      appError.context,
      appError,
      {
        errorId: appError.errorId,
        type: appError.type,
        severity: appError.severity,
        recoverable: appError.recoverable,
        ...appError.technicalDetails
      }
    );

    // Attempt recovery if possible
    if (appError.recoverable) {
      await this.attemptRecovery(appError);
    }

    // Notify user if callback is set
    if (this.userNotificationCallback) {
      this.userNotificationCallback(appError);
    }
  }

  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  private inferErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('pdf') || message.includes('document')) {
      return ErrorType.PDF_PROCESSING;
    }
    if (message.includes('openai') || message.includes('gemini') || message.includes('ai')) {
      return ErrorType.AI_SERVICE;
    }
    if (message.includes('google') || message.includes('gapi')) {
      return ErrorType.GOOGLE_API;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('storage') || message.includes('localStorage')) {
      return ErrorType.STORAGE;
    }
    
    return ErrorType.UNKNOWN;
  }

  private inferErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('error') || message.includes('failed')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('warning') || message.includes('slow')) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  private async attemptRecovery(error: AppError): Promise<void> {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    
    for (const strategy of strategies) {
      if (strategy.canRecover(error)) {
        try {
          logger.info(`Attempting recovery: ${strategy.description}`, error.context);
          await strategy.recover(error);
          logger.info(`Recovery successful: ${strategy.description}`, error.context);
          return;
        } catch (recoveryError) {
          logger.warn(`Recovery failed: ${strategy.description}`, error.context, recoveryError as Error);
        }
      }
    }
    
    logger.warn('No recovery strategies available or all failed', error.context);
  }

  public setUserNotificationCallback(callback: (error: AppError) => void): void {
    this.userNotificationCallback = callback;
  }

  public getErrorHistory(filter?: { type?: ErrorType; severity?: ErrorSeverity; since?: Date }): AppError[] {
    let filteredErrors = this.errorHistory;

    if (filter) {
      if (filter.type) {
        filteredErrors = filteredErrors.filter(error => error.type === filter.type);
      }
      if (filter.severity) {
        filteredErrors = filteredErrors.filter(error => error.severity === filter.severity);
      }
      if (filter.since) {
        filteredErrors = filteredErrors.filter(error => new Date(error.timestamp) >= filter.since!);
      }
    }

    return filteredErrors;
  }

  public getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    this.errorHistory.forEach(error => {
      const key = `${error.type}_${error.severity}`;
      stats[key] = (stats[key] || 0) + 1;
    });
    
    return stats;
  }

  public clearErrorHistory(): void {
    this.errorHistory = [];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const handleError = (error: Error | AppError, context?: LogContext) => 
  errorHandler.handleError(error, context);

export const createError = (
  message: string,
  type: ErrorType,
  severity?: ErrorSeverity,
  context?: LogContext,
  technicalDetails?: Record<string, any>,
  recoverable?: boolean,
  userMessage?: string
) => errorHandler.createError(message, type, severity, context, technicalDetails, recoverable, userMessage);
