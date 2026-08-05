/**
 * Markdown → plain text, for the text-to-speech path.
 *
 * ## Why this exists
 *
 * Both replacement extractors emit GFM, but `pageTexts[]` feeds TTS via
 * `useAudioText.ts`. Unstripped markup is read aloud verbatim: a page
 * beginning
 *
 *     ## B TABLE QUICK REFERENCE
 *     |Migration|Name|Description|
 *     |---|---|---|
 *
 * becomes *"hash hash B TABLE QUICK REFERENCE, pipe Migration pipe Name pipe
 * Description, pipe dash dash dash"*. That output is real — it came from
 * `@firecrawl/pdf-inspector` v1.12.0 against a PDF already in this repo — and
 * `@firecrawl/anydoc` renders CSV to a GFM table the same way.
 *
 * The existing cleanup at `api/utils/index.ts:31-82` does not help: it strips
 * publication boilerplate (DOI, ISSN, copyright lines), knows nothing about
 * markup, and runs per-page over the network at 15-way concurrency. Stripping
 * belongs here, synchronously, at the single point where extractor output
 * becomes `pageTexts`.
 *
 * ## Scope
 *
 * This is deliberately a lightweight lexical pass, not a CommonMark parser.
 * The input is machine-generated GFM from a known set of extractors, and the
 * output is consumed by a speech synthesiser — so "reads correctly aloud"
 * matters and "round-trips to an identical AST" does not. `marked` is
 * available as a dependency, but routing through HTML and back would cost a
 * parse plus a DOM strip per page for output nobody renders.
 *
 * Structure is preserved as punctuation rather than discarded: table rows
 * become comma-joined cells so a row is spoken as a sentence instead of a
 * stream of pipes.
 */

/** Matches a GFM table delimiter row, e.g. `| --- | :--: |`. */
const TABLE_DELIMITER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/

/** Matches any line that looks like a GFM table row. */
const TABLE_ROW = /^\s*\|.*\|\s*$/

/**
 * Convert one GFM table row into comma-joined cell text.
 * `| 001 | initial_schema |` → `001, initial_schema`
 */
function tableRowToSentence(line: string): string {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(', ')
}

/** Strip inline markup from a single line of text. */
function stripInline(text: string): string {
  return (
    text
      // Images first — `![alt](src)` keeps the alt text, which is the only
      // part with spoken value. Must precede links or the leading `!` is left
      // stranded.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links keep their label and drop the target.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Reference-style links: `[label][ref]`
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Autolinks: `<https://example.com>`
      .replace(/<(https?:\/\/[^>]+)>/g, '$1')
      // Inline code — backticks carry no meaning aloud.
      .replace(/`+([^`]*)`+/g, '$1')
      // Bold/italic/strike. Longest markers first so `***x***` and `~~x~~`
      // collapse cleanly rather than leaving orphaned characters.
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/___([^_]+)___/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Underscore italics only when the underscores are word-boundaried, so
      // identifiers such as `page_texts_cleaned` survive intact.
      .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, '$1$2')
      // Escaped punctuation: `\*` → `*`
      .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
  )
}

/**
 * Convert GFM to text suitable for speech synthesis.
 *
 * Safe on `''`, `null`, and `undefined` — extractors legitimately return
 * empty pages, and callers should not have to guard every call site.
 */
export function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return ''

  const out: string[] = []
  let inFence = false

  for (const rawLine of markdown.split(/\r?\n/)) {
    // Fenced code blocks: drop the fences, keep the contents. The code is
    // usually the substance of the page; the backticks never are.
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      out.push(rawLine.trim())
      continue
    }

    let line = rawLine

    // Horizontal rules carry no spoken content.
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push('')
      continue
    }

    // Tables: drop the delimiter row entirely, turn data rows into sentences.
    if (TABLE_DELIMITER.test(line) && line.includes('-')) {
      continue
    }
    if (TABLE_ROW.test(line)) {
      out.push(stripInline(tableRowToSentence(line)))
      continue
    }

    // ATX headings: `## Title` → `Title`
    line = line.replace(/^\s{0,3}#{1,6}\s+/, '')
    // Closing hashes on ATX headings: `## Title ##`
    line = line.replace(/\s+#+\s*$/, '')
    // Blockquote markers, possibly nested: `> > quoted`
    line = line.replace(/^\s*(>\s?)+/, '')
    // Unordered list bullets.
    line = line.replace(/^\s*[-*+]\s+/, '')
    // Ordered list markers — the number is kept because "1." is meaningful
    // when read aloud, unlike a bullet glyph.
    line = line.replace(/^\s*(\d+)[.)]\s+/, '$1. ')
    // GFM task list checkboxes.
    line = line.replace(/^\[[ xX]\]\s+/, '')

    out.push(stripInline(line))
  }

  return (
    out
      .join('\n')
      // Setext headings leave their underline behind once inline markup is
      // gone; drop a line of only `=` or `-` that follows text.
      .replace(/\n[=-]{2,}\n/g, '\n')
      // Collapse runs of blank lines into a single paragraph break so TTS
      // pauses once, not five times.
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
      .join('\n')
      .trim()
  )
}

/**
 * Assertion helper for tests and for a defensive check at the point where
 * `pageTexts` is built. Returns the markers found, so a failure message can
 * say *what* leaked rather than merely that something did.
 */
export function findMarkdownMarkers(text: string): string[] {
  const found: string[] = []
  if (/^\s{0,3}#{1,6}\s/m.test(text)) found.push('heading')
  if (/\*\*|__/.test(text)) found.push('bold')
  if (/^\s*\|.*\|\s*$/m.test(text)) found.push('table-row')
  if (/^\s*(```|~~~)/m.test(text)) found.push('code-fence')
  if (/!\[[^\]]*\]\([^)]*\)/.test(text)) found.push('image')
  if (/\[[^\]]*\]\([^)]*\)/.test(text)) found.push('link')
  return found
}
