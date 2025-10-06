import React, { useCallback, useState } from 'react'
import { X, Upload, FileText, AlertCircle, Save, Cloud } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { storageService } from '../services/storageService'
import { supabaseStorageService } from '../services/supabaseStorageService'
import { googleIntegrationService } from '../services/googleIntegrationService'
import { simpleGoogleAuth } from '../services/simpleGoogleAuth'
import { logger, trackPerformance } from '../services/logger'
import { errorHandler, ErrorType, ErrorSeverity } from '../services/errorHandler'
import { validatePDFFile, validateFile } from '../services/validation'

interface DocumentUploadProps {
  onClose: () => void
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onClose }) => {
  const { addDocument, setLoading, refreshLibrary } = useAppStore()
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
    const context = {
      component: 'DocumentUpload',
      action: 'handleFile'
    };

    setError(null)
    setLoading(true)

    try {
      logger.info('Starting file upload', context, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      // Validate file
      if (file.type === 'application/pdf') {
        const validation = validatePDFFile(file, context);
        if (!validation.isValid) {
          const error = errorHandler.createError(
            `Invalid PDF file: ${validation.errors.join(', ')}`,
            ErrorType.VALIDATION,
            ErrorSeverity.MEDIUM,
            context,
            { validationErrors: validation.errors }
          );
          throw error;
        }
      } else {
        const validation = validateFile(file, { 
          maxSize: 10 * 1024 * 1024, // 10MB
          allowedTypes: ['text/plain', 'text/markdown']
        }, context);
        if (!validation.isValid) {
          const error = errorHandler.createError(
            `Invalid file: ${validation.errors.join(', ')}`,
            ErrorType.VALIDATION,
            ErrorSeverity.MEDIUM,
            context,
            { validationErrors: validation.errors }
          );
          throw error;
        }
      }

      if (file.type === 'application/pdf') {
        const { content, pdfData, totalPages, pageTexts } = await trackPerformance(
          'extractPDFData',
          () => extractPDFData(file),
          context,
          { fileName: file.name, fileSize: file.size }
        );

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
        
        logger.info('PDF document processed successfully', context, {
          documentId: document.id,
          totalPages,
          contentLength: content.length,
          pageTextsCount: pageTexts.length,
          pageTextsPreview: pageTexts.slice(0, 3).map((text, i) => ({
            page: i + 1,
            textLength: text.length,
            textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
          }))
        });
        
        // Save to library if checkbox is checked
        if (saveToLibrary) {
          await trackPerformance('saveToLibrary', async () => {
            try {
              // Save to Supabase (primary storage)
              await supabaseStorageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'pdf',
                savedAt: new Date(),
                totalPages,
                fileData: pdfData,
                pageTexts, // Include pageTexts for TTS functionality
              })
              
              logger.info('Document saved to Supabase', context, {
                documentId: document.id
              });
              
              // Also save to localStorage as backup
              await storageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'pdf',
                savedAt: new Date(),
                totalPages,
                fileData: pdfData,
                pageTexts, // Include pageTexts for TTS functionality
              })
              
              logger.info('Document saved to local library (backup)', context, {
                documentId: document.id
              });
              
              // Trigger library refresh
              refreshLibrary();
              
              // Upload to Google Drive "Readings In Progress" if user is signed in
              if (simpleGoogleAuth.isSignedIn()) {
                try {
                  logger.info('Uploading PDF to Google Drive', context);
                  const readingFile = await googleIntegrationService.uploadPDFToReadings(file)
                  logger.info('PDF uploaded to Google Drive successfully', context, {
                    url: readingFile.url
                  });
                } catch (driveError) {
                  logger.error('Error uploading to Google Drive', context, driveError as Error);
                  // Don't fail the whole operation if Drive upload fails
                }
              }
            } catch (err) {
              logger.error('Error saving to library', context, err as Error);
              throw err;
            }
          }, context);
        }
      } else {
        const content = await trackPerformance(
          'extractTextFromFile',
          () => extractTextFromFile(file),
          context,
          { fileName: file.name, fileSize: file.size }
        );

        const document = {
          id: crypto.randomUUID(),
          name: file.name,
          content,
          type: 'text' as const,
          uploadedAt: new Date()
        }
        
        addDocument(document)
        
        logger.info('Text document processed successfully', context, {
          documentId: document.id,
          contentLength: content.length
        });
        
        // Save to library if checkbox is checked
        if (saveToLibrary) {
          await trackPerformance('saveToLibrary', async () => {
            try {
              // Save to Supabase (primary storage)
              await supabaseStorageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'text',
                savedAt: new Date(),
                fileData: content,
              })
              
              logger.info('Document saved to Supabase', context, {
                documentId: document.id
              });
              
              // Also save to localStorage as backup
              await storageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'text',
                savedAt: new Date(),
                fileData: content,
              })
              
              logger.info('Document saved to local library (backup)', context, {
                documentId: document.id
              });
              
              // Trigger library refresh
              refreshLibrary();
            } catch (err) {
              logger.error('Error saving to library', context, err as Error);
              throw err;
            }
          }, context);
        }
      }
      
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process file');
      logger.error('File upload failed', context, error);
      
      await errorHandler.handleError(error, context);
      setError(error.message);
    } finally {
      setLoading(false)
    }
  }

  const extractPDFData = async (file: File) => {
    const context = {
      component: 'DocumentUpload',
      action: 'extractPDFData'
    };

    try {
      logger.info('Starting PDF data extraction', context, {
        fileName: file.name,
        fileSize: file.size
      });

      // Import PDF.js directly
      const pdfjsLib = await import('pdfjs-dist')
      
      // Set up PDF.js worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      
      logger.info('PDF.js worker configured', context);
      
      // Store the file as a Blob to avoid ArrayBuffer detachment issues
      const fileBlob = new Blob([file], { type: 'application/pdf' })
      
      // For initial processing, read the file
      const arrayBuffer = await file.arrayBuffer()
      
      // Load the PDF document for text extraction
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      logger.info('PDF document loaded', context, {
        totalPages: pdf.numPages
      });
      
      let fullText = ''
      const pageTexts: string[] = []
      let successfulPages = 0
      let failedPages = 0
      
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
          successfulPages++
        } catch (pageError) {
          logger.warn(`Error extracting text from page ${pageNum}`, context, pageError as Error);
          pageTexts.push('')
          fullText += '\n\n'
          failedPages++
        }
      }
      
      logger.info('PDF text extraction completed', context, {
        totalPages: pdf.numPages,
        successfulPages,
        failedPages,
        extractedTextLength: fullText.length
      });
      
      // Store the blob directly - PDFViewer will convert to blob URL
      return {
        content: fullText.trim() || 'PDF loaded successfully. Text extraction may be limited for some PDFs.',
        pdfData: fileBlob,
        totalPages: pdf.numPages,
        pageTexts
      }
    } catch (error) {
      logger.error('PDF data extraction failed', context, error as Error);
      const appError = errorHandler.createError(
        `Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.PDF_PROCESSING,
        ErrorSeverity.HIGH,
        context,
        { fileName: file.name, fileSize: file.size }
      );
      throw appError;
    }
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    const context = {
      component: 'DocumentUpload',
      action: 'extractTextFromFile'
    };

    try {
      logger.info('Starting text file extraction', context, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
        const content = await file.text();
        
        logger.info('Text file extracted successfully', context, {
          contentLength: content.length
        });
        
        return content;
      } else {
        const error = errorHandler.createError(
          'Unsupported file type. Please upload a text file or PDF.',
          ErrorType.VALIDATION,
          ErrorSeverity.MEDIUM,
          context,
          { fileName: file.name, fileType: file.type }
        );
        throw error;
      }
    } catch (error) {
      logger.error('Text file extraction failed', context, error as Error);
      throw error;
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


