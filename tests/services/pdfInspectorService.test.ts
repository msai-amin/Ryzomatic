/**
 * Tests for pdfInspectorService — the client adapter for the PDF lane.
 *
 * Two invariants carry the risk of this whole phase:
 *
 *  1. `pageTexts` must be markup-free (TTS reads it) while `pageMarkdown`
 *     keeps its structure.
 *  2. `pageTexts.length` must equal `pageCount`. A short array does not throw;
 *     it silently shifts every page-indexed consumer — `useAudioText.ts:80` and
 *     `PDFViewerV2.tsx:321` both index `[currentPage - 1]`.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))

vi.mock('../../src/services/supabaseAuthService', () => ({
  authService: { getSession: mockGetSession },
}))

import { inspectPdfFile, inspectPdfByKey } from '../../src/services/pdfInspectorService'
import { findMarkdownMarkers } from '../../src/utils/markdownToPlainText'

const originalFetch = global.fetch
let mockFetch: ReturnType<typeof vi.fn>

/** Response shaped like the endpoint's `kind: 'pdf'` payload. */
const pdfPayload = (pages: string[], overrides: Record<string, any> = {}) => ({
  kind: 'pdf',
  pages,
  pageCount: pages.length,
  needsOcrByIndex: pages.map(() => false),
  ocrPageIndices: [],
  ocrReasonByIndex: {},
  missingPages: [],
  metadata: {
    fileName: 'x.pdf',
    fileType: 'pdf',
    pdfType: 'TextBased',
    confidence: 1,
    hasEncodingIssues: false,
    isComplexLayout: false,
    processingTime: 23,
  },
  ...overrides,
})

beforeEach(() => {
  mockFetch = vi.fn()
  global.fetch = mockFetch as unknown as typeof fetch
  mockGetSession.mockResolvedValue({ access_token: 'tok-abc' })
})

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('markdown containment', () => {
  it('strips markup from pageTexts but keeps it in pageMarkdown', async () => {
    // Verbatim pdf-inspector v1.12.0 output against a PDF in this repo.
    const realPage =
      '## B TABLE QUICK REFERENCE\n\n|Migration|Name|\n|---|---|\n|001|initial_schema|\n'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(pdfPayload([realPage, 'Plain second page.'])),
    })

    const r = await inspectPdfFile(new File(['x'], 'x.pdf', { type: 'application/pdf' }))

    expect(r.success).toBe(true)
    expect(r.pageMarkdown[0]).toContain('|')
    expect(findMarkdownMarkers(r.pageTexts[0])).toEqual([])
    expect(r.pageTexts[0]).toContain('001, initial_schema')
  })
})

describe('page alignment — the silent-desync guard', () => {
  it('keeps pageTexts index-aligned with page number', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => `RYZO_PAGE_${i + 1}`)
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(pdfPayload(pages)) })

    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))

    expect(r.pageTexts).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(r.pageTexts[i]).toContain(`RYZO_PAGE_${i + 1}`)
    }
  })

  it('preserves blank interior pages instead of collapsing them', async () => {
    // The gap fixture: dropping the blank page would shift page 3 into slot 1.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(pdfPayload(['RYZO_PAGE_1', '', 'RYZO_PAGE_3'])),
    })

    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))

    expect(r.pageTexts).toHaveLength(3)
    expect(r.pageTexts[1]).toBe('')
    expect(r.pageTexts[2]).toContain('RYZO_PAGE_3')
  })

  it('rejects a response whose page array is short rather than shipping a shift', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...pdfPayload(['a', 'b']), pageCount: 5 }),
    })

    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))

    expect(r.success).toBe(false)
    expect(r.error).toMatch(/2 pages for a 5-page document/)
    expect(r.pageTexts).toEqual([])
  })
})

describe('OCR routing signals', () => {
  it('passes through indices and reasons for the Vision path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          pdfPayload(['a', 'b', 'c'], {
            ocrPageIndices: [1, 2],
            ocrReasonByIndex: { 1: 'image-only page', 2: 'no extractable text' },
          })
        ),
    })

    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))

    expect(r.ocrPageIndices).toEqual([1, 2])
    expect(r.ocrReasonByIndex[1]).toBe('image-only page')
  })
})

describe('inspectPdfByKey — the re-open path', () => {
  it('sends the S3 key as query params instead of re-uploading the file', async () => {
    // Re-uploading a 10MB PDF on every document open would be a real latency
    // regression; the server refetches from S3 after verifying ownership.
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(pdfPayload(['a'])) })

    await inspectPdfByKey('users/u1/doc.pdf', 'doc-42')

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('action=extract')
    expect(url).toContain(`s3Key=${encodeURIComponent('users/u1/doc.pdf')}`)
    expect(url).toContain('documentId=doc-42')
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty('body')
  })
})

describe('declines rather than throws', () => {
  it('declines when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: null })
    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))
    expect(r.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('declines on server error, surfacing the detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Extraction failed', details: 'binary not loadable' }),
    })
    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))
    expect(r.success).toBe(false)
    expect(r.error).toBe('binary not loadable')
  })

  it('declines on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'))
    const r = await inspectPdfFile(new File(['x'], 'x.pdf'))
    expect(r.success).toBe(false)
    expect(r.error).toBe('offline')
  })
})
