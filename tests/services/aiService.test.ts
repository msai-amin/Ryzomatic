/**
 * Tests for AI Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  sendMessageToAI, 
  analyzeWithGPT,
  __setOpenAIClientForTests,
  __setGeminiClientForTests
} from '../../src/services/aiService';
import { errorHandler } from '../../src/services/errorHandler';
import { logger } from '../../src/services/logger';

// Provide lightweight mocks for external SDKs to prevent actual initialization
vi.mock('openai', () => ({
  default: class MockOpenAI {}
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGemini {}
}));

const createMockGeminiClient = () => {
  const generateContent = vi.fn();
  return {
    client: {
      getGenerativeModel: vi.fn().mockReturnValue({ generateContent })
    },
    generateContent
  };
};

const createMockOpenAIClient = () => {
  const createCompletion = vi.fn();
  return {
    client: {
      chat: {
        completions: {
          create: createCompletion
        }
      }
    },
    createCompletion
  };
};

describe('AI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logger.clearLogs();
    errorHandler.clearErrorHistory();
    __setGeminiClientForTests(null);
    __setOpenAIClientForTests(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    __setGeminiClientForTests(null);
    __setOpenAIClientForTests(null);
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

      const geminiMock = createMockGeminiClient();
      geminiMock.generateContent.mockResolvedValue(mockGeminiResponse as any);
      __setGeminiClientForTests(geminiMock.client as any);
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(geminiMock.client.getGenerativeModel).toHaveBeenCalled();
      expect(result).toBe('Gemini response');
    });

    it('should handle Gemini API failure and fallback to OpenAI', async () => {
      const geminiMock = createMockGeminiClient();
      geminiMock.generateContent.mockRejectedValue(new Error('Gemini API error'));
      __setGeminiClientForTests(geminiMock.client as any);

      const openAIMock = createMockOpenAIClient();
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: 'OpenAI response'
          }
        }]
      };
      openAIMock.createCompletion.mockResolvedValue(mockOpenAIResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);

      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(openAIMock.createCompletion).toHaveBeenCalled();
      expect(result).toBe('OpenAI response');
    });

    it('should handle OpenAI API failure and fallback to mock', async () => {
      const geminiMock = createMockGeminiClient();
      geminiMock.generateContent.mockRejectedValue(new Error('Gemini API error'));
      __setGeminiClientForTests(geminiMock.client as any);

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockRejectedValue(new Error('OpenAI API error'));
      __setOpenAIClientForTests(openAIMock.client as any);

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

      const geminiMock = createMockGeminiClient();
      const mockGeminiResponse = {
        response: {
          text: vi.fn().mockReturnValue('Response')
        }
      };
      geminiMock.generateContent.mockResolvedValue(mockGeminiResponse as any);
      __setGeminiClientForTests(geminiMock.client as any);

      await sendMessageToAI('Test message', largeContent);

      const callArgs = geminiMock.generateContent.mock.calls[0][0];
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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'framework');
      expect(openAIMock.createCompletion).toHaveBeenCalled();
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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await analyzeWithGPT('Test text', 'synthesis');
      expect(result).toBe('Synthesis analysis result');
    });

    it('should throw error when OpenAI is not configured', async () => {
      vi.stubEnv('VITE_OPENAI_API_KEY', undefined);
      __setOpenAIClientForTests(null);

      await expect(analyzeWithGPT('Test text')).rejects.toThrow('OpenAI API is not configured');
    });

    it('should handle OpenAI API errors', async () => {
      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockRejectedValue(new Error('OpenAI API error'));
      __setOpenAIClientForTests(openAIMock.client as any);
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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      await analyzeWithGPT('Test text', 'framework');
      let callArgs = openAIMock.createCompletion.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('theoretical frameworks');

      await analyzeWithGPT('Test text', 'literary');
      callArgs = openAIMock.createCompletion.mock.calls[1][0];
      expect(callArgs.messages[0].content).toContain('Rhetorical devices');

      await analyzeWithGPT('Test text', 'argument');
      callArgs = openAIMock.createCompletion.mock.calls[2][0];
      expect(callArgs.messages[0].content).toContain('philosophical argument');

      await analyzeWithGPT('Test text', 'synthesis');
      callArgs = openAIMock.createCompletion.mock.calls[3][0];
      expect(callArgs.messages[0].content).toContain('Synthesize the key ideas');
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics for sendMessageToAI', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');

      const geminiMock = createMockGeminiClient();
      const mockGeminiResponse = {
        response: {
          text: vi.fn().mockReturnValue('Response')
        }
      };
      geminiMock.generateContent.mockResolvedValue(mockGeminiResponse as any);
      __setGeminiClientForTests(geminiMock.client as any);

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

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockResolvedValue(mockResponse as any);
      __setOpenAIClientForTests(openAIMock.client as any);
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
      const geminiMock = createMockGeminiClient();
      geminiMock.generateContent.mockRejectedValue(new Error('API Error'));
      __setGeminiClientForTests(geminiMock.client as any);

      const openAIMock = createMockOpenAIClient();
      openAIMock.createCompletion.mockRejectedValue(new Error('API Error'));
      __setOpenAIClientForTests(openAIMock.client as any);

      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
      vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');

      const result = await sendMessageToAI('Test message', 'Document content');
      expect(result).toContain('I understand you\'re asking about the document');
    });
  });
});
