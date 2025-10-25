import { useState, useEffect, useCallback } from 'react'
import { offlineStorageService, OfflineDocument, OfflineStorageStats } from '../services/offlineStorageService'
import { Capacitor } from '@capacitor/core'

export interface UseOfflineStorageReturn {
  // State
  documents: OfflineDocument[]
  stats: OfflineStorageStats | null
  isLoading: boolean
  error: string | null
  isAvailable: boolean

  // Actions
  downloadDocument: (documentId: string, title: string, url: string, metadata?: OfflineDocument['metadata']) => Promise<OfflineDocument | null>
  deleteDocument: (documentId: string) => Promise<boolean>
  getDocumentUrl: (documentId: string) => Promise<string | null>
  refreshDocuments: () => Promise<void>
  clearAllDocuments: () => Promise<boolean>
  isDocumentDownloaded: (documentId: string) => Promise<boolean>

  // Utilities
  formatFileSize: (bytes: number) => string
}

export const useOfflineStorage = (): UseOfflineStorageReturn => {
  const [documents, setDocuments] = useState<OfflineDocument[]>([])
  const [stats, setStats] = useState<OfflineStorageStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)

  // Check if offline storage is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        await offlineStorageService.initialize()
        setIsAvailable(Capacitor.isNativePlatform())
      } catch (err) {
        console.error('Offline storage not available:', err)
        setIsAvailable(false)
      }
    }

    checkAvailability()
  }, [])

  // Load documents and stats
  const refreshDocuments = useCallback(async () => {
    if (!isAvailable) return

    setIsLoading(true)
    setError(null)

    try {
      const [docs, storageStats] = await Promise.all([
        offlineStorageService.getAllDocuments(),
        offlineStorageService.getStorageStats()
      ])

      setDocuments(docs)
      setStats(storageStats)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load offline documents'
      setError(errorMessage)
      console.error('Failed to refresh documents:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable])

  // Load documents on mount and when availability changes
  useEffect(() => {
    if (isAvailable) {
      refreshDocuments()
    }
  }, [isAvailable, refreshDocuments])

  // Download a document
  const downloadDocument = useCallback(async (
    documentId: string,
    title: string,
    url: string,
    metadata?: OfflineDocument['metadata']
  ): Promise<OfflineDocument | null> => {
    if (!isAvailable) {
      setError('Offline storage not available on this platform')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const document = await offlineStorageService.downloadDocument(
        documentId,
        title,
        url,
        metadata
      )

      // Refresh the documents list
      await refreshDocuments()
      
      return document
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download document'
      setError(errorMessage)
      console.error('Download failed:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, refreshDocuments])

  // Delete a document
  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!isAvailable) {
      setError('Offline storage not available on this platform')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await offlineStorageService.deleteDocument(documentId)
      
      if (success) {
        // Refresh the documents list
        await refreshDocuments()
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document'
      setError(errorMessage)
      console.error('Delete failed:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, refreshDocuments])

  // Get document URL
  const getDocumentUrl = useCallback(async (documentId: string): Promise<string | null> => {
    if (!isAvailable) return null

    try {
      return await offlineStorageService.getDocumentUrl(documentId)
    } catch (err) {
      console.error('Failed to get document URL:', err)
      return null
    }
  }, [isAvailable])

  // Clear all documents
  const clearAllDocuments = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      setError('Offline storage not available on this platform')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await offlineStorageService.clearAllDocuments()
      
      if (success) {
        // Refresh the documents list
        await refreshDocuments()
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear documents'
      setError(errorMessage)
      console.error('Clear all failed:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, refreshDocuments])

  // Check if document is downloaded
  const isDocumentDownloaded = useCallback(async (documentId: string): Promise<boolean> => {
    if (!isAvailable) return false

    try {
      return await offlineStorageService.isDocumentDownloaded(documentId)
    } catch (err) {
      console.error('Failed to check download status:', err)
      return false
    }
  }, [isAvailable])

  // Format file size utility
  const formatFileSize = useCallback((bytes: number): string => {
    return offlineStorageService.formatFileSize(bytes)
  }, [])

  return {
    // State
    documents,
    stats,
    isLoading,
    error,
    isAvailable,

    // Actions
    downloadDocument,
    deleteDocument,
    getDocumentUrl,
    refreshDocuments,
    clearAllDocuments,
    isDocumentDownloaded,

    // Utilities
    formatFileSize
  }
}

export default useOfflineStorage
