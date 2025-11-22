/**
 * DocumentRelationshipGraph Component
 * Visualizes document relationships as a weighted graph using D3.js
 */
import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Network, FileText, Loader, ExternalLink } from 'lucide-react';
import { DocumentRelationshipWithDetails } from '../../lib/supabase';
import { documentRelationships, cognitivePaths } from '../../lib/supabase';
import { useAppStore } from '../store/appStore';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { cognitivePathService, CognitivePathGraphNode } from '../services/cognitivePathService';

interface DocumentRelationshipGraphProps {
  sourceDocumentId: string;
  userId: string;
  onOpenDocument?: (documentId: string) => void;
}

interface GraphNode {
  id: string;
  title: string;
  fileType?: string;
  nodeType: 'document' | 'note' | 'highlight' | 'concept';
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
  weight: number; // edge_strength (0-100)
  edgeType: string; // similarity, reading_flow, concept_link, note_connection, highlight_chain, research_path
  relationshipId?: string;
  connectionReason?: string | null;
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
  const [cognitiveGraphNodes, setCognitiveGraphNodes] = useState<CognitivePathGraphNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [useCognitivePaths, setUseCognitivePaths] = useState(true); // Toggle between old and new graph

  useEffect(() => {
    loadRelationships();
    if (useCognitivePaths) {
      loadCognitivePathGraph();
    }
  }, [sourceDocumentId, userId, useCognitivePaths]);

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

  const loadCognitivePathGraph = async () => {
    try {
      const nodes = await cognitivePathService.getCognitivePathGraph(
        sourceDocumentId,
        userId,
        ['document', 'note', 'highlight', 'concept']
      );
      setCognitiveGraphNodes(nodes);
    } catch (error) {
      console.error('Error loading cognitive path graph:', error);
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

  const getEdgeColor = (edgeType: string, weight: number): string => {
    // Color code by edge type
    switch (edgeType) {
      case 'similarity':
        return getCSSVariable('--color-primary', '#3b82f6'); // Blue
      case 'reading_flow':
        return getCSSVariable('--color-success', '#10b981'); // Green
      case 'concept_link':
        return getCSSVariable('--color-warning', '#f59e0b'); // Orange
      case 'note_connection':
        return '#8b5cf6'; // Purple
      case 'highlight_chain':
        return '#ec4899'; // Pink
      case 'research_path':
        return getCSSVariable('--color-error', '#ef4444'); // Red
      default:
        return getRelevanceColor(weight);
    }
  };

  const getNodeColor = (nodeType: string, isSource: boolean): string => {
    if (isSource) return getPrimaryColor();
    
    switch (nodeType) {
      case 'document':
        return getCSSVariable('--color-primary', '#3b82f6');
      case 'note':
        return getCSSVariable('--color-success', '#10b981');
      case 'highlight':
        return getCSSVariable('--color-warning', '#f59e0b');
      case 'concept':
        return '#8b5cf6'; // Purple
      default:
        return getCSSVariable('--color-text-secondary', '#64748b');
    }
  };

  const getNodeShape = (nodeType: string): string => {
    switch (nodeType) {
      case 'document':
        return 'circle';
      case 'note':
        return 'rect';
      case 'highlight':
        return 'diamond';
      case 'concept':
        return 'star';
      default:
        return 'circle';
    }
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
  const buildGraph = () => {
    if (useCognitivePaths && cognitiveGraphNodes.length > 0) {
      // Use cognitive path graph
      const nodeMap = new Map<string, GraphNode>();
      const links: GraphEdge[] = [];

      // Add source document
      nodeMap.set(sourceDocumentId, {
        id: sourceDocumentId,
        title: currentDocument?.name || 'Current Document',
        fileType: currentDocument?.type || 'pdf',
        nodeType: 'document',
        isSource: true,
        x: dimensions.width / 2,
        y: dimensions.height / 2,
        fx: dimensions.width / 2,
        fy: dimensions.height / 2
      });

      // Process cognitive graph nodes
      cognitiveGraphNodes.forEach(node => {
        const nodeId = node.node_id;
        
        // Extract ID from prefixed format (doc:xxx, note:xxx, etc.)
        const actualId = nodeId.includes(':') ? nodeId.split(':')[1] : nodeId;
        
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            title: node.node_content.substring(0, 50) + (node.node_content.length > 50 ? '...' : ''),
            nodeType: node.node_type,
            relevance: node.edge_strength,
            isSource: false
          });
        }

        // Create edge from source to this node
        links.push({
          source: sourceDocumentId,
          target: nodeId,
          weight: node.edge_strength,
          edgeType: node.edge_type,
          connectionReason: node.connection_reason
        });
      });

      return {
        nodes: Array.from(nodeMap.values()),
        links
      };
    } else {
      // Fallback to original document relationships
      const nodes: GraphNode[] = [
        {
          id: sourceDocumentId,
          title: currentDocument?.name || 'Current Document',
          fileType: currentDocument?.type || 'pdf',
          nodeType: 'document',
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
          nodeType: 'document' as const,
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
          edgeType: 'similarity',
          relationshipId: rel.relationship_id
        }));

      return { nodes, links };
    }
  };

  const { nodes, links } = buildGraph();

  // D3.js graph visualization
  useEffect(() => {
    if (!svgRef.current || isLoading) return;
    if (!useCognitivePaths && relationships.length === 0) return;
    if (useCognitivePaths && cognitiveGraphNodes.length === 0 && relationships.length === 0) return;

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

    // Drag functions (defined inside useEffect to access simulation, width, height)
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

    // Create links (edges)
    const link = g.append('g')
      .selectAll('line')
      .data(graphLinks)
      .join('line')
      .attr('stroke', (d: any) => getEdgeColor(d.edgeType || 'similarity', d.weight))
      .attr('stroke-opacity', (d: any) => 0.4 + (d.weight / 100) * 0.4)
      .attr('stroke-width', (d: any) => getEdgeWidth(d.weight))
      .attr('stroke-dasharray', (d: any) => {
        // Dashed lines for reading flow, solid for others
        return d.edgeType === 'reading_flow' ? '5,5' : 'none';
      })
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

    // Create nodes (simplified - all circles for now, different colors by type)
    const node = g.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', (d: any) => {
        // Different sizes by node type
        const baseSize = getNodeSize(d.relevance, d.isSource);
        if (d.isSource) return baseSize;
        if (d.nodeType === 'concept') return baseSize * 0.8;
        if (d.nodeType === 'highlight') return baseSize * 0.7;
        if (d.nodeType === 'note') return baseSize * 0.9;
        return baseSize;
      })
      .attr('fill', (d: any) => getNodeColor(d.nodeType || 'document', d.isSource))
      .attr('stroke', (d: any) => d.isSource ? getPrimaryColor() : '#fff')
      .attr('stroke-width', (d: any) => d.isSource ? 3 : 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        setHoveredNode(d.id);
        const baseSize = getNodeSize(d.relevance, d.isSource);
        const hoverSize = d.isSource ? baseSize : 
          d.nodeType === 'concept' ? baseSize * 0.8 + 5 :
          d.nodeType === 'highlight' ? baseSize * 0.7 + 5 :
          d.nodeType === 'note' ? baseSize * 0.9 + 5 :
          baseSize + 5;
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', hoverSize)
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
      .on('mouseout', function(event, d: any) {
        setHoveredNode(null);
        const baseSize = getNodeSize(d.relevance, d.isSource);
        const normalSize = d.isSource ? baseSize : 
          d.nodeType === 'concept' ? baseSize * 0.8 :
          d.nodeType === 'highlight' ? baseSize * 0.7 :
          d.nodeType === 'note' ? baseSize * 0.9 :
          baseSize;
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', normalSize)
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
        // Truncate long titles and add node type indicator
        const maxLength = d.isSource ? 25 : 20;
        const truncated = d.title.length > maxLength ? d.title.substring(0, maxLength) + '...' : d.title;
        const typeIndicator = d.nodeType && d.nodeType !== 'document' ? ` [${d.nodeType}]` : '';
        return truncated + typeIndicator;
      })
      .attr('font-size', (d: any) => d.isSource ? 14 : 12)
      .attr('font-weight', (d: any) => d.isSource ? 'bold' : 'normal')
      .attr('fill', () => getCSSVariable('--color-text-primary', '#1e293b'))
      .attr('dx', (d: any) => {
        const baseSize = getNodeSize(d.relevance, d.isSource);
        const actualSize = d.isSource ? baseSize : 
          d.nodeType === 'concept' ? baseSize * 0.8 :
          d.nodeType === 'highlight' ? baseSize * 0.7 :
          d.nodeType === 'note' ? baseSize * 0.9 :
          baseSize;
        return actualSize + 8;
      })
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

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [relationships, cognitiveGraphNodes, isLoading, dimensions, selectedNode, sourceDocumentId, currentDocument, useCognitivePaths]);


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
            {useCognitivePaths 
              ? `${cognitiveGraphNodes.length} connections`
              : `${relationships.length} related`
            }
          </span>
        </div>
        <button
          onClick={() => setUseCognitivePaths(!useCognitivePaths)}
          className="text-xs px-2 py-1 rounded border transition-colors"
          style={{
            backgroundColor: useCognitivePaths ? 'var(--color-primary)' : 'var(--color-surface)',
            color: useCognitivePaths ? 'white' : 'var(--color-text-primary)',
            borderColor: 'var(--color-border)'
          }}
        >
          {useCognitivePaths ? 'Cognitive Paths' : 'Similarity Only'}
        </button>
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
        {useCognitivePaths ? (
          <>
            <div className="flex items-center gap-4 text-xs flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: '#3b82f6' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Similarity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: '#10b981', borderStyle: 'dashed', borderWidth: '1px' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Reading Flow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: '#f59e0b' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Concept Link</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: '#8b5cf6' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Note Connection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: '#ec4899' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Highlight Chain</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Document</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Note</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Highlight</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Concept</span>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              Cognitive paths show how you actually learn and connect ideas • Edge thickness = connection strength • Drag nodes to rearrange • Scroll to zoom
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

