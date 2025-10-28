import React, { useState, useEffect } from 'react';
import { Link2, FileText, Brain, StickyNote, Trash2, Loader, Zap } from 'lucide-react';
import { autoRelationshipService } from '../../lib/autoRelationshipService';
import { NoteRelationship } from '../../lib/autoRelationshipService';

interface NoteRelationshipPanelProps {
  noteId: string;
  userId: string;
}

export const NoteRelationshipPanel: React.FC<NoteRelationshipPanelProps> = ({
  noteId,
  userId
}) => {
  const [relationships, setRelationships] = useState<Array<NoteRelationship & { content: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadRelationships();
  }, [noteId]);

  const loadRelationships = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/notes/relationships?noteId=${noteId}&userId=${userId}`);
      const result = await response.json();
      
      if (result.data) {
        setRelationships(result.data);
      }
    } catch (error) {
      console.error('Error loading relationships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch('/api/notes/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          userId,
          action: 'auto-detect'
        })
      });

      if (response.ok) {
        await loadRelationships();
      }
    } catch (error) {
      console.error('Error auto-detecting relationships:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDelete = async (relationshipId: string) => {
    if (!confirm('Remove this relationship?')) return;
    
    setDeletingId(relationshipId);
    try {
      await fetch(`/api/notes/relationships?relationshipId=${relationshipId}&userId=${userId}`, {
        method: 'DELETE'
      });
      await loadRelationships();
    } catch (error) {
      console.error('Error deleting relationship:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />;
      case 'memory':
        return <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />;
      case 'note':
        return <StickyNote className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />;
      default:
        return <Link2 className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-secondary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Related Items
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-secondary)'
          }}>
            {relationships.length}
          </span>
        </div>
        <button
          onClick={handleAutoDetect}
          disabled={isDetecting}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)'
          }}
        >
          {isDetecting ? (
            <Loader className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Auto-detect
            </>
          )}
        </button>
      </div>

      {relationships.length === 0 ? (
        <div className="text-center py-4">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            No relationships found
          </p>
          <button
            onClick={handleAutoDetect}
            disabled={isDetecting}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}
          >
            Auto-detect relationships
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="p-3 rounded-lg border transition-colors"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)'
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getIcon(rel.related_type)}
                    <span className="text-xs font-medium capitalize" style={{ color: 'var(--color-text)' }}>
                      {rel.related_type}
                    </span>
                    {rel.is_auto_detected && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-inverse)'
                      }}>
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {rel.content || 'No content available'}
                  </p>
                  {rel.similarity_score && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                      {(rel.similarity_score * 100).toFixed(0)}% similarity
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(rel.id!)}
                  disabled={deletingId === rel.id}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {deletingId === rel.id ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

