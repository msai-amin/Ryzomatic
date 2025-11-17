import React, { useState, useCallback } from 'react';
import { FileText, Eye, Trash2, Loader, CheckCircle, AlertCircle, Clock, Network, Upload } from 'lucide-react';
import { DocumentRelationshipWithDetails } from '../../lib/supabase';
import { Tooltip } from './Tooltip';
import { useAppStore } from '../store/appStore';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { documentRelationships } from '../../lib/supabase';

interface RelatedDocumentsPanelProps {
  relatedDocuments: DocumentRelationshipWithDetails[];
  isLoading: boolean;
  onAddRelatedDocument: () => void; // Keep for backward compatibility but won't be used
  onPreviewDocument: (relationship: DocumentRelationshipWithDetails) => void;
  onDeleteRelationship: (relationshipId: string) => void;
  onOpenGraphView?: () => void;
  onRelationshipCreated?: () => void; // Callback to refresh related documents
}

export const RelatedDocumentsPanel: React.FC<RelatedDocumentsPanelProps> = ({
  relatedDocuments,
  isLoading,
  onAddRelatedDocument,
  onPreviewDocument,
  onDeleteRelationship,
  onOpenGraphView,
  onRelationshipCreated
}) => {
  const { currentDocument, user } = useAppStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [processingRelationships, setProcessingRelationships] = useState<Set<string>>(new Set());
  
  const hasActiveAnalysis = relatedDocuments.some((relationship) =>
    relationship.relevance_calculation_status === 'processing' ||
    relationship.relevance_calculation_status === 'pending'
  ) || processingRelationships.size > 0;

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

  // Check if file format is compatible
  const isCompatibleFile = (file: File): boolean => {
    const compatibleTypes = ['application/pdf', 'application/epub+zip', 'text/plain', 'text/markdown'];
    const compatibleExtensions = ['.pdf', '.epub', '.txt', '.md'];
    return compatibleTypes.includes(file.type) || 
           compatibleExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  // Handle file upload and relationship creation
  const handleFileUpload = useCallback(async (file: File) => {
    if (!currentDocument || !user) {
      alert('Please open a document first');
      return;
    }

    if (!isCompatibleFile(file)) {
      alert('Unsupported file format. Please upload PDF, EPUB, or TXT files.');
      return;
    }

    const fileId = `${Date.now()}-${file.name}`;
    setUploadingFiles(prev => new Set(prev).add(fileId));
    let documentId: string | undefined;

    try {
      // Initialize storage service
      supabaseStorageService.setCurrentUser(user.id);

      // Read file content
      let fileData: string | Blob;
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        fileData = await file.text();
      } else {
        fileData = file;
      }

      // Upload to library
      documentId = await supabaseStorageService.saveBook({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        fileName: file.name,
        type: file.type === 'application/pdf' ? 'pdf' : 
              file.type === 'application/epub+zip' ? 'epub' : 'text',
        savedAt: new Date(),
        fileData: fileData,
      });

      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });

      // Create relationship with 'pending' status
      if (documentId) {
        setProcessingRelationships(prev => new Set(prev).add(documentId));

        const { data: relationship, error } = await documentRelationships.create({
          source_document_id: currentDocument.id,
          related_document_id: documentId,
        });

        if (error) {
          throw new Error(`Failed to create relationship: ${error.message}`);
        }

        // Trigger refresh
        if (onRelationshipCreated) {
          onRelationshipCreated();
        }

        // The background service will automatically process the relationship using Gemini
        // The loader will show until relevance_calculation_status becomes 'completed'
      }

    } catch (error) {
      console.error('Error uploading file and creating relationship:', error);
      alert(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
      if (documentId) {
        setProcessingRelationships(prev => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
      }
    }
  }, [currentDocument, user, onRelationshipCreated]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!currentDocument || !user) {
      alert('Please open a document first');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const compatibleFiles = files.filter(isCompatibleFile);

    if (compatibleFiles.length === 0) {
      alert('No compatible files found. Please upload PDF, EPUB, or TXT files.');
      return;
    }

    // Process all files
    for (const file of compatibleFiles) {
      await handleFileUpload(file);
    }
  }, [currentDocument, user, handleFileUpload]);

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
    <div 
      className="space-y-3"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        minHeight: '200px',
        transition: 'all 0.2s ease',
        border: isDragging ? '2px dashed var(--color-primary)' : 'none',
        borderRadius: isDragging ? '8px' : '0',
        backgroundColor: isDragging ? 'var(--color-primary-light)' : 'transparent',
        padding: isDragging ? '12px' : '0',
      }}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-10 rounded-lg"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Drop files here to add related documents
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              PDF, EPUB, or TXT files
            </p>
          </div>
        </div>
      )}

      {hasActiveAnalysis && (
        <div
          className="flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary-dark)'
          }}
        >
          <Loader className="w-3 h-3 animate-spin" />
          <span>AI is building the relationship between documents...</span>
        </div>
      )}

      {/* Upload progress indicators */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploadingFiles).map((fileId) => (
            <div
              key={fileId}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <Loader className="w-3 h-3 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--color-text-secondary)' }}>
                Uploading file...
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Related Documents
        </h3>
        {onOpenGraphView && (
          <Tooltip content="View Document Graph" position="left">
            <button
              onClick={onOpenGraphView}
              className="p-1 rounded transition-colors hover:bg-gray-100"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Network className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Document Count */}
      <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {relatedDocuments.length} related document{relatedDocuments.length !== 1 ? 's' : ''}
      </div>

      {/* Documents List */}
      {relatedDocuments.length === 0 && uploadingFiles.size === 0 && !isDragging ? (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            No related documents yet
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Drag and drop PDF, EPUB, or TXT files here
          </p>
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
                      ? 'AI is analyzing documents...'
                      : relationship.relevance_calculation_status === 'failed'
                      ? 'Analysis failed - will retry automatically'
                      : 'Waiting for AI analysis...'
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
