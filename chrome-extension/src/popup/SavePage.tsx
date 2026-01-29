import React, { useState, useEffect } from 'react';
import { PageContent, ExtensionMessage } from '@shared/types';
import { saveWebPage, savePdf } from '@shared/api';

interface SavePageProps {
  onSaved?: () => void;
}

export function SavePage({ onSaved }: SavePageProps) {
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPageContent();
  }, []);

  const loadPageContent = async () => {
    setLoading(true);
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id || !tab.url) {
        throw new Error('No active tab found');
      }

      // Check if it's a PDF
      const isPdf = tab.url.toLowerCase().endsWith('.pdf') || 
                    tab.url.includes('application/pdf');

      if (isPdf) {
        setPageContent({
          url: tab.url,
          title: tab.title || 'Untitled PDF',
          text: '',
          isPdf: true,
        });
      } else {
        // Request page content from content script
        const message: ExtensionMessage = { type: 'GET_PAGE_CONTENT' };
        const response = await chrome.tabs.sendMessage(tab.id, message);
        
        if (response?.success && response.data) {
          setPageContent(response.data as PageContent);
        } else {
          // Fallback if content script not loaded
          setPageContent({
            url: tab.url,
            title: tab.title || 'Untitled',
            text: '',
            isPdf: false,
          });
        }
      }
    } catch (err) {
      console.error('Error loading page content:', err);
      setError('Could not load page content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!pageContent) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (pageContent.isPdf) {
        // Fetch and save PDF
        const response = await fetch(pageContent.url);
        const blob = await response.blob();
        await savePdf(blob, pageContent.title, pageContent.url);
      } else {
        // Save web page
        await saveWebPage(pageContent);
      }

      setSuccess(true);
      onSaved?.();
      
      // Show notification
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: '/icons/icon-48.png',
        title: 'Saved to Ryzomatic',
        message: `"${pageContent.title}" has been saved to your library`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <div style={styles.spinner}>⏳</div>
          <p style={styles.loadingText}>Loading page content...</p>
        </div>
      </div>
    );
  }

  if (!pageContent) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <p>Unable to access page content</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Save to Library</h2>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && (
        <div style={styles.success}>
          ✓ Saved successfully!
        </div>
      )}

      <div style={styles.preview}>
        <div style={styles.previewIcon}>
          {pageContent.isPdf ? '📄' : '🌐'}
        </div>
        <div style={styles.previewContent}>
          <h3 style={styles.previewTitle}>{pageContent.title}</h3>
          <p style={styles.previewUrl}>{truncateUrl(pageContent.url)}</p>
          {pageContent.description && (
            <p style={styles.previewDescription}>
              {pageContent.description.slice(0, 120)}...
            </p>
          )}
        </div>
      </div>

      <div style={styles.meta}>
        {pageContent.isPdf && (
          <span style={styles.badge}>PDF Document</span>
        )}
        {pageContent.author && (
          <span style={styles.metaItem}>By: {pageContent.author}</span>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || success}
        style={{
          ...styles.saveButton,
          ...(saving ? styles.saveButtonDisabled : {}),
          ...(success ? styles.saveButtonSuccess : {}),
        }}
      >
        {saving ? 'Saving...' : success ? '✓ Saved' : 'Save to Library'}
      </button>

      <div style={styles.actions}>
        <button
          onClick={() => chrome.tabs.create({ url: 'https://ryzomatic.net' })}
          style={styles.secondaryButton}
        >
          Open Library
        </button>
      </div>
    </div>
  );
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 30 
      ? parsed.pathname.slice(0, 30) + '...' 
      : parsed.pathname;
    return parsed.hostname + path;
  } catch {
    return url.slice(0, 50) + '...';
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    margin: 0,
  },
  preview: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#1f2937',
    borderRadius: '8px',
    border: '1px solid #374151',
  },
  previewIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  previewContent: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 4px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  previewUrl: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  previewDescription: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '8px 0 0 0',
    lineHeight: '1.4',
  },
  meta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  badge: {
    padding: '4px 8px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#10b981',
    fontWeight: '500',
  },
  metaItem: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  saveButton: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  saveButtonSuccess: {
    background: '#059669',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  secondaryButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: 'transparent',
    color: '#d1d5db',
    fontSize: '13px',
    cursor: 'pointer',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px',
    gap: '12px',
  },
  spinner: {
    fontSize: '24px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  errorState: {
    padding: '24px',
    textAlign: 'center',
    color: '#f87171',
  },
  error: {
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '13px',
  },
  success: {
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    fontSize: '13px',
    textAlign: 'center',
  },
};

