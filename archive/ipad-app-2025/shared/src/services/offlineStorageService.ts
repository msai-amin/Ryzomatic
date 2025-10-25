import { Capacitor } from '@capacitor/core'

export interface OfflineDocument {
  id: string
  title: string
  url: string
  localPath: string
  size: number
  downloadedAt: Date
  lastAccessed: Date
  isDownloaded: boolean
  metadata?: {
    author?: string
    journal?: string
    year?: number
    pages?: number
  }
}

export interface OfflineStorageStats {
  totalDocuments: number
  totalSize: number
  availableSpace: number
  lastSync: Date | null
}

class OfflineStorageService {
  private readonly STORAGE_DIR = 'smart-reader-documents'
  private readonly METADATA_FILE = 'metadata.json'
  private documents: Map<string, OfflineDocument> = new Map()
  private isInitialized = false
  private Filesystem: any = null
  private Directory: any = null
  private Encoding: any = null

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Check if we're on a native platform
      if (!Capacitor.isNativePlatform()) {
        console.log('Offline storage not available on web platform')
        return
      }

      // Dynamically import Capacitor modules
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      this.Filesystem = Filesystem
      this.Directory = Directory
      this.Encoding = Encoding

      // Create storage directory if it doesn't exist
      await this.ensureStorageDirectory()
      
      // Load existing metadata
      await this.loadMetadata()
      
      this.isInitialized = true
      console.log('Offline storage initialized successfully')
    } catch (error) {
      console.error('Failed to initialize offline storage:', error)
      throw error
    }
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await this.Filesystem.mkdir({
        path: this.STORAGE_DIR,
        directory: this.Directory.Data,
        recursive: true
      })
    } catch (error) {
      // Directory might already exist
      console.log('Storage directory already exists or created')
    }
  }

  private async loadMetadata(): Promise<void> {
    try {
      const result = await this.Filesystem.readFile({
        path: `${this.STORAGE_DIR}/${this.METADATA_FILE}`,
        directory: this.Directory.Data,
        encoding: this.Encoding.UTF8
      })

      const metadata = JSON.parse(result.data as string)
      this.documents = new Map(Object.entries(metadata))
    } catch (error) {
      // No metadata file exists yet, start with empty map
      console.log('No existing metadata found, starting fresh')
      this.documents = new Map()
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      const metadata = Object.fromEntries(this.documents)
      await this.Filesystem.writeFile({
        path: `${this.STORAGE_DIR}/${this.METADATA_FILE}`,
        data: JSON.stringify(metadata, null, 2),
        directory: this.Directory.Data,
        encoding: this.Encoding.UTF8
      })
    } catch (error) {
      console.error('Failed to save metadata:', error)
      throw error
    }
  }

  async downloadDocument(
    documentId: string,
    title: string,
    url: string,
    metadata?: OfflineDocument['metadata']
  ): Promise<OfflineDocument> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!Capacitor.isNativePlatform()) {
      throw new Error('Offline storage only available on native platforms')
    }

    try {
      // Check if already downloaded
      if (this.documents.has(documentId)) {
        const existing = this.documents.get(documentId)!
        existing.lastAccessed = new Date()
        await this.saveMetadata()
        return existing
      }

      // Download the file
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`)
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Save to local storage
      const fileName = `${documentId}.pdf`
      const localPath = `${this.STORAGE_DIR}/${fileName}`

      await this.Filesystem.writeFile({
        path: localPath,
        data: uint8Array,
        directory: this.Directory.Data
      })

      // Create document record
      const document: OfflineDocument = {
        id: documentId,
        title,
        url,
        localPath,
        size: arrayBuffer.byteLength,
        downloadedAt: new Date(),
        lastAccessed: new Date(),
        isDownloaded: true,
        metadata
      }

      this.documents.set(documentId, document)
      await this.saveMetadata()

      console.log(`Document downloaded successfully: ${title}`)
      return document
    } catch (error) {
      console.error('Failed to download document:', error)
      throw error
    }
  }

  async getDocument(documentId: string): Promise<OfflineDocument | null> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const document = this.documents.get(documentId)
    if (document) {
      document.lastAccessed = new Date()
      await this.saveMetadata()
    }
    return document || null
  }

  async getDocumentUrl(documentId: string): Promise<string | null> {
    const document = await this.getDocument(documentId)
    if (!document || !document.isDownloaded) {
      return null
    }

    try {
      const result = await this.Filesystem.getUri({
        directory: this.Directory.Data,
        path: document.localPath
      })
      return result.uri
    } catch (error) {
      console.error('Failed to get document URL:', error)
      return null
    }
  }

  async getAllDocuments(): Promise<OfflineDocument[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    return Array.from(this.documents.values()).sort(
      (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
    )
  }

  async deleteDocument(documentId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const document = this.documents.get(documentId)
    if (!document) {
      return false
    }

    try {
      // Delete the file
      await this.Filesystem.deleteFile({
        path: document.localPath,
        directory: this.Directory.Data
      })

      // Remove from metadata
      this.documents.delete(documentId)
      await this.saveMetadata()

      console.log(`Document deleted: ${document.title}`)
      return true
    } catch (error) {
      console.error('Failed to delete document:', error)
      return false
    }
  }

  async getStorageStats(): Promise<OfflineStorageStats> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const documents = Array.from(this.documents.values())
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0)
    const lastSync = documents.length > 0 
      ? new Date(Math.max(...documents.map(doc => doc.downloadedAt.getTime())))
      : null

    // Get available space (approximate)
    let availableSpace = 0
    try {
      const result = await this.Filesystem.stat({
        path: this.STORAGE_DIR,
        directory: this.Directory.Data
      })
      // This is a rough estimate - iOS doesn't provide exact available space
      availableSpace = 1000000000 // 1GB placeholder
    } catch (error) {
      console.warn('Could not get storage stats:', error)
    }

    return {
      totalDocuments: documents.length,
      totalSize,
      availableSpace,
      lastSync
    }
  }

  async clearAllDocuments(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      // Delete all files
      for (const document of this.documents.values()) {
        try {
          await this.Filesystem.deleteFile({
            path: document.localPath,
            directory: this.Directory.Data
          })
        } catch (error) {
          console.warn(`Failed to delete file ${document.localPath}:`, error)
        }
      }

      // Clear metadata
      this.documents.clear()
      await this.saveMetadata()

      console.log('All offline documents cleared')
      return true
    } catch (error) {
      console.error('Failed to clear all documents:', error)
      return false
    }
  }

  async isDocumentDownloaded(documentId: string): Promise<boolean> {
    const document = await this.getDocument(documentId)
    return document?.isDownloaded || false
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Export singleton instance
export const offlineStorageService = new OfflineStorageService()
export default offlineStorageService
