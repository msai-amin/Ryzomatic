/**
 * RelationshipAnalysisCard Component
 * Enhanced card component for displaying relationship analysis with better UX
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, BookOpen, GitBranch } from 'lucide-react';
import { DocumentRelationshipWithDetails } from '../../lib/supabase';
import {
  parseRelationshipDescription,
  getOverviewText,
  getSharedTopics,
  getKeyConnections,
  getReadingRecommendation,
  getRelationshipType,
  getRelationshipScore,
  getSemanticOverlap,
  getStructuralDifferences,
  getRawAnalysis
} from '../utils/relationshipAnalysisParser';
import {
  getRelationshipTypeColor,
  getRelationshipTypeIcon,
  getRelationshipTypeLabel,
  getRelationshipTypeBgColor
} from '../utils/relationshipTypeUtils';
import { RelevanceBreakdown } from './RelevanceBreakdown';
import { Tooltip } from './Tooltip';

interface RelationshipAnalysisCardProps {
  relationship: DocumentRelationshipWithDetails;
  onPreviewDocument?: (relationship: DocumentRelationshipWithDetails) => void;
  onOpenInViewer?: (relationship: DocumentRelationshipWithDetails) => void;
  compact?: boolean;
}

export const RelationshipAnalysisCard: React.FC<RelationshipAnalysisCardProps> = ({
  relationship,
  onPreviewDocument,
  onOpenInViewer,
  compact = false
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const description = relationship.ai_generated_description || relationship.relationship_description;
  const parsed = parseRelationshipDescription(description);
  const isStructured = parsed.isStructured;
  
  const relationshipType = getRelationshipType(description);
  const relationshipScore = getRelationshipScore(description);
  const relevancePercentage = relationship.relevance_percentage ?? relationshipScore ?? null;
  
  const overview = getOverviewText(description);
  const sharedTopics = getSharedTopics(description);
  const keyConnections = getKeyConnections(description);
  const semanticOverlap = getSemanticOverlap(description);
  const structuralDifferences = getStructuralDifferences(description);
  const readingRec = getReadingRecommendation(description);
  const rawAnalysis = getRawAnalysis(description);
  
  const getRelevanceColor = (percentage?: number | null) => {
    if (!percentage) return 'var(--color-text-tertiary)';
    if (percentage >= 80) return 'var(--color-success)';
    if (percentage >= 50) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };
  
  if (compact) {
    // Compact view for list items
    return (
      <div className="p-3 rounded-lg border transition-colors cursor-pointer group"
        style={{ 
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)'
        }}
        onClick={() => onPreviewDocument?.(relationship)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
              {relationship.related_title}
            </h4>
            {relationshipType && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: getRelationshipTypeBgColor(relationshipType),
                    color: getRelationshipTypeColor(relationshipType)
                  }}
                >
                  {getRelationshipTypeIcon(relationshipType)}
                  {getRelationshipTypeLabel(relationshipType)}
                </span>
              </div>
            )}
          </div>
          {relevancePercentage !== null && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm font-semibold" style={{ color: getRelevanceColor(relevancePercentage) }}>
                {relevancePercentage}%
              </span>
            </div>
          )}
        </div>
        
        {relevancePercentage !== null && (
          <div 
            className="w-full h-1.5 rounded-full mb-2"
            style={{ backgroundColor: 'var(--color-border-light)' }}
          >
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: `${relevancePercentage}%`,
                backgroundColor: getRelevanceColor(relevancePercentage)
              }}
            />
          </div>
        )}
        
        {overview && overview !== 'No overview available' && (
          <p className="text-xs line-clamp-2 mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            {overview}
          </p>
        )}
      </div>
    );
  }
  
  // Full card view
  return (
    <div className="space-y-4">
      {/* Header with relationship type and score */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {relationshipType && (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: getRelationshipTypeBgColor(relationshipType),
                  color: getRelationshipTypeColor(relationshipType),
                  border: `1px solid ${getRelationshipTypeColor(relationshipType)}40`
                }}
              >
                {getRelationshipTypeIcon(relationshipType)}
                {getRelationshipTypeLabel(relationshipType)}
              </span>
            </div>
          )}
          
          {relevancePercentage !== null && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: getRelevanceColor(relevancePercentage) }}>
                  {relevancePercentage}%
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  relevant
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenInViewer && (
            <Tooltip content="Open in Viewer">
              <button
                onClick={() => onOpenInViewer(relationship)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-hover)',
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
            }}
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Relevance Breakdown */}
      {isStructured && (
        <RelevanceBreakdown
          relevancePercentage={relevancePercentage ?? undefined}
          aiGeneratedDescription={relationship.ai_generated_description}
          relationshipDescription={relationship.relationship_description}
        />
      )}
      
      {/* Overview/Explanation */}
      {overview && overview !== 'No overview available' && (
        <div>
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Explanation
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            {overview}
          </p>
        </div>
      )}
      
      {/* Expandable Details */}
      {showDetails && (
        <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {/* Semantic Overlap */}
          {semanticOverlap.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Key Semantic Overlap
              </h4>
              <div className="flex flex-wrap gap-2">
                {semanticOverlap.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)'
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Structural Differences */}
          {structuralDifferences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Structural Differences
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {structuralDifferences.map((diff, idx) => (
                  <li key={idx}>{diff}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Reading Recommendation */}
          {readingRec && (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Reading Recommendation
              </h4>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {readingRec}
              </p>
            </div>
          )}
          
          {/* Raw Analysis - Keywords */}
          {rawAnalysis.commonKeywords && rawAnalysis.commonKeywords.length > 0 && (
            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Common Keywords
              </h4>
              <div className="flex flex-wrap gap-1">
                {rawAnalysis.commonKeywords.slice(0, 10).map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-surface-hover)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    {keyword}
                  </span>
                ))}
                {rawAnalysis.commonKeywords.length > 10 && (
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    +{rawAnalysis.commonKeywords.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

