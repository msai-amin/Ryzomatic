/**
 * Office / e-book extraction via `@firecrawl/anydoc`.
 *
 * Replaces the Docling tier, which is excluded from deployment in
 * `.vercelignore` because its ~4GB Python bundle exceeds Vercel's limits. Every
 * `/api/docling` call 404s, so `.docx`/`.pptx`/`.xlsx` uploads reached the
 * orchestrator's non-PDF branch and threw.
 *
 * anydoc is a 7.6MB Rust addon with no ML models and no external services. It
 * publishes a `linux-x64-gnu` binary matching Vercel's Node runtime (verified)
 * and a `darwin-arm64` one for local development.
 *
 * ## Deliberately not handling PDFs
 *
 * anydoc *can* parse PDFs, but it returns one flat Markdown string with no page
 * boundaries. Ryzomatic's `pageTexts[]` contract is page-indexed and consumed by
 * 29 modules, several of which index `[currentPage - 1]`. Flattening pages would
 * silently desynchronise TTS and viewer page-sync. PDFs stay on the existing
 * pipeline; `@firecrawl/pdf-inspector`, which exposes a page-level API, is the
 * Phase 2 candidate.
 */

/**
 * Extensions anydoc handles that we want to accept. PDF is deliberately absent
 * (see above). Keep in sync with `ACCEPTED_FILE_TYPES` in DocumentUpload.tsx.
 */
const SUPPORTED_EXTENSIONS = new Set([
  'doc', 'docx', 'docm',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'ppsm', 'pot',
  'xls', 'xlsx', 'xlsm', 'xlsb',
  'odt', 'ods', 'odp',
  'rtf', 'epub', 'csv',
])

export interface AnydocExtractResult {
  markdown: string
  /** Rendered document model, when anydoc can produce one. */
  blockCount: number
  tableCount: number
  extension: string
}

export function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? ''
}

export function isAnydocSupported(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(fileName))
}

/**
 * Convert an office/e-book file to Markdown.
 *
 * The anydoc binding is `require`d lazily so that a missing or unloadable
 * platform binary surfaces as a handled 5xx on this one action rather than
 * taking down every other action multiplexed through `api/documents` — upload,
 * OCR and document-description all share this function.
 */
export async function extractWithAnydoc(
  bytes: Buffer,
  fileName: string
): Promise<AnydocExtractResult> {
  const extension = extensionOf(fileName)

  if (!isAnydocSupported(fileName)) {
    throw new Error(`Unsupported format for anydoc extraction: .${extension}`)
  }

  const anydoc = require('@firecrawl/anydoc')

  // Format must come from the extension: `formatFromBytes` returns null for
  // text-based formats such as CSV, which have no magic bytes.
  const format = anydoc.formatFromExtension(extension)
  if (!format) {
    throw new Error(`anydoc could not resolve a format for .${extension}`)
  }

  // Both anydoc entry points are async despite the sync-looking signatures in
  // its README.
  const markdown: string = await anydoc.toMarkdownBytes(bytes, format)

  // The structured model is best-effort: it powers table/figure counts in the
  // quality report, and a failure there should not fail the extraction.
  let blockCount = 0
  let tableCount = 0
  try {
    const doc = await anydoc.toDocument(bytes, format)
    const blocks: Array<{ kind?: string }> = doc?.blocks ?? []
    blockCount = blocks.length
    tableCount = blocks.filter((b) => b?.kind === 'table').length
  } catch {
    // Structured model unavailable for this input; counts stay zero.
  }

  return { markdown: markdown ?? '', blockCount, tableCount, extension }
}
