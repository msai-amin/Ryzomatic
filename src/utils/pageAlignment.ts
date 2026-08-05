/**
 * Page alignment — the single place that knows how extractor page numbering
 * maps onto Ryzomatic's `pageTexts[]` contract.
 *
 * ## Why this file exists
 *
 * `pageTexts` is consumed by 29 modules, and several index it *positionally*
 * against the currently-displayed page:
 *
 *   useAudioText.ts:80    normalizedCleanedPageTexts[currentPage - 1]
 *   PDFViewerV2.tsx:321   document?.pageTexts?.[currentPage - 1]
 *
 * `currentPage` is the 1-based page a human sees, so `pageTexts[i]` MUST be
 * the text of page `i + 1`. A one-position shift does not throw — it silently
 * desynchronises TTS word-highlighting and viewer page-sync, and only becomes
 * visible partway through a document.
 *
 * ## The hazard being contained
 *
 * `@firecrawl/pdf-inspector`'s `extractPagesMarkdown()` returns *three*
 * different index conventions in a single object (measured against v1.12.0):
 *
 *   pages[].page          0-based   → 0,1,2…22 for a 23-page document
 *   pages[].needsOcr      0-based   → parallel to pages[]
 *   pagesNeedingOcr       1-BASED   → [3,4] denotes pages[].page 2 and 3
 *   ocrReasonsByPage      neither   → keyed by position within pagesNeedingOcr
 *
 * Rather than remember which is which at 29 call sites, every conversion is
 * funnelled through this module and asserted by tests.
 *
 * ## Why not just `.map()`
 *
 * On every corpus measured so far `pages[]` is dense and in order, so
 * `pages.map(p => p.markdown)` happens to be correct. That is a property of
 * the observed inputs, not a guarantee of the API. If a page ever fails to
 * parse and is omitted, `.map()` shifts every subsequent page by one and
 * produces exactly the silent desync described above. These functions build
 * the array by explicit index assignment so a missing page leaves a hole
 * instead of moving its neighbours.
 */

/** A page record as returned by pdf-inspector's `extractPagesMarkdown()`. */
export interface ExtractorPage {
  /** 0-based page index. Do not assume the set is dense or ordered. */
  page: number
  markdown: string
  needsOcr?: boolean
}

export interface AlignedPages {
  /** Dense, length === pageCount. `pageTexts[i]` is the text of page i + 1. */
  pageTexts: string[]
  /** Parallel to `pageTexts`; `true` where the extractor wants OCR. */
  needsOcrByIndex: boolean[]
  /** 0-based indices that no extractor record covered (holes, not shifts). */
  missingPages: number[]
  /** Records whose `page` fell outside `[0, pageCount)` — a real API contract break. */
  outOfRangePages: number[]
}

/**
 * Project sparse, arbitrarily-ordered extractor records onto a dense
 * `pageTexts`-shaped array.
 *
 * @param pages     Records from `extractPagesMarkdown().pages`.
 * @param pageCount Authoritative page count from `processPdf().pageCount`.
 */
export function alignPages(pages: readonly ExtractorPage[], pageCount: number): AlignedPages {
  if (!Number.isInteger(pageCount) || pageCount < 0) {
    throw new Error(`alignPages: pageCount must be a non-negative integer, got ${pageCount}`)
  }

  const pageTexts = new Array<string>(pageCount).fill('')
  const needsOcrByIndex = new Array<boolean>(pageCount).fill(false)
  const seen = new Set<number>()
  const outOfRangePages: number[] = []

  for (const record of pages ?? []) {
    const idx = record?.page
    if (!Number.isInteger(idx)) continue

    // Out-of-range records are dropped rather than clamped: clamping would
    // overwrite a legitimate page with foreign content, which is worse than
    // an empty page and much harder to notice.
    if (idx < 0 || idx >= pageCount) {
      outOfRangePages.push(idx)
      continue
    }

    pageTexts[idx] = record.markdown ?? ''
    needsOcrByIndex[idx] = Boolean(record.needsOcr)
    seen.add(idx)
  }

  const missingPages: number[] = []
  for (let i = 0; i < pageCount; i++) {
    if (!seen.has(i)) missingPages.push(i)
  }

  return { pageTexts, needsOcrByIndex, missingPages, outOfRangePages }
}

/**
 * Convert pdf-inspector's **1-based** `pagesNeedingOcr` into 0-based indices
 * aligned with `pageTexts`.
 *
 * Verified against v1.12.0: a document whose blank pages sat at
 * `pages[].page` 2 and 3 reported `pagesNeedingOcr: [3, 4]`.
 */
export function ocrPagesToIndices(pagesNeedingOcr: readonly number[] | undefined | null): number[] {
  return (pagesNeedingOcr ?? [])
    .filter((n) => Number.isInteger(n) && n >= 1)
    .map((n) => n - 1)
}

/**
 * Convert 0-based indices back to the **1-based** page numbers that
 * `DocumentQualityReport.problematicPages` and `pageMetrics[].pageNumber`
 * already use (see `src/utils/pdfQualityValidator.ts`).
 */
export function indicesToPageNumbers(indices: readonly number[] | undefined | null): number[] {
  return (indices ?? []).filter((i) => Number.isInteger(i) && i >= 0).map((i) => i + 1)
}
