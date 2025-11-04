import { DocumentRelationshipWithDetails } from '../../lib/supabase'
import { Document } from '../store/appStore'

/**
 * Nivo Network node structure
 */
export interface NetworkNode {
  id: string
  label: string
  color: string
  size: number
  metadata?: {
    documentId: string
    title: string
    fileType: string
    relevance?: number
    pages?: number
    description?: string
  }
}

/**
 * Nivo Network link structure
 */
export interface NetworkLink {
  source: string
  target: string
  value: number
  color?: string
}

/**
 * Transformed data for Nivo Network component
 */
export interface NetworkData {
  nodes: NetworkNode[]
  links: NetworkLink[]
}

/**
 * Transform document relationships to Nivo network format
 * 
 * @param currentDocument - The current document being viewed (center node)
 * @param relatedDocuments - Array of related documents with relationship details
 * @returns Network data structure for Nivo visualization
 */
export function transformToNetworkData(
  currentDocument: Document | null,
  relatedDocuments: DocumentRelationshipWithDetails[]
): NetworkData {
  // If no current document, return empty network
  if (!currentDocument) {
    return { nodes: [], links: [] }
  }

  const nodes: NetworkNode[] = []
  const links: NetworkLink[] = []

  // Add current document as central node (larger, primary color)
  nodes.push({
    id: currentDocument.id,
    label: currentDocument.name,
    color: 'var(--color-primary)', // Will be resolved to actual color
    size: 30, // Largest node for central document
    metadata: {
      documentId: currentDocument.id,
      title: currentDocument.name,
      fileType: currentDocument.type,
      pages: currentDocument.totalPages
    }
  })

  // Add related documents as nodes
  relatedDocuments.forEach((relationship) => {
    const relevance = relationship.relevance_percentage || 0
    
    // Determine node color based on relevance
    let color: string
    if (relevance >= 80) {
      color = 'var(--color-success)' // Green for high relevance
    } else if (relevance >= 50) {
      color = 'var(--color-warning)' // Yellow for medium relevance
    } else if (relevance > 0) {
      color = 'var(--color-text-secondary)' // Gray for low relevance
    } else {
      color = 'var(--color-text-tertiary)' // Very light for pending
    }

    // Calculate node size based on relevance (10-25px range)
    const nodeSize = relevance > 0 
      ? Math.max(10, Math.min(25, 10 + (relevance / 100) * 15))
      : 12 // Default size for pending relationships

    nodes.push({
      id: relationship.related_document_id,
      label: relationship.related_title,
      color,
      size: nodeSize,
      metadata: {
        documentId: relationship.related_document_id,
        title: relationship.related_title,
        fileType: relationship.related_file_type,
        relevance,
        pages: relationship.related_total_pages,
        description: relationship.relationship_description || relationship.ai_generated_description
      }
    })

    // Add link from current document to related document
    // Link value (thickness) is based on relevance percentage
    links.push({
      source: currentDocument.id,
      target: relationship.related_document_id,
      value: relevance || 1, // Minimum value of 1 for visibility
      color: color // Link color matches node color
    })
  })

  return { nodes, links }
}

/**
 * Get CSS color value from CSS variable
 * This is a helper to resolve CSS variables to actual colors for Nivo
 * Note: Nivo may need actual color values, not CSS variables
 */
export function resolveCSSColor(cssVar: string): string {
  // For now, return the CSS variable as-is
  // Nivo's ResponsiveNetwork should handle CSS variables
  // If not, we'll need to compute actual colors
  return cssVar
}

