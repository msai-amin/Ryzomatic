import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Search, Plus, Check, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { userBooks } from '../../lib/supabase';
import { DocumentUpload } from './DocumentUpload';
import { Tooltip } from './Tooltip';

interface AddRelatedDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDocumentId: string;
  onRelationshipCreated: () => void;
}

interface DocumentOption {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  total_pages?: number;
  created_at: string;
}

export const AddRelatedDocumentModal: React.FC<AddRelatedDocumentModalProps> = ({
  isOpen,
  onClose,
  sourceDocumentId,
  onRelationshipCreated
}) => {
  const { user, refreshLibrary } = useAppStore();
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [libraryDocuments, setLibraryDocuments] = useState<DocumentOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [relationshipDescription, setRelationshipDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load library documents when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadLibraryDocuments();
    }
  }, [isOpen, user]);

  const loadLibraryDocuments = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data: documents, error } = await userBooks.list(user.id, 50);
      
      if (error) {
        console.error('Error loading library documents:', error);
        setError('Failed to load documents from library');
        return;
      }

      // Filter out the source document
      const filteredDocs = documents?.filter(doc => doc.id !== sourceDocumentId) || [];
      setLibraryDocuments(filteredDocs);
    } catch (error) {
      console.error('Error loading library documents:', error);
      setError('Failed to load documents from library');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = libraryDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRelationship = async () => {
    if (!selectedDocumentId || !user) {
      setError('Please select a document');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await fetch('/api/documents/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceDocumentId,
          relatedDocumentId: selectedDocumentId,
          relationshipDescription: relationshipDescription.trim() || undefined,
          userId: user.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create relationship');
      }

      setSuccess('Relationship created successfully! AI is calculating relevance...');
      
      // Refresh related documents
      onRelationshipCreated();
      
      // Reset form
      setSelectedDocumentId(null);
      setRelationshipDescription('');
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 2000);

    } catch (error) {
      console.error('Error creating relationship:', error);
      setError(error instanceof Error ? error.message : 'Failed to create relationship');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadComplete = async (uploadedDocumentId: string) => {
    try {
      setIsCreating(true);
      setError(null);

      const response = await fetch('/api/documents/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceDocumentId,
          relatedDocumentId: uploadedDocumentId,
          relationshipDescription: relationshipDescription.trim() || undefined,
          userId: user?.id
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create relationship');
      }

      setSuccess('Document uploaded and relationship created! AI is calculating relevance...');
      
      // Refresh library and related documents
      refreshLibrary();
      onRelationshipCreated();
      
      // Reset form
      setRelationshipDescription('');
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 2000);

    } catch (error) {
      console.error('Error creating relationship after upload:', error);
      setError(error instanceof Error ? error.message : 'Failed to create relationship');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-semibold">Add Related Document</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-3 px-6 text-sm font-medium transition-colors ${
              activeTab === 'library' 
                ? 'border-b-2' 
                : 'hover:bg-gray-50'
            }`}
            style={{
              color: activeTab === 'library' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottomColor: activeTab === 'library' ? 'var(--color-primary)' : 'transparent',
              backgroundColor: activeTab === 'library' ? 'var(--color-primary-light)' : 'transparent'
            }}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            From Library
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-6 text-sm font-medium transition-colors ${
              activeTab === 'upload' 
                ? 'border-b-2' 
                : 'hover:bg-gray-50'
            }`}
            style={{
              color: activeTab === 'upload' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderBottomColor: activeTab === 'upload' ? 'var(--color-primary)' : 'transparent',
              backgroundColor: activeTab === 'upload' ? 'var(--color-primary-light)' : 'transparent'
            }}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload New
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'library' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              {/* Document List */}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--color-primary)' }}></div>
                  <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading documents...</p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {searchQuery ? 'No documents match your search' : 'No documents in your library'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedDocumentId === doc.id ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: selectedDocumentId === doc.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        borderColor: selectedDocumentId === doc.id ? 'var(--color-primary)' : 'var(--color-border)',
                      }}
                      onClick={() => setSelectedDocumentId(doc.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                          <div>
                            <h3 className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                              {doc.title}
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              {doc.file_name} • {doc.file_type.toUpperCase()}
                              {doc.total_pages && ` • ${doc.total_pages} pages`}
                            </p>
                          </div>
                        </div>
                        {selectedDocumentId === doc.id && (
                          <Check className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <DocumentUpload
                onClose={() => {
                  // Reset to library tab after upload completes
                  setActiveTab('library');
                }}
                onUploadComplete={(uploadedDocumentId) => {
                  // Automatically create relationship after upload
                  console.log('DocumentUpload: Upload completed with ID:', uploadedDocumentId);
                  setSelectedDocumentId(uploadedDocumentId);
                  // Close the modal after handling the uploaded document
                  setTimeout(() => {
                    onClose();
                  }, 500);
                }}
                setAsCurrentDocument={false}
              />
            </div>
          )}

          {/* Relationship Description */}
          <div className="mt-6">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Relationship Description (Optional)
            </label>
            <textarea
              value={relationshipDescription}
              onChange={(e) => setRelationshipDescription(e.target.value)}
              placeholder="Describe how this document relates to the current one..."
              className="w-full p-3 border rounded-lg resize-none"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
              rows={3}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              AI will calculate relevance automatically and generate a description if none is provided.
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-3 rounded-lg flex items-center space-x-2" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 rounded-lg flex items-center space-x-2" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              <Check className="w-4 h-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-secondary)'
            }}
          >
            Cancel
          </button>
          {activeTab === 'library' && (
            <button
              onClick={handleCreateRelationship}
              disabled={!selectedDocumentId || isCreating}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)'
              }}
            >
              {isCreating ? 'Creating...' : 'Create Relationship'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
