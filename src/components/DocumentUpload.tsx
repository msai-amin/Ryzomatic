import React, { useCallback, useState, useEffect, useRef } from 'react'
import { X, Upload, FileText, AlertCircle, Save, Cloud } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { storageService } from '../services/storageService'
import { supabaseStorageService } from '../services/supabaseStorageService'
import { googleIntegrationService } from '../services/googleIntegrationService'
import { simpleGoogleAuth } from '../services/simpleGoogleAuth'
import { logger, trackPerformance } from '../services/logger'
import { errorHandler, ErrorType, ErrorSeverity } from '../services/errorHandler'
import { validatePDFFile, validateFile } from '../services/validation'
import { documentContentService } from '../services/documentContentService'
import { OCRConsentDialog } from './OCRConsentDialog'
import { calculateOCRCredits } from '../utils/ocrUtils'
import { extractStructuredText } from '../utils/pdfTextExtractor'
import { extractWithFallback, extractWithHybridPipeline } from '../services/pdfExtractionOrchestrator'
import { isDoclingSupported, getMimeTypesForDocling } from '../services/doclingService'
import { canPerformVisionExtraction } from '../services/visionUsageService'
import { configurePDFWorker } from '../utils/pdfjsConfig'
import { supabase } from '../../lib/supabase'
import { FEATURES } from '../config/featureFlags'
// PDF.js will be imported dynamically to avoid ES module issues

/**
 * What the file picker will actually let through.
 *
 * Keep this in lockstep with the validation branch in handleFiles and with the
 * "Supported formats" list below it — the three drifting apart is what produced
 * the bug where the picker accepted .docx and the orchestrator threw on it.
 *
 * The office/e-book set only appears once the anydoc lane is live.
 */
const PDF_AND_TEXT_TYPES =
  '.txt,.md,.pdf,application/pdf,text/plain,text/markdown'

const OFFICE_TYPES = [
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
  '.odt', '.ods', '.odp', '.rtf', '.epub', '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',')

const ACCEPTED_FILE_TYPES = FEATURES.docExtractionV2
  ? `${PDF_AND_TEXT_TYPES},${OFFICE_TYPES}`
  : PDF_AND_TEXT_TYPES

interface DocumentUploadProps {
  onClose: () => void
  onUploadComplete?: (documentId: string) => void // Optional callback for when upload completes
  setAsCurrentDocument?: boolean // Control whether uploaded doc becomes current
  zIndexClass?: string
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onClose,
  onUploadComplete,
  setAsCurrentDocument = true,
  zIndexClass = 'z-50'
}) => {
  const { addDocument, setLoading, refreshLibrary, refreshRelatedDocuments, user } = useAppStore()
  const [dragActive, setDragActive] = useState(false)
  const [showOCRDialog, setShowOCRDialog] = useState(false)
  const [ocrPendingData, setOcrPendingData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [userProfile, setUserProfile] = useState<any>({ tier: 'free', credits: 0, ocr_count_monthly: 0 })
  const [extractionProgress, setExtractionProgress] = useState<string>('')
  const handleFileRef = useRef<((file: File) => Promise<void>) | null>(null)

  // CRITICAL: Normalize user.id to prevent React comparison error
  const normalizedUserId = user?.id ?? ''

  // Initialize supabaseStorageService with current user when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      console.log('DocumentUpload: Initializing supabaseStorageService with user:', user.id)
      supabaseStorageService.setCurrentUser(user.id)
    } else {
      console.warn('DocumentUpload: No user ID available, supabaseStorageService not initialized')
      supabaseStorageService.setCurrentUser(null)
    }
  }, [normalizedUserId])

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
      // Only allow single file upload
      if (e.target.files.length > 1) {
        alert('Multiple file upload is not allowed. Please upload one file at a time.')
        return
      }
      await handleFile(e.target.files[0])
    }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    const context = {
      component: 'DocumentUpload',
      action: 'handleFile'
    };

    setError(null)
    setExtractionProgress('')
    setLoading(true)

    let resultingDocumentId: string | null = null

    try {
      // CRITICAL: Check authentication before starting upload
      if (saveToLibrary) {
        if (!user?.id) {
          const authError = errorHandler.createError(
            'You must be signed in to save documents to your library. Please sign in and try again.',
            ErrorType.AUTHENTICATION,
            ErrorSeverity.HIGH,
            context
          );
          throw authError;
        }

        // Ensure service is initialized with user ID
        console.log('DocumentUpload: Verifying supabaseStorageService is initialized with user:', user.id)
        supabaseStorageService.setCurrentUser(user.id)
      }

      logger.info('Starting file upload', context, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: user?.id || 'not authenticated',
        saveToLibrary
      });

      // Validate file
      const fileExt = file.name.toLowerCase().split('.').pop() || '';
      const isDoclingFile = isDoclingSupported(file.name);
      
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
      } else if (isDoclingFile) {
        // Office/image formats. The Docling tier that used to handle these is
        // excluded from deployment (.vercelignore — the ~4GB Python bundle
        // exceeds Vercel limits), so /api/docling 404s and the orchestrator
        // hard-throws at pdfExtractionOrchestrator.ts:497 with a message that
        // leaks implementation detail at the user.
        //
        // Until the anydoc lane lands (FEATURES.docExtractionV2), reject these
        // here with something actionable instead of letting them fail deep in
        // the pipeline.
        if (!FEATURES.docExtractionV2) {
          const error = errorHandler.createError(
            `${fileExt.toUpperCase()} files aren't supported yet — please convert to PDF and try again. Word, PowerPoint and Excel support is coming.`,
            ErrorType.VALIDATION,
            ErrorSeverity.MEDIUM,
            context,
            { fileName: file.name, fileType: fileExt, reason: 'docExtractionV2_disabled' }
          );
          throw error;
        }

        const maxSize = 50 * 1024 * 1024; // 50MB for documents
        if (file.size > maxSize) {
          const error = errorHandler.createError(
            `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`,
            ErrorType.VALIDATION,
            ErrorSeverity.MEDIUM,
            context,
            { fileSize: file.size, maxSize }
          );
          throw error;
        }
      } else {
        const validation = validateFile(
          file,
          { 
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['text/plain', 'text/markdown']
          },
          context
        );
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

      if (file.type === 'application/pdf' || isDoclingFile) {
        // Get user info for vision fallback
        const fileTypeLabel = fileExt === 'pdf' ? 'PDF' : fileExt.toUpperCase();
        setExtractionProgress(`Extracting text from ${fileTypeLabel}...`)
        
        let userId: string | undefined
        let userTier: string | undefined
        let authToken: string | undefined
        
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            userId = user.id
            const { data: profile } = await supabase
              .from('profiles')
              .select('tier')
              .eq('id', user.id)
              .single()
            userTier = profile?.tier || 'free'
            const session = await supabase.auth.getSession()
            authToken = session.data.session?.access_token
          }
        } catch (authError) {
          logger.warn('Could not get user info for vision fallback', context, authError as Error)
        }

        // Use the hybrid pipeline (Docling first, PDF.js fallback)
        const extractionResult = await trackPerformance(
          'extractWithHybridPipeline',
          () => extractWithHybridPipeline(file, {
            useDocling: true, // Try Docling first for better extraction
            doclingOptions: {
              enableOcr: true,
              extractTables: true,
              // extractFormulas intentionally omitted — it was a Docling option
              // that never delivered anything (the tier is excluded from
              // deployment), and formulaService.ts, the only code that could
              // have consumed formula output, had zero importers and was
              // deleted. Reinstate only alongside a real math-extraction path.
              preserveLayout: true,
            },
            visionOptions: {
              enabled: !!userId && !!authToken, // Enable vision fallback if user is authenticated
              userId,
              userTier,
              authToken
            }
          }),
          context,
          { fileName: file.name, fileSize: file.size }
        );

        // Show quality report based on extraction method
        if (extractionResult.extractionMethod === 'docling') {
          const tableInfo = extractionResult.metadata.doclingTables 
            ? `\n✓ ${extractionResult.metadata.doclingTables} tables detected` 
            : '';
          const figureInfo = extractionResult.metadata.doclingFigures 
            ? `\n✓ ${extractionResult.metadata.doclingFigures} figures detected` 
            : '';
          setExtractionProgress(
            `✓ ${extractionResult.totalPages} pages extracted with Docling` +
            tableInfo + figureInfo
          )
        } else if (extractionResult.metadata.visionPages > 0) {
          setExtractionProgress(
            `✓ ${extractionResult.metadata.pdfJsPages} pages extracted\n` +
            `✓ ${extractionResult.metadata.visionPages} pages enhanced with AI vision`
          )
        } else {
          setExtractionProgress(`✓ All ${extractionResult.totalPages} pages extracted successfully`)
        }

        const { content, pdfData, totalPages, pageTexts, needsOCR, ocrStatus, extractionMethod, visionPagesUsed } = extractionResult;

        // Determine document type based on file extension
        const docType = fileExt === 'pdf' ? 'pdf' as const : 
                        ['docx', 'pptx', 'xlsx'].includes(fileExt) ? 'document' as const :
                        ['png', 'jpg', 'jpeg', 'tiff', 'bmp'].includes(fileExt) ? 'image' as const :
                        'pdf' as const;

        const document = {
          id: crypto.randomUUID(),
          name: file.name,
          content,
          type: docType,
          uploadedAt: new Date(),
          pdfData,
          totalPages,
          pageTexts,
          needsOCR,
          ocrStatus: ocrStatus as 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined',
          extractionMethod, // Add extraction method for UI badges
          visionPages: visionPagesUsed,
          sourceFormat: fileExt // Track original file format
        }
        
        // Check if we should show OCR dialog (auto-approve if session setting is enabled)
        const autoApproveOCR = sessionStorage.getItem('ocr_auto_approve') === 'true';
        
        if (needsOCR && !autoApproveOCR) {
          // Store document data and show OCR consent dialog
          setOcrPendingData({ document, file, saveToLibrary });
          setShowOCRDialog(true);
          setLoading(false);
          return; // Wait for user consent
        }
        
        logger.info('PDF document processed successfully', context, {
          documentId: document.id,
          totalPages,
          contentLength: content.length,
          pageTextsCount: pageTexts.length,
          pageTextsPreview: pageTexts.slice(0, 3).map((text, i) => {
            const safeText = typeof text === 'string' ? text : String(text || '')
            return {
              page: i + 1,
              textLength: safeText.length,
              textPreview: safeText.substring(0, 50) + (safeText.length > 50 ? '...' : '')
            }
          })
        });
        
        // CRITICAL: Save to database FIRST (if saveToLibrary is checked) to get the database ID
        // This ensures the document has the correct ID before being added to the store
        // Otherwise, highlights/notes will fail with "Book not found" because they use document.id
        let saveSucceeded = !saveToLibrary; // If saveToLibrary is false, consider it "succeeded" (no save needed)
        if (saveToLibrary) {
          await trackPerformance('saveToLibrary', async () => {
            try {
              // Double-check authentication before saving
              if (!user?.id) {
                throw new Error('User authentication lost. Please sign in again and try uploading.');
              }

              // Ensure service is initialized
              supabaseStorageService.setCurrentUser(user.id)

              logger.info('Saving PDF to Supabase', context, {
                documentId: document.id,
                userId: user.id,
                fileName: file.name,
                totalPages
              });

              // Save to Supabase (primary storage) and get the database-generated ID
              const databaseId = await supabaseStorageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'pdf',
                savedAt: new Date(),
                totalPages,
                fileData: pdfData,
                pageTexts, // Include pageTexts for TTS functionality
              })
              
              // CRITICAL: Update document with database ID if different
              if (databaseId !== document.id) {
                console.log('🔄 Updating document ID from', document.id, 'to database ID:', databaseId);
                document.id = databaseId as typeof document.id;
              }
              
              // Store extracted text for vector search and graph generation
              if (user?.id && pageTexts.length > 0) {
                const fullText = pageTexts.join('\n\n');
                documentContentService.storeDocumentContent(
                  databaseId,
                  user.id,
                  fullText,
                  'pdfjs'
                ).catch(error => {
                  logger.warn('Failed to store document content', { documentId: databaseId }, error);
                  // Don't fail the upload if content storage fails
                });
              }
              saveSucceeded = true; // Mark save as succeeded
              
              logger.info('Document saved to Supabase', context, {
                documentId: databaseId
              });
              
              // Try to save to localStorage as backup (optional)
              try {
                await storageService.saveBook({
                  id: databaseId, // Use database ID for consistency
                  title: document.name,
                  fileName: file.name,
                  type: 'pdf',
                  savedAt: new Date(),
                  totalPages,
                  fileData: pdfData,
                  pageTexts, // Include pageTexts for TTS functionality
                })
                
                logger.info('Document saved to local library (backup)', context, {
                  documentId: databaseId
                });
              } catch (localStorageError) {
                // localStorage backup failed, but Supabase succeeded - this is OK
                logger.warn('localStorage backup failed, but Supabase save succeeded', context, localStorageError as Error);
              }
              
              // Trigger library refresh
              console.log('DocumentUpload: Calling refreshLibrary() after successful PDF save')
              refreshLibrary();
              
              // Refresh related documents graph for currently viewed document
              console.log('DocumentUpload: Calling refreshRelatedDocuments() after successful PDF save')
              refreshRelatedDocuments();
              
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
              // Save failed - don't add document to store if saveToLibrary was requested
              const error = err instanceof Error ? err : new Error('Unknown error occurred while saving');
              // #region agent log
              (() => {
                try {
                  const isDev = !!(import.meta as any)?.env?.DEV;
                  if (!isDev) return;
                  fetch('/api/debug/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      location: 'DocumentUpload.tsx:353',
                      message: 'Save to library failed',
                      data: {
                        errorMessage: error.message,
                        errorName: error.name,
                        errorStack: error.stack?.substring(0, 500),
                        userId: user?.id,
                        hasUser: !!user,
                        documentId: document.id,
                        fileName: file.name,
                        fileSize: file.size,
                      },
                      timestamp: Date.now(),
                      sessionId: 'debug-session',
                      runId: 'run1',
                      hypothesisId: 'A',
                    }),
                  }).catch(() => {});
                } catch {
                  // swallow
                }
              })();
              // #endregion
              logger.error('Failed to save PDF to library', context, error, {
                errorMessage: error.message,
                errorStack: error.stack,
                userId: user?.id
              });
              saveSucceeded = false;
              
              // Provide user-friendly error message
              let userMessage = 'Failed to save document to library. ';
              if (error.message.includes('authenticated') || error.message.includes('authentication')) {
                userMessage += 'Please sign in and try again.';
              } else if (error.message.includes('bucket') || error.message.includes('storage')) {
                userMessage += 'Storage service error. Please try again or contact support.';
              } else if (error.message.includes('database') || error.message.includes('RLS')) {
                userMessage += 'Database error. Please try again or contact support.';
              } else {
                userMessage += error.message || 'Please try again.';
              }
              
              setError(userMessage);
              // Don't throw - we'll check saveSucceeded below
            }
          }, context);
        }
        
        // CRITICAL: Only add document to store if save succeeded (or saveToLibrary was false)
        // This prevents adding documents with wrong IDs that will cause foreign key errors
        if (saveSucceeded) {
          addDocument(document, setAsCurrentDocument)
          resultingDocumentId = document.id
          // Dispatch custom event for onboarding to detect upload completion
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('document-uploaded', { 
              detail: { documentId: document.id } 
            }))
          }
        } else {
          // Save failed and saveToLibrary was true - don't add document
          logger.warn(
            'Not adding document to store because save failed',
            context,
            undefined,
            {
              documentId: document.id,
              documentName: document.name
            }
          );
          throw new Error('Failed to save document to library. Please try again.');
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
        
        logger.info('Text document processed successfully', context, {
          documentId: document.id,
          contentLength: content.length
        });
        
        // CRITICAL: Save to database FIRST (if saveToLibrary is checked) to get the database ID
        // This ensures the document has the correct ID before being added to the store
        let saveSucceeded = !saveToLibrary; // If saveToLibrary is false, consider it "succeeded" (no save needed)
        if (saveToLibrary) {
          await trackPerformance('saveToLibrary', async () => {
            try {
              // Double-check authentication before saving
              if (!user?.id) {
                throw new Error('User authentication lost. Please sign in again and try uploading.');
              }

              // Ensure service is initialized
              supabaseStorageService.setCurrentUser(user.id)

              logger.info('Saving text file to Supabase', context, {
                documentId: document.id,
                userId: user.id,
                fileName: file.name
              });

              // Save to Supabase (primary storage) and get the database-generated ID
              const databaseId = await supabaseStorageService.saveBook({
                id: document.id,
                title: document.name,
                fileName: file.name,
                type: 'text',
                savedAt: new Date(),
                fileData: content,
              })
              
              // CRITICAL: Update document with database ID if different
              if (databaseId !== document.id) {
                console.log('🔄 Updating document ID from', document.id, 'to database ID:', databaseId);
                document.id = databaseId as typeof document.id;
              }
              
              // Store text content for vector search and graph generation
              if (user?.id && content.length > 0) {
                documentContentService.storeDocumentContent(
                  databaseId,
                  user.id,
                  content,
                  'manual'
                ).catch(error => {
                  logger.warn('Failed to store document content', { documentId: databaseId }, error);
                  // Don't fail the upload if content storage fails
                });
              }
              
              saveSucceeded = true; // Mark save as succeeded
              
              logger.info('Document saved to Supabase', context, {
                documentId: databaseId
              });
              
              // Try to save to localStorage as backup (optional)
              try {
                await storageService.saveBook({
                  id: databaseId, // Use database ID for consistency
                  title: document.name,
                  fileName: file.name,
                  type: 'text',
                  savedAt: new Date(),
                  fileData: content,
                })
                
                logger.info('Document saved to local library (backup)', context, {
                  documentId: databaseId
                });
              } catch (localStorageError) {
                // localStorage backup failed, but Supabase succeeded - this is OK
                logger.warn('localStorage backup failed, but Supabase save succeeded', context, localStorageError as Error);
              }
              
              // Trigger library refresh
              console.log('DocumentUpload: Calling refreshLibrary() after successful text save')
              refreshLibrary();
              
              // Refresh related documents graph for currently viewed document
              console.log('DocumentUpload: Calling refreshRelatedDocuments() after successful text save')
              refreshRelatedDocuments();
            } catch (err) {
              // Save failed - don't add document to store if saveToLibrary was requested
              const error = err instanceof Error ? err : new Error('Unknown error occurred while saving');
              logger.error('Failed to save text file to library', context, error, {
                errorMessage: error.message,
                errorStack: error.stack,
                userId: user?.id
              });
              saveSucceeded = false;
              
              // Provide user-friendly error message
              let userMessage = 'Failed to save document to library. ';
              if (error.message.includes('authenticated') || error.message.includes('authentication')) {
                userMessage += 'Please sign in and try again.';
              } else if (error.message.includes('bucket') || error.message.includes('storage')) {
                userMessage += 'Storage service error. Please try again or contact support.';
              } else if (error.message.includes('database') || error.message.includes('RLS')) {
                userMessage += 'Database error. Please try again or contact support.';
              } else {
                userMessage += error.message || 'Please try again.';
              }
              
              setError(userMessage);
              // Don't throw - we'll check saveSucceeded below
            }
          }, context);
        }
        
        // CRITICAL: Only add document to store if save succeeded (or saveToLibrary was false)
        // This prevents adding documents with wrong IDs that will cause foreign key errors
        if (saveSucceeded) {
          addDocument(document, setAsCurrentDocument)
        } else {
          // Save failed and saveToLibrary was true - don't add document
          logger.warn(
            'Not adding document to store because save failed',
            context,
            undefined,
            {
              documentId: document.id,
              documentName: document.name
            }
          );
          throw new Error('Failed to save document to library. Please try again.');
        }
      }
      
      // Call the upload complete callback if provided
      if (resultingDocumentId && onUploadComplete) {
        console.log('DocumentUpload: Calling onUploadComplete with document:', resultingDocumentId);
        onUploadComplete(resultingDocumentId);
      }
      
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process file');
      logger.error('File upload failed', context, error, {
        errorMessage: error.message,
        errorStack: error.stack,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: user?.id
      });
      
      await errorHandler.handleError(error, context);
      
      // Provide user-friendly error message
      let userMessage = error.message;
      if (error.message.includes('authenticated') || error.message.includes('authentication')) {
        userMessage = 'You must be signed in to upload documents. Please sign in and try again.';
      } else if (error.message.includes('Failed to save document to library')) {
        // Keep the specific error message from save failures
        userMessage = error.message;
      } else if (!userMessage || userMessage === 'Failed to process file') {
        userMessage = 'Failed to process file. Please check the file format and try again.';
      }
      
      setError(userMessage);
    } finally {
      setLoading(false)
    }
  }, [user, saveToLibrary, setAsCurrentDocument, addDocument, setLoading, refreshLibrary, refreshRelatedDocuments, onUploadComplete, onClose])

  // Store handleFile in ref for event listener
  useEffect(() => {
    handleFileRef.current = handleFile
  }, [handleFile])

  // Listen for file drop events from EmptyState
  useEffect(() => {
    const handleFileDrop = (event: CustomEvent) => {
      const file = event.detail?.file
      if (file instanceof File && handleFileRef.current) {
        handleFileRef.current(file)
      }
    }

    window.addEventListener('app:upload-file', handleFileDrop as EventListener)
    return () => {
      window.removeEventListener('app:upload-file', handleFileDrop as EventListener)
    }
  }, [])

  // Handle OCR consent approval
  const handleOCRApprove = async () => {
    if (!ocrPendingData) return;

    const { document, file, saveToLibrary: shouldSave } = ocrPendingData;
    const context = {
      component: 'DocumentUpload',
      action: 'handleOCRApprove'
    };
    
    try {
      setShowOCRDialog(false);
      setLoading(true);

      // CRITICAL: Save to database FIRST (if saveToLibrary is checked) to get the database ID
      if (shouldSave) {
        // Double-check authentication before saving
        if (!user?.id) {
          throw new Error('User authentication lost. Please sign in again and try uploading.');
        }

        // Ensure service is initialized
        supabaseStorageService.setCurrentUser(user.id)

        logger.info('OCR Approve: Saving PDF to Supabase', context, {
          documentId: document.id,
          userId: user.id,
          fileName: file.name
        });

        const databaseId = await supabaseStorageService.saveBook({
          id: document.id,
          title: document.name,
          fileName: file.name,
          type: 'pdf',
          fileData: document.pdfData,
          totalPages: document.totalPages,
          pageTexts: document.pageTexts,
          savedAt: new Date()
        });
        
        // CRITICAL: Update document with database ID if different
        if (databaseId !== document.id) {
          console.log('🔄 OCR Approve: Updating document ID from', document.id, 'to database ID:', databaseId);
          document.id = databaseId as typeof document.id;
        }
        
        console.log('DocumentUpload: Calling refreshLibrary() after OCR approval')
        refreshLibrary();
      }
      
      // CRITICAL: Add document to store AFTER saving (so it has the correct database ID)
      // Document has OCR status set to 'pending'
      addDocument(document, setAsCurrentDocument);
      // Dispatch custom event for onboarding to detect upload completion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-uploaded', { 
          detail: { documentId: document.id } 
        }))
      }

      // Call OCR API endpoint
      // This will be polled in PDFViewer component
      setOcrPendingData(null);
      onClose();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      logger.error('OCR approval failed', context, err, {
        errorMessage: err.message,
        errorStack: err.stack,
        userId: user?.id
      });
      
      // Provide user-friendly error message
      let userMessage = 'Failed to process OCR request. ';
      if (err.message.includes('authenticated') || err.message.includes('authentication')) {
        userMessage += 'Please sign in and try again.';
      } else if (err.message.includes('bucket') || err.message.includes('storage')) {
        userMessage += 'Storage service error. Please try again or contact support.';
      } else if (err.message.includes('database') || err.message.includes('RLS')) {
        userMessage += 'Database error. Please try again or contact support.';
      } else {
        userMessage += err.message || 'Please try again.';
      }
      
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle OCR consent decline
  const handleOCRDecline = async () => {
    if (!ocrPendingData) return;

    const { document, file, saveToLibrary: shouldSave } = ocrPendingData;

    try {
      setShowOCRDialog(false);
      setLoading(true);

      // Update document status to 'user_declined'
      document.ocrStatus = 'user_declined';

      // CRITICAL: Save to database FIRST (if saveToLibrary is checked) to get the database ID
      if (shouldSave) {
        const databaseId = await supabaseStorageService.saveBook({
          id: document.id,
          title: document.name,
          fileName: file.name,
          type: 'pdf',
          fileData: document.pdfData,
          totalPages: document.totalPages,
          pageTexts: document.pageTexts,
          savedAt: new Date()
        });
        
        // CRITICAL: Update document with database ID if different
        if (databaseId !== document.id) {
          console.log('🔄 OCR Decline: Updating document ID from', document.id, 'to database ID:', databaseId);
          document.id = databaseId as typeof document.id;
        }
        
        refreshLibrary();
      }
      
      // CRITICAL: Add document to store AFTER saving (so it has the correct database ID)
      // Document has OCR status set to 'user_declined' (with limited text)
      addDocument(document, setAsCurrentDocument);
      // Dispatch custom event for onboarding to detect upload completion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-uploaded', { 
          detail: { documentId: document.id } 
        }))
      }

      setOcrPendingData(null);
      onClose();
    } catch (error) {
      logger.error('OCR decline failed', { component: 'DocumentUpload' }, error as Error);
      setError('Failed to save document');
    } finally {
      setLoading(false);
    }
  };

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

      // Use globalThis.pdfjsLib if available (set in main.tsx), otherwise try dynamic import
      let pdfjsLib: any
      let getDocument: any
      
      if (typeof globalThis !== 'undefined' && (globalThis as any).pdfjsLib) {
        // Use the globally initialized PDF.js library
        pdfjsLib = (globalThis as any).pdfjsLib
        getDocument = pdfjsLib.getDocument
        
        // Verify getDocument exists
        if (!getDocument || typeof getDocument !== 'function') {
          logger.warn('globalThis.pdfjsLib exists but getDocument is missing, falling back to dynamic import', context, {
            pdfjsLibType: typeof pdfjsLib,
            hasGetDocument: !!getDocument,
            pdfjsLibKeys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 15) : []
          } as any)
          
          // Fallback to dynamic import
          const pdfjsModule = await import('pdfjs-dist')
          pdfjsLib = pdfjsModule.default || pdfjsModule
          getDocument = pdfjsLib.getDocument || pdfjsModule.getDocument
          logger.info('Using dynamic import fallback for PDF extraction', context)
        } else {
          logger.info('Using globalThis.pdfjsLib for PDF extraction', context, {
            hasGetDocument: typeof getDocument === 'function'
          } as any)
        }
      } else {
        // Fallback to dynamic import if globalThis.pdfjsLib is not available
        const pdfjsModule = await import('pdfjs-dist')
        pdfjsLib = pdfjsModule.default || pdfjsModule
        getDocument = pdfjsLib.getDocument || pdfjsModule.getDocument
        logger.info('Using dynamic import for PDF extraction', context)
      }
      
      if (!getDocument || typeof getDocument !== 'function') {
        logger.error('PDF.js module structure', context, {
          hasGlobalThis: !!(typeof globalThis !== 'undefined' && (globalThis as any).pdfjsLib),
          pdfjsLibType: typeof pdfjsLib,
          hasGetDocument: !!getDocument,
          pdfjsLibKeys: pdfjsLib ? Object.keys(pdfjsLib).slice(0, 15) : [],
          pdfjsLibHasGetDocument: pdfjsLib ? typeof pdfjsLib.getDocument : 'N/A'
        } as any)
        throw new Error('getDocument function not found in PDF.js module')
      }
      
      // Set up PDF.js worker
      configurePDFWorker(pdfjsLib)
      
      logger.info('PDF.js worker configured', context);
      
      // Store the file as a Blob to avoid ArrayBuffer detachment issues
      const fileBlob = new Blob([file], { type: 'application/pdf' })
      
      // For initial processing, read the file
      const arrayBuffer = await file.arrayBuffer()
      
      // Load the PDF document for text extraction
      const pdf = await getDocument({ data: arrayBuffer }).promise
      
      logger.info('PDF document loaded', context, {
        totalPages: pdf.numPages
      });
      
      let fullText = ''
      const pageTexts: string[] = []
      let successfulPages = 0
      let failedPages = 0
      
      // Extract text from each page with proper structure
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          
          // Use structured extraction to maintain reading order and paragraph breaks
          const pageText = extractStructuredText(textContent.items)
          
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
      
      // Detect if OCR is needed (scanned/non-searchable PDF)
      const avgTextPerPage = fullText.length / pdf.numPages;
      const textDensity = avgTextPerPage / 500; // Assuming ~500 chars is normal per page
      const needsOCR = fullText.length < 100 || textDensity < 0.1;
      
      logger.info('OCR detection results', context, {
        extractedTextLength: fullText.length,
        avgTextPerPage,
        textDensity,
        needsOCR
      });
      
      // Store the blob directly - PDFViewer will convert to blob URL
      return {
        content: fullText.trim() || 'PDF loaded successfully. Text extraction may be limited for some PDFs.',
        pdfData: fileBlob,
        totalPages: pdf.numPages,
        pageTexts,
        needsOCR,
        ocrStatus: needsOCR ? 'pending' : 'not_needed'
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
    <div
      className={`fixed inset-0 flex items-start justify-center pt-20 pb-8 px-4 overflow-y-auto ${zIndexClass}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div className="rounded-xl shadow-xl max-w-2xl w-full mx-4 animate-scale-in my-auto" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
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
              accept={ACCEPTED_FILE_TYPES}
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

          {extractionProgress && (
            <div 
              className="mt-4 p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgb(34, 197, 94)',
              }}
            >
              <pre className="text-sm whitespace-pre-wrap" style={{ color: 'rgb(34, 197, 94)' }}>{extractionProgress}</pre>
            </div>
          )}

          <div className="mt-6" style={{ color: 'var(--color-text-secondary)' }}>
            <p className="text-caption font-medium mb-2">Supported formats:</p>
            <ul className="space-y-1 text-caption">
              <li>• PDF documents (.pdf)</li>
              <li>• Text files (.txt, .md)</li>
              {FEATURES.docExtractionV2 && (
                <>
                  <li>• Word documents (.doc, .docx)</li>
                  <li>• PowerPoint presentations (.ppt, .pptx)</li>
                  <li>• Excel spreadsheets (.xls, .xlsx)</li>
                  <li>• OpenDocument (.odt, .ods, .odp)</li>
                  <li>• E-books and rich text (.epub, .rtf, .csv)</li>
                </>
              )}
            </ul>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {FEATURES.docExtractionV2
                ? 'PDFs use a multi-tier pipeline with AI vision enhancement for low-quality pages. Office and e-book formats are converted server-side.'
                : 'PDFs use a multi-tier extraction pipeline with AI vision enhancement for low-quality pages. Word, PowerPoint and Excel support is coming — convert to PDF for now.'}
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
      
      {/* OCR Consent Dialog */}
      {showOCRDialog && ocrPendingData && (
        <OCRConsentDialog
          isOpen={showOCRDialog}
          onClose={() => {
            setShowOCRDialog(false);
            setOcrPendingData(null);
            onClose();
          }}
          onApprove={handleOCRApprove}
          onDecline={handleOCRDecline}
          pageCount={ocrPendingData.document?.totalPages || 0}
          estimatedCredits={calculateOCRCredits(ocrPendingData.document?.totalPages || 0, userProfile.tier)}
          userTier={userProfile.tier}
          remainingOCRs={userProfile.ocr_count_monthly || 0}
          userCredits={userProfile.credits || 0}
        />
      )}
    </div>
  )
}


