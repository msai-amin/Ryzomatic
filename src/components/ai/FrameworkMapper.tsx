/**
 * Framework Mapper Component
 * Visualizes theoretical frameworks and their relationships using D3.js
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  TheoreticalFramework, 
  FrameworkRelationship,
  GraphData 
} from '../../services/ai/frameworkMapperService';
import { BookOpen, Network, Sparkles } from 'lucide-react';

interface FrameworkMapperProps {
  frameworks: TheoreticalFramework[];
  relationships: FrameworkRelationship[];
  visualizationData: GraphData;
  onFrameworkClick?: (framework: TheoreticalFramework) => void;
  className?: string;
}

export const FrameworkMapper: React.FC<FrameworkMapperProps> = ({
  frameworks,
  relationships,
  visualizationData,
  onFrameworkClick,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedFramework, setSelectedFramework] = useState<TheoreticalFramework | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || frameworks.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Create container for zoom
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Prepare data for D3
    const nodes = visualizationData.nodes.map(node => ({
      ...node,
      x: width / 2 + Math.random() * 100 - 50,
      y: height / 2 + Math.random() * 100 - 50
    }));

    const links = visualizationData.edges.map(edge => ({
      source: edge.from,
      target: edge.to,
      value: edge.value,
      title: edge.title
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.value));

    // Create link labels
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .attr('opacity', 0)
      .text((d: any) => d.title || '');

    // Create nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d: any) => 8 + d.value)
      .attr('fill', (d: any) => getColorForGroup(d.group))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        setHoveredNode(d.id);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => 12 + d.value)
          .attr('stroke-width', 3);
        
        // Show connected links
        link
          .attr('stroke-opacity', (l: any) => 
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.2
          );
        
        linkLabels
          .attr('opacity', (l: any) => 
            l.source.id === d.id || l.target.id === d.id ? 1 : 0
          );
      })
      .on('mouseout', function() {
        setHoveredNode(null);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => 8 + d.value)
          .attr('stroke-width', 2);
        
        link.attr('stroke-opacity', 0.6);
        linkLabels.attr('opacity', 0);
      })
      .on('click', function(event, d: any) {
        const framework = frameworks.find(fw => fw.id === d.id);
        if (framework) {
          setSelectedFramework(framework);
          onFrameworkClick?.(framework);
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
      .data(nodes)
      .join('text')
      .text((d: any) => d.label)
      .attr('font-size', 12)
      .attr('dx', 15)
      .attr('dy', 4)
      .attr('fill', '#1e293b')
      .attr('font-weight', 500)
      .style('pointer-events', 'none');

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

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
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [frameworks, visualizationData, onFrameworkClick]);

  return (
    <div className={`framework-mapper bg-white rounded-lg shadow-lg ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Theoretical Framework Map
          </h3>
          <Sparkles className="w-4 h-4 text-yellow-500" />
        </div>
        <p className="text-sm text-gray-600">
          {frameworks.length} framework{frameworks.length !== 1 ? 's' : ''} • 
          {' '}{relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="relative">
        <svg 
          ref={svgRef} 
          className="w-full h-[600px] bg-gradient-to-br from-slate-50 to-blue-50"
        />
        
        {frameworks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No frameworks detected yet</p>
              <p className="text-sm">Upload a document to analyze</p>
            </div>
          </div>
        )}
      </div>

      {selectedFramework && (
        <div className="p-4 border-t border-gray-200 bg-blue-50">
          <h4 className="font-semibold text-gray-900 mb-2">
            {selectedFramework.name}
          </h4>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Author:</strong> {selectedFramework.author}
            {selectedFramework.year && ` (${selectedFramework.year})`}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {selectedFramework.description}
          </p>
          {selectedFramework.keyTerms.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedFramework.keyTerms.map((term, idx) => (
                <span 
                  key={idx}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Confidence: {(selectedFramework.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}

      <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <p>💡 <strong>Tip:</strong> Click and drag nodes to rearrange • Scroll to zoom • Hover for connections</p>
      </div>
    </div>
  );
};

/**
 * Get color for a group (author)
 */
function getColorForGroup(group: string): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#f97316', // orange
  ];
  
  // Simple hash function for consistent colors
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

