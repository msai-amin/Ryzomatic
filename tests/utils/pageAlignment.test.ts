/**
 * Tests for pageAlignment — the module that guards the `pageTexts[i]` ⇄
 * "page i + 1" invariant that TTS word-highlighting and viewer page-sync
 * both depend on.
 *
 * The sparse cases matter more than the happy path: every corpus measured so
 * far returns dense, ordered pages, so a positional `.map()` would pass all
 * realistic fixtures and still corrupt alignment the first time a page fails
 * to parse in production.
 */

import { describe, it, expect } from 'vitest'
import {
  alignPages,
  ocrPagesToIndices,
  indicesToPageNumbers,
  type ExtractorPage,
} from '../../src/utils/pageAlignment'

const page = (n: number, text: string, needsOcr = false): ExtractorPage => ({
  page: n,
  markdown: text,
  needsOcr,
})

describe('alignPages — dense input (the observed case)', () => {
  it('maps 0-based page numbers straight onto array indices', () => {
    const input = [page(0, 'RYZO_PAGE_1'), page(1, 'RYZO_PAGE_2'), page(2, 'RYZO_PAGE_3')]
    const { pageTexts, missingPages } = alignPages(input, 3)

    expect(pageTexts).toEqual(['RYZO_PAGE_1', 'RYZO_PAGE_2', 'RYZO_PAGE_3'])
    expect(missingPages).toEqual([])
  })

  it('holds the load-bearing invariant: pageTexts[i] is the text of page i+1', () => {
    const input = Array.from({ length: 30 }, (_, i) => page(i, `RYZO_PAGE_${i + 1}`))
    const { pageTexts } = alignPages(input, 30)

    pageTexts.forEach((text, i) => {
      expect(text).toBe(`RYZO_PAGE_${i + 1}`)
    })
  })
})

describe('alignPages — sparse input (the case .map() gets wrong)', () => {
  it('leaves a hole rather than shifting later pages when one is dropped', () => {
    // Page index 1 never arrives. A positional .map() would place page 3's
    // text at index 1 and silently shift the whole document.
    const input = [page(0, 'RYZO_PAGE_1'), page(2, 'RYZO_PAGE_3')]
    const { pageTexts, missingPages } = alignPages(input, 3)

    expect(pageTexts).toEqual(['RYZO_PAGE_1', '', 'RYZO_PAGE_3'])
    expect(pageTexts[2]).toBe('RYZO_PAGE_3') // ← would be '' under .map()
    expect(missingPages).toEqual([1])
  })

  it('is order-independent', () => {
    const input = [page(2, 'third'), page(0, 'first'), page(1, 'second')]
    expect(alignPages(input, 3).pageTexts).toEqual(['first', 'second', 'third'])
  })

  it('pads to pageCount when the extractor returns fewer records', () => {
    const { pageTexts, missingPages } = alignPages([page(0, 'only')], 4)

    expect(pageTexts).toHaveLength(4)
    expect(pageTexts).toEqual(['only', '', '', ''])
    expect(missingPages).toEqual([1, 2, 3])
  })

  it('reports empty input as entirely missing rather than returning []', () => {
    const { pageTexts, missingPages } = alignPages([], 3)
    expect(pageTexts).toEqual(['', '', ''])
    expect(missingPages).toEqual([0, 1, 2])
  })
})

describe('alignPages — malformed input', () => {
  it('drops out-of-range records instead of clamping them onto real pages', () => {
    // Clamping would overwrite page 2 with foreign content — corruption that
    // reads as plausible text. Dropping leaves it observably empty.
    const input = [page(0, 'first'), page(9, 'stray'), page(-1, 'negative')]
    const { pageTexts, outOfRangePages } = alignPages(input, 2)

    expect(pageTexts).toEqual(['first', ''])
    expect(outOfRangePages).toEqual([9, -1])
  })

  it('ignores records with a non-integer page', () => {
    const input = [page(0, 'good'), { page: 1.5, markdown: 'bad' }, { markdown: 'no page' } as any]
    expect(alignPages(input as ExtractorPage[], 2).pageTexts).toEqual(['good', ''])
  })

  it('treats missing markdown as empty text, not undefined', () => {
    const { pageTexts } = alignPages([{ page: 0 } as ExtractorPage], 1)
    expect(pageTexts).toEqual([''])
  })

  it('rejects a nonsensical pageCount loudly', () => {
    expect(() => alignPages([], -1)).toThrow(/non-negative integer/)
    expect(() => alignPages([], 1.5)).toThrow(/non-negative integer/)
  })
})

describe('alignPages — needsOcr flags stay parallel to pageTexts', () => {
  it('aligns flags by index, including across a gap', () => {
    const input = [page(0, 'a', false), page(2, 'c', true)]
    const { needsOcrByIndex } = alignPages(input, 3)

    expect(needsOcrByIndex).toEqual([false, false, true])
  })
})

describe('ocrPagesToIndices — the 1-based → 0-based conversion', () => {
  it('converts pdf-inspector 1-based OCR page numbers to array indices', () => {
    // Measured against v1.12.0: blank pages at pages[].page 2 and 3 were
    // reported as pagesNeedingOcr [3, 4].
    expect(ocrPagesToIndices([3, 4])).toEqual([2, 3])
  })

  it('handles empty and nullish input', () => {
    expect(ocrPagesToIndices([])).toEqual([])
    expect(ocrPagesToIndices(undefined)).toEqual([])
    expect(ocrPagesToIndices(null)).toEqual([])
  })

  it('discards page 0, which is invalid under a 1-based convention', () => {
    expect(ocrPagesToIndices([0, 1, 2])).toEqual([0, 1])
  })
})

describe('indicesToPageNumbers — round-trip back to the report convention', () => {
  it('converts 0-based indices to the 1-based numbers the quality report uses', () => {
    expect(indicesToPageNumbers([0, 1, 4])).toEqual([1, 2, 5])
  })

  it('round-trips with ocrPagesToIndices', () => {
    const original = [3, 4, 17]
    expect(indicesToPageNumbers(ocrPagesToIndices(original))).toEqual(original)
  })

  it('handles nullish input', () => {
    expect(indicesToPageNumbers(undefined)).toEqual([])
  })
})
