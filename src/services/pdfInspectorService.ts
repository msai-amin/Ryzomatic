/**
 * Client for the pdf-inspector PDF lane.
 *
 * Two entry points, because the two callers hold the document differently:
 *
 *   inspectPdfFile()   upload — the bytes are in the browser, POST them
 *   inspectPdfByKey()  re-open — the bytes are in S3, send the key instead
 *
 * The second matters: `supabaseStorageService` re-extracts `pageTexts` every
 * time a PDF is opened, because `user_books.page_texts` was dropped in
 * migration 004. Round-tripping a 10 MB PDF back to the server on every open
 * would be a real latency regression, so the server refetches from S3 instead
 * (server↔S3 is far faster than browser↔server) after verifying ownership.
 *
 * ## The markdown split
 *
 * The endpoint returns Markdown per page. `pageTexts` must be plain — TTS reads
 * it aloud — while `content` keeps structure for chat, notes and search. That
 * split is applied here so no caller has to remember it.
 */

import { markdownToPlainText } from '../utils/markdownToPlainText'
import { authService } from './supabaseAuthService'

export interface PdfInspectionResult {
  success: boolean
  /** Dense, length === pageCount. Plain text — safe for TTS. */
  pageTexts: string[]
  /** Markdown, structure intact — for content/chat/search. */
  pageMarkdown: string[]
  pageCount: number
  /** 0-based indices the extractor wants OCR'd. */
  ocrPageIndices: number[]
  /** Human-readable cause per 0-based index, where reported. */
  ocrReasonByIndex: Record<number, string>
  /** 0-based indices no extractor record covered. */
  missingPages: number[]
  pdfType: string
  confidence: number
  hasEncodingIssues: boolean
  isComplexLayout: boolean
  title?: string
  processingTimeMs: number
  error?: string
}

function failed(error: string): PdfInspectionResult {
  return {
    success: false,
    pageTexts: [],
    pageMarkdown: [],
    pageCount: 0,
    ocrPageIndices: [],
    ocrReasonByIndex: {},
    missingPages: [],
    pdfType: 'Unknown',
    confidence: 0,
    hasEncodingIssues: false,
    isComplexLayout: false,
    processingTimeMs: 0,
    error,
  }
}

function adapt(payload: any): PdfInspectionResult {
  const pageMarkdown: string[] = Array.isArray(payload?.pages) ? payload.pages : []
  const pageCount: number = payload?.pageCount ?? pageMarkdown.length

  // Length is asserted rather than assumed: a short array here would shift
  // every page-indexed consumer downstream (useAudioText, PDFViewerV2).
  if (pageMarkdown.length !== pageCount) {
    return failed(
      `Extractor returned ${pageMarkdown.length} pages for a ${pageCount}-page document`
    )
  }

  return {
    success: true,
    pageTexts: pageMarkdown.map((md) => markdownToPlainText(md)),
    pageMarkdown,
    pageCount,
    ocrPageIndices: Array.isArray(payload?.ocrPageIndices) ? payload.ocrPageIndices : [],
    ocrReasonByIndex: payload?.ocrReasonByIndex ?? {},
    missingPages: Array.isArray(payload?.missingPages) ? payload.missingPages : [],
    pdfType: payload?.metadata?.pdfType ?? 'Unknown',
    confidence: payload?.metadata?.confidence ?? 0,
    hasEncodingIssues: Boolean(payload?.metadata?.hasEncodingIssues),
    isComplexLayout: Boolean(payload?.metadata?.isComplexLayout),
    title: payload?.metadata?.title || undefined,
    processingTimeMs: payload?.metadata?.processingTime ?? 0,
  }
}

async function authHeader(): Promise<string | null> {
  const session = await authService.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : null
}

/** Upload path: the browser holds the bytes. Never throws. */
export async function inspectPdfFile(file: File): Promise<PdfInspectionResult> {
  try {
    const auth = await authHeader()
    if (!auth) return failed('Not authenticated')

    const form = new FormData()
    form.append('file', file, file.name)

    const response = await fetch('/api/documents?action=extract', {
      method: 'POST',
      headers: { Authorization: auth },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      return failed(detail?.details || detail?.error || `HTTP ${response.status}`)
    }
    return adapt(await response.json())
  } catch (error: any) {
    return failed(error?.message ?? 'Network error')
  }
}

/** Re-open path: the document is already in S3; send the key, not the bytes. */
export async function inspectPdfByKey(
  s3Key: string,
  documentId: string
): Promise<PdfInspectionResult> {
  try {
    const auth = await authHeader()
    if (!auth) return failed('Not authenticated')

    const url =
      `/api/documents?action=extract` +
      `&s3Key=${encodeURIComponent(s3Key)}` +
      `&documentId=${encodeURIComponent(documentId)}`

    const response = await fetch(url, { method: 'POST', headers: { Authorization: auth } })

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      return failed(detail?.details || detail?.error || `HTTP ${response.status}`)
    }
    return adapt(await response.json())
  } catch (error: any) {
    return failed(error?.message ?? 'Network error')
  }
}
