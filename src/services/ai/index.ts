/**
 * AI Services Index
 * Central export for all AI services
 */

export { aiEngine, AIEngineCore } from './aiEngineCore';
export type { 
  AIAnalysisResult, 
  DocumentAnalysisRequest,
  AIEngineConfig 
} from './aiEngineCore';

export { 
  analyzeFrameworks,
  getCachedFrameworks 
} from './frameworkMapperService';
export type {
  TheoreticalFramework,
  FrameworkRelationship,
  FrameworkMapping,
  GraphData
} from './frameworkMapperService';

export { 
  generateHistoricalContext,
  searchRelatedFigures 
} from './historicalContextService';
export type {
  HistoricalContext,
  HistoricalEvent,
  TimelineData,
  Source
} from './historicalContextService';

