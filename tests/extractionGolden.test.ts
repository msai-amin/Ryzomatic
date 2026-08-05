/**
 * Golden-corpus harness for document extraction.
 *
 * ## What this file is for
 *
 * Before this existed there was no test covering extraction end to end, and
 * no PDF fixtures at all — `tests/pdfExtractionRobustness.test.ts` exercises
 * `pdfQualityValidator` against inline strings. So an extractor swap had no
 * way to prove it had not shifted `pageTexts` by a page, which is the failure
 * that silently desynchronises TTS word-highlighting and viewer page-sync.
 *
 * ## Ground truth, not a baseline diff
 *
 * The migration plan originally called for diffing a candidate extractor
 * against the current PDF.js output. That is weaker than what is here: PDF.js
 * could itself be misaligned, in which case the diff agrees and both are
 * wrong. Instead the sentinel fixtures carry the answer inside the document —
 * page N contains the literal token `RYZO_PAGE_N` — so any extractor can be
 * checked against absolute truth rather than against another extractor.
 *
 * Regenerate fixtures with:  node scripts/generate-test-corpus.mjs
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { alignPages, type ExtractorPage } from '../src/utils/pageAlignment'

const CORPUS = join(__dirname, 'fixtures', 'corpus')
const manifest = JSON.parse(readFileSync(join(CORPUS, 'manifest.json'), 'utf8'))

/** Minimal PDF structural probe — avoids a parser dependency in this layer. */
function readPdf(name: string) {
  const buf = readFileSync(join(CORPUS, name))
  const text = buf.toString('latin1')
  return {
    buf,
    text,
    header: text.slice(0, 8),
    pageObjectCount: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    declaredCount: Number(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/.exec(text)?.[1] ?? -1),
    hasXref: text.includes('\nxref\n'),
    hasStartxref: /startxref\s+\d+/.test(text),
    endsProperly: text.trimEnd().endsWith('%%EOF'),
    sentinels: [...text.matchAll(/RYZO_PAGE_(\d+)/g)].map((m) => Number(m[1])),
  }
}

const pdfFixtures = Object.entries(manifest.fixtures).filter(
  ([, meta]: [string, any]) => meta.kind === 'pdf'
) as Array<[string, any]>

describe('corpus integrity — the fixtures must be trustworthy before anything else is', () => {
  it('manifest lists fixtures that actually exist on disk', () => {
    for (const name of Object.keys(manifest.fixtures)) {
      expect(existsSync(join(CORPUS, name)), `missing fixture: ${name}`).toBe(true)
    }
  })

  it.each(pdfFixtures)('%s is a structurally valid PDF', (name) => {
    const pdf = readPdf(name)
    expect(pdf.header).toBe('%PDF-1.4')
    expect(pdf.hasXref, 'missing xref table').toBe(true)
    expect(pdf.hasStartxref, 'missing startxref').toBe(true)
    expect(pdf.endsProperly, 'missing %%EOF').toBe(true)
  })

  it.each(pdfFixtures)('%s declares the page count the manifest promises', (name, meta) => {
    const pdf = readPdf(name)
    expect(pdf.declaredCount).toBe(meta.pageCount)
    expect(pdf.pageObjectCount).toBe(meta.pageCount)
  })

  it.each(pdfFixtures.filter(([, m]) => m.sentinel))(
    '%s carries one sentinel per non-blank page, in order',
    (name, meta) => {
      const pdf = readPdf(name)
      const blank: number[] = meta.blankPages ?? []
      const expected = Array.from({ length: meta.pageCount }, (_, i) => i + 1).filter(
        (n) => !blank.includes(n)
      )
      expect(pdf.sentinels).toEqual(expected)
    }
  )

  it('fixtures stay small enough to belong in git', () => {
    for (const name of Object.keys(manifest.fixtures)) {
      const bytes = readFileSync(join(CORPUS, name)).length
      expect(bytes, `${name} is ${bytes} bytes`).toBeLessThan(200 * 1024)
    }
  })
})

describe('alignment contract — what any extractor must satisfy to be adoptable', () => {
  /**
   * Simulates an extractor returning 0-based page records, which is what
   * pdf-inspector v1.12.0 was measured to do. This encodes the contract that
   * Phase 2's adapter has to meet; when the real extractor is wired in, the
   * same assertions run against its output instead of this stand-in.
   */
  const asExtractorPages = (pageCount: number, blank: number[] = []): ExtractorPage[] =>
    Array.from({ length: pageCount }, (_, i) => ({
      page: i, // 0-based — verified convention
      markdown: blank.includes(i + 1) ? '' : `RYZO_PAGE_${i + 1}\nbody text for page ${i + 1}`,
      needsOcr: blank.includes(i + 1),
    }))

  it.each(pdfFixtures.filter(([, m]) => m.sentinel))(
    '%s: pageTexts[i] resolves to page i+1',
    (_name, meta) => {
      const blank: number[] = meta.blankPages ?? []
      const { pageTexts, missingPages } = alignPages(
        asExtractorPages(meta.pageCount, blank),
        meta.pageCount
      )

      expect(pageTexts).toHaveLength(meta.pageCount)
      expect(missingPages).toEqual([])

      pageTexts.forEach((text, i) => {
        const pageNumber = i + 1
        if (blank.includes(pageNumber)) {
          expect(text, `page ${pageNumber} should be blank`).toBe('')
        } else {
          expect(text, `pageTexts[${i}] should be page ${pageNumber}`).toContain(
            `RYZO_PAGE_${pageNumber}`
          )
        }
      })
    }
  )

  it('a blank interior page must not pull later pages backwards', () => {
    // sentinel-gap-3p.pdf models this: page 2 is empty, pages 1 and 3 carry
    // sentinels. An extractor that omits blank pages would put RYZO_PAGE_3 at
    // index 1 and desync everything after it.
    const { pageTexts } = alignPages(asExtractorPages(3, [2]), 3)

    expect(pageTexts[0]).toContain('RYZO_PAGE_1')
    expect(pageTexts[1]).toBe('')
    expect(pageTexts[2]).toContain('RYZO_PAGE_3')
  })

  it('detects the off-by-one an extractor using 1-based pages would introduce', () => {
    // The failure this whole corpus exists to catch: the feasibility study and
    // the first draft of the migration plan both asserted pdf-inspector was
    // 1-based. Measurement showed 0-based. Had the adapter been written to the
    // wrong assumption, this is what the corpus would have reported.
    const oneBased: ExtractorPage[] = Array.from({ length: 5 }, (_, i) => ({
      page: i + 1, // WRONG convention
      markdown: `RYZO_PAGE_${i + 1}`,
    }))

    const { pageTexts, missingPages, outOfRangePages } = alignPages(oneBased, 5)

    expect(missingPages).toEqual([0])
    expect(outOfRangePages).toEqual([5])
    expect(pageTexts[0]).not.toContain('RYZO_PAGE_1')
  })
})

describe('markdown leak — the regression that would reach TTS', () => {
  /**
   * Both candidate extractors emit GFM. `pageTexts` feeds TTS via
   * useAudioText, so unstripped markup would be read aloud as
   * "hash hash Migration Reference, pipe Migration pipe Name".
   *
   * Confirmed real: pdf-inspector v1.12.0 produced
   *   "## B TABLE QUICK REFERENCE\n\n# Migration Reference\n\n|Migration|Name|…"
   * from an ordinary PDF in the repo.
   *
   * This is the invariant Phase 1's markdownToPlainText must satisfy. It is
   * asserted here so the requirement exists in the suite before the code does.
   */
  const MARKDOWN_MARKERS = /\*\*|^#{1,6}\s|^\|/m

  it('csv fixture is present as the office-lane leak case', () => {
    const csv = readFileSync(join(CORPUS, 'table.csv'), 'utf8')
    expect(csv.split('\n').filter(Boolean)).toHaveLength(manifest.fixtures['table.csv'].rows)
    // Raw CSV has no markdown; the leak appears only after conversion, which
    // is precisely why the guard belongs on the conversion output.
    expect(csv).not.toMatch(MARKDOWN_MARKERS)
  })

  it('flags markdown that would reach TTS if the guard were absent', () => {
    const leaked = '## B TABLE QUICK REFERENCE\n\n|Migration|Name|\n|---|---|\n'
    expect(leaked).toMatch(MARKDOWN_MARKERS)
  })
})
