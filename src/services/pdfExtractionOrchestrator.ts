/**
 * PDF Extraction Orchestrator
 * 
 * Central service that manages the 3-tier fallback system:
 * 1. PDF.js native extraction (fast, free)
 * 2. Gemini Vision fallback (automatic for poor quality pages)
 * 3. GPT-5 Nano OCR (user-initiated for scanned documents)
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

export interface ExtractionResult {
  success: boolean
  content: string
  pageTexts: string[]
  totalPages: number
  pdfData?: Blob | ArrayBuffer
  qualityReport: DocumentQualityReport
  extractionMethod: 'pdfjs' | 'hybrid' | 'vision' | 'ocr'
  needsOCR: boolean
  ocrStatus: 'not_needed' | 'pending' | 'processing' | 'completed' | 'user_declined'
  visionPagesUsed: number[]
  metadata: {
    pdfJsPages: number
    visionPages: number
    ocrPages: number
    processingTime: number
    qualitySummary: string
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

