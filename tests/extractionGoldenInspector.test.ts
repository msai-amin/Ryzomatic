/**
 * Golden-corpus test for pdf-inspector — the alignment gate for Phase 2.
 *
 * Unlike the service tests, this runs the **real library against real PDFs**.
 * It is the only thing standing between a page-numbering change upstream and a
 * silent TTS/viewer desync in production.
 *
 * The sentinel fixtures encode their own expected answer: page N contains the
 * literal token `RYZO_PAGE_N`. So a failure here means "page N's text landed in
 * slot M", not merely "output changed" — the assertion names the bug.
 *
 * Regenerate fixtures with: node scripts/generate-test-corpus.mjs
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { alignPages, ocrPagesToIndices } from '../src/utils/pageAlignment'

const require = createRequire(import.meta.url)
const CORPUS = join(process.cwd(), 'tests', 'fixtures', 'corpus')

/**
 * The native addon cannot load under some CI runners. Skip rather than fail:
 * a red suite for an environment limitation trains people to ignore red.
 */
let inspector: any = null
try {
  inspector = require('@firecrawl/pdf-inspector')
} catch {
  inspector = null
}

const canRun = inspector !== null && existsSync(join(CORPUS, 'sentinel-5p.pdf'))
const describeIfAvailable = canRun ? describe : describe.skip

describeIfAvailable('pdf-inspector golden corpus', () => {
  const load = (name: string) => readFileSync(join(CORPUS, name))

  describe.each([
    ['sentinel-5p.pdf', 5],
    ['sentinel-30p.pdf', 30],
  ])('%s', (fixture, expectedPages) => {
    it(`reports ${expectedPages} pages`, () => {
      expect(inspector.processPdf(load(fixture)).pageCount).toBe(expectedPages)
    })

    it('emits page records that are 0-based and dense', () => {
      // The feasibility study claimed 1-based and sparse. Measured otherwise.
      // If this ever flips, alignPages absorbs it — but we want to be told.
      const pages = inspector.extractPagesMarkdown(load(fixture)).pages
      expect(pages).toHaveLength(expectedPages)
      pages.forEach((p: any, i: number) => expect(p.page).toBe(i))
    })

    it('places every page at its own index after alignment', () => {
      const bytes = load(fixture)
      const { pageCount } = inspector.processPdf(bytes)
      const { pages } = inspector.extractPagesMarkdown(bytes)

      const aligned = alignPages(pages, pageCount)

      expect(aligned.pageTexts).toHaveLength(expectedPages)
      expect(aligned.missingPages).toEqual([])
      expect(aligned.outOfRangePages).toEqual([])

      for (let i = 0; i < expectedPages; i++) {
        expect(
          aligned.pageTexts[i],
          `page ${i + 1} text landed at the wrong index`
        ).toContain(`RYZO_PAGE_${i + 1}`)
      }
    })
  })

  describe('sentinel-gap-3p.pdf — blank interior page', () => {
    // The dangerous case: an extractor that omits an empty page shifts every
    // later page by one. Invisible until TTS drifts mid-document.
    it('keeps the blank page as a slot rather than dropping it', () => {
      const bytes = load('sentinel-gap-3p.pdf')
      const { pageCount } = inspector.processPdf(bytes)
      const { pages } = inspector.extractPagesMarkdown(bytes)

      const aligned = alignPages(pages, pageCount)

      expect(pageCount).toBe(3)
      expect(aligned.pageTexts).toHaveLength(3)

      // Pages 1 and 3 keep their sentinels; the blank page occupies index 1.
      expect(aligned.pageTexts[0]).toContain('RYZO_PAGE_1')
      expect(aligned.pageTexts[2]).toContain('RYZO_PAGE_3')
      expect(aligned.pageTexts[1]).not.toContain('RYZO_PAGE_3')
    })

    it('flags the blank page for OCR using the 1-based list', () => {
      const bytes = load('sentinel-gap-3p.pdf')
      const { pagesNeedingOcr } = inspector.extractPagesMarkdown(bytes)

      // Measured: [2] — 1-based, denoting the blank page at 0-based index 1.
      expect(pagesNeedingOcr).toContain(2)
      expect(ocrPagesToIndices(pagesNeedingOcr)).toContain(1)
    })
  })

  describe('ocrReasonsByPage shape — an array, not a map', () => {
    // The name suggests a map keyed by page. It is an ARRAY of
    // { page, reasons[] } with a 1-based `page`. Inspecting it as JSON shows
    // numeric keys "0","1" — those are array positions, and reading them as
    // page keys produced "[object Object]" reasons in the quality report.
    it('exposes 1-based page numbers and a reasons array', () => {
      const { pagesNeedingOcr, ocrReasonsByPage } = inspector.extractPagesMarkdown(
        load('sentinel-gap-3p.pdf')
      )

      expect(Array.isArray(ocrReasonsByPage)).toBe(true)

      if (ocrReasonsByPage.length > 0) {
        const entry = ocrReasonsByPage[0]
        expect(entry).toHaveProperty('page')
        expect(entry).toHaveProperty('reasons')
        expect(Array.isArray(entry.reasons)).toBe(true)
        expect(typeof entry.reasons[0]).toBe('string')

        // `page` is 1-based and agrees with pagesNeedingOcr.
        expect(pagesNeedingOcr).toContain(entry.page)
      }
    })
  })

  describe('document metadata', () => {
    it('classifies the clean sentinels as text-based with full confidence', () => {
      const meta = inspector.processPdf(load('sentinel-5p.pdf'))
      expect(meta.pdfType).toBe('TextBased')
      expect(meta.confidence).toBeGreaterThan(0.9)
    })

    it('lowers confidence when a page is unreadable', () => {
      // One blank page in three: the signal that drives OCR routing.
      const meta = inspector.processPdf(load('sentinel-gap-3p.pdf'))
      expect(meta.confidence).toBeLessThan(0.9)
    })
  })
})
