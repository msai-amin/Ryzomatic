import React, { useState } from 'react';
import { X, Sparkles, Loader2, FileText, AlertCircle } from 'lucide-react';
import { synthesizeDocuments } from '../services/aiService';

interface SynthesisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentIds: string[];
  documentTitles: Array<{ id: string; title: string }>;
}

export const SynthesisDialog: React.FC<SynthesisDialogProps> = ({
  isOpen,
  onClose,
  documentIds,
  documentTitles,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    synthesis: string;
    documents_used: Array<{ id: string; title: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!query.trim() || documentIds.length < 2) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await synthesizeDocuments(documentIds, query.trim());
      setResult(res);
    } catch (e: any) {
      // Handle LOTUS_NOT_AVAILABLE error specially
      const errorMessage = e.message || 'Synthesis failed';
      if (errorMessage.includes('LOTUS_NOT_AVAILABLE') || errorMessage.includes('not available')) {
        setError('Synthesis is not available in this environment. Please try again later.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setResult(null);
    setError(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
      onClick={handleBackdropClick}
      data-testid="synthesis-dialog-backdrop"
    >
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col max-h-[80vh]"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                color: '#8B5CF6',
              }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                LOTUS Synthesis
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {documentIds.length} documents selected
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
            aria-label="Close synthesis dialog"
            data-testid="synthesis-dialog-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Selected Documents */}
          <div>
            <h3
              className="text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Selected Documents
            </h3>
            <div
              className="rounded-lg border p-3 max-h-32 overflow-y-auto"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
              }}
            >
              <ul className="space-y-1">
                {documentTitles.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Query Input */}
          <div>
            <label
              htmlFor="synthesis-query"
              className="text-sm font-medium mb-2 block"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Research Question
            </label>
            <textarea
              id="synthesis-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to synthesize? e.g., 'Summarize the key findings about machine learning across these papers'"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)',
              }}
              rows={3}
              disabled={isLoading}
              data-testid="synthesis-query-input"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-lg border p-3"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#DC2626',
              }}
              data-testid="synthesis-error"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div>
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Synthesis Result
              </h3>
              <div
                className="rounded-lg border p-4 max-h-64 overflow-y-auto"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                }}
                data-testid="synthesis-result"
              >
                <p
                  className="text-sm whitespace-pre-wrap"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {result.synthesis}
                </p>
                {result.documents_used.length > 0 && (
                  <div
                    className="mt-4 pt-3 border-t"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p
                      className="text-xs font-medium mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Documents used:
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {result.documents_used.map((d) => d.title).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 p-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !query.trim() || documentIds.length < 2}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#8B5CF6',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#7C3AED';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#8B5CF6';
            }}
            data-testid="synthesis-generate-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
