import React, { lazy, Suspense } from 'react'
import { ReviewPanel } from './ReviewPanel'

// Lazy-load: PDFViewerV2 is ~3,300 LOC and pulls in @react-pdf-viewer/* plus
// pdfjs-dist. EditorialLayout is only entered from peer-review mode.
const PDFViewerV2 = lazy(() =>
  import('../PDFViewerV2').then(m => ({ default: m.PDFViewerV2 }))
)

export const EditorialLayout: React.FC = () => {
  return (
    <div id="onboarding-editorial-layout" data-onboarding="onboarding-editorial-layout" className="flex h-full w-full overflow-hidden">
      {/* Left Pane: PDF Viewer */}
      <div className="w-1/2 h-full relative border-r border-[var(--color-border)]">
        {/* We pass specific props or context to PDFViewerV2 if needed, but it uses global store */}
        <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-secondary)' }}>Loading PDF viewer…</div>}>
          <PDFViewerV2 />
        </Suspense>
      </div>

      {/* Right Pane: Review Editor */}
      <div className="w-1/2 h-full">
        <ReviewPanel />
      </div>
    </div>
  )
}

