#!/usr/bin/env node
/**
 * Inspect what the extraction engines actually produce for a given document.
 *
 *   npm run try:extract -- path/to/paper.pdf
 *   npm run try:extract -- path/to/report.docx
 *   npm run try:extract              # runs against the sentinel corpus
 *
 * No server, no env vars, no deploy — it calls the libraries directly. Useful
 * when triaging "why did this document extract badly", and as the fastest way
 * to see a new library version's behaviour before wiring it in.
 *
 * It imports the real `markdownToPlainText` rather than approximating it, so
 * the "what TTS reads" output is exactly what ships. Node's native type
 * stripping (22.6+) makes importing the .ts source directly possible.
 *
 * What each section tells you:
 *   ALIGNMENT      whether pageTexts[i] is really page i+1 — the TTS/viewer
 *                  desync risk that `src/utils/pageAlignment.ts` guards
 *   OCR ROUTING    which pages would cost a Gemini Vision call, and why
 *   MARKDOWN GUARD before/after of the strip that keeps TTS from reading "pipe"
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { basename, extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import { markdownToPlainText, findMarkdownMarkers } from '../src/utils/markdownToPlainText.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(ROOT, 'package.json'))

const indent = (text, prefix = '  | ') =>
  String(text).split('\n').map((l) => prefix + l).join('\n')

const rule = (label) => `\n${'='.repeat(66)}\n  ${label}\n${'='.repeat(66)}`

/* ─── PDF lane ──────────────────────────────────────────────────────────── */

function reportPdf(bytes) {
  const inspector = require('@firecrawl/pdf-inspector')

  const started = Date.now()
  const meta = inspector.processPdf(bytes)
  const extracted = inspector.extractPagesMarkdown(bytes)
  const elapsed = Date.now() - started
  const pages = extracted.pages ?? []

  console.log('\nDOCUMENT')
  console.log(`  pages            ${meta.pageCount}`)
  console.log(`  type             ${meta.pdfType}`)
  console.log(`  confidence       ${meta.confidence}`)
  console.log(`  encoding issues  ${meta.hasEncodingIssues}`)
  console.log(`  complex layout   ${meta.isComplexLayout}`)
  if (meta.title) console.log(`  title            ${meta.title}`)
  console.log(`  extracted in     ${elapsed} ms`)

  // The property every page-indexed consumer depends on.
  const dense = pages.length === meta.pageCount && pages.every((p, i) => p.page === i)
  console.log('\nALIGNMENT')
  console.log(`  records          ${pages.length} for ${meta.pageCount} pages`)
  console.log(`  0-based dense    ${dense ? 'YES — safe' : 'NO — alignPages() will leave holes, not shifts'}`)
  if (!dense) {
    const seen = new Set(pages.map((p) => p.page))
    const missing = [...Array(meta.pageCount).keys()].filter((i) => !seen.has(i))
    console.log(`  missing indices  ${JSON.stringify(missing.slice(0, 20))}`)
  }

  console.log('\nOCR ROUTING  (pages that would cost a Gemini Vision call)')
  const needing = extracted.pagesNeedingOcr ?? []
  if (needing.length === 0) {
    console.log('  none — every page read cleanly')
  } else {
    console.log(`  pagesNeedingOcr  ${JSON.stringify(needing)}  (1-based)`)
    console.log(`  0-based indices  ${JSON.stringify(needing.map((n) => n - 1))}`)
    // An ARRAY of { page, reasons[] } with 1-based page — not a map, despite
    // the name. Misreading its array positions as page keys is what produced
    // "[object Object]" reasons before this was corrected.
    for (const entry of extracted.ocrReasonsByPage ?? []) {
      const reasons = (entry.reasons ?? []).join(', ').replace(/_/g, ' ')
      console.log(`  page ${entry.page}          ${reasons}`)
    }
    const pct = ((needing.length / meta.pageCount) * 100).toFixed(0)
    console.log(`  ${needing.length}/${meta.pageCount} pages (${pct}%) — the remainder are Vision calls saved`)
  }

  // Worst case for TTS: whichever page carries the most markup.
  const densest = pages
    .slice()
    .sort(
      (a, b) =>
        ((b.markdown ?? '').match(/[#|*]/g) ?? []).length -
        ((a.markdown ?? '').match(/[#|*]/g) ?? []).length
    )[0]

  if (densest) {
    const raw = (densest.markdown ?? '').slice(0, 420)
    console.log(`\nMARKDOWN GUARD  (page ${densest.page + 1} — densest markup here)`)
    console.log('\n  raw markdown — what TTS would read unguarded:')
    console.log(indent(raw))
    console.log('\n  after markdownToPlainText — what TTS actually reads:')
    console.log(indent(markdownToPlainText(raw)))

    const leaked = findMarkdownMarkers(markdownToPlainText(densest.markdown ?? ''))
    console.log(`\n  leaked markers   ${leaked.length ? leaked.join(', ') + '  ← BUG' : 'none'}`)
  }
}

/* ─── office / e-book lane ──────────────────────────────────────────────── */

async function reportOffice(bytes, ext) {
  const anydoc = require('@firecrawl/anydoc')

  // Format comes from the extension: formatFromBytes returns null for
  // text-based formats such as CSV, which carry no magic bytes.
  const format = anydoc.formatFromExtension(ext)
  if (!format) {
    console.error(`\n  anydoc has no format for .${ext}`)
    process.exitCode = 1
    return
  }

  const started = Date.now()
  const markdown = await anydoc.toMarkdownBytes(bytes, format)
  const elapsed = Date.now() - started

  let blocks = 0
  let tables = 0
  try {
    const doc = await anydoc.toDocument(bytes, format)
    blocks = (doc.blocks ?? []).length
    tables = (doc.blocks ?? []).filter((b) => b?.kind === 'table').length
  } catch {
    // Structured model unavailable for this input; counts stay zero.
  }

  console.log('\nDOCUMENT')
  console.log(`  format           ${format}`)
  console.log(`  markdown chars   ${markdown.length}`)
  console.log(`  blocks           ${blocks}  (tables: ${tables})`)
  console.log(`  extracted in     ${elapsed} ms`)
  console.log('\n  Office formats become ONE logical page: Word/Excel/CSV have no')
  console.log('  intrinsic pagination, so no citable page numbers are invented.')

  const raw = markdown.slice(0, 420)
  console.log('\nMARKDOWN GUARD')
  console.log('\n  raw markdown — what TTS would read unguarded:')
  console.log(indent(raw))
  console.log('\n  after markdownToPlainText — what TTS actually reads:')
  console.log(indent(markdownToPlainText(raw)))

  const leaked = findMarkdownMarkers(markdownToPlainText(markdown))
  console.log(`\n  leaked markers   ${leaked.length ? leaked.join(', ') + '  ← BUG' : 'none'}`)
}

/* ─── entry point ───────────────────────────────────────────────────────── */

async function inspect(target) {
  if (!existsSync(target)) {
    console.error(`not found: ${target}`)
    process.exitCode = 1
    return
  }

  const ext = extname(target).toLowerCase().replace('.', '')
  const bytes = readFileSync(target)
  console.log(rule(`${basename(target)}  (${(bytes.length / 1024).toFixed(0)} KB, .${ext})`))

  try {
    if (ext === 'pdf') reportPdf(bytes)
    else await reportOffice(bytes, ext)
  } catch (error) {
    console.error(`\n  FAILED: ${error.message}`)
    process.exitCode = 1
  }
}

const args = process.argv.slice(2)

if (args.length > 0) {
  for (const target of args) await inspect(target)
} else {
  // No argument: walk the committed corpus so the script is useful with no setup.
  const corpus = join(ROOT, 'tests', 'fixtures', 'corpus')
  if (!existsSync(corpus)) {
    console.error('No corpus found. Run: node scripts/generate-test-corpus.mjs')
    process.exitCode = 1
  } else {
    const fixtures = readdirSync(corpus).filter((f) => /\.(pdf|csv|docx|pptx|xlsx|epub)$/i.test(f))
    console.log(`No file given — inspecting ${fixtures.length} corpus fixtures.`)
    console.log('Pass a path to inspect your own document:  npm run try:extract -- paper.pdf')
    for (const f of fixtures) await inspect(join(corpus, f))
  }
}
