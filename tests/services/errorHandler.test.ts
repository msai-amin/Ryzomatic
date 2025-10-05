/**
 * Tests for Error Handler Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler, ErrorType, ErrorSeverity, AppError } from '../../src/services/errorHandler';

describe('Error Handler Service', () => {
  beforeEach(() => {
    errorHandler.clearErrorHistory();
  });

  describe('Error Creation', () => {
    it('should create AppError with correct properties', () => {
      const error = errorHandler.createError(
        'Test error message',
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        { component: 'Test' },
        { testData: 'value' },
        true,
        'User-friendly message'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error message');
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.context?.component).toBe('Test');
      expect(error.technicalDetails?.testData).toBe('value');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toBe('User-friendly message');
      expect(error.errorId).toBeDefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should generate unique error IDs', () => {
      const error1 = errorHandler.createError('Error 1', ErrorType.UNKNOWN);
      const error2 = errorHandler.createError('Error 2', ErrorType.UNKNOWN);

      expect(error1.errorId).not.toBe(error2.errorId);
    });

    it('should provide default user messages', () => {
      const error = errorHandler.createError(
        'Test error',
        ErrorType.NETWORK,
        ErrorSeverity.HIGH
      );

      expect(error.userMessage).toBe('Network error occurred. Some features may not work properly.');
    });
  });

  describe('Error History', () => {
    it('should store errors in history', () => {
      const error = errorHandler.createError('Test error', ErrorType.UNKNOWN);
      
      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].errorId).toBe(error.errorId);
    });

    it('should filter error history by type', () => {
      errorHandler.createError('Network error', ErrorType.NETWORK);
      errorHandler.createError('Validation error', ErrorType.VALIDATION);
      
      const networkErrors = errorHandler.getErrorHistory({ type: ErrorType.NETWORK });
      expect(networkErrors).toHaveLength(1);
      expect(networkErrors[0].type).toBe(ErrorType.NETWORK);
    });

    it('should filter error history by severity', () => {
      errorHandler.createError('Low error', ErrorType.UNKNOWN, ErrorSeverity.LOW);
      errorHandler.createError('High error', ErrorType.UNKNOWN, ErrorSeverity.HIGH);
      
      const highErrors = errorHandler.getErrorHistory({ severity: ErrorSeverity.HIGH });
      expect(highErrors).toHaveLength(1);
      expect(highErrors[0].severity).toBe(ErrorSeverity.HIGH);
    });

    it('should filter error history by date', () => {
      const oldDate = new Date(Date.now() - 10000);
      const recentDate = new Date();
      
      // Create error with old timestamp
      const oldError = errorHandler.createError('Old error', ErrorType.UNKNOWN);
      oldError.timestamp = oldDate.toISOString();
      
      errorHandler.createError('Recent error', ErrorType.UNKNOWN);
      
      const recentErrors = errorHandler.getErrorHistory({ since: new Date(Date.now() - 5000) });
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Recent error');
    });
  });

  describe('Error Statistics', () => {
    it('should provide error statistics', () => {
      errorHandler.createError('Error 1', ErrorType.NETWORK, ErrorSeverity.LOW);
      errorHandler.createError('Error 2', ErrorType.NETWORK, ErrorSeverity.HIGH);
      errorHandler.createError('Error 3', ErrorType.VALIDATION, ErrorSeverity.MEDIUM);
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats['NETWORK_LOW']).toBe(1);
      expect(stats['NETWORK_HIGH']).toBe(1);
      expect(stats['VALIDATION_MEDIUM']).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle regular Error objects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const regularError = new Error('Regular error');
      await errorHandler.handleError(regularError, { component: 'Test' });
      
      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('Regular error');
      expect(history[0].type).toBe(ErrorType.UNKNOWN); // Inferred type
      
      consoleSpy.mockRestore();
    });

    it('should handle AppError objects', async () => {
      const appError = errorHandler.createError(
        'App error',
        ErrorType.AI_SERVICE,
        ErrorSeverity.HIGH
      );
      
      await errorHandler.handleError(appError);
      
      const history = errorHandler.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].errorId).toBe(appError.errorId);
    });

    it('should infer error types from error messages', () => {
      const networkError = new Error('Network timeout');
      const authError = new Error('Unauthorized access');
      const pdfError = new Error('PDF processing failed');
      
      // Access private method through type assertion
      const handler = errorHandler as any;
      
      expect(handler.inferErrorType(networkError)).toBe(ErrorType.NETWORK);
      expect(handler.inferErrorType(authError)).toBe(ErrorType.AUTHENTICATION);
      expect(handler.inferErrorType(pdfError)).toBe(ErrorType.PDF_PROCESSING);
    });

    it('should infer error severity from error messages', () => {
      const criticalError = new Error('Critical system failure');
      const highError = new Error('Operation failed');
      const lowError = new Error('Warning: slow response');
      
      // Access private method through type assertion
      const handler = errorHandler as any;
      
      expect(handler.inferErrorSeverity(criticalError)).toBe(ErrorSeverity.CRITICAL);
      expect(handler.inferErrorSeverity(highError)).toBe(ErrorSeverity.HIGH);
      expect(handler.inferErrorSeverity(lowError)).toBe(ErrorSeverity.LOW);
    });
  });

  describe('Recovery Strategies', () => {
    it('should attempt recovery for recoverable errors', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const recoverableError = errorHandler.createError(
        'Network error',
        ErrorType.NETWORK,
        ErrorSeverity.MEDIUM
      );
      
      await errorHandler.handleError(recoverableError);
      
      // Should log recovery attempt
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting network error recovery')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not attempt recovery for critical errors', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      const criticalError = errorHandler.createError(
        'Critical network failure',
        ErrorType.NETWORK,
        ErrorSeverity.CRITICAL
      );
      
      await errorHandler.handleError(criticalError);
      
      // Should not log recovery attempt
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Attempting network error recovery')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('User Notifications', () => {
    it('should call user notification callback when set', async () => {
      const notificationCallback = vi.fn();
      errorHandler.setUserNotificationCallback(notificationCallback);
      
      const error = errorHandler.createError('Test error', ErrorType.UNKNOWN);
      await errorHandler.handleError(error);
      
      expect(notificationCallback).toHaveBeenCalledWith(error);
    });
  });
});
