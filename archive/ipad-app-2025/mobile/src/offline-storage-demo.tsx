import React from 'react'
import { useOfflineStorage } from '@shared/hooks/useOfflineStorage'

const OfflineStorageDemo = () => {
  const {
    documents,
    stats,
    isLoading,
    error,
    isAvailable,
    downloadDocument,
    deleteDocument,
    refreshDocuments,
    clearAllDocuments,
    formatFileSize
  } = useOfflineStorage()

  const handleDownloadTest = async () => {
    // Test with a sample PDF URL
    const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    const result = await downloadDocument(
      'test-doc-1',
      'Test Document',
      testUrl,
      {
        author: 'Test Author',
        journal: 'Test Journal',
        year: 2024
      }
    )

    if (result) {
      console.log('Document downloaded successfully:', result)
    }
  }

  if (!isAvailable) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--color-background, #000000)',
        color: 'var(--color-text, #ffffff)',
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}>
        <h1 style={{ color: 'var(--color-primary, #9ca3af)', marginBottom: '20px' }}>
          📱 Offline Storage Demo
        </h1>
        <p style={{ color: 'var(--color-text-secondary, #d1d5db)', fontSize: '1.2rem' }}>
          Offline storage is only available on native platforms (iPad).
        </p>
        <p style={{ color: 'var(--color-text-secondary, #d1d5db)', marginTop: '10px' }}>
          This feature requires Capacitor's Filesystem API.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--color-background, #000000)',
      color: 'var(--color-text, #ffffff)',
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          color: 'var(--color-primary, #9ca3af)',
          margin: 0 
        }}>
          📱 Offline Storage
        </h1>
        <button
          onClick={refreshDocuments}
          disabled={isLoading}
          style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Storage Stats */}
      {stats && (
        <div style={{
          backgroundColor: 'var(--color-background-secondary, #111827)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '1px solid var(--color-primary, #9ca3af)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            color: 'var(--color-text, #ffffff)',
            marginBottom: '15px'
          }}>
            Storage Statistics
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            <div>
              <div style={{ color: 'var(--color-text-secondary, #d1d5db)' }}>Documents</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalDocuments}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary, #d1d5db)' }}>Total Size</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatFileSize(stats.totalSize)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary, #d1d5db)' }}>Available Space</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatFileSize(stats.availableSpace)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-secondary, #d1d5db)' }}>Last Sync</div>
              <div style={{ fontSize: '1.2rem' }}>
                {stats.lastSync ? stats.lastSync.toLocaleDateString() : 'Never'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Download Button */}
      <div style={{
        backgroundColor: 'var(--color-background-secondary, #111827)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '30px',
        border: '1px solid var(--color-primary, #9ca3af)'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: 'var(--color-text, #ffffff)',
          marginBottom: '15px'
        }}>
          Test Offline Storage
        </h3>
        <p style={{
          color: 'var(--color-text-secondary, #d1d5db)',
          marginBottom: '15px'
        }}>
          Download a test PDF to verify offline storage functionality.
        </p>
        <button
          onClick={handleDownloadTest}
          disabled={isLoading}
          style={{
            backgroundColor: 'var(--color-primary, #9ca3af)',
            color: 'var(--color-background, #000000)',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontSize: '1rem'
          }}
        >
          {isLoading ? 'Downloading...' : 'Download Test PDF'}
        </button>
      </div>

      {/* Documents List */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            color: 'var(--color-text, #ffffff)',
            margin: 0
          }}>
            Offline Documents ({documents.length})
          </h2>
          {documents.length > 0 && (
            <button
              onClick={clearAllDocuments}
              disabled={isLoading}
              style={{
                backgroundColor: 'transparent',
                color: '#dc3545',
                border: '1px solid #dc3545',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--color-text-secondary, #d1d5db)',
            backgroundColor: 'var(--color-background-secondary, #111827)',
            borderRadius: '12px',
            border: '1px solid var(--color-primary, #9ca3af)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📄</div>
            <h3 style={{ marginBottom: '10px' }}>No offline documents</h3>
            <p>Download documents to read them offline on your iPad.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  backgroundColor: 'var(--color-background-secondary, #111827)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-primary, #9ca3af)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{
                    fontSize: '1.2rem',
                    color: 'var(--color-text, #ffffff)',
                    marginBottom: '8px'
                  }}>
                    {doc.title}
                  </h4>
                  <div style={{
                    color: 'var(--color-text-secondary, #d1d5db)',
                    fontSize: '0.9rem',
                    marginBottom: '5px'
                  }}>
                    {formatFileSize(doc.size)} • Downloaded {doc.downloadedAt.toLocaleDateString()}
                  </div>
                  {doc.metadata && (
                    <div style={{
                      color: 'var(--color-text-secondary, #d1d5db)',
                      fontSize: '0.8rem'
                    }}>
                      {doc.metadata.author && `${doc.metadata.author} • `}
                      {doc.metadata.journal && `${doc.metadata.journal} • `}
                      {doc.metadata.year && doc.metadata.year}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  disabled={isLoading}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#dc3545',
                    border: '1px solid #dc3545',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    fontSize: '0.9rem'
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OfflineStorageDemo
