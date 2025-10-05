/**
 * Tests for AI Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendMessageToAI, analyzeWithGPT } from '../../src/services/aiService';
import { errorHandler } from '../../src/services/errorHandler';
import { logger } from '../../src/services/logger';

// Mock the AI clients
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn()
    })
  }))
}));

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logger.clearLogs();
    errorHandler.clearErrorHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendMessageToAI', () => {
    it('should validate input prompts', async () => {
      await expect(sendMessageToAI('')).rejects.toThrow();
    });

    it('should validate document content', async () => {
      const largeContent = 'x'.repeat(2000000); // 2MB
      await expect(sendMessageToAI('Test message', largeContent)).rejects.toThrow();
    });

    it('should handle Gemini API success', async () => {
      const mockGeminiResponse = {
        response: {
          text: vi.fn().mockReturnValue('Gemini response')
        }
      };

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      mockModel.generateContent.mockResolvedValue(mockGeminiResponse);

      // Mock environment variable
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toBe('Gemini response');
    });

    it('should handle Gemini API failure and fallback to OpenAI', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      mockModel.generateContent.mockRejectedValue(new Error('Gemini API error'));

      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: 'OpenAI response'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponse);

      // Mock environment variables
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toBe('OpenAI response');
    });

    it('should handle OpenAI API failure and fallback to mock', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      mockModel.generateContent.mockRejectedValue(new Error('Gemini API error'));

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      // Mock environment variables
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toContain('I understand you\'re asking about the document');
    });

    it('should use mock responses when no API keys are configured', async () => {
      // Mock environment variables to be undefined
      vi.stubEnv('VITE_GEMINI_API_KEY', undefined);
      vi.stubEnv('VITE_OPENAI_API_KEY', undefined);

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toContain('I understand you\'re asking about the document');
    });

    it('should truncate large document content', async () => {
      const largeContent = 'x'.repeat(15000);
      
      // Mock environment variables
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      
      const mockGeminiResponse = {
        response: {
          text: vi.fn().mockReturnValue('Response')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockGeminiResponse);

      await sendMessageToAI('Test message', largeContent);
      
      // Verify that the content was truncated
      const callArgs = mockModel.generateContent.mock.calls[0][0];
      expect(callArgs).toContain('x'.repeat(12000)); // Should be truncated to 12000 chars
    });

    it('should handle summary requests with mock responses', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', undefined);
      vi.stubEnv('VITE_OPENAI_API_KEY', undefined);

      const result = await sendMessageToAI('Please summarize this document', 'Document content');
      expect(result).toContain('Here\'s a summary of the document content');
    });

    it('should handle explanation requests with mock responses', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', undefined);
      vi.stubEnv('VITE_OPENAI_API_KEY', undefined);

      const result = await sendMessageToAI('Can you explain this?', 'Document content');
      expect(result).toContain('I\'d be happy to explain that for you');
    });
  });

  describe('analyzeWithGPT', () => {
    it('should validate input text', async () => {
      await expect(analyzeWithGPT('')).rejects.toThrow();
    });

    it('should handle framework analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Framework analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'framework');
      expect(result).toBe('Framework analysis result');
    });

    it('should handle literary analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Literary analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'literary');
      expect(result).toBe('Literary analysis result');
    });

    it('should handle argument analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Argument analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'argument');
      expect(result).toBe('Argument analysis result');
    });

    it('should handle synthesis analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Synthesis analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'synthesis');
      expect(result).toBe('Synthesis analysis result');
    });

    it('should throw error when OpenAI is not configured', async () => {
      vi.stubEnv('VITE_OPENAI_API_KEY', undefined);

      await expect(analyzeWithGPT('Test text')).rejects.toThrow('OpenAI API is not configured');
    });

    it('should handle OpenAI API errors', async () => {
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      await expect(analyzeWithGPT('Test text')).rejects.toThrow('OpenAI API error');
    });

    it('should use correct prompt for each analysis type', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      // Test framework analysis
      await analyzeWithGPT('Test text', 'framework');
      let callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('theoretical frameworks');

      // Test literary analysis
      await analyzeWithGPT('Test text', 'literary');
      callArgs = mockOpenAI.chat.completions.create.mock.calls[1][0];
      expect(callArgs.messages[0].content).toContain('Rhetorical devices');

      // Test argument analysis
      await analyzeWithGPT('Test text', 'argument');
      callArgs = mockOpenAI.chat.completions.create.mock.calls[2][0];
      expect(callArgs.messages[0].content).toContain('philosophical argument');

      // Test synthesis analysis
      await analyzeWithGPT('Test text', 'synthesis');
      callArgs = mockOpenAI.chat.completions.create.mock.calls[3][0];
      expect(callArgs.messages[0].content).toContain('Synthesize the key ideas');
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics for sendMessageToAI', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      
      const mockGeminiResponse = {
        response: {
          text: vi.fn().mockReturnValue('Response')
        }
      };
      mockModel.generateContent.mockResolvedValue(mockGeminiResponse);

      await sendMessageToAI('Test message', 'Document content');

      const metrics = logger.getPerformanceMetrics('sendMessageToAI');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });

    it('should track performance metrics for analyzeWithGPT', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Analysis result'
          }
        }]
      };

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      await analyzeWithGPT('Test text', 'framework');

      const metrics = logger.getPerformanceMetrics('analyzeWithGPT');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].duration).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      await expect(sendMessageToAI('')).rejects.toThrow();
      
      const errorHistory = errorHandler.getErrorHistory();
      expect(errorHistory).toHaveLength(1);
      expect(errorHistory[0].type).toBe('VALIDATION');
    });

    it('should handle API errors gracefully', async () => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test-key');
      const mockModel = mockGenAI.getGenerativeModel();
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      // Should not throw, should return mock response
      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toContain('I understand you\'re asking about the document');
    });
  });
});
