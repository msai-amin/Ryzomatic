/**
 * Types for structured relationship analysis
 */
export interface StructuredRelationshipAnalysis {
  overview: string;
  sharedTopics: string[];
  keyConnections: string[];
  readingRecommendation: string;
  rawAnalysis?: {
    sourceKeywords?: string[];
    relatedKeywords?: string[];
    commonKeywords?: string[];
    sourceTopics?: string[];
    relatedTopics?: string[];
    commonTopics?: string[];
  };
}

/**
 * Result after parsing relationship description
 */
export interface ParsedRelationshipDescription {
  isStructured: boolean;
  data: StructuredRelationshipAnalysis | string;
}

/**
 * Parse AI-generated relationship description
 * Handles both structured JSON and plain text (backward compatibility)
 */
export function parseRelationshipDescription(
  description: string | null | undefined
): ParsedRelationshipDescription {
  if (!description) {
    return {
      isStructured: false,
      data: 'No relationship description available.'
    };
  }

  // Try to parse as JSON
  try {
    const jsonMatch = description.trim().match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as StructuredRelationshipAnalysis;
      
      // Validate structure
      if (
        typeof parsed.overview === 'string' &&
        Array.isArray(parsed.sharedTopics) &&
        Array.isArray(parsed.keyConnections)
      ) {
        return {
          isStructured: true,
          data: parsed
        };
      }
    }
  } catch (error) {
    // Not JSON, treat as plain text
    console.log('RelationshipAnalysisParser: Description is plain text, not JSON');
  }

  // Return as plain text
  return {
    isStructured: false,
    data: description
  };
}

/**
 * Extract overview text from either structured or plain text
 */
export function getOverviewText(description: string | null | undefined): string {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    return (parsed.data as StructuredRelationshipAnalysis).overview || 'No overview available';
  }
  
  return parsed.data as string;
}

/**
 * Extract shared topics from structured description
 */
export function getSharedTopics(description: string | null | undefined): string[] {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    return (parsed.data as StructuredRelationshipAnalysis).sharedTopics || [];
  }
  
  return [];
}

/**
 * Extract key connections from structured description
 */
export function getKeyConnections(description: string | null | undefined): string[] {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    return (parsed.data as StructuredRelationshipAnalysis).keyConnections || [];
  }
  
  return [];
}

/**
 * Extract reading recommendation from structured description
 */
export function getReadingRecommendation(description: string | null | undefined): string {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    return (parsed.data as StructuredRelationshipAnalysis).readingRecommendation || '';
  }
  
  return '';
}

/**
 * Extract raw analysis data from structured description
 */
export function getRawAnalysis(description: string | null | undefined): {
  sourceKeywords?: string[];
  relatedKeywords?: string[];
  commonKeywords?: string[];
  sourceTopics?: string[];
  relatedTopics?: string[];
  commonTopics?: string[];
} {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured && (parsed.data as StructuredRelationshipAnalysis).rawAnalysis) {
    return (parsed.data as StructuredRelationshipAnalysis).rawAnalysis || {};
  }
  
  return {};
}

