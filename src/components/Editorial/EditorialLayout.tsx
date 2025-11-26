import React from 'react'
import { PDFViewerV2 } from '../PDFViewerV2'
import { ReviewPanel } from './ReviewPanel'
import { FigureDrawer } from './FigureDrawer'

export const EditorialLayout: React.FC = () => {
  return (
    <div id="onboarding-editorial-layout" data-onboarding="onboarding-editorial-layout" className="flex h-full w-full overflow-hidden">
      {/* Left Pane: PDF Viewer */}
      <div className="w-1/2 h-full relative border-r border-[var(--color-border)]">
        {/* We pass specific props or context to PDFViewerV2 if needed, but it uses global store */}
        <PDFViewerV2 />
        
        {/* Figure Drawer lives on top of the PDF Viewer */}
        <FigureDrawer />
      </div>

      {/* Right Pane: Review Editor */}
      <div className="w-1/2 h-full">
        <ReviewPanel />
      </div>
    </div>
  )
}

