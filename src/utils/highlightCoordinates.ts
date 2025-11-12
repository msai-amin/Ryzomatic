export interface RectLike {
  x: number
  y: number
  width: number
  height: number
}

interface ViewportLike {
  convertToPdfPoint: (x: number, y: number) => [number, number]
  convertToViewportPoint: (x: number, y: number) => [number, number]
}

/**
 * Convert a screen-space rectangle (measured in CSS pixels at the current zoom)
 * into a rectangle in the base viewport coordinate system (scale = 1).
 *
 * We first jump to PDF point space so we can drop any device-pixel or transform
 * quirks, then project back into a scale-1 viewport. The resulting rectangle
 * can be scaled by any zoom level to recover screen coordinates.
 */
export function convertScreenRectToBaseViewportRect(
  screenRect: RectLike,
  currentViewport: ViewportLike,
  baseViewport: ViewportLike
): RectLike {
  const topLeftPdf = currentViewport.convertToPdfPoint(screenRect.x, screenRect.y)
  const bottomRightPdf = currentViewport.convertToPdfPoint(
    screenRect.x + screenRect.width,
    screenRect.y + screenRect.height
  )

  const topLeftViewport = baseViewport.convertToViewportPoint(topLeftPdf[0], topLeftPdf[1])
  const bottomRightViewport = baseViewport.convertToViewportPoint(
    bottomRightPdf[0],
    bottomRightPdf[1]
  )

  const x = Math.min(topLeftViewport[0], bottomRightViewport[0])
  const y = Math.min(topLeftViewport[1], bottomRightViewport[1])
  const width = Math.abs(bottomRightViewport[0] - topLeftViewport[0])
  const height = Math.abs(bottomRightViewport[1] - topLeftViewport[1])

  return { x, y, width, height }
}

