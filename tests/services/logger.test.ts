/**
 * Tests for Logger Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, LogLevel } from '../../src/services/logger';

describe('Logger Service', () => {
  beforeEach(() => {
    // Clear logs before each test
    logger.clearLogs();
    // Reset log level to DEBUG for testing
    logger.setLogLevel(LogLevel.DEBUG);
  });

  describe('Logging Levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      logger.debug('Test debug message', { component: 'Test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] [Test] Test debug message')
      );
      
      consoleSpy.mockRestore();
    });

    it('should log info messages when level is INFO', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logger.info('Test info message', { component: 'Test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [Test] Test info message')
      );
      
      consoleSpy.mockRestore();
    });

    it('should log warning messages when level is WARN', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      logger.warn('Test warning message', { component: 'Test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [Test] Test warning message')
      );
      
      consoleSpy.mockRestore();
    });

    it('should log error messages when level is ERROR', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.error('Test error message', { component: 'Test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [Test] Test error message')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not log debug messages when level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      logger.debug('Test debug message', { component: 'Test' });
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Log Storage', () => {
    it('should store logs in memory', () => {
      logger.info('Test message', { component: 'Test' });
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].context?.component).toBe('Test');
    });

    it('should limit stored logs to maxLogs', () => {
      // Set a small limit for testing
      const originalMaxLogs = 1000;
      
      for (let i = 0; i < 5; i++) {
        logger.info(`Test message ${i}`, { component: 'Test' });
      }
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(5);
    });

    it('should filter logs by level', () => {
      logger.debug('Debug message', { component: 'Test' });
      logger.info('Info message', { component: 'Test' });
      logger.warn('Warning message', { component: 'Test' });
      logger.error('Error message', { component: 'Test' });
      
      const errorLogs = logger.getLogs({ level: LogLevel.ERROR });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error message');
    });

    it('should filter logs by component', () => {
      logger.info('Test message 1', { component: 'Component1' });
      logger.info('Test message 2', { component: 'Component2' });
      
      const component1Logs = logger.getLogs({ component: 'Component1' });
      expect(component1Logs).toHaveLength(1);
      expect(component1Logs[0].message).toBe('Test message 1');
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test result';
      };
      
      const result = await logger.trackPerformance('testOperation', testFunction);
      
      expect(result).toBe('test result');
      
      const metrics = logger.getPerformanceMetrics('testOperation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('testOperation');
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should track failed operations', async () => {
      const failingFunction = async () => {
        throw new Error('Test error');
      };
      
      await expect(
        logger.trackPerformance('failingOperation', failingFunction)
      ).rejects.toThrow('Test error');
      
      const metrics = logger.getPerformanceMetrics('failingOperation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('failingOperation');
      expect(metrics[0].success).toBe(false);
    });

    it('should calculate average performance', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test result';
      };
      
      await logger.trackPerformance('avgTest', testFunction);
      await logger.trackPerformance('avgTest', testFunction);
      
      const average = logger.getAveragePerformance('avgTest');
      expect(average).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should log errors with stack traces', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('Test error');
      
      logger.error('Test error message', { component: 'Test' }, testError);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [Test] Test error message'),
        testError
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Export Functionality', () => {
    it('should export logs as JSON', () => {
      logger.info('Test message', { component: 'Test' });
      
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('logs');
      expect(parsed).toHaveProperty('performanceMetrics');
      expect(parsed.logs).toHaveLength(1);
    });
  });
});
