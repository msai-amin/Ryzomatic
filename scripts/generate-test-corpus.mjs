#!/usr/bin/env node
/**
 * Deterministic test-corpus generator for extraction work.
 *
 * Run:  node scripts/generate-test-corpus.mjs
 * Out:  tests/fixtures/corpus/
 *
 * Why generate rather than commit opaque binaries: the fixtures encode an
 * assertion (page N contains RYZO_PAGE_N). If they were black-box PDFs
 * downloaded from somewhere, a corpus bug would look identical to an
 * extractor bug. Generated fixtures are auditable, tiny, license-free, and
 * reproducible byte-for-byte.
 *
 * There is no PDF *writer* in the dependency tree (pdfjs-dist reads only),
 * so the PDFs are hand-rolled. They are deliberately minimal but fully
 * spec-valid, including a correct xref table — lopdf (which pdf-inspector
 * uses) is stricter about xref than pdf.js is, so a "most parsers tolerate
 * it" shortcut would produce fixtures that pass one engine and fail the
 * other, which is exactly the confusion this corpus exists to eliminate.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'fixtures', 'corpus')

/* ─── minimal PDF writer ────────────────────────────────────────────────── */

/** Escape a string for a PDF literal string object. */
const lit = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/**
 * Build a single page's content stream.
 * Each page carries its sentinel token plus filler so that extractors have
 * enough text to classify the page as text-based rather than image-only.
 */
function contentStream(lines) {
  const body = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 22 : 12} Tf 72 ${720 - i * 26} Td (${lit(line)}) Tj ET`)
    .join('\n')
  return `${body}\n`
}

/**
 * Assemble a valid single-file PDF.
 *
 * Object layout:
 *   1        Catalog
 *   2        Pages
 *   3        Font (Helvetica, a standard-14 face so no embedding is needed)
 *   4,6,8…   Page objects
 *   5,7,9…   Content streams
 */
function buildPdf(pages) {
  const objects = []          // 1-indexed; objects[0] is object 1
  const pageObjNums = pages.map((_, i) => 4 + i * 2)

  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`)
  objects.push(
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`
  )
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)

  pages.forEach((lines, i) => {
    const contentNum = 5 + i * 2
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>`
    )
    const stream = contentStream(lines)
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`)
  })

  // Serialize, tracking byte offsets for the xref table.
  const chunks = []
  const offsets = []
  let pos = 0
  const push = (s) => {
    const buf = Buffer.from(s, 'latin1')
    chunks.push(buf)
    pos += buf.length
  }

  push('%PDF-1.4\n')
  objects.forEach((body, i) => {
    offsets[i] = pos
    push(`${i + 1} 0 obj\n${body}\nendobj\n`)
  })

  const xrefPos = pos
  const size = objects.length + 1
  // Each entry is exactly 20 bytes: 10-digit offset, 5-digit gen, type, CRLF-ish padding.
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)

  return Buffer.concat(chunks)
}

/** A sentinel PDF: page N (1-based) contains the literal token RYZO_PAGE_N. */
function sentinelPdf(pageCount) {
  const pages = []
  for (let n = 1; n <= pageCount; n++) {
    pages.push([
      `RYZO_PAGE_${n}`,
      `This is page ${n} of ${pageCount} in the Ryzomatic alignment corpus.`,
      `Any extractor that maps this page to index ${n - 1} is correctly aligned.`,
      `Filler line to keep the page classified as text-based rather than image-only.`,
    ])
  }
  return buildPdf(pages)
}

/**
 * A PDF whose interior page carries no text at all.
 *
 * This is the fixture that catches the dangerous failure: an extractor that
 * *skips* empty pages rather than emitting an empty entry silently shifts
 * every later page by one, which is invisible until TTS drifts mid-document.
 */
function gapPdf() {
  return buildPdf([
    ['RYZO_PAGE_1', 'First page, has text.'],
    [' '],                                   // deliberately blank interior page
    ['RYZO_PAGE_3', 'Third page. If this lands at index 1, the extractor dropped a page.'],
  ])
}

/* ─── non-PDF fixtures ──────────────────────────────────────────────────── */

/**
 * CSV exercises the Markdown-leak path: anydoc renders tabular input as a GFM
 * table, so this file's extraction should contain pipes *in `markdown`* and
 * none at all in `pageTexts`.
 */
const CSV = `Migration,Name,Description
001,initial_schema,Core tables
002,add_profile_policy,RLS for profiles
003,storage_buckets,S3 wiring
`

/* ─── main ──────────────────────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true })

const artifacts = [
  ['sentinel-5p.pdf', sentinelPdf(5)],
  ['sentinel-30p.pdf', sentinelPdf(30)],
  ['sentinel-gap-3p.pdf', gapPdf()],
  ['table.csv', Buffer.from(CSV, 'utf8')],
]

for (const [name, buf] of artifacts) {
  writeFileSync(join(OUT, name), buf)
  console.log(`  ${name.padEnd(22)} ${String(buf.length).padStart(7)} bytes`)
}

// Manifest: what each fixture asserts. The test reads this so that adding a
// fixture does not mean editing assertions in two places.
const manifest = {
  generatedBy: 'scripts/generate-test-corpus.mjs',
  note: 'Regenerate with: node scripts/generate-test-corpus.mjs',
  fixtures: {
    'sentinel-5p.pdf': { kind: 'pdf', pageCount: 5, sentinel: true },
    'sentinel-30p.pdf': { kind: 'pdf', pageCount: 30, sentinel: true },
    'sentinel-gap-3p.pdf': {
      kind: 'pdf',
      pageCount: 3,
      sentinel: true,
      blankPages: [2],
      note: 'Page 2 is intentionally blank; pages 1 and 3 carry sentinels.',
    },
    'table.csv': { kind: 'csv', rows: 4, note: 'Markdown-leak fixture for the office lane.' },
  },
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`  manifest.json`)
console.log(`\nCorpus written to tests/fixtures/corpus/`)
