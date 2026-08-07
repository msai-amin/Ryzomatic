/**
 * Lightweight feature-flag registry.
 *
 * Pilot-grade: each flag resolves from (in priority order)
 *   1. a localStorage override  — `localStorage.setItem('ff_docExtractionV2','true'|'false')`
 *      (lets us toggle per-browser during the pilot without a redeploy)
 *   2. a Vite build-time env var — e.g. VITE_FF_DOC_EXTRACTION_V2=false
 *   3. the hardcoded default below
 *
 * Keep this tiny. If flags multiply, graduate to a real provider.
 */

type FlagKey = 'docExtractionV2' | 'pdfInspector' | 'readerV3'

const DEFAULTS: Record<FlagKey, boolean> = {
  // Office/e-book extraction via @firecrawl/anydoc, replacing the dead Docling
  // tier. Affects NEW UPLOADS ONLY — the on-demand re-extraction path in
  // supabaseStorageService is gated on `file_type === 'pdf'`, so existing
  // documents are untouched by this lane.
  docExtractionV2: false,

  // PDF text extraction via @firecrawl/pdf-inspector, replacing the PDF.js
  // text tier. Deliberately separate from docExtractionV2: this lane DOES
  // touch existing documents, because raw pageTexts are re-extracted on every
  // open (user_books.page_texts was dropped in migration 004). Flipping this
  // changes what every already-uploaded PDF produces.
  pdfInspector: false,

  // Reader redesign, wave A: warm palette and reading-progress ring.
  // Presentation only — no data dependencies, no change to extraction or
  // storage. Applied as a scope class on the reader root, so turning it off
  // removes one class and restores the current look.
  //
  // DEFAULT ON. The justification is not taste: the current theme puts a
  // near-white PDF page on `--color-background: #000000`, the widest luminance
  // gap a display can produce, on the one surface a user stares at for an hour
  // at a time. `--rv-desk: #1f2027` narrows it. That argument holds without
  // any usage data, which is why this ships ahead of the rest of the redesign.
  //
  // Note what is NOT covered: `.rv-railbtn` and `.rv-seg` in readerTheme.css
  // have no consumers. Those components were descoped from wave A, and the
  // rules are left in place deliberately as the record of that gap.
  readerV3: true,
}

const ENV_KEYS: Record<FlagKey, string> = {
  docExtractionV2: 'VITE_FF_DOC_EXTRACTION_V2',
  pdfInspector: 'VITE_FF_PDF_INSPECTOR',
  readerV3: 'VITE_FF_READER_V3',
}

function readEnv(key: string): boolean | null {
  try {
    const raw = (import.meta as any)?.env?.[key]
    if (raw === undefined || raw === null || raw === '') return null
    return String(raw).toLowerCase() === 'true'
  } catch {
    return null
  }
}

function readLocalStorage(flag: FlagKey): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(`ff_${flag}`)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

export function isFeatureEnabled(flag: FlagKey): boolean {
  const ls = readLocalStorage(flag)
  if (ls !== null) return ls
  const env = readEnv(ENV_KEYS[flag])
  if (env !== null) return env
  return DEFAULTS[flag]
}

export const FEATURES = {
  get docExtractionV2() {
    return isFeatureEnabled('docExtractionV2')
  },
  get pdfInspector() {
    return isFeatureEnabled('pdfInspector')
  },
  get readerV3() {
    return isFeatureEnabled('readerV3')
  },
}
