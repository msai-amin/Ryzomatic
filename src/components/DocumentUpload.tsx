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
// PDF.js will be imported dynamically to avoid ES module issues

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
              // In local development, S3 API endpoints may not be available (404)
              // This is OK - the document is still loaded in memory for the current session
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
              
              // Try to save to localStorage as backup (optional)
              try {
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
              } catch (localStorageError) {
                // localStorage backup failed, but Supabase succeeded - this is OK
                logger.warn('localStorage backup failed, but Supabase save succeeded', context, localStorageError as Error);
              }
              
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
              // In local development, S3 API may not be available (404)
              // Log the error but don't fail the whole upload since the PDF is already loaded
              logger.warn('Could not save to library (likely S3 API unavailable in local dev)', context, err as Error);
              // Don't throw - the document is already added to the reader
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
              
              // Try to save to localStorage as backup (optional)
              try {
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
              } catch (localStorageError) {
                // localStorage backup failed, but Supabase succeeded - this is OK
                logger.warn('localStorage backup failed, but Supabase save succeeded', context, localStorageError as Error);
              }
              
              // Trigger library refresh
              refreshLibrary();
            } catch (err) {
              // In local development, S3 API may not be available (404)
              // Log the error but don't fail the whole upload since the document is already loaded
              logger.warn('Could not save text file to library (likely S3 API unavailable in local dev)', context, err as Error);
              // Don't throw - the document is already added to the reader
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

      // Dynamic import of PDF.js to avoid ES module issues with Vite
      const pdfjsModule = await import('pdfjs-dist')
      
      // Access the actual library - it might be under .default or directly available
      const pdfjsLib = pdfjsModule.default || pdfjsModule
      
      // Set up PDF.js worker - with safety check
      if (pdfjsLib && 'GlobalWorkerOptions' in pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      }
      
      logger.info('PDF.js worker configured', context);
      
      // Store the file as a Blob to avoid ArrayBuffer detachment issues
      const fileBlob = new Blob([file], { type: 'application/pdf' })
      
      // For initial processing, read the file
      const arrayBuffer = await file.arrayBuffer()
      
      // Try to access getDocument from the module or its properties
      const getDocument = pdfjsLib.getDocument || pdfjsModule.getDocument
      
      if (!getDocument) {
        throw new Error('getDocument function not found in PDF.js module')
      }
      
      // Load the PDF document for text extraction
      const pdf = await getDocument({ data: arrayBuffer }).promise
      
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
      <div className="modal-content animate-scale-in">
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-heading-3" style={{ color: 'var(--color-text-primary)' }}>Upload Document</h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            aria-label="Close Upload Dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300"
            style={{
              borderColor: dragActive ? 'var(--color-primary)' : 'var(--color-border)',
              backgroundColor: dragActive ? 'rgba(156, 163, 175, 0.1)' : 'transparent',
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-heading-3 mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Drop your document here
            </p>
            <p className="text-body mb-4" style={{ color: 'var(--color-text-secondary)' }}>
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
              className="btn-primary cursor-pointer inline-flex items-center space-x-2 text-button"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--border-radius-lg)',
              }}
            >
              <FileText className="w-4 h-4" />
              <span>Choose File</span>
            </label>
          </div>

          {error && (
            <div 
              className="mt-4 p-4 rounded-lg flex items-center space-x-2"
              style={{
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid var(--color-error)',
              }}
            >
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
            </div>
          )}

          <div className="mt-6" style={{ color: 'var(--color-text-secondary)' }}>
            <p className="text-caption font-medium mb-2">Supported formats:</p>
            <ul className="space-y-1 text-caption">
              <li>• Text files (.txt)</li>
              <li>• PDF documents (.pdf)</li>
            </ul>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
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
              className="w-4 h-4 rounded focus:ring-2"
              style={{
                accentColor: 'var(--color-primary)',
                borderColor: 'var(--color-border)',
              }}
            />
            <label 
              htmlFor="save-to-library" 
              className="ml-2 text-caption flex items-center gap-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <Save className="w-4 h-4" />
              Save to Library {simpleGoogleAuth.isSignedIn() && <span className="flex items-center gap-1">& <Cloud className="w-4 h-4" /> Google Drive</span>}
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}


