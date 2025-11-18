/**
 * RelevanceBreakdown Component
 * Visualizes how relevance score is calculated from different factors
 */
import React from 'react';
import { Tooltip } from './Tooltip';
import { getRawAnalysis } from '../utils/relationshipAnalysisParser';

interface RelevanceBreakdownProps {
  relevancePercentage?: number;
  aiGeneratedDescription?: string | null;
  relationshipDescription?: string | null;
}

export const RelevanceBreakdown: React.FC<RelevanceBreakdownProps> = ({
  relevancePercentage,
  aiGeneratedDescription,
  relationshipDescription
}) => {
  const rawAnalysis = getRawAnalysis(aiGeneratedDescription || relationshipDescription);
  
  // Calculate contribution percentages (these are the weights used in calculation)
  const keywordWeight = 0.4; // 40%
  const topicWeight = 0.3; // 30%
  const themeWeight = 0.2; // 20%
  const summaryWeight = 0.1; // 10%
  
  // Estimate contributions based on raw analysis data
  // If we have common keywords/topics, we can estimate overlap
  const hasCommonKeywords = rawAnalysis.commonKeywords && rawAnalysis.commonKeywords.length > 0;
  const hasCommonTopics = rawAnalysis.commonTopics && rawAnalysis.commonTopics.length > 0;
  const hasSourceKeywords = rawAnalysis.sourceKeywords && rawAnalysis.sourceKeywords.length > 0;
  const hasRelatedKeywords = rawAnalysis.relatedKeywords && rawAnalysis.relatedKeywords.length > 0;
  
  // Estimate keyword overlap contribution
  const keywordContribution = hasCommonKeywords && hasSourceKeywords && hasRelatedKeywords
    ? Math.min(100, (rawAnalysis.commonKeywords!.length / Math.max(rawAnalysis.sourceKeywords!.length, rawAnalysis.relatedKeywords!.length)) * 100)
    : hasCommonKeywords ? 50 : 0;
  
  // Estimate topic overlap contribution
  const topicContribution = hasCommonTopics ? 70 : 0;
  
  // Default theme and summary contributions (we don't have direct data for these)
  const themeContribution = 50; // Estimated
  const summaryContribution = 50; // Estimated
  
  // Calculate weighted score
  const weightedScore = (
    keywordContribution * keywordWeight +
    topicContribution * topicWeight +
    themeContribution * themeWeight +
    summaryContribution * summaryWeight
  );
  
  const getBarColor = (value: number) => {
    if (value >= 70) return 'var(--color-success)';
    if (value >= 40) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };
  
  if (!relevancePercentage && !rawAnalysis.commonKeywords && !rawAnalysis.commonTopics) {
    return null; // Don't show if no data
  }
  
  return (
    <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Relevance Breakdown
        </h4>
        {relevancePercentage !== undefined && (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {relevancePercentage}%
          </span>
        )}
      </div>
      
      <div className="space-y-2.5">
        {/* Keyword Overlap */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Keywords
              </span>
              <Tooltip content="Overlap of technical terms and key phrases (40% weight)">
                <span className="text-xs opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                  (40%)
                </span>
              </Tooltip>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {Math.round(keywordContribution)}%
            </span>
          </div>
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-border-light)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${keywordContribution}%`,
                backgroundColor: getBarColor(keywordContribution)
              }}
            />
          </div>
          {hasCommonKeywords && rawAnalysis.commonKeywords && (
            <div className="flex flex-wrap gap-1 mt-1">
              {rawAnalysis.commonKeywords.slice(0, 5).map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)'
                  }}
                >
                  {keyword}
                </span>
              ))}
              {rawAnalysis.commonKeywords.length > 5 && (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  +{rawAnalysis.commonKeywords.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Topic Overlap */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Topics
              </span>
              <Tooltip content="Overlap of subject areas and themes (30% weight)">
                <span className="text-xs opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                  (30%)
                </span>
              </Tooltip>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {Math.round(topicContribution)}%
            </span>
          </div>
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-border-light)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${topicContribution}%`,
                backgroundColor: getBarColor(topicContribution)
              }}
            />
          </div>
          {hasCommonTopics && rawAnalysis.commonTopics && (
            <div className="flex flex-wrap gap-1 mt-1">
              {rawAnalysis.commonTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--color-warning-light)',
                    color: 'var(--color-warning)'
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Theme Overlap */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Themes
              </span>
              <Tooltip content="Overlap of overarching themes and questions (20% weight)">
                <span className="text-xs opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                  (20%)
                </span>
              </Tooltip>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {Math.round(themeContribution)}%
            </span>
          </div>
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-border-light)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${themeContribution}%`,
                backgroundColor: getBarColor(themeContribution)
              }}
            />
          </div>
        </div>
        
        {/* Summary Similarity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Summary
              </span>
              <Tooltip content="Similarity of document summaries and main arguments (10% weight)">
                <span className="text-xs opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                  (10%)
                </span>
              </Tooltip>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {Math.round(summaryContribution)}%
            </span>
          </div>
          <div 
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-border-light)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${summaryContribution}%`,
                backgroundColor: getBarColor(summaryContribution)
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Comparison Matrix */}
      {(rawAnalysis.sourceKeywords || rawAnalysis.relatedKeywords || rawAnalysis.commonKeywords) && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Keyword Comparison
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="mb-1 opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                Source
              </p>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {rawAnalysis.sourceKeywords?.length || 0} keywords
              </p>
            </div>
            <div>
              <p className="mb-1 opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                Common
              </p>
              <p style={{ color: 'var(--color-success)' }}>
                {rawAnalysis.commonKeywords?.length || 0} shared
              </p>
            </div>
            <div>
              <p className="mb-1 opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                Related
              </p>
              <p style={{ color: 'var(--color-text-primary)' }}>
                {rawAnalysis.relatedKeywords?.length || 0} keywords
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

