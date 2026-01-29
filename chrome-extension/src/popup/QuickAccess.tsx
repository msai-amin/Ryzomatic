import React, { useState, useEffect } from 'react';
import { Document } from '@shared/types';
import { getRecentDocuments } from '@shared/storage';

export function QuickAccess() {
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentDocuments();
  }, []);

  const loadRecentDocuments = async () => {
    try {
      const docs = await getRecentDocuments();
      setRecentDocs(docs);
    } catch (err) {
      console.error('Error loading recent documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDocument = (doc: Document) => {
    chrome.tabs.create({
      url: `https://ryzomatic.net/document/${doc.id}`,
    });
  };

  const openLibrary = () => {
    chrome.tabs.create({ url: 'https://ryzomatic.net' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Quick Access</h2>
        <button onClick={openLibrary} style={styles.openButton}>
          Open Library →
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingState}>
          <span style={styles.spinner}>⏳</span>
        </div>
      ) : recentDocs.length > 0 ? (
        <div style={styles.documentList}>
          <h3 style={styles.sectionTitle}>Recent Documents</h3>
          {recentDocs.slice(0, 5).map((doc) => (
            <button
              key={doc.id}
              onClick={() => openDocument(doc)}
              style={styles.documentItem}
            >
              <span style={styles.documentIcon}>
                {doc.file_type === 'pdf' ? '📄' : '📝'}
              </span>
              <div style={styles.documentInfo}>
                <span style={styles.documentTitle}>{doc.title}</span>
                <span style={styles.documentMeta}>
                  {formatDate(doc.last_read_at || doc.created_at)}
                  {doc.reading_progress !== undefined && doc.reading_progress > 0 && (
                    <span style={styles.progress}>
                      {' '} • {Math.round(doc.reading_progress)}%
                    </span>
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No recent documents</p>
          <p style={styles.emptySubtext}>
            Save a page to get started
          </p>
        </div>
      )}

      <div style={styles.quickActions}>
        <button
          onClick={() => chrome.tabs.create({ url: 'https://ryzomatic.net/upload' })}
          style={styles.actionButton}
        >
          <span style={styles.actionIcon}>📤</span>
          Upload Document
        </button>
        <button
          onClick={() => chrome.tabs.create({ url: 'https://ryzomatic.net/search' })}
          style={styles.actionButton}
        >
          <span style={styles.actionIcon}>🔍</span>
          Search Library
        </button>
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
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
  openButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 8px 0',
  },
  documentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  documentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: '#1f2937',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s',
    width: '100%',
  },
  documentIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  documentTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  documentMeta: {
    fontSize: '11px',
    color: '#6b7280',
  },
  progress: {
    color: '#10b981',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: '0 0 4px 0',
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: 'transparent',
    color: '#d1d5db',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionIcon: {
    fontSize: '14px',
  },
  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    padding: '24px',
  },
  spinner: {
    fontSize: '20px',
    animation: 'spin 1s linear infinite',
  },
};

