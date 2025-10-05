import React, { useCallback, useState } from 'react'
import { X, Upload, FileText, AlertCircle, Save, Cloud } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { storageService } from '../services/storageService'
import { googleIntegrationService } from '../services/googleIntegrationService'
import { simpleGoogleAuth } from '../services/simpleGoogleAuth'

interface DocumentUploadProps {
  onClose: () => void
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onClose }) => {
  const { addDocument, setLoading } = useAppStore()
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveToLibrary, setSaveToLibrary] = useState(true)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0])
    }
  }, [])

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)

    try {
      if (file.type === 'application/pdf') {
        const { content, pdfData, totalPages, pageTexts } = await extractPDFData(file)
        const document = {
          id: crypto.randomUUID(),
          name: file.name,
          content,
          type: 'pdf' as const,
          uploadedAt: new Date(),
          pdfData,
          totalPages,
          pageTexts
        }
        addDocument(document)
        
        // Save to library if checkbox is checked
        if (saveToLibrary) {
          try {
            // Save locally
            await storageService.saveBook({
              id: document.id,
              title: document.name,
              fileName: file.name,
              type: 'pdf',
              savedAt: new Date(),
              totalPages,
              fileData: pdfData,
            })
            
            // Upload to Google Drive "Readings In Progress" if user is signed in
            if (simpleGoogleAuth.isSignedIn()) {
              try {
                console.log('Uploading PDF to Google Drive...')
                const readingFile = await googleIntegrationService.uploadPDFToReadings(file)
                console.log('PDF uploaded to Google Drive:', readingFile.url)
              } catch (driveError) {
                console.error('Error uploading to Google Drive:', driveError)
                // Don't fail the whole operation if Drive upload fails
              }
            }
          } catch (err) {
            console.error('Error saving to library:', err)
          }
        }
      } else {
        const content = await extractTextFromFile(file)
        const document = {
          id: crypto.randomUUID(),
          name: file.name,
          content,
          type: 'text' as const,
          uploadedAt: new Date()
        }
        addDocument(document)
        
        // Save to library if checkbox is checked
        if (saveToLibrary) {
          try {
            await storageService.saveBook({
              id: document.id,
              title: document.name,
              fileName: file.name,
              type: 'text',
              savedAt: new Date(),
              fileData: content,
            })
          } catch (err) {
            console.error('Error saving to library:', err)
          }
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setLoading(false)
    }
  }

  const extractPDFData = async (file: File) => {
    try {
      // Import PDF.js dynamically
      const pdfjsLib = await import('pdfjs-dist')
      
      // Set up PDF.js worker with fallback
      const localWorker = '/pdf.worker.min.js'
      const cdnWorker = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
      
      // Set the worker source with fallback
      pdfjsLib.GlobalWorkerOptions.workerSrc = localWorker
      
      // Test if local worker is accessible
      try {
        await fetch(localWorker, { method: 'HEAD' })
        console.log('✅ PDF.js worker configured to use local file')
      } catch {
        console.warn('⚠️ Local PDF.js worker not found, using CDN fallback')
        pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorker
      }
      
      // Read the file as array buffer
      const originalArrayBuffer = await file.arrayBuffer()
      
      // Create a deep copy of the ArrayBuffer to prevent detachment
      const bufferCopy = originalArrayBuffer.slice(0)
      
      // Create a new ArrayBuffer for PDF.js processing to avoid any detachment
      const processingBuffer = new ArrayBuffer(bufferCopy.byteLength)
      new Uint8Array(processingBuffer).set(new Uint8Array(bufferCopy))
      
      // Load the PDF document with the processing buffer
      const pdf = await pdfjsLib.getDocument({ 
        data: processingBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableAutoFetch: true,
        disableStream: true
      }).promise
      
      let fullText = ''
      const pageTexts: string[] = []
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          
          // Combine all text items from the page
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
          
          pageTexts.push(pageText)
          fullText += pageText + '\n\n'
        } catch (pageError) {
          console.warn(`Error extracting text from page ${pageNum}:`, pageError)
          pageTexts.push('')
          fullText += '\n\n'
        }
      }
      
      return {
        content: fullText.trim() || 'PDF loaded successfully. Text extraction may be limited for some PDFs.',
        pdfData: bufferCopy, // Use the buffer copy for storage to prevent detachment
        totalPages: pdf.numPages,
        pageTexts
      }
    } catch (error) {
      console.error('Error extracting PDF data:', error)
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      return await file.text()
    } else {
      throw new Error('Unsupported file type. Please upload a text file or PDF.')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your document here
            </p>
            <p className="text-gray-600 mb-4">
              or click to browse files
            </p>
            <input
              type="file"
              accept=".txt,.pdf"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="btn-primary cursor-pointer inline-flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Choose File</span>
            </label>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-medium mb-2">Supported formats:</p>
            <ul className="space-y-1">
              <li>• Text files (.txt)</li>
              <li>• PDF documents (.pdf)</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Note: For PDFs, text extraction is attempted first. If the advanced PDF viewer has issues, 
              the app will automatically fall back to text-only view.
            </p>
          </div>

          {/* Save to Library Checkbox */}
          <div className="mt-4 flex items-center">
            <input
              type="checkbox"
              id="save-to-library"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="save-to-library" className="ml-2 text-sm text-gray-700 flex items-center gap-1">
              <Save className="w-4 h-4" />
              Save to Library {simpleGoogleAuth.isSignedIn() && <span className="flex items-center gap-1">& <Cloud className="w-4 h-4" /> Google Drive</span>}
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}


