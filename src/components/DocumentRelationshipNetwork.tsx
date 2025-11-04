import React, { useMemo, useCallback } from 'react'
import { ResponsiveNetwork } from '@nivo/network'
import { DocumentRelationshipWithDetails } from '../../lib/supabase'
import { Document } from '../store/appStore'
import { transformToNetworkData, NetworkNode } from '../utils/documentRelationshipTransformer'
import { FileText, Network } from 'lucide-react'

interface DocumentRelationshipNetworkProps {
  currentDocument: Document | null
  relatedDocuments: DocumentRelationshipWithDetails[]
  onNodeClick?: (documentId: string) => void
  height?: number
}

/**
 * Color palette for network nodes
 * Using actual hex colors since Nivo may not handle CSS variables well
 */
const NODE_COLORS = {
  primary: '#3b82f6', // Blue for current document
  highRelevance: '#10b981', // Green for high relevance (>=80%)
  mediumRelevance: '#f59e0b', // Orange for medium relevance (50-79%)
  lowRelevance: '#6b7280', // Gray for low relevance (1-49%)
  pending: '#9ca3af' // Light gray for pending
}

/**
 * Document Relationship Network Visualization
 * 
 * Displays the current document as a central node with related documents
 * connected via links whose thickness represents relevance percentage.
 */
export const DocumentRelationshipNetwork: React.FC<DocumentRelationshipNetworkProps> = ({
  currentDocument,
  relatedDocuments,
  onNodeClick,
  height = 400
}) => {
  // Transform data to Nivo format
  const networkData = useMemo(() => {
    const data = transformToNetworkData(currentDocument, relatedDocuments)
    
    // Convert CSS variables to actual colors for Nivo
    return {
      nodes: data.nodes.map(node => {
        let color = node.color
        // Replace CSS variables with actual colors
        if (color.includes('var(--color-primary)')) {
          color = NODE_COLORS.primary
        } else if (color.includes('var(--color-success)')) {
          color = NODE_COLORS.highRelevance
        } else if (color.includes('var(--color-warning)')) {
          color = NODE_COLORS.mediumRelevance
        } else if (color.includes('var(--color-text-secondary)')) {
          color = NODE_COLORS.lowRelevance
        } else if (color.includes('var(--color-text-tertiary)')) {
          color = NODE_COLORS.pending
        }
        return { ...node, color }
      }),
      links: data.links.map(link => {
        let color = link.color || NODE_COLORS.lowRelevance
        // Replace CSS variables with actual colors
        if (color.includes('var(--color-success)')) {
          color = NODE_COLORS.highRelevance
        } else if (color.includes('var(--color-warning)')) {
          color = NODE_COLORS.mediumRelevance
        } else if (color.includes('var(--color-text-secondary)')) {
          color = NODE_COLORS.lowRelevance
        } else if (color.includes('var(--color-text-tertiary)')) {
          color = NODE_COLORS.pending
        }
        return { ...link, color }
      })
    }
  }, [currentDocument, relatedDocuments])

  // Handle node click
  const handleNodeClick = useCallback((node: NetworkNode) => {
    if (onNodeClick && node.metadata?.documentId) {
      onNodeClick(node.metadata.documentId)
    }
  }, [onNodeClick])

  // Empty state
  if (!currentDocument) {
    return (
      <div className="flex flex-col items-center justify-center py-12" style={{ minHeight: height }}>
        <Network className="w-12 h-12 mb-3 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
          No document selected
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Open a document to see its relationships
        </p>
      </div>
    )
  }

  if (relatedDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" style={{ minHeight: height }}>
        <Network className="w-12 h-12 mb-3 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
          No related documents found
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Add related documents to see the network visualization
        </p>
      </div>
    )
  }

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      <ResponsiveNetwork
        data={networkData}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        linkDistance={150}
        centeringStrength={0.3}
        repulsivity={50}
        nodeSize={(node: NetworkNode) => node.size}
        activeNodeSize={(node: NetworkNode) => node.size * 1.3}
        nodeColor={(node: NetworkNode) => node.color}
        nodeBorderWidth={2}
        nodeBorderColor={{
          from: 'color',
          modifiers: [['darker', 0.8]]
        }}
        linkThickness={(link) => {
          // Thickness based on relevance value (1-5px range)
          const value = link.value || 1
          return Math.max(1, Math.min(5, (value / 100) * 5))
        }}
        linkColor={(link) => link.color || NODE_COLORS.lowRelevance}
        motionConfig="gentle"
        animate={true}
        onClick={(node) => handleNodeClick(node as NetworkNode)}
        tooltip={({ node }: { node: NetworkNode }) => {
          const metadata = node.metadata
          if (!metadata) return null

          return (
            <div
              className="p-3 rounded-lg shadow-lg border"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                maxWidth: '250px'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm font-semibold">{metadata.title}</span>
              </div>
              {metadata.relevance !== undefined && (
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Relevance: {metadata.relevance}%
                </div>
              )}
              {metadata.fileType && (
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Type: {metadata.fileType.toUpperCase()}
                </div>
              )}
              {metadata.pages && (
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Pages: {metadata.pages}
                </div>
              )}
              {metadata.description && (
                <div className="text-xs mt-2 pt-2 border-t" style={{ 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}>
                  {metadata.description.substring(0, 100)}
                  {metadata.description.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}

export default DocumentRelationshipNetwork

