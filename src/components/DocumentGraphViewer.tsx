import React, { useState, useEffect } from 'react';
import { Network, Expand, Minimize, Loader, FileText, StickyNote, Brain, Filter } from 'lucide-react';
import { UnifiedNode, UnifiedEdge } from '../../lib/unifiedGraphService';

interface DocumentGraphViewerProps {
  documentId: string;
  userId: string;
  maxDepth?: number;
}

interface GraphData {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
}

export const DocumentGraphViewer: React.FC<DocumentGraphViewerProps> = ({
  documentId,
  userId,
  maxDepth = 2
}) => {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<UnifiedNode | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadGraph();
  }, [documentId, maxDepth]);

  const loadGraph = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/graph/query?documentId=${documentId}&userId=${userId}&depth=${maxDepth}`
      );
      const result = await response.json();
      
      if (result.data) {
        setGraph(result.data);
      }
    } catch (error) {
      console.error('Error loading graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'note':
        return <StickyNote className="w-4 h-4" />;
      case 'memory':
        return <Brain className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getNodeColor = (nodeType: string) => {
    switch (nodeType) {
      case 'document':
        return 'var(--color-primary)';
      case 'note':
        return 'var(--color-success)';
      case 'memory':
        return 'var(--color-warning)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  const filteredNodes = filter === 'all' 
    ? graph.nodes 
    : graph.nodes.filter(n => n.node_type === filter);

  const filteredEdges = graph.edges.filter(e => {
    const fromExists = filteredNodes.some(n => n.id === e.from);
    const toExists = filteredNodes.some(n => n.id === e.to);
    return fromExists && toExists;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="text-center py-8">
        <Network className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
          No connections found
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Add notes or related documents to see the graph
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Document Graph
          </h3>
          <span className="text-xs px-2 py-0.5 rounded" style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)'
          }}>
            {filteredNodes.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 rounded text-xs border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
          >
            <option value="all">All</option>
            <option value="document">Documents</option>
            <option value="note">Notes</option>
            <option value="memory">Memories</option>
          </select>
        </div>
      </div>

      {/* Graph Visualization - Simplified List View */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {/* Central Document */}
          {filteredNodes.find(n => n.id === `doc:${documentId}`) && (
            <div
              className="p-3 rounded-lg border-2"
              style={{
                borderColor: 'var(--color-primary)',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-semibold">Central Document</span>
              </div>
              <p className="text-xs line-clamp-2">
                {filteredNodes.find(n => n.id === `doc:${documentId}`)?.content || 'No description'}
              </p>
            </div>
          )}

          {/* Related Nodes */}
          {filteredNodes
            .filter(n => n.id !== `doc:${documentId}`)
            .map((node) => {
              const connectedEdges = filteredEdges.filter(e => e.from === node.id || e.to === node.id);
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                  className="p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm"
                  style={{
                    borderColor: selectedNode?.id === node.id ? getNodeColor(node.node_type) : 'var(--color-border)',
                    backgroundColor: selectedNode?.id === node.id 
                      ? 'var(--color-primary)' 
                      : 'var(--color-surface)',
                    color: selectedNode?.id === node.id ? 'var(--color-text-inverse)' : 'var(--color-text)'
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.node_type)}
                      <span className="text-xs font-medium capitalize">{node.node_type}</span>
                      {connectedEdges.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text-secondary)'
                        }}>
                          {connectedEdges.length} links
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs line-clamp-2">{node.content || 'No content'}</p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="mt-4 p-3 rounded-lg border" style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)'
        }}>
          <div className="flex items-center gap-2 mb-2">
            {getNodeIcon(selectedNode.node_type)}
            <span className="text-xs font-medium capitalize">{selectedNode.node_type}</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {selectedNode.content}
          </p>
        </div>
      )}
    </div>
  );
};

