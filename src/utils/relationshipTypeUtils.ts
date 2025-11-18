/**
 * Utility functions for relationship type display
 */
import React from 'react';
import { 
  FileText, 
  GitBranch, 
  ArrowRight, 
  XCircle, 
  FlaskConical, 
  BookOpen, 
  Link2, 
  Ban 
} from 'lucide-react';

export type RelationshipType = 
  | 'Identical'
  | 'Revision / Version'
  | 'Extension / Follow-up'
  | 'Refutation / Counter-Argument'
  | 'Methodological Application'
  | 'Shared Topic'
  | 'Related (Tangential)'
  | 'Unrelated';

/**
 * Get color for relationship type
 */
export function getRelationshipTypeColor(type: string | null | undefined): string {
  if (!type) return 'var(--color-text-tertiary)';
  
  const normalizedType = type.toLowerCase().trim();
  
  if (normalizedType.includes('identical')) {
    return 'var(--color-primary)'; // Blue
  }
  if (normalizedType.includes('revision') || normalizedType.includes('version')) {
    return 'var(--color-primary)'; // Blue
  }
  if (normalizedType.includes('extension') || normalizedType.includes('follow-up')) {
    return 'var(--color-success)'; // Green
  }
  if (normalizedType.includes('refutation') || normalizedType.includes('counter')) {
    return 'var(--color-error)'; // Red
  }
  if (normalizedType.includes('methodological') || normalizedType.includes('application')) {
    return 'var(--color-primary)'; // Blue
  }
  if (normalizedType.includes('shared topic')) {
    return 'var(--color-warning)'; // Yellow/Orange
  }
  if (normalizedType.includes('tangential') || normalizedType.includes('related')) {
    return 'var(--color-text-secondary)'; // Gray
  }
  if (normalizedType.includes('unrelated')) {
    return 'var(--color-text-tertiary)'; // Light gray
  }
  
  return 'var(--color-text-secondary)'; // Default
}

/**
 * Get icon for relationship type
 */
export function getRelationshipTypeIcon(type: string | null | undefined): React.ReactNode {
  if (!type) return <FileText className="w-4 h-4" />;
  
  const normalizedType = type.toLowerCase().trim();
  
  if (normalizedType.includes('identical')) {
    return <FileText className="w-4 h-4" />;
  }
  if (normalizedType.includes('revision') || normalizedType.includes('version')) {
    return <GitBranch className="w-4 h-4" />;
  }
  if (normalizedType.includes('extension') || normalizedType.includes('follow-up')) {
    return <ArrowRight className="w-4 h-4" />;
  }
  if (normalizedType.includes('refutation') || normalizedType.includes('counter')) {
    return <XCircle className="w-4 h-4" />;
  }
  if (normalizedType.includes('methodological') || normalizedType.includes('application')) {
    return <FlaskConical className="w-4 h-4" />;
  }
  if (normalizedType.includes('shared topic')) {
    return <BookOpen className="w-4 h-4" />;
  }
  if (normalizedType.includes('tangential') || normalizedType.includes('related')) {
    return <Link2 className="w-4 h-4" />;
  }
  if (normalizedType.includes('unrelated')) {
    return <Ban className="w-4 h-4" />;
  }
  
  return <FileText className="w-4 h-4" />; // Default
}

/**
 * Get display label for relationship type
 */
export function getRelationshipTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  
  // Normalize common variations
  const normalizedType = type.toLowerCase().trim();
  
  if (normalizedType.includes('identical')) {
    return 'Identical';
  }
  if (normalizedType.includes('revision') || normalizedType.includes('version')) {
    return 'Revision / Version';
  }
  if (normalizedType.includes('extension') || normalizedType.includes('follow-up')) {
    return 'Extension / Follow-up';
  }
  if (normalizedType.includes('refutation') || normalizedType.includes('counter')) {
    return 'Refutation / Counter-Argument';
  }
  if (normalizedType.includes('methodological') || normalizedType.includes('application')) {
    return 'Methodological Application';
  }
  if (normalizedType.includes('shared topic')) {
    return 'Shared Topic';
  }
  if (normalizedType.includes('tangential') || normalizedType.includes('related')) {
    return 'Related (Tangential)';
  }
  if (normalizedType.includes('unrelated')) {
    return 'Unrelated';
  }
  
  return type; // Return original if no match
}

/**
 * Get background color for relationship type badge
 */
export function getRelationshipTypeBgColor(type: string | null | undefined): string {
  const color = getRelationshipTypeColor(type);
  
  // Convert CSS variable to rgba with opacity
  if (color.includes('primary')) {
    return 'rgba(99, 102, 241, 0.1)'; // indigo-500 with 10% opacity
  }
  if (color.includes('success')) {
    return 'rgba(34, 197, 94, 0.1)'; // green-500 with 10% opacity
  }
  if (color.includes('error')) {
    return 'rgba(239, 68, 68, 0.1)'; // red-500 with 10% opacity
  }
  if (color.includes('warning')) {
    return 'rgba(251, 191, 36, 0.1)'; // yellow-400 with 10% opacity
  }
  
  return 'rgba(148, 163, 184, 0.1)'; // Default gray
}

