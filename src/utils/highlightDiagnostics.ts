/**
 * Highlight Diagnostics Utilities
 * 
 * Measures actual misalignment between highlights and text to diagnose issues.
 */

export interface MisalignmentMeasurement {
  isAligned: boolean
  maxOffsetX: number
  maxOffsetY: number
  averageOffsetX: number
  averageOffsetY: number
  details: Array<{
    expected: DOMRect
    actual: DOMRect
    offset: { x: number; y: number }
  }>
}

/**
 * Measure misalignment between highlight rectangle and expected text positions
 */
export function measureHighlightMisalignment(
  highlightRect: DOMRect,
  expectedTextRects: DOMRect[],
  tolerance: number = 2
): MisalignmentMeasurement {
  if (expectedTextRects.length === 0) {
    return {
      isAligned: false,
      maxOffsetX: Infinity,
      maxOffsetY: Infinity,
      averageOffsetX: Infinity,
      averageOffsetY: Infinity,
      details: []
    }
  }

  const details: Array<{
    expected: DOMRect
    actual: DOMRect
    offset: { x: number; y: number }
  }> = []

  let totalOffsetX = 0
  let totalOffsetY = 0
  let maxOffsetX = 0
  let maxOffsetY = 0

  // Compare highlight with each expected text rect
  expectedTextRects.forEach(expectedRect => {
    // Calculate offset between highlight and expected position
    const offsetX = Math.abs(highlightRect.left - expectedRect.left)
    const offsetY = Math.abs(highlightRect.top - expectedRect.top)

    totalOffsetX += offsetX
    totalOffsetY += offsetY
    maxOffsetX = Math.max(maxOffsetX, offsetX)
    maxOffsetY = Math.max(maxOffsetY, offsetY)

    details.push({
      expected: expectedRect,
      actual: highlightRect,
      offset: { x: offsetX, y: offsetY }
    })
  })

  const averageOffsetX = totalOffsetX / expectedTextRects.length
  const averageOffsetY = totalOffsetY / expectedTextRects.length

  const isAligned = maxOffsetX <= tolerance && maxOffsetY <= tolerance

  return {
    isAligned,
    maxOffsetX,
    maxOffsetY,
    averageOffsetX,
    averageOffsetY,
    details
  }
}

/**
 * Log diagnostic information for highlight creation/rendering
 */
export function logHighlightDiagnostics(
  phase: 'creation' | 'rendering',
  pageNumber: number,
  data: {
    highlightPosition?: { x: number; y: number; width: number; height: number }
    scaledRects?: Array<{ x1: number; y1: number; x2: number; y2: number }>
    viewportRects?: Array<{ left: number; top: number; width: number; height: number }>
    renderRects?: Array<{ x: number; y: number; width: number; height: number }>
    scale?: number
    baseViewport?: { width: number; height: number; scale: number }
    currentViewport?: { width: number; height: number; scale: number }
  }
): void {
  if (!import.meta.env.DEV) {
    return // Only log in development
  }

  console.group(`🔍 Highlight Diagnostics [${phase}] - Page ${pageNumber}`)
  
  if (data.highlightPosition) {
    console.log('Highlight Position:', data.highlightPosition)
  }
  
  if (data.scaledRects) {
    console.log('Scaled Rects:', data.scaledRects)
  }
  
  if (data.viewportRects) {
    console.log('Viewport Rects:', data.viewportRects)
  }
  
  if (data.renderRects) {
    console.log('Render Rects:', data.renderRects)
  }
  
  if (data.scale !== undefined) {
    console.log('Current Scale:', data.scale)
  }
  
  if (data.baseViewport) {
    console.log('Base Viewport:', data.baseViewport)
  }
  
  if (data.currentViewport) {
    console.log('Current Viewport:', data.currentViewport)
  }
  
  console.groupEnd()
}

