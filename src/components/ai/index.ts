/**
 * AI Components Index
 * Central export for all AI-related components
 */

export { FrameworkMapper } from './FrameworkMapper';
export { HistoricalTimeline } from './HistoricalTimeline';
export { AIInsightsPanel } from './AIInsightsPanel';

// Re-export types for convenience
export type { 
  TheoreticalFramework, 
  FrameworkRelationship,
  FrameworkMapping,
  GraphData 
} from '../../services/ai/frameworkMapperService';

export type { 
  HistoricalContext, 
  HistoricalEvent,
  TimelineData 
} from '../../services/ai/historicalContextService';

