/**
 * Types for structured relationship analysis
 * Supports both old format (overview, sharedTopics, etc.) and new format (relationship_score_percent, relationship_type, etc.)
 */
export interface StructuredRelationshipAnalysis {
  // New format (actual AI output)
  relationship_score_percent?: number;
  relationship_type?: string;
  key_semantic_overlap?: string[];
  key_structural_differences?: string[];
  explanation?: string;
  
  // Old format (backward compatibility)
  overview?: string;
  sharedTopics?: string[];
  keyConnections?: string[];
  readingRecommendation?: string;
  
  // Common fields
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
      
      // Validate structure - check for new format first
      const hasNewFormat = (
        typeof parsed.relationship_score_percent === 'number' &&
        typeof parsed.relationship_type === 'string' &&
        Array.isArray(parsed.key_semantic_overlap) &&
        Array.isArray(parsed.key_structural_differences) &&
        typeof parsed.explanation === 'string'
      );
      
      // Check for old format (backward compatibility)
      const hasOldFormat = (
        typeof parsed.overview === 'string' &&
        Array.isArray(parsed.sharedTopics) &&
        Array.isArray(parsed.keyConnections)
      );
      
      if (hasNewFormat || hasOldFormat) {
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
 * Maps explanation to overview for new format
 */
export function getOverviewText(description: string | null | undefined): string {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    const data = parsed.data as StructuredRelationshipAnalysis;
    // New format: use explanation as overview
    if (data.explanation) {
      return data.explanation;
    }
    // Old format: use overview
    if (data.overview) {
      return data.overview;
    }
    return 'No overview available';
  }
  
  return parsed.data as string;
}

/**
 * Extract shared topics from structured description
 * Maps key_semantic_overlap to sharedTopics for new format
 */
export function getSharedTopics(description: string | null | undefined): string[] {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    const data = parsed.data as StructuredRelationshipAnalysis;
    // New format: use key_semantic_overlap
    if (data.key_semantic_overlap && data.key_semantic_overlap.length > 0) {
      return data.key_semantic_overlap;
    }
    // Old format: use sharedTopics
    if (data.sharedTopics) {
      return data.sharedTopics;
    }
  }
  
  return [];
}

/**
 * Extract key connections from structured description
 * Maps key_structural_differences to keyConnections for new format
 */
export function getKeyConnections(description: string | null | undefined): string[] {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    const data = parsed.data as StructuredRelationshipAnalysis;
    // New format: use key_structural_differences
    if (data.key_structural_differences && data.key_structural_differences.length > 0) {
      return data.key_structural_differences;
    }
    // Old format: use keyConnections
    if (data.keyConnections) {
      return data.keyConnections;
    }
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
 * Extract relationship type from structured description
 */
export function getRelationshipType(description: string | null | undefined): string | null {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    const data = parsed.data as StructuredRelationshipAnalysis;
    return data.relationship_type || null;
  }
  
  return null;
}

/**
 * Extract relationship score percentage from structured description
 */
export function getRelationshipScore(description: string | null | undefined): number | null {
  const parsed = parseRelationshipDescription(description);
  
  if (parsed.isStructured) {
    const data = parsed.data as StructuredRelationshipAnalysis;
    return data.relationship_score_percent ?? null;
  }
  
  return null;
}

/**
 * Extract semantic overlap from structured description
 */
export function getSemanticOverlap(description: string | null | undefined): string[] {
  return getSharedTopics(description); // Same as shared topics
}

/**
 * Extract structural differences from structured description
 */
export function getStructuralDifferences(description: string | null | undefined): string[] {
  return getKeyConnections(description); // Same as key connections
}

/**
 * Extract explanation from structured description
 */
export function getExplanation(description: string | null | undefined): string {
  return getOverviewText(description); // Same as overview
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

