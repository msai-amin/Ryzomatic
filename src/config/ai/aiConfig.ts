/**
 * AI Engine Configuration
 * Central configuration for all AI services and models
 */

export interface AIModelConfig {
  name: string;
  provider: 'openai' | 'google';
  modelId: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retries: number;
  costPerToken?: number;
}

export interface AIEngineSettings {
  defaultModels: {
    neural: AIModelConfig;
    quantum: AIModelConfig;
    synapse: AIModelConfig;
  };
  features: {
    caching: boolean;
    realTime: boolean;
    multiModel: boolean;
    batchProcessing: boolean;
    parallelProcessing: boolean;
  };
  limits: {
    maxConcurrentRequests: number;
    maxTokensPerRequest: number;
    maxDocumentsPerBatch: number;
    rateLimitPerMinute: number;
  };
  cache: {
    enabled: boolean;
    ttl: number; // Time to live in milliseconds
    maxSize: number; // Maximum cache entries
  };
}

export const aiConfig: AIEngineSettings = {
  defaultModels: {
    neural: {
      name: 'Neural Analysis Engine',
      provider: 'openai',
      modelId: 'gpt-4-turbo-preview',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      retries: 3,
      costPerToken: 0.00003
    },
    quantum: {
      name: 'Quantum Parse Engine',
      provider: 'google',
      modelId: 'gemini-2.5-flash',
      maxTokens: 3000,
      temperature: 0.5,
      timeout: 25000,
      retries: 3,
      costPerToken: 0.00001
    },
    synapse: {
      name: 'Synapse Synthesis Engine',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      maxTokens: 5000,
      temperature: 0.6,
      timeout: 35000,
      retries: 2,
      costPerToken: 0.00015
    }
  },
  features: {
    caching: true,
    realTime: true,
    multiModel: true,
    batchProcessing: true,
    parallelProcessing: true
  },
  limits: {
    maxConcurrentRequests: 5,
    maxTokensPerRequest: 8000,
    maxDocumentsPerBatch: 10,
    rateLimitPerMinute: 60
  },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 1000
  }
};

// Environment-specific configurations
export const getAIEnvironmentConfig = () => {
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;

  if (isDevelopment) {
    return {
      ...aiConfig,
      features: {
        ...aiConfig.features,
        caching: true,
        realTime: true
      },
      limits: {
        ...aiConfig.limits,
        maxConcurrentRequests: 3,
        rateLimitPerMinute: 30
      }
    };
  }

  if (isProduction) {
    return {
      ...aiConfig,
      features: {
        ...aiConfig.features,
        caching: true,
        realTime: true,
        batchProcessing: true
      },
      limits: {
        ...aiConfig.limits,
        maxConcurrentRequests: 10,
        rateLimitPerMinute: 100
      }
    };
  }

  return aiConfig;
};

// API Keys configuration
export const getAPIKeys = () => {
  return {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    google: import.meta.env.VITE_GEMINI_API_KEY
  };
};

// Validation function for API keys
export const validateAPIKeys = (): { valid: boolean; missing: string[] } => {
  const keys = getAPIKeys();
  const missing: string[] = [];

  if (!keys.openai) missing.push('VITE_OPENAI_API_KEY');
  if (!keys.google) missing.push('VITE_GEMINI_API_KEY');

  return {
    valid: missing.length === 0,
    missing
  };
};

// Model selection based on availability
export const getAvailableModels = () => {
  const keys = getAPIKeys();
  const available: string[] = [];

  if (keys.openai) available.push('neural', 'synapse');
  if (keys.google) available.push('quantum');

  return available;
};

export default aiConfig;
