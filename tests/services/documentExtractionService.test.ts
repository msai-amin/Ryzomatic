/**
 * Tests for documentExtractionService — the client shim for the anydoc lane.
 *
 * The assertion that matters most here is negative: `structure.pages[].text`
 * and `text` must never contain Markdown, because the orchestrator maps
 * `structure.pages[].text` straight into `pageTexts`, and `pageTexts` is what
 * TTS reads aloud (`useAudioText.ts:80`). `markdown` is expected to keep its
 * structure — chat, notes and search consume that field.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }))

vi.mock('../../src/services/supabaseAuthService', () => ({
  authService: { getSession: mockGetSession },
}))

import {
  extractDocument,
  isAnydocSupported,
} from '../../src/services/documentExtractionService'
import { findMarkdownMarkers } from '../../src/utils/markdownToPlainText'

const originalFetch = global.fetch
let mockFetch: ReturnType<typeof vi.fn>

/** Verbatim anydoc v0.1.6 output for tests/fixtures/corpus/table.csv. */
const REAL_ANYDOC_CSV_OUTPUT =
  '| Migration | Name | Description |\n' +
  '| --- | --- | --- |\n' +
  '| 001 | initial_schema | Core tables |\n' +
  '| 002 | add_profile_policy | RLS for profiles |\n'

/**
 * A real File, not a stub — jsdom's FormData.append rejects anything that is
 * not an actual Blob, and the shim builds a FormData for the upload.
 */
const fakeFile = (name: string) => new File(['file contents'], name, { type: 'text/csv' })

beforeEach(() => {
  mockFetch = vi.fn()
  global.fetch = mockFetch as unknown as typeof fetch
  mockGetSession.mockResolvedValue({ access_token: 'tok-123' })
  // FormData exists in jsdom; guard for other environments.
  if (typeof globalThis.FormData === 'undefined') {
    ;(globalThis as any).FormData = class {
      append() {}
    }
  }
})

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('isAnydocSupported', () => {
  it('accepts the office and e-book formats the lane handles', () => {
    for (const f of ['a.docx', 'b.pptx', 'c.xlsx', 'd.odt', 'e.epub', 'f.rtf', 'g.csv', 'h.doc']) {
      expect(isAnydocSupported(f), f).toBe(true)
    }
  })

  it('rejects PDFs — they must stay on the page-indexed pipeline', () => {
    // anydoc flattens PDFs to one Markdown string with no page boundaries,
    // which would break the pageTexts contract 29 modules depend on.
    expect(isAnydocSupported('paper.pdf')).toBe(false)
  })

  it('rejects unknown extensions and is case-insensitive', () => {
    expect(isAnydocSupported('image.png')).toBe(false)
    expect(isAnydocSupported('REPORT.DOCX')).toBe(true)
  })
})

describe('extractDocument — the markdown containment invariant', () => {
  it('keeps markdown in .markdown and plain text in .text and structure.pages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          markdown: REAL_ANYDOC_CSV_OUTPUT,
          metadata: { fileType: 'csv', tableCount: 1 },
        }),
    })

    const result = await extractDocument(fakeFile('table.csv'), 'table.csv')

    expect(result.success).toBe(true)

    // markdown keeps its structure
    expect(result.markdown).toContain('|')

    // ...but nothing that reaches pageTexts may.
    expect(findMarkdownMarkers(result.text)).toEqual([])
    expect(result.text).not.toContain('|')
    expect(result.structure.pages[0].text).toBe(result.text)
    expect(findMarkdownMarkers(result.structure.pages[0].text)).toEqual([])

    // Table structure survives as speakable punctuation.
    expect(result.text).toContain('001, initial_schema, Core tables')
  })

  it('emits a single logical page rather than fabricating pagination', async () => {
    // Word/Excel/CSV have no intrinsic pages. Inventing ~3000-char pseudo-pages
    // would produce page numbers that cannot be cited and that shift whenever
    // the chunker is retuned.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: 'Some text', metadata: { fileType: 'docx' } }),
    })

    const result = await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(result.metadata.pageCount).toBe(1)
    expect(result.structure.pages).toHaveLength(1)
    expect(result.structure.pages[0].pageNumber).toBe(1)
  })

  it('posts to the folded action, not a separate function', async () => {
    // There is no spare Vercel function slot (12/12 on Hobby), so this must
    // stay an action on api/documents.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: 'x', metadata: {} }),
    })

    await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/documents?action=extract')
    expect(mockFetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer tok-123' },
    })
  })
})

describe('extractDocument — declines rather than throws', () => {
  // The orchestrator treats success:false as "this tier declined" and
  // continues its cascade, exactly as it did with Docling's 404s. Throwing
  // would abort extraction entirely.

  it('declines unsupported formats without calling the network', async () => {
    const result = await extractDocument(fakeFile('paper.pdf'), 'paper.pdf')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/unsupported/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('declines when unauthenticated', async () => {
    mockGetSession.mockResolvedValueOnce({ access_token: null })

    const result = await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not authenticated/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('declines on a server error, surfacing the detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Extraction failed', details: 'binary not loadable' }),
    })

    const result = await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(result.success).toBe(false)
    expect(result.error).toBe('binary not loadable')
  })

  it('declines on a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'))

    const result = await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(result.success).toBe(false)
    expect(result.error).toBe('offline')
  })

  it('declines when extraction yields only whitespace', async () => {
    // An empty result must not be reported as success — the orchestrator would
    // accept it and skip the remaining tiers.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: '   \n\n  ', metadata: {} }),
    })

    const result = await extractDocument(fakeFile('a.docx'), 'a.docx')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no text/i)
  })
})
