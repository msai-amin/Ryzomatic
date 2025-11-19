/**
 * Gemini Vision Service
 * 
 * Server-side service for PDF page text extraction using Gemini 2.5 Flash Vision
 * Cost-effective vision model for robust text extraction from images
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI (SERVER-SIDE ONLY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface VisionExtractionOptions {
  maxImageWidth?: number // Default: 1024px to save tokens
  temperature?: number // Default: 0.1 for accuracy
  timeout?: number // Default: 30000ms (30s)
}

export interface VisionExtractionResult {
  success: boolean
  extractedText: string
  metadata: {
    pageNumber: number
    tokensUsed: number
    processingTime: number
    confidence?: number
    imageSize: number
    model: string
  }
  error?: string
}

/**
 * Extract text from a PDF page image using Gemini Vision
 * Note: This function expects the page to already be rendered to an image
 */
export async function extractPageWithVision(
  pageImageBase64: string,
  pageNumber: number,
  options: VisionExtractionOptions = {}
): Promise<VisionExtractionResult> {
  const startTime = Date.now()
  const temperature = options.temperature || 0.1
  const timeout = options.timeout || 30000

  try {
    // Call Gemini Vision API
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash' // Using 2.5 flash for cost-effective vision
    })

    const prompt = `Extract all text from this PDF page image. Preserve the layout, paragraphs, and reading order (top-to-bottom, left-to-right). 

For multi-column layouts, process left column first, then right column, separated by "---".

Return ONLY the extracted text without any commentary or explanations.`

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Vision API timeout')), timeout)
    })

    // Race between API call and timeout
    const result = await Promise.race([
      model.generateContent([
        prompt,
        {
          inlineData: {
            data: pageImageBase64,
            mimeType: 'image/png'
          }
        }
      ]),
      timeoutPromise
    ])

    const response = result.response
    const extractedText = response.text()
    const tokensUsed = (response.usageMetadata?.totalTokenCount) || 0
    const processingTime = Date.now() - startTime
    const imageSize = Buffer.from(pageImageBase64, 'base64').length

    return {
      success: true,
      extractedText: extractedText.trim(),
      metadata: {
        pageNumber,
        tokensUsed,
        processingTime,
        imageSize,
        model: 'gemini-2.5-flash'
      }
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    
    return {
      success: false,
      extractedText: '',
      metadata: {
        pageNumber,
        tokensUsed: 0,
        processingTime,
        imageSize: 0,
        model: 'gemini-2.5-flash'
      },
      error: error instanceof Error ? error.message : 'Unknown vision extraction error'
    }
  }
}

/**
 * Extract text from multiple PDF page images using Gemini Vision
 * @param pageImages - Map of page numbers to base64-encoded PNG images
 */
export async function extractPagesWithVision(
  pageImages: Map<number, string>,
  options: VisionExtractionOptions = {}
): Promise<Map<number, VisionExtractionResult>> {
  const results = new Map<number, VisionExtractionResult>()

  // Process pages sequentially to avoid rate limits
  // In production, consider batch processing with concurrency limits
  for (const [pageNumber, imageBase64] of pageImages.entries()) {
    const result = await extractPageWithVision(imageBase64, pageNumber, options)
    results.set(pageNumber, result)
    
    // Small delay between requests to be respectful of API limits
    const pageIndex = Array.from(pageImages.keys()).indexOf(pageNumber)
    if (pageIndex < pageImages.size - 1) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

/**
 * Calculate estimated cost for vision extraction
 * Gemini 2.5 Flash pricing: ~$0.075 per 1M input tokens
 */
export function estimateVisionCost(pageCount: number, avgImageSize: number = 150000): number {
  // Rough estimate: ~10,000 tokens per page for vision input
  const tokensPerPage = 10000
  const totalTokens = pageCount * tokensPerPage
  const costPer1MTokens = 0.075
  
  return (totalTokens / 1000000) * costPer1MTokens
}

/**
 * Check if Gemini Vision is properly configured
 */
export function isVisionConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

