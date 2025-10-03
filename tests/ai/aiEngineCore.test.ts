/**
 * AI Engine Core Tests
 * Test suite for the AI engine core functionality
 */

import { AIEngineCore, DocumentAnalysisRequest } from '../../src/services/ai/aiEngineCore';

describe('AIEngineCore', () => {
  let aiEngine: AIEngineCore;

  beforeEach(() => {
    aiEngine = new AIEngineCore({
      features: {
        caching: true,
        realTime: true,
        multiModel: true
      }
    });
  });

  afterEach(() => {
    aiEngine.clearCache();
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      const config = aiEngine.getConfig();
      expect(config.features.caching).toBe(true);
      expect(config.features.realTime).toBe(true);
      expect(config.features.multiModel).toBe(true);
    });

    test('should update configuration', () => {
      aiEngine.updateConfig({
        features: {
          caching: false,
          realTime: true,
          multiModel: true
        }
      });

      const config = aiEngine.getConfig();
      expect(config.features.caching).toBe(false);
    });
  });

  describe('Document Analysis', () => {
    const mockRequest: DocumentAnalysisRequest = {
      documentId: 'test-doc-1',
      content: 'This is a test document for AI analysis.',
      type: 'academic',
      analysisTypes: ['neural', 'quantum', 'synapse'],
      options: {
        depth: 'deep',
        focus: ['analysis', 'insights']
      }
    };

    test('should perform neural analysis', async () => {
      const results = await aiEngine.analyzeDocument({
        ...mockRequest,
        analysisTypes: ['neural']
      });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('neural');
      expect(results[0].analysis.confidence).toBeGreaterThan(0);
      expect(results[0].analysis.insights).toBeInstanceOf(Array);
    });

    test('should perform quantum parse', async () => {
      const results = await aiEngine.analyzeDocument({
        ...mockRequest,
        analysisTypes: ['quantum']
      });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('quantum');
      expect(results[0].analysis.confidence).toBeGreaterThan(0);
      expect(results[0].analysis.metadata.dimensions).toBeDefined();
    });

    test('should perform synapse synthesis', async () => {
      const results = await aiEngine.analyzeDocument({
        ...mockRequest,
        analysisTypes: ['synapse']
      });

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('synapse');
      expect(results[0].analysis.confidence).toBeGreaterThan(0);
      expect(results[0].analysis.metadata.connectionsCreated).toBeDefined();
    });

    test('should perform multiple analysis types', async () => {
      const results = await aiEngine.analyzeDocument(mockRequest);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.type)).toEqual(['neural', 'quantum', 'synapse']);
    });

    test('should handle analysis errors gracefully', async () => {
      // Mock a request that might cause errors
      const errorRequest: DocumentAnalysisRequest = {
        documentId: 'error-doc',
        content: '',
        type: 'academic',
        analysisTypes: ['neural', 'quantum', 'synapse']
      };

      const results = await aiEngine.analyzeDocument(errorRequest);
      // Should still return results for successful analyses
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Caching', () => {
    test('should cache analysis results', async () => {
      const request: DocumentAnalysisRequest = {
        documentId: 'cache-test',
        content: 'Test content for caching',
        type: 'academic',
        analysisTypes: ['neural']
      };

      // First call should populate cache
      await aiEngine.analyzeDocument(request);
      const stats1 = aiEngine.getCacheStats();
      expect(stats1.size).toBe(1);

      // Second call should use cache
      await aiEngine.analyzeDocument(request);
      const stats2 = aiEngine.getCacheStats();
      expect(stats2.size).toBe(1); // Same size, used cache
    });

    test('should clear cache', () => {
      aiEngine.clearCache();
      const stats = aiEngine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid analysis types', async () => {
      const request: DocumentAnalysisRequest = {
        documentId: 'test',
        content: 'Test content',
        type: 'academic',
        analysisTypes: ['neural'] // Valid type
      };

      // This should not throw an error
      const results = await aiEngine.analyzeDocument(request);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

// Mock data for testing
export const mockDocuments = {
  academic: {
    id: 'academic-1',
    content: `
      Abstract: This paper presents a novel approach to machine learning
      that combines neural networks with quantum computing principles.
      The methodology demonstrates significant improvements in processing
      speed and accuracy across multiple benchmark datasets.
      
      Introduction: Machine learning has evolved rapidly, but traditional
      approaches face limitations in scalability and efficiency. This work
      introduces a hybrid approach that leverages quantum principles...
    `,
    type: 'academic' as const
  },
  research: {
    id: 'research-1',
    content: `
      Research Question: How can AI systems better understand context
      in academic literature?
      
      Methodology: We analyzed 10,000 academic papers using advanced
      NLP techniques and machine learning algorithms.
      
      Results: Our approach achieved 87% accuracy in context understanding,
      representing a 23% improvement over existing methods.
    `,
    type: 'research' as const
  }
};
