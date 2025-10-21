import React, { useState, useMemo } from 'react';
import { X, Trash2, AlertTriangle, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { Highlight } from '../services/highlightService';

interface HighlightManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  highlights: Highlight[];
  onDeleteHighlight: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onJumpToPage: (pageNumber: number) => void;
  bookName: string;
}

type FilterOption = 'all' | 'orphaned' | 'active';

export const HighlightManagementPanel: React.FC<HighlightManagementPanelProps> = ({
  isOpen,
  onClose,
  highlights,
  onDeleteHighlight,
  onDeleteMultiple,
  onJumpToPage,
  bookName,
}) => {
  const [filter, setFilter] = useState<FilterOption>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());

  // Filter highlights
  const filteredHighlights = useMemo(() => {
    switch (filter) {
      case 'orphaned':
        return highlights.filter(h => h.is_orphaned);
      case 'active':
        return highlights.filter(h => !h.is_orphaned);
      default:
        return highlights;
    }
  }, [highlights, filter]);

  // Group highlights by page
  const highlightsByPage = useMemo(() => {
    const grouped = new Map<number, Highlight[]>();
    filteredHighlights.forEach(h => {
      const pageHighlights = grouped.get(h.page_number) || [];
      pageHighlights.push(h);
      grouped.set(h.page_number, pageHighlights);
    });
    return grouped;
  }, [filteredHighlights]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const togglePageExpanded = (pageNum: number) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageNum)) {
      newExpanded.delete(pageNum);
    } else {
      newExpanded.add(pageNum);
    }
    setExpandedPages(newExpanded);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    
    if (confirm(`Delete ${selectedIds.size} highlight(s)?`)) {
      onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredHighlights.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredHighlights.map(h => h.id)));
    }
  };

  if (!isOpen) return null;

  const stats = {
    total: highlights.length,
    orphaned: highlights.filter(h => h.is_orphaned).length,
    active: highlights.filter(h => !h.is_orphaned).length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Highlight Manager
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {bookName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & Filters */}
        <div
          className="p-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-4">
              <div className="text-sm">
                <span style={{ color: 'var(--color-text-secondary)' }}>Total: </span>
                <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                  {stats.total}
                </span>
              </div>
              <div className="text-sm">
                <span style={{ color: 'var(--color-text-secondary)' }}>Active: </span>
                <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                  {stats.active}
                </span>
              </div>
              <div className="text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span style={{ color: 'var(--color-text-secondary)' }}>Orphaned: </span>
                <span style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                  {stats.orphaned}
                </span>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {(['all', 'active', 'orphaned'] as FilterOption[]).map(filterOption => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === filterOption ? 'shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: filter === filterOption ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  color: filter === filterOption ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                }}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Highlights List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredHighlights.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              No highlights found
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from(highlightsByPage.entries())
                .sort(([a], [b]) => a - b)
                .map(([pageNum, pageHighlights]) => (
                  <div key={pageNum} className="border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                    {/* Page Header */}
                    <button
                      onClick={() => togglePageExpanded(pageNum)}
                      className="w-full flex items-center justify-between p-3 hover:bg-opacity-50 transition-colors"
                      style={{ backgroundColor: 'var(--color-surface-hover)' }}
                    >
                      <div className="flex items-center gap-2">
                        {expandedPages.has(pageNum) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          Page {pageNum}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          ({pageHighlights.length} highlight{pageHighlights.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToPage(pageNum);
                        }}
                        className="px-3 py-1 rounded text-sm hover:bg-opacity-80 transition-colors"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-inverse)',
                        }}
                      >
                        Jump to Page
                      </button>
                    </button>

                    {/* Highlights in this page */}
                    {expandedPages.has(pageNum) && (
                      <div className="p-3 space-y-2">
                        {pageHighlights.map(highlight => (
                          <div
                            key={highlight.id}
                            className="flex items-start gap-3 p-3 rounded-lg border"
                            style={{
                              borderColor: 'var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(highlight.id)}
                              onChange={() => toggleSelection(highlight.id)}
                              className="mt-1"
                            />
                            
                            <div
                              className="w-6 h-6 rounded flex-shrink-0"
                              style={{ backgroundColor: highlight.color_hex }}
                              title={highlight.color_id}
                            />

                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm line-clamp-2"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                "{highlight.highlighted_text}"
                              </p>
                              {highlight.is_orphaned && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  {highlight.orphaned_reason || 'Orphaned highlight'}
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => onDeleteHighlight(highlight.id)}
                              className="p-1.5 rounded transition-colors flex-shrink-0"
                              style={{ color: 'var(--color-text-secondary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                                e.currentTarget.style.color = '#ef4444'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                                e.currentTarget.style.color = 'var(--color-text-secondary)'
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={handleSelectAll}
            className="text-sm"
            style={{ color: 'var(--color-primary)' }}
          >
            {selectedIds.size === filteredHighlights.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

