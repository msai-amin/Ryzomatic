import React, { useState, useEffect } from 'react';
import { FileText, Edit, Save, RefreshCw, Loader } from 'lucide-react';
import { supabase } from '../services/supabaseAuthService';

interface DocumentDescriptionEditorProps {
  bookId: string;
  userId: string;
  onUpdate?: () => void;
}

export const DocumentDescriptionEditor: React.FC<DocumentDescriptionEditorProps> = ({
  bookId,
  userId,
  onUpdate
}) => {
  const [description, setDescription] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUserDescription, setIsUserDescription] = useState(false);
  const [aiDescription, setAiDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadDescription();
  }, [bookId]);

  const loadDescription = async () => {
    try {
      const response = await fetch(`/api/documents?action=getDescription&bookId=${bookId}&userId=${userId}`);
      const result = await response.json();
      
      if (result.data) {
        const desc = result.data.user_entered_description || result.data.ai_generated_description || '';
        setDescription(desc);
        setAiDescription(result.data.ai_generated_description || '');
        setIsUserDescription(!!result.data.user_entered_description);
      }
    } catch (error) {
      console.error('Error loading description:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateDescription', bookId, userId })
      });

      if (response.ok) {
        await loadDescription();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error generating description:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/documents?action=updateDescription&bookId=${bookId}&userId=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDescription: description })
      });

      if (response.ok) {
        setIsEditing(false);
        setIsUserDescription(true);
        await loadDescription();
        onUpdate?.();
      }
    } catch (error) {
      console.error('Error saving description:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Document Description
          </span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 rounded-lg border text-sm resize-none"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            minHeight: '100px'
          }}
          placeholder="Enter a description of this document..."
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}
          >
            {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
          <button
            onClick={() => {
              setDescription(aiDescription);
              setIsEditing(false);
            }}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Document Description
          </span>
          {!isUserDescription && (
            <span className="text-xs px-2 py-0.5 rounded" style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}>
              AI Generated
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {description && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {isGenerating ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {description ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            No description available. Generate one to help with document relationships and search.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader className="w-3 h-3 animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate Description'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

