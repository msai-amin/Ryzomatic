/**
 * PDF text extraction via `@firecrawl/pdf-inspector`.
 *
 * Replaces the PDF.js text tier. PDF.js still renders the viewer — this only
 * concerns the text that populates `pageTexts[]`.
 *
 * ## Why replace a working extractor
 *
 * PDF.js emits text in raw content-stream order, which interleaves columns on
 * two-column academic papers — Ryzomatic's core document type. pdf-inspector
 * resolves reading order, detects tables, decodes CID/ToUnicode fonts, and —
 * most valuably — reports *why* a page is unreadable, so OCR can be routed per
 * page instead of inferred from character-count heuristics. Every page it
 * correctly classifies as text-based is a Gemini Vision call not made.
 *
 * ## Index conventions — read `src/utils/pageAlignment.ts` before touching this
 *
 * `extractPagesMarkdown()` returns three different conventions in one object
 * (measured against v1.12.0):
 *
 *   pages[].page      0-based, observed dense
 *   pages[].needsOcr  0-based, parallel to pages[]
 *   pagesNeedingOcr   1-BASED
 *   ocrReasonsByPage  keyed by position within pagesNeedingOcr, not by page
 *
 * The feasibility study asserted `page` was 1-based and sparse. It is not.
 * Implementing that assumption would have shifted every document by one page.
 * All conversions go through `pageAlignment` so the rule lives in one place.
 */

import { alignPages, ocrPagesToIndices, type ExtractorPage } from '../../../src/utils/pageAlignment'

export interface PdfInspectResult {
  /** Dense, length === pageCount. Markdown; caller must strip before TTS. */
  pageMarkdown: string[]
  /** Parallel to pageMarkdown. */
  needsOcrByIndex: boolean[]
  /** 0-based indices needing OCR, reconciled from both signals. */
  ocrPageIndices: number[]
  /** Human-readable OCR cause per 0-based page index, when reported. */
  ocrReasonByIndex: Record<number, string>
  pageCount: number
  /** e.g. 'TextBased' | 'Scanned' | 'Mixed' */
  pdfType: string
  /** 0..1 extraction confidence from the library. */
  confidence: number
  hasEncodingIssues: boolean
  isComplexLayout: boolean
  title?: string
  /** 0-based indices no extractor record covered — holes, never shifts. */
  missingPages: number[]
  processingTimeMs: number
}

/**
 * Extract page-indexed text from a PDF.
 *
 * Throws on failure so the caller can fall back to PDF.js; a partial result
 * would be worse than none, because a short `pageTexts` array desynchronises
 * every page-indexed consumer.
 */
export async function inspectPdf(bytes: Buffer): Promise<PdfInspectResult> {
  const started = Date.now()

  // Required lazily: `api/documents` multiplexes upload, OCR and descriptions
  // into one function to stay under the Vercel Hobby 12-function cap, so a
  // native binary that fails to load must not take the whole endpoint down.
  const inspector = require('@firecrawl/pdf-inspector')

  // Document-level metadata. Its pageCount is authoritative — pages[] is
  // aligned against it rather than trusted to be complete.
  const meta = inspector.processPdf(bytes)
  const pageCount: number = meta?.pageCount ?? 0
  if (!pageCount) {
    throw new Error('pdf-inspector reported zero pages')
  }

  const extracted = inspector.extractPagesMarkdown(bytes)
  const records: ExtractorPage[] = extracted?.pages ?? []

  const aligned = alignPages(records, pageCount)

  // Two OCR signals exist and can disagree: the per-page `needsOcr` flag and
  // the document-level `pagesNeedingOcr` list. Union them — a page either
  // signal flags is a page worth sending to Vision, and a false positive costs
  // one API call while a false negative ships unreadable text to the user.
  const fromList = ocrPagesToIndices(extracted?.pagesNeedingOcr)
  const fromFlags = aligned.needsOcrByIndex
    .map((needs, i) => (needs ? i : -1))
    .filter((i) => i >= 0)
  const ocrPageIndices = [...new Set([...fromList, ...fromFlags])].sort((a, b) => a - b)

  // `ocrReasonsByPage` is keyed by position within `pagesNeedingOcr`, not by
  // page number — re-key it to 0-based page indices so callers never have to
  // know that.
  const ocrReasonByIndex: Record<number, string> = {}
  const reasons = extracted?.ocrReasonsByPage ?? {}
  fromList.forEach((pageIdx, positionInList) => {
    const reason = reasons[String(positionInList)] ?? reasons[positionInList]
    if (reason) ocrReasonByIndex[pageIdx] = String(reason)
  })

  return {
    pageMarkdown: aligned.pageTexts,
    needsOcrByIndex: aligned.needsOcrByIndex,
    ocrPageIndices,
    ocrReasonByIndex,
    pageCount,
    pdfType: meta?.pdfType ?? 'Unknown',
    confidence: typeof meta?.confidence === 'number' ? meta.confidence : 0,
    hasEncodingIssues: Boolean(meta?.hasEncodingIssues),
    isComplexLayout: Boolean(meta?.isComplexLayout),
    title: meta?.title || undefined,
    missingPages: aligned.missingPages,
    processingTimeMs: Date.now() - started,
  }
}
