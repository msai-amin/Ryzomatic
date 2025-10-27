import React, { useState, useEffect } from 'react';
import { Search, Network, TrendingUp, TrendingDown, Sparkles, BookOpen, Brain } from 'lucide-react';
import { memoryService } from '../../lib/memoryService';
import { memoryGraphService } from '../../lib/memoryGraph';
import { costTracker } from '../../lib/costTracker';
import { useAppStore } from '../store/appStore';

interface MemoryExplorerProps {
  onClose?: () => void;
}

export const MemoryExplorer: React.FC<MemoryExplorerProps> = ({ onClose }) => {
  const { user } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<any>(null);
  const [relatedGraph, setRelatedGraph] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      loadStats();
    }
  }, [user?.id]);

  const loadStats = async () => {
    if (!user?.id) return;

    try {
      const costSavings = await costTracker.getCostSavings(user.id);
      const cachePerformance = await costTracker.getCachePerformance(user.id);
      const centralMemories = await memoryGraphService.getCentralMemories(user.id, 10);

      setStats({
        costSavings,
        cachePerformance,
        centralMemories,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.id) return;

    setLoading(true);
    try {
      const results = await memoryService.searchMemories({
        userId: user.id,
        query: searchQuery,
        limit: 20,
      });
      setMemories(results);
    } catch (error) {
      console.error('Error searching memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemoryClick = async (memory: any) => {
    setSelectedMemory(memory);
    
    if (user?.id) {
      try {
        const graph = await memoryGraphService.getRelatedMemories(memory.id, user.id, 2);
        setRelatedGraph(graph);
      } catch (error) {
        console.error('Error loading memory graph:', error);
      }
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please sign in to view your memory explorer
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">Memory Explorer</h2>
              <p className="text-sm text-gray-500">Your conversation memory graph</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-600" />
              <span className="text-gray-600">
                Saved <strong>{Math.round(stats.costSavings.tokensSaved / 1000)}K</strong> tokens
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-600" />
              <span className="text-gray-600">
                <strong>{stats.centralMemories.length}</strong> central memories
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-gray-600">
                <strong>{Math.round(stats.cachePerformance.hitRate)}%</strong> cache hit rate
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search memories..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {memories.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">No memories yet</p>
            <p className="text-sm">Start chatting to build your memory graph</p>
          </div>
        )}

        {memories.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {memories.map((memory) => (
              <div
                key={memory.id}
                onClick={() => handleMemoryClick(memory)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedMemory?.id === memory.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
                        {memory.entity_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {memory.entity_text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Memory Graph View */}
        {selectedMemory && relatedGraph && (
          <div className="mt-6 border-t pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Network className="w-5 h-5" />
              Related Memories
            </h3>
            <div className="space-y-2">
              {relatedGraph.nodes.slice(1, 10).map((node: any) => (
                <div
                  key={node.id}
                  className="p-3 border border-gray-200 rounded-lg text-sm"
                >
                  <span className="text-xs text-gray-500">{node.entity_type}</span>
                  <p className="text-gray-700 mt-1">{node.entity_text.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

