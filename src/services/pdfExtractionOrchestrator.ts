/**
 * PDF Extraction Orchestrator
 * 
 * Central service that manages document extraction with multiple strategies:
 * 1. Docling (preferred) - Superior table, formula, and layout extraction
 * 2. PDF.js native extraction (fallback) - Fast, free
 * 3. Gemini Vision fallback (automatic for poor quality pages)
 * 4. GPT-5 Nano OCR (user-initiated for scanned documents)
 */

import { extractStructuredText } from '../utils/pdfTextExtractor';
import { 
  analyzeDocumentQuality, 
  identifyProblematicPages,
  needsFullOCR,
  needsVisionFallback,
  generateQualitySummary,
  type DocumentQualityReport 
} from '../utils/pdfQualityValidator';
import { configurePDFWorker } from '../utils/pdfjsConfig';
import { logger } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';
import {
  processWithDocling,
  isDoclingSupported,
  type DoclingResult,
  type DoclingOptions
} from './doclingService';
import { extractDocument, isAnydocSupported } from './documentExtractionService';
import { FEATURES } from '../config/featureFlags';

export interface ExtractionResult {
  success: boolean
  content: string
  pageTexts: string[]
  totalPages: number
  pdfData?: Blob | ArrayBuffer
  qualityReport: DocumentQualityReport
  extractionMethod: 'pdfjs' | 'hybrid' | 'vision' | 'ocr' | 'docling' | 'anydoc'
  needsOCR: boolean
  ocrStatus: 'not_needed' | 'pending' | 'processing' | 'completed' | 'user_declined'
  visionPagesUsed: number[]
  metadata: {
    pdfJsPages: number
    visionPages: number
    ocrPages: number
    processingTime: number
    qualitySummary: string
    doclingTables?: number
    doclingFigures?: number
  }
}

export interface VisionFallbackOptions {
  enabled: boolean
  userId?: string
  userTier?: string
  documentId?: string
  s3Key?: string
  authToken?: string
}

/**
 * Options for hybrid extraction pipeline
 */
export interface HybridExtractionOptions {
  /** Use Docling as primary extraction method (default: true) */
  useDocling?: boolean
  /** Docling-specific options */
  doclingOptions?: DoclingOptions
  /** Vision fallback options for PDF.js pipeline */
  visionOptions?: VisionFallbackOptions
}

interface PDFExtractionContext {
  component: string
  action: string
  fileName?: string
  fileSize?: number
}

/**
 * Extract text from PDF with intelligent 3-tier fallback
 * This is the main entry point for robust PDF text extraction
 */
export async function extractWithFallback(
  pdfFile: File | ArrayBuffer,
  visionOptions: VisionFallbackOptions = { enabled: false }
): Promise<ExtractionResult> {
  const startTime = Date.now()
  const context: PDFExtractionContext = {
    component: 'PDFExtractionOrchestrator',
    action: 'extractWithFallback',
    fileName: pdfFile instanceof File ? pdfFile.name : 'buffer',
    fileSize: pdfFile instanceof File ? pdfFile.size : (pdfFile as ArrayBuffer).byteLength
  }

  logger.info('Starting 3-tier PDF extraction', context, {
    visionEnabled: visionOptions.enabled,
    userTier: visionOptions.userTier
  })

  try {
    // ========================================
    // TIER 1: PDF.js Native Text Extraction
    // ========================================
    logger.info('Tier 1: Starting PDF.js extraction', context)
    
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
      throw new Error('getDocument function not found in PDF.js module. Check console for module structure.')
    }
    
    // Set up PDF.js worker
    configurePDFWorker(pdfjsLib)
    
    const fileBlob = pdfFile instanceof File 
      ? new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' })
      : new Blob([pdfFile], { type: 'application/pdf' })
    
    const fileArrayBuffer = await fileBlob.arrayBuffer()
    
    logger.info('Loading PDF with PDF.js', context, {
      dataSize: fileArrayBuffer.byteLength,
      workerSrc: pdfjsLib.GlobalWorkerOptions?.workerSrc
    })
    
    const loadingTask = getDocument({ data: fileArrayBuffer })
    const pdf = await loadingTask.promise
    
    const totalPages = pdf.numPages
    const pageTexts: string[] = []
    let fullText = ''
    let successfulPages = 0
    let failedPages = 0

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = extractStructuredText(textContent.items)
        
        pageTexts.push(pageText)
        fullText += pageText + '\n\n'
        successfulPages++
      } catch (pageError) {
        logger.warn(`PDF.js extraction failed for page ${pageNum}`, context, pageError as Error)
        pageTexts.push('')
        fullText += '\n\n'
        failedPages++
      }
    }

    logger.info('Tier 1: PDF.js extraction completed', context, {
      totalPages,
      successfulPages,
      failedPages,
      extractedTextLength: fullText.length
    })

    // ========================================
    // QUALITY ANALYSIS
    // ========================================
    logger.info('Analyzing extraction quality', context)
    const qualityReport = analyzeDocumentQuality(pageTexts)
    const problematicPages = identifyProblematicPages(qualityReport)
    const qualitySummary = generateQualitySummary(qualityReport)

    logger.info('Quality analysis complete', context, {
      overallScore: qualityReport.overallScore,
      problematicPages: problematicPages.length,
      recommendedMethod: qualityReport.extractionMethod
    })

    // ========================================
    // TIER 2: Vision Fallback (if needed and enabled)
    // ========================================
    let visionPagesUsed: number[] = []
    let finalPageTexts = [...pageTexts]
    let extractionMethod = qualityReport.extractionMethod

    if (visionOptions.enabled && needsVisionFallback(qualityReport) && problematicPages.length > 0) {
      logger.info('Tier 2: Triggering vision fallback', context, {
        problematicPages,
        count: problematicPages.length
      })

      try {
        // Call vision extraction API for problematic pages
        const visionResults = await reprocessPagesWithVision(
          fileArrayBuffer,
          problematicPages,
          visionOptions
        )

        // Merge vision results with PDF.js results
        visionResults.forEach((visionText, pageNumber) => {
          if (visionText && visionText.trim().length > 0) {
            finalPageTexts[pageNumber - 1] = visionText
            visionPagesUsed.push(pageNumber)
            logger.info(`Page ${pageNumber} improved with vision extraction`, context, {
              originalLength: pageTexts[pageNumber - 1].length,
              visionLength: visionText.length
            })
          }
        })

        // Update extraction method if vision was used
        if (visionPagesUsed.length > 0) {
          extractionMethod = 'hybrid'
        }

        logger.info('Tier 2: Vision fallback completed', context, {
          pagesImproved: visionPagesUsed.length,
          pageNumbers: visionPagesUsed
        })

      } catch (visionError) {
        logger.error('Tier 2: Vision fallback failed, using PDF.js results', context, visionError as Error)
        // Continue with PDF.js results - graceful degradation
      }
    } else if (!visionOptions.enabled && problematicPages.length > 0) {
      logger.info('Vision fallback available but not enabled', context, {
        problematicPages: problematicPages.length
      })
    }

    // ========================================
    // TIER 3: OCR Detection
    // ========================================
    // Determine if full OCR is needed (scanned PDF or very poor quality)
    const avgTextPerPage = fullText.length / totalPages
    const textDensity = avgTextPerPage / 500
    const needsOCRFlag = needsFullOCR(qualityReport) || fullText.length < 100 || textDensity < 0.1
    const ocrStatus = needsOCRFlag ? 'pending' : 'not_needed'

    if (needsOCRFlag) {
      logger.info('Tier 3: Full OCR recommended', context, {
        textLength: fullText.length,
        textDensity,
        avgTextPerPage
      })
    }

    // ========================================
    // FINALIZE RESULTS
    // ========================================
    // Ensure all pageTexts are strings before joining
    const safePageTexts = finalPageTexts.map(text => typeof text === 'string' ? text : String(text || ''))
    const finalFullText = safePageTexts.join('\n\n').trim()
    const processingTime = Date.now() - startTime

    // Clean up PDF document
    await pdf.destroy()

    const result: ExtractionResult = {
      success: true,
      content: finalFullText || 'PDF loaded successfully. Text extraction may be limited for some PDFs.',
      pageTexts: finalPageTexts,
      totalPages,
      pdfData: fileBlob,
      qualityReport,
      extractionMethod,
      needsOCR: needsOCRFlag,
      ocrStatus,
      visionPagesUsed,
      metadata: {
        pdfJsPages: successfulPages,
        visionPages: visionPagesUsed.length,
        ocrPages: 0, // OCR is separate user-initiated process
        processingTime,
        qualitySummary
      }
    }

    logger.info('PDF extraction completed successfully', context, {
      extractionMethod,
      totalPages,
      visionPages: visionPagesUsed.length,
      needsOCR: needsOCRFlag,
      processingTime
    })

    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logger.error('PDF extraction failed', context, error as Error, {
      errorMessage,
      errorStack,
      fileName: context.fileName,
      fileSize: context.fileSize
    })
    
    const appError = errorHandler.createError(
      `Failed to extract PDF text: ${errorMessage}`,
      ErrorType.PDF_PROCESSING,
      ErrorSeverity.HIGH,
      context,
      { 
        fileName: context.fileName, 
        fileSize: context.fileSize,
        errorDetails: errorMessage,
        errorStack 
      }
    )
    
    throw appError
  }
}

/**
 * Extract text using hybrid pipeline with Docling as primary method
 * 
 * This is the preferred extraction method that provides:
 * - Superior table structure recognition
 * - Better formula/math extraction
 * - Improved multi-column layout handling
 * - Support for more file formats (DOCX, PPTX, XLSX, images)
 * 
 * Falls back to PDF.js if Docling fails or is unavailable.
 * 
 * @param file - File object or ArrayBuffer containing the document
 * @param options - Hybrid extraction options
 * @returns ExtractionResult with extracted content
 */
export async function extractWithHybridPipeline(
  file: File | ArrayBuffer,
  options: HybridExtractionOptions = {}
): Promise<ExtractionResult> {
  const startTime = Date.now()
  const fileName = file instanceof File ? file.name : 'document.pdf'
  const fileSize = file instanceof File ? file.size : (file as ArrayBuffer).byteLength
  
  const context: PDFExtractionContext = {
    component: 'PDFExtractionOrchestrator',
    action: 'extractWithHybridPipeline',
    fileName,
    fileSize
  }

  // Default to using Docling unless explicitly disabled
  const useDocling = options.useDocling !== false

  logger.info('Starting hybrid extraction pipeline', context, {
    useDocling,
    fileType: fileName.split('.').pop()?.toLowerCase()
  })

  // ========================================
  // STRATEGY 1: Try Docling First (if enabled)
  // ========================================
  // When FEATURES.docExtractionV2 is on, office/e-book formats go to anydoc
  // instead of Docling. Docling is excluded from deployment (.vercelignore —
  // the ~4GB Python bundle exceeds Vercel limits), so its branch always 404s
  // and falls through; anydoc is the live replacement. PDFs are handled by
  // Strategy 2 either way — anydoc flattens page boundaries, which would break
  // the page-indexed pageTexts contract.
  const useAnydoc = FEATURES.docExtractionV2 && isAnydocSupported(fileName)

  if (useAnydoc || (useDocling && isDoclingSupported(fileName))) {
    try {
      logger.info(useAnydoc ? 'Attempting anydoc extraction' : 'Attempting Docling extraction', context)

      const doclingResult = useAnydoc
        ? await extractDocument(file as File, fileName)
        : await processWithDocling(file, fileName, {
            enableOcr: options.doclingOptions?.enableOcr ?? true,
            extractTables: options.doclingOptions?.extractTables ?? true,
            preserveLayout: options.doclingOptions?.preserveLayout ?? true,
          })

      if (doclingResult.success && doclingResult.text.trim().length > 0) {
        const processingTime = Date.now() - startTime

        // Page texts must stay markup-free: they feed TTS via useAudioText.
        // documentExtractionService already strips anydoc's Markdown, and
        // Docling returned plain text here, so this stays plain either way.
        const pageTexts = doclingResult.structure.pages.map(p => p.text)

        // Content keeps its structure — chat, notes and search benefit from it.
        const content = doclingResult.markdown || doclingResult.text

        // Create a quality report for Docling results
        // Docling typically produces high-quality output
        const qualityReport: DocumentQualityReport = {
          totalPages: pageTexts.length,
          pageMetrics: pageTexts.map((text, idx) => ({
            pageNumber: idx + 1,
            charCount: text.length,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            lineCount: text.split('\n').length,
            specialCharRatio: 0,
            qualityScore: 95,
            needsVisionFallback: false,
            issues: []
          })),
          overallScore: 95,
          problematicPages: [],
          extractionMethod: useAnydoc ? 'anydoc' : 'docling',
          summary: {
            successfulPages: pageTexts.length,
            poorQualityPages: 0,
            failedPages: 0
          }
        }

        const result: ExtractionResult = {
          success: true,
          content,
          pageTexts,
          totalPages: doclingResult.metadata.pageCount,
          pdfData: file instanceof File ? await file.arrayBuffer() : file,
          qualityReport,
          extractionMethod: useAnydoc ? 'anydoc' : 'docling',
          needsOCR: false,
          ocrStatus: 'not_needed',
          visionPagesUsed: [],
          metadata: {
            pdfJsPages: 0,
            visionPages: 0,
            ocrPages: 0,
            processingTime,
            qualitySummary: `Extracted with Docling: ${doclingResult.metadata.tables} tables, ${doclingResult.metadata.figures} figures detected`,
            doclingTables: doclingResult.metadata.tables,
            doclingFigures: doclingResult.metadata.figures
          }
        }

        logger.info('Docling extraction completed successfully', context, {
          pageCount: result.totalPages,
          tables: doclingResult.metadata.tables,
          figures: doclingResult.metadata.figures,
          contentLength: content.length,
          processingTime
        })

        return result
      } else {
        // Docling returned but with no content - fall through to PDF.js
        logger.warn('Docling extraction returned empty content, falling back to PDF.js', context, undefined, {
          doclingError: doclingResult.error
        })
      }
    } catch (doclingError) {
      // Docling failed - log and fall through to PDF.js
      logger.warn('Docling extraction failed, falling back to PDF.js', context, doclingError as Error)
    }
  } else if (!isDoclingSupported(fileName)) {
    logger.info('File type not supported by Docling, using PDF.js', context, {
      fileType: fileName.split('.').pop()?.toLowerCase()
    })
  }

  // ========================================
  // STRATEGY 2: Fall Back to PDF.js Pipeline
  // ========================================
  logger.info('Using PDF.js fallback extraction', context)
  
  // PDF.js only reads PDFs, so a non-PDF reaching here means the document tier
  // above declined. The message is user-facing (it surfaces in the upload
  // dialog), so it should say what the user can do rather than name the
  // internal component that failed.
  const fileExt = fileName.split('.').pop()?.toLowerCase()
  if (fileExt && fileExt !== 'pdf') {
    const errorMessage = useAnydoc
      ? `Could not extract text from this .${fileExt} file. It may be corrupt, password-protected, or empty.`
      : `.${fileExt.toUpperCase()} files aren't supported yet — please convert to PDF and try again.`

    logger.error('Unsupported file type for fallback', context, new Error(errorMessage))

    throw errorHandler.createError(
      errorMessage,
      ErrorType.PDF_PROCESSING,
      ErrorSeverity.HIGH,
      context,
      { fileName, fileSize, fileType: fileExt, anydocAttempted: useAnydoc }
    )
  }

  // Use the existing PDF.js extraction pipeline
  return extractWithFallback(file, options.visionOptions || { enabled: false })
}

/**
 * Reprocess specific pages with Gemini Vision
 * Calls the server-side vision extraction API
 */
export async function reprocessPagesWithVision(
  pdfData: ArrayBuffer,
  pageNumbers: number[],
  options: VisionFallbackOptions
): Promise<Map<number, string>> {
  const context = {
    component: 'PDFExtractionOrchestrator',
    action: 'reprocessPagesWithVision'
  }

  if (!options.authToken || !options.documentId || !options.s3Key) {
    logger.warn('Vision fallback skipped: missing required options', context, undefined, {
      hasAuthToken: !!options.authToken,
      hasDocumentId: !!options.documentId,
      hasS3Key: !!options.s3Key
    })
    return new Map()
  }

  try {
    logger.info('Vision extraction not yet implemented, skipping', context, {
      pageNumbers,
      count: pageNumbers.length
    })

    // TODO: Implement vision extraction when service is ready
    // Vision extraction requires PDF rendering service setup
    // which is not yet configured for serverless environment
    return new Map()
  } catch (error) {
    logger.error('Vision extraction failed', context, error as Error)
    // Return empty map - graceful degradation
    return new Map()
  }
}

/**
 * Check if vision fallback is available for the user
 */
export async function canUseVisionFallback(
  userId: string,
  pageCount: number,
  authToken: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const response = await fetch('/api/documents/vision-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ userId, pageCount })
    })

    if (!response.ok) {
      return { allowed: false, reason: 'Unable to check vision availability' }
    }

    const data = await response.json()
    return data

  } catch (error) {
    return { allowed: false, reason: 'Vision check failed' }
  }
}

