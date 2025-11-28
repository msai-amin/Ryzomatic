import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, Clock, Edit3, Trash2, ExternalLink, AlertCircle, CheckCircle, Loader, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DocumentRelationshipWithDetails, userBooks } from '../../lib/supabase';
import { Tooltip } from './Tooltip';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { RelationshipAnalysisCard } from './RelationshipAnalysisCard';
import { RelevanceBreakdown } from './RelevanceBreakdown';
import { 
  parseRelationshipDescription, 
  getOverviewText, 
  getSharedTopics, 
  getKeyConnections, 
  getReadingRecommendation,
  getRawAnalysis 
} from '../utils/relationshipAnalysisParser';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  relationship: DocumentRelationshipWithDetails;
  onEditRelationship: (relationshipId: string) => void;
  onDeleteRelationship: (relationshipId: string) => void;
}

const getPrettyJson = (description?: string | null): string | null => {
  if (!description) return null;
  try {
    const jsonMatch = description.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
};

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  relationship,
  onEditRelationship,
  onDeleteRelationship
}) => {
  const { setCurrentDocument } = useAppStore();
  const [documentContent, setDocumentContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Load document content when modal opens
  useEffect(() => {
    if (isOpen && relationship.related_document_id) {
      loadDocumentContent();
    }
  }, [isOpen, relationship.related_document_id]);

  const loadDocumentContent = async () => {
    try {
      setIsLoadingContent(true);
      const { data: document, error } = await userBooks.get(relationship.related_document_id);
      
      if (error || !document) {
        console.error('Error loading document:', error);
        return;
      }

      // Extract preview content
      let content = '';
      if (document.file_type === 'pdf' && document.page_texts) {
        // Show first page or first few pages
        content = document.page_texts.slice(0, 2).join(' ');
      } else if (document.text_content) {
        // Show first part of text content
        content = document.text_content;
      }

      // Limit content length for preview
      if (content.length > 1000) {
        content = content.substring(0, 1000) + '...';
      }

      setDocumentContent(content);
    } catch (error) {
      console.error('Error loading document content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleOpenInViewer = async () => {
    try {
      const { user } = useAppStore.getState();
      if (!user?.id) {
        alert('You must be signed in to open documents.');
        return;
      }

      // Initialize supabaseStorageService with current user
      supabaseStorageService.setCurrentUser(user.id);

      // Use getBook() to download full PDF data from S3, not just metadata
      console.log('DocumentPreviewModal: Loading full book data for', relationship.related_document_id);
      const fullBook = await supabaseStorageService.getBook(relationship.related_document_id);
      
      if (!fullBook) {
        console.error('Error loading document: Book not found');
        alert('Document not found. Please try again.');
        return;
      }

      if (!fullBook.fileData) {
        console.error('Error loading document: No file data available');
        alert('Document file data is missing. Please try re-uploading the document.');
        return;
      }

      // Sanitize page texts (same pattern as LibraryModal)
      const sanitizePageTexts = (pageTexts: any[]): string[] => {
        if (!Array.isArray(pageTexts)) return [];
        return pageTexts.map((text, index) => {
          if (typeof text === 'string') return text;
          if (text === null || text === undefined) return '';
          try {
            return String(text);
          } catch {
            console.warn(`Failed to sanitize page text at index ${index}`);
            return '';
          }
        });
      };

      const cleanedPageTexts = sanitizePageTexts(fullBook.pageTexts || []);
      const combinedContent = cleanedPageTexts.length > 0
        ? cleanedPageTexts.join('\n\n')
        : fullBook.text_content || '';

      // Convert SavedBook to Document format (same pattern as LibraryModal)
      const doc = {
        id: fullBook.id,
        name: fullBook.title,
        content: combinedContent,
        type: fullBook.type,
        uploadedAt: fullBook.savedAt,
        pdfData: (() => {
          // CRITICAL: Clone ArrayBuffer and convert to Blob to prevent detachment issues
          // Blobs are safer than ArrayBuffers because they can't be detached by workers
          if (fullBook.type === 'pdf' && fullBook.fileData instanceof ArrayBuffer) {
            try {
              // Check if ArrayBuffer is already detached
              new Uint8Array(fullBook.fileData, 0, 1);
              // Not detached - clone it and convert to Blob for safety
              const clonedBuffer = fullBook.fileData.slice(0);
              const blob = new Blob([clonedBuffer], { type: 'application/pdf' });
              console.log('DocumentPreviewModal: Cloned PDF ArrayBuffer and converted to Blob:', {
                originalSize: fullBook.fileData.byteLength,
                clonedSize: clonedBuffer.byteLength,
                blobSize: blob.size
              });
              return blob;
            } catch (error) {
              // Already detached - this shouldn't happen if cloning in supabaseStorageService worked
              console.error('DocumentPreviewModal: ArrayBuffer is detached, cannot clone:', error);
              throw new Error('PDF data is corrupted. Please try re-opening the document.');
            }
          }
          return undefined;
        })(),
        totalPages: fullBook.totalPages,
        lastReadPage: fullBook.lastReadPage,
        pageTexts: cleanedPageTexts,
        cleanedPageTexts,
        highlights: [],
        highlightsLoaded: false
      };

      console.log('DocumentPreviewModal: Document created for app store:', {
        id: doc.id,
        type: doc.type,
        hasPdfData: !!doc.pdfData,
        pdfDataType: doc.pdfData ? doc.pdfData.constructor.name : 'undefined',
        pdfDataLength: doc.pdfData ? (doc.pdfData as Blob).size : 0,
        hasPageTexts: !!doc.pageTexts,
        pageTextsLength: doc.pageTexts?.length || 0
      });

      setCurrentDocument(doc as any);
      onClose();
    } catch (error) {
      console.error('Error opening document:', error);
      alert(`Failed to open document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this relationship?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDeleteRelationship(relationship.relationship_id);
      onClose();
    } catch (error) {
      console.error('Error deleting relationship:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRelevanceColor = (percentage?: number) => {
    if (!percentage) return 'var(--color-text-tertiary)';
    if (percentage >= 80) return 'var(--color-success)';
    if (percentage >= 50) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };

  const getRelevanceStatus = () => {
    switch (relationship.relevance_calculation_status) {
      case 'completed':
        return { icon: CheckCircle, color: 'var(--color-success)', text: 'Analysis Complete' };
      case 'processing':
        return { icon: Loader, color: 'var(--color-primary)', text: 'Analyzing...' };
      case 'failed':
        return { icon: AlertCircle, color: 'var(--color-error)', text: 'Analysis Failed' };
      default:
        return { icon: Loader, color: 'var(--color-text-tertiary)', text: 'Pending Analysis' };
    }
  };

  const relevanceStatus = getRelevanceStatus();
  const StatusIcon = relevanceStatus.icon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <div>
              <h2 className="text-xl font-semibold">{relationship.related_title}</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {relationship.related_file_name} • {relationship.related_file_type.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Metadata */}
            <div className="space-y-6">
              {/* Relevance Status */}
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-medium mb-3">Relevance Analysis</h3>
                <div className="flex items-center space-x-2 mb-2">
                  <StatusIcon 
                    className={`w-4 h-4 ${relationship.relevance_calculation_status === 'processing' ? 'animate-spin' : ''}`}
                    style={{ color: relevanceStatus.color }}
                  />
                  <span className="text-sm font-medium" style={{ color: relevanceStatus.color }}>
                    {relevanceStatus.text}
                  </span>
                </div>
                
                {relationship.relevance_percentage && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Relevance</span>
                      <span 
                        className="font-bold"
                        style={{ color: getRelevanceColor(relationship.relevance_percentage) }}
                      >
                        {relationship.relevance_percentage}%
                      </span>
                    </div>
                    <div 
                      className="w-full h-2 rounded-full"
                      style={{ backgroundColor: 'var(--color-border-light)' }}
                    >
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${relationship.relevance_percentage}%`,
                          backgroundColor: getRelevanceColor(relationship.relevance_percentage)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Document Info */}
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-medium mb-3">Document Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {relationship.related_file_type.toUpperCase()} Document
                    </span>
                  </div>
                  {relationship.related_total_pages && (
                    <div className="flex items-center space-x-2">
                      <span className="w-4 h-4 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>📄</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {relationship.related_total_pages} pages
                      </span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      Added {new Date(relationship.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced Relationship Analysis */}
              {(relationship.relationship_description || relationship.ai_generated_description) && (
                <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <RelationshipAnalysisCard
                    relationship={relationship}
                    onOpenInViewer={handleOpenInViewer}
                    compact={false}
                  />
                  
                  {/* Relevance Breakdown Visualization */}
                  <div className="mt-4">
                    <RelevanceBreakdown
                      relevancePercentage={relationship.relevance_percentage ?? undefined}
                      aiGeneratedDescription={relationship.ai_generated_description}
                      relationshipDescription={relationship.relationship_description}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Preview */}
            <div className="lg:col-span-2">
              <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="font-medium mb-3">Document Preview</h3>
                
                {isLoadingContent ? (
                  <div className="text-center py-8">
                    <Loader className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading preview...</p>
                  </div>
                ) : documentContent ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <p className="whitespace-pre-wrap">{documentContent}</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      No preview available for this document
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center space-x-2">
            <Tooltip content="Remove Relationship" position="top">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ 
                  color: 'var(--color-error)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error-light)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Edit Relationship" position="top">
              <button
                onClick={() => onEditRelationship(relationship.relationship_id)}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-text-secondary)'
              }}
            >
              Close
            </button>
            <button
              onClick={handleOpenInViewer}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)'
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Viewer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
