import React, { useState } from 'react';
import { FileText, Plus, Eye, Trash2, Loader, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { DocumentRelationshipWithDetails } from '../../lib/supabase';
import { Tooltip } from './Tooltip';

interface RelatedDocumentsPanelProps {
  relatedDocuments: DocumentRelationshipWithDetails[];
  isLoading: boolean;
  onAddRelatedDocument: () => void;
  onPreviewDocument: (relationship: DocumentRelationshipWithDetails) => void;
  onDeleteRelationship: (relationshipId: string) => void;
}

export const RelatedDocumentsPanel: React.FC<RelatedDocumentsPanelProps> = ({
  relatedDocuments,
  isLoading,
  onAddRelatedDocument,
  onPreviewDocument,
  onDeleteRelationship
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getRelevanceColor = (percentage?: number) => {
    if (!percentage) return 'var(--color-text-tertiary)';
    if (percentage >= 80) return 'var(--color-success)';
    if (percentage >= 50) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };

  const getRelevanceStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3 h-3" style={{ color: 'var(--color-success)' }} />;
      case 'processing':
        return <Loader className="w-3 h-3 animate-spin" style={{ color: 'var(--color-primary)' }} />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" style={{ color: 'var(--color-error)' }} />;
      default:
        return <Clock className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />;
    }
  };

  const handleDelete = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to remove this relationship?')) {
      return;
    }

    try {
      setDeletingId(relationshipId);
      await onDeleteRelationship(relationshipId);
    } catch (error) {
      console.error('Error deleting relationship:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Related Documents
          </h3>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 rounded-lg border animate-pulse" style={{ borderColor: 'var(--color-border)' }}>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Related Documents
        </h3>
        <Tooltip content="Add Related Document" position="left">
          <button
            onClick={onAddRelatedDocument}
            className="p-1 rounded transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Document Count */}
      <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {relatedDocuments.length} related document{relatedDocuments.length !== 1 ? 's' : ''}
      </div>

      {/* Documents List */}
      {relatedDocuments.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            No related documents yet
          </p>
          <button
            onClick={onAddRelatedDocument}
            className="text-xs px-3 py-1 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}
          >
            Add Related Document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {relatedDocuments.map((relationship) => (
            <div
              key={relationship.relationship_id}
              className="p-3 rounded-lg border transition-colors cursor-pointer group"
              style={{ 
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)'
              }}
              onClick={() => onPreviewDocument(relationship)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                  <h4 className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {relationship.related_title}
                  </h4>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {getRelevanceStatusIcon(relationship.relevance_calculation_status)}
                  <Tooltip content="Remove Relationship" position="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(relationship.relationship_id);
                      }}
                      disabled={deletingId === relationship.relationship_id}
                      className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      style={{ 
                        color: 'var(--color-error)',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error-light)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {deletingId === relationship.relationship_id ? (
                        <Loader className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Relevance Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {relationship.relevance_calculation_status === 'completed' && relationship.relevance_percentage
                      ? `${relationship.relevance_percentage}% relevant`
                      : relationship.relevance_calculation_status === 'processing'
                      ? 'Analyzing...'
                      : relationship.relevance_calculation_status === 'failed'
                      ? 'Analysis failed'
                      : 'Pending analysis'
                    }
                  </span>
                  <div className="flex items-center space-x-1">
                    <Tooltip content="Preview Document" position="top">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewDocument(relationship);
                        }}
                        className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                        style={{ 
                          color: 'var(--color-text-secondary)',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {relationship.relevance_percentage && (
                  <div 
                    className="w-full h-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-border-light)' }}
                  >
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${relationship.relevance_percentage}%`,
                        backgroundColor: getRelevanceColor(relationship.relevance_percentage)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Description Preview */}
              {(relationship.relationship_description || relationship.ai_generated_description) && (
                <div className="mt-2">
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {relationship.relationship_description || relationship.ai_generated_description}
                  </p>
                </div>
              )}

              {/* Document Type Badge */}
              <div className="mt-2">
                <span 
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary-dark)'
                  }}
                >
                  {relationship.related_file_type.toUpperCase()}
                  {relationship.related_total_pages && ` • ${relationship.related_total_pages} pages`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
