/**
 * DocumentRelationshipGraph Component
 * Visualizes document relationships as a weighted graph using D3.js
 */
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Network, FileText, Loader, ExternalLink } from 'lucide-react';
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
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number; // relevance_percentage
  relationshipId: string;
}

export const DocumentRelationshipGraph: React.FC<DocumentRelationshipGraphProps> = ({
  sourceDocumentId,
  userId,
  onOpenDocument
}) => {
  const { currentDocument } = useAppStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [relationships, setRelationships] = useState<DocumentRelationshipWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    loadRelationships();
  }, [sourceDocumentId, userId]);

  // Update dimensions on container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(800, rect.width - 40),
          height: Math.max(600, rect.height - 100)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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

  // Helper to get CSS variable value
  const getCSSVariable = (varName: string, fallback: string = '#000'): string => {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return value || fallback;
  };

  const getRelevanceColor = (percentage?: number): string => {
    if (!percentage) return getCSSVariable('--color-text-tertiary', '#94a3b8');
    if (percentage >= 80) return getCSSVariable('--color-success', '#10b981');
    if (percentage >= 50) return getCSSVariable('--color-warning', '#f59e0b');
    return getCSSVariable('--color-text-secondary', '#64748b');
  };

  const getPrimaryColor = (): string => {
    return getCSSVariable('--color-primary', '#3b82f6');
  };

  const getEdgeWidth = (weight: number): number => {
    // Map relevance (0-100) to edge width (1-8px)
    return Math.max(1, Math.min(8, (weight / 100) * 8));
  };

  const getNodeSize = (relevance?: number, isSource: boolean = false): number => {
    if (isSource) return 30; // Main node radius
    if (!relevance) return 15;
    // Map relevance to node size (15-25px radius)
    return 15 + (relevance / 100) * 10;
  };

  const getLinkDistance = (weight: number): number => {
    // Higher relevance = closer distance (inverse relationship)
    // Range: 100-300px
    return 300 - (weight / 100) * 200;
  };

  // Build graph structure for D3
  const nodes: GraphNode[] = [
    {
      id: sourceDocumentId,
      title: currentDocument?.name || 'Current Document',
      fileType: currentDocument?.type || 'pdf',
      isSource: true,
      x: dimensions.width / 2,
      y: dimensions.height / 2,
      fx: dimensions.width / 2,
      fy: dimensions.height / 2
    },
    ...relationships.map(rel => ({
      id: rel.related_document_id,
      title: rel.related_title,
      fileType: rel.related_file_type,
      relevance: rel.relevance_percentage ?? undefined,
      isSource: false
    }))
  ];

  const links: GraphEdge[] = relationships
    .filter(rel => rel.relevance_percentage !== null && rel.relevance_percentage !== undefined)
    .map(rel => ({
      source: sourceDocumentId,
      target: rel.related_document_id,
      weight: rel.relevance_percentage!,
      relationshipId: rel.relationship_id
    }));

  // D3.js graph visualization
  useEffect(() => {
    if (!svgRef.current || isLoading || relationships.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Create container for zoom
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Prepare nodes with initial positions
    const graphNodes = nodes.map(node => {
      if (node.isSource) {
        // Main node fixed at center
        return {
          ...node,
          x: width / 2,
          y: height / 2,
          fx: width / 2,
          fy: height / 2
        };
      }
      // Related nodes positioned randomly around center
      const angle = Math.random() * Math.PI * 2;
      const radius = 150 + Math.random() * 100;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius
      };
    });

    // Prepare links - map IDs to node objects
    const graphLinks = links.map(link => {
      const sourceNode = graphNodes.find(n => n.id === link.source);
      const targetNode = graphNodes.find(n => n.id === link.target);
      return {
        source: sourceNode || link.source,
        target: targetNode || link.target,
        weight: link.weight,
        relationshipId: link.relationshipId
      };
    }).filter(link => link.source && link.target);

    // Create force simulation
    const simulation = d3.forceSimulation(graphNodes as any)
      .force('link', d3.forceLink(graphLinks)
        .id((d: any) => d.id)
        .distance((d: any) => getLinkDistance(d.weight))
      )
      .force('charge', d3.forceManyBody().strength((d: any) => {
        // Main node doesn't repel, related nodes repel
        return d.isSource ? 0 : -400;
      }))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeSize(d.relevance, d.isSource) + 15));

    // Create links (edges)
    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', (d: any) => getRelevanceColor(d.weight))
      .attr('stroke-opacity', (d: any) => 0.4 + (d.weight / 100) * 0.4)
      .attr('stroke-width', (d: any) => getEdgeWidth(d.weight))
      .style('cursor', 'pointer');

    // Create link labels (relevance percentage)
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(graphLinks)
      .join('text')
      .attr('font-size', 11)
      .attr('fill', (d: any) => getRelevanceColor(d.weight))
      .attr('opacity', 0)
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text((d: any) => `${d.weight.toFixed(0)}%`);

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', (d: any) => getNodeSize(d.relevance, d.isSource))
      .attr('fill', (d: any) => {
        if (d.isSource) return getPrimaryColor();
        return d.relevance ? getRelevanceColor(d.relevance) : getCSSVariable('--color-text-tertiary', '#94a3b8');
      })
      .attr('stroke', (d: any) => d.isSource ? getPrimaryColor() : '#fff')
      .attr('stroke-width', (d: any) => d.isSource ? 3 : 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        setHoveredNode(d.id);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => getNodeSize(d.relevance, d.isSource) + 5)
          .attr('stroke-width', (d: any) => d.isSource ? 4 : 3);
        
        // Highlight connected links
        link
          .attr('stroke-opacity', (l: any) => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
            const targetId = typeof l.target === 'string' ? l.target : l.target.id;
            return sourceId === d.id || targetId === d.id ? 0.9 : 0.2;
          });
        
        linkLabels
          .attr('opacity', (l: any) => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
            const targetId = typeof l.target === 'string' ? l.target : l.target.id;
            return sourceId === d.id || targetId === d.id ? 1 : 0;
          });
      })
      .on('mouseout', function() {
        setHoveredNode(null);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => getNodeSize(d.relevance, d.isSource))
          .attr('stroke-width', (d: any) => d.isSource ? 3 : 2);
        
        link.attr('stroke-opacity', (d: any) => 0.4 + (d.weight / 100) * 0.4);
        linkLabels.attr('opacity', 0);
      })
      .on('click', function(event, d: any) {
        setSelectedNode(selectedNode === d.id ? null : d.id);
        if (!d.isSource && onOpenDocument) {
          onOpenDocument(d.id);
        }
      })
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any
      );

    // Create node labels
    const labels = g.append('g')
      .selectAll('text')
      .data(graphNodes)
      .join('text')
      .text((d: any) => {
        // Truncate long titles
        const maxLength = d.isSource ? 25 : 20;
        return d.title.length > maxLength ? d.title.substring(0, maxLength) + '...' : d.title;
      })
      .attr('font-size', (d: any) => d.isSource ? 14 : 12)
      .attr('font-weight', (d: any) => d.isSource ? 'bold' : 'normal')
      .attr('fill', () => getCSSVariable('--color-text-primary', '#1e293b'))
      .attr('dx', (d: any) => getNodeSize(d.relevance, d.isSource) + 8)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .style('font-family', 'system-ui, -apple-system, sans-serif');

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? graphNodes.find(n => n.id === d.source)
            : d.source;
          return (source as any).x;
        })
        .attr('y1', (d: any) => {
          const source = typeof d.source === 'string' 
            ? graphNodes.find(n => n.id === d.source)
            : d.source;
          return (source as any).y;
        })
        .attr('x2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? graphNodes.find(n => n.id === d.target)
            : d.target;
          return (target as any).x;
        })
        .attr('y2', (d: any) => {
          const target = typeof d.target === 'string' 
            ? graphNodes.find(n => n.id === d.target)
            : d.target;
          return (target as any).y;
        });

      linkLabels
        .attr('x', (d: any) => {
          const source = typeof d.source === 'string' 
            ? graphNodes.find(n => n.id === d.source)
            : d.source;
          const target = typeof d.target === 'string' 
            ? graphNodes.find(n => n.id === d.target)
            : d.target;
          return ((source as any).x + (target as any).x) / 2;
        })
        .attr('y', (d: any) => {
          const source = typeof d.source === 'string' 
            ? graphNodes.find(n => n.id === d.source)
            : d.source;
          const target = typeof d.target === 'string' 
            ? graphNodes.find(n => n.id === d.target)
            : d.target;
          return ((source as any).y + (target as any).y) / 2;
        });

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      // Don't allow dragging the main node - keep it fixed
      if (event.subject.isSource) {
        return;
      }
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      // Don't allow dragging the main node
      if (event.subject.isSource) {
        return;
      }
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep main node fixed at center
      if (event.subject.isSource) {
        event.subject.fx = width / 2;
        event.subject.fy = height / 2;
        return;
      }
      // Allow related nodes to be repositioned but don't fix them permanently
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
  };
  }, [relationships, isLoading, dimensions, selectedNode, sourceDocumentId, currentDocument]);

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

  const selectedRelationship = selectedNode 
    ? relationships.find(r => r.related_document_id === selectedNode)
    : null;

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
          <div
        ref={containerRef}
        className="flex-1 overflow-hidden rounded-lg border" 
            style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          minHeight: '500px',
          position: 'relative'
        }}
      >
        <svg 
          ref={svgRef} 
          className="w-full h-full"
                      style={{
            backgroundColor: 'var(--color-surface)',
            display: 'block'
                        }}
                      />
                    </div>

      {/* Selected Node Details */}
      {selectedRelationship && selectedNode && (
        <div className="mt-4 p-3 rounded-lg border" style={{ 
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface-hover)'
        }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {selectedRelationship.related_title}
            </h4>
            {selectedRelationship.relevance_percentage !== null && (
                              <span 
                className="text-xs font-semibold px-2 py-0.5 rounded"
                                style={{
                  backgroundColor: getRelevanceColor(selectedRelationship.relevance_percentage),
                                  color: 'var(--color-text-inverse)'
                                }}
                              >
                {selectedRelationship.relevance_percentage}% relevant
                              </span>
                            )}
                          </div>
          {selectedRelationship.relationship_description && (
                          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              {selectedRelationship.relationship_description}
                          </p>
                        )}
          {selectedRelationship.ai_generated_description && (
                          <details className="text-xs">
                            <summary className="cursor-pointer mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                              AI Analysis
                            </summary>
                            <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {selectedRelationship.ai_generated_description.substring(0, 300)}
                {selectedRelationship.ai_generated_description.length > 300 ? '...' : ''}
                            </p>
                          </details>
                        )}
          {onOpenDocument && (
            <button
              onClick={() => onOpenDocument(selectedNode)}
              className="mt-2 text-xs px-3 py-1 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <ExternalLink className="w-3 h-3 inline mr-1" />
              Open Document
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-4 text-xs flex-wrap">
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
          Edge thickness and color represent relevance strength • Drag nodes to rearrange • Scroll to zoom • Hover to see connections
        </p>
      </div>
    </div>
  );
};

