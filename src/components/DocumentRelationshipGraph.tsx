/**
 * DocumentRelationshipGraph Component
 * Visualizes document relationships as a weighted graph
 */
import React, { useState, useEffect } from 'react';
import { Network, FileText, Loader, X, ExternalLink } from 'lucide-react';
import { DocumentRelationshipWithDetails } from '../../lib/supabase';
import { documentRelationships } from '../../lib/supabase';
import { useAppStore } from '../store/appStore';
import { supabaseStorageService } from '../services/supabaseStorageService';

interface DocumentRelationshipGraphProps {
  sourceDocumentId: string;
  userId: string;
  onOpenDocument?: (documentId: string) => void;
}

interface GraphNode {
  id: string;
  title: string;
  fileType: string;
  relevance?: number;
  isSource: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number; // relevance_percentage
  relationshipId: string;
}

export const DocumentRelationshipGraph: React.FC<DocumentRelationshipGraphProps> = ({
  sourceDocumentId,
  userId,
  onOpenDocument
}) => {
  const { currentDocument } = useAppStore();
  const [relationships, setRelationships] = useState<DocumentRelationshipWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    loadRelationships();
  }, [sourceDocumentId, userId]);

  const loadRelationships = async () => {
    setIsLoading(true);
    try {
      supabaseStorageService.setCurrentUser(userId);
      const { data, error } = await documentRelationships.getWithDetails(sourceDocumentId);
      
      if (error) {
        console.error('Error loading relationships:', error);
        return;
      }

      setRelationships(data || []);
    } catch (error) {
      console.error('Error loading relationships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Build graph structure
  const nodes: GraphNode[] = [
    {
      id: sourceDocumentId,
      title: currentDocument?.name || 'Current Document',
      fileType: currentDocument?.type || 'pdf',
      isSource: true
    },
    ...relationships.map(rel => ({
      id: rel.related_document_id,
      title: rel.related_title,
      fileType: rel.related_file_type,
      relevance: rel.relevance_percentage ?? undefined,
      isSource: false
    }))
  ];

  const edges: GraphEdge[] = relationships
    .filter(rel => rel.relevance_percentage !== null && rel.relevance_percentage !== undefined)
    .map(rel => ({
      from: sourceDocumentId,
      to: rel.related_document_id,
      weight: rel.relevance_percentage!,
      relationshipId: rel.relationship_id
    }));

  const getRelevanceColor = (percentage?: number) => {
    if (!percentage) return 'var(--color-text-tertiary)';
    if (percentage >= 80) return 'var(--color-success)';
    if (percentage >= 50) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };

  const getEdgeWidth = (weight: number) => {
    // Map relevance (0-100) to edge width (1-5)
    return Math.max(1, Math.min(5, (weight / 100) * 5));
  };

  const getNodeSize = (relevance?: number) => {
    if (!relevance) return 40;
    // Map relevance to node size (40-80)
    return 40 + (relevance / 100) * 40;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="text-center py-8">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
          No related documents found
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Add related documents to see the relationship graph
        </p>
      </div>
    );
  }

  // Sort nodes by relevance (highest first)
  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.isSource) return -1;
    if (b.isSource) return 1;
    return (b.relevance ?? 0) - (a.relevance ?? 0);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Document Relationship Graph
          </h3>
          <span className="text-xs px-2 py-0.5 rounded" style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)'
          }}>
            {relationships.length} related
          </span>
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Central Document Node */}
          <div
            className="p-4 rounded-lg border-2 transition-all cursor-pointer"
            style={{
              borderColor: 'var(--color-primary)',
              backgroundColor: 'var(--color-primary-light)',
              borderWidth: '3px'
            }}
            onClick={() => setSelectedNode(selectedNode === sourceDocumentId ? null : sourceDocumentId)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="rounded-full p-2 flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    width: '48px',
                    height: '48px'
                  }}
                >
                  <FileText className="w-6 h-6" style={{ color: 'var(--color-text-inverse)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {currentDocument?.name || 'Current Document'}
                    </span>
                    <span 
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-inverse)'
                      }}
                    >
                      CENTER
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {currentDocument?.type?.toUpperCase() || 'PDF'} Document
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Related Document Nodes */}
          {sortedNodes
            .filter(node => !node.isSource)
            .map((node) => {
              const relationship = relationships.find(r => r.related_document_id === node.id);
              const edge = edges.find(e => e.to === node.id);
              const isSelected = selectedNode === node.id;
              const nodeSize = getNodeSize(node.relevance);
              const edgeWidth = edge ? getEdgeWidth(edge.weight) : 1;

              return (
                <div key={node.id} className="relative">
                  {/* Connection Line Visualization */}
                  {edge && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 flex items-center justify-center" style={{ marginLeft: '-8px' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${edgeWidth}px`,
                          backgroundColor: getRelevanceColor(edge.weight),
                          opacity: 0.6
                        }}
                      />
                    </div>
                  )}

                  {/* Node */}
                  <div
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${isSelected ? 'shadow-lg' : ''}`}
                    style={{
                      borderColor: isSelected 
                        ? getRelevanceColor(node.relevance) 
                        : 'var(--color-border)',
                      backgroundColor: isSelected 
                        ? 'var(--color-surface-hover)' 
                        : 'var(--color-surface)',
                      borderWidth: edge ? `${edgeWidth}px` : '1px',
                      marginLeft: edge ? '16px' : '0'
                    }}
                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div 
                          className="rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: node.relevance 
                              ? getRelevanceColor(node.relevance) 
                              : 'var(--color-text-tertiary)',
                            width: `${nodeSize}px`,
                            height: `${nodeSize}px`
                          }}
                        >
                          <FileText 
                            className="w-4 h-4" 
                            style={{ color: 'var(--color-text-inverse)' }} 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                              {node.title}
                            </span>
                            {node.relevance !== undefined && (
                              <span 
                                className="text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0"
                                style={{
                                  backgroundColor: getRelevanceColor(node.relevance),
                                  color: 'var(--color-text-inverse)'
                                }}
                              >
                                {node.relevance}%
                              </span>
                            )}
                            {relationship?.relevance_calculation_status === 'pending' || 
                             relationship?.relevance_calculation_status === 'processing' ? (
                              <span className="text-xs px-2 py-0.5 rounded flex-shrink-0" style={{
                                backgroundColor: 'var(--color-surface-hover)',
                                color: 'var(--color-text-secondary)'
                              }}>
                                Calculating...
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              {node.fileType.toUpperCase()}
                            </span>
                            {relationship?.related_total_pages && (
                              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                • {relationship.related_total_pages} pages
                              </span>
                            )}
                            {edge && (
                              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                                • Weight: {edge.weight.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {onOpenDocument && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDocument(node.id);
                          }}
                          className="p-2 rounded-lg transition-colors flex-shrink-0"
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
                      )}
                    </div>

                    {/* Selected Node Details */}
                    {isSelected && relationship && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        {relationship.relationship_description && (
                          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {relationship.relationship_description}
                          </p>
                        )}
                        {relationship.ai_generated_description && (
                          <details className="text-xs">
                            <summary className="cursor-pointer mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                              AI Analysis
                            </summary>
                            <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>
                              {relationship.ai_generated_description.substring(0, 200)}
                              {relationship.ai_generated_description.length > 200 ? '...' : ''}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>High relevance (≥80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Medium (50-79%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-text-secondary)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Low (&lt;50%)</span>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Edge thickness represents relevance strength
        </p>
      </div>
    </div>
  );
};

