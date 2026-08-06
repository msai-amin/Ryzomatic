/**
 * Client shim for the anydoc office/e-book extraction lane.
 *
 * Posts to `/api/documents?action=extract` and adapts the response to the
 * `ExtractedDocument` shape, so the orchestrator's Strategy-1 block
 * (`pdfExtractionOrchestrator.ts:394-470`) needs no structural change — only a
 * swap of which function it calls.
 *
 * ## The invariant this file exists to hold
 *
 * The orchestrator splits markup and plain text:
 *
 *     pageTexts = result.structure.pages.map(p => p.text)   // PLAIN
 *     content   = result.markdown || result.text            // markdown
 *
 * `pageTexts` feeds TTS (`useAudioText.ts`), so `structure.pages[].text` and
 * `text` must be markup-free, while `markdown` keeps its structure for chat,
 * notes and search. Every `text` field below therefore goes through
 * `markdownToPlainText`.
 *
 * ## Synthetic pagination
 *
 * anydoc returns one Markdown blob per document — Word, Excel and CSV have no
 * intrinsic pagination. Rather than fabricate page boundaries that would not
 * correspond to anything a user sees, the document is emitted as a single
 * logical page. Consumers that flatten `pageTexts` (notesService, ChatPanel)
 * are unaffected; page-indexed consumers (TTS, viewer) simply see a one-page
 * document, which is honest. Splitting into ~3000-char pseudo-pages was
 * considered and rejected: it invents page numbers that cannot be cited and
 * that would shift if the chunker were ever retuned.
 */

import { markdownToPlainText } from '../utils/markdownToPlainText'
import { authService } from './supabaseAuthService'

/**
 * Result contract for the office/e-book lane.
 *
 * Structurally identical to the old `DoclingResult`, deliberately: the
 * orchestrator's Strategy-1 block was written against this shape, so keeping it
 * meant the Docling→anydoc swap changed which function was called and nothing
 * else. Now that `doclingService` is gone, the type lives with its only
 * remaining producer and carries a name describing what it is rather than which
 * library once produced it.
 */
export interface ExtractedDocument {
  success: boolean
  /** Structure intact — for content, chat, notes and search. */
  markdown: string
  /** Plain text — safe for `pageTexts`, which TTS reads aloud. */
  text: string
  metadata: {
    pageCount: number
    tables: number
    figures: number
    fileType: string
    fileName: string
  }
  structure: {
    pages: Array<{
      pageNumber: number
      text: string
    }>
  }
  error?: string
}

/** Formats handled by the anydoc lane. PDFs stay on the existing pipeline. */
const SUPPORTED_EXTENSIONS = new Set([
  'doc', 'docx', 'docm',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'ppsm', 'pot',
  'xls', 'xlsx', 'xlsm', 'xlsb',
  'odt', 'ods', 'odp',
  'rtf', 'epub', 'csv',
])

export function isAnydocSupported(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(fileName.toLowerCase().split('.').pop() ?? '')
}

function emptyResult(fileName: string, error: string): ExtractedDocument {
  return {
    success: false,
    markdown: '',
    text: '',
    metadata: {
      pageCount: 0,
      tables: 0,
      figures: 0,
      fileType: fileName.toLowerCase().split('.').pop() ?? '',
      fileName,
    },
    structure: { pages: [] },
    error,
  }
}

/**
 * Extract an office/e-book document.
 *
 * Never throws: the orchestrator treats a `success: false` result as "this tier
 * declined" and continues its cascade.
 */
export async function extractDocument(file: File, fileName: string): Promise<ExtractedDocument> {
  if (!isAnydocSupported(fileName)) {
    return emptyResult(fileName, `Unsupported format for document extraction: ${fileName}`)
  }

  try {
    const session = await authService.getSession()
    const token = session?.access_token
    if (!token) {
      return emptyResult(fileName, 'Not authenticated')
    }

    const form = new FormData()
    form.append('file', file, fileName)

    const response = await fetch('/api/documents?action=extract', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      return emptyResult(fileName, detail?.details || detail?.error || `HTTP ${response.status}`)
    }

    const payload = await response.json()
    const markdown: string = payload?.markdown ?? ''
    const text = markdownToPlainText(markdown)

    if (!text.trim()) {
      return emptyResult(fileName, 'Extraction produced no text')
    }

    return {
      success: true,
      markdown,
      text,
      metadata: {
        // One logical page — see "Synthetic pagination" above.
        pageCount: 1,
        tables: payload?.metadata?.tableCount ?? 0,
        figures: 0,
        fileType: payload?.metadata?.fileType ?? '',
        fileName,
      },
      structure: {
        pages: [{ pageNumber: 1, text }],
      },
    }
  } catch (error: any) {
    return emptyResult(fileName, error?.message ?? 'Network error')
  }
}
