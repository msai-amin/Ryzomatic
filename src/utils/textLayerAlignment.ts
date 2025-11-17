/**
 * Text Layer Alignment Verification
 * 
 * Verifies that the text layer is perfectly aligned with the PDF canvas.
 * This is critical for accurate highlight positioning.
 */

export interface AlignmentCheck {
  isAligned: boolean
  canvasRect: DOMRect
  textLayerRect: DOMRect
  containerRect: DOMRect
  offsetX: number
  offsetY: number
  widthMatch: boolean
  heightMatch: boolean
  transformMatch: boolean
  errors: string[]
  warnings: string[]
}

const ALIGNMENT_TOLERANCE = 1 // pixels
const DIMENSION_TOLERANCE = 1 // pixels

/**
 * Verify that text layer is perfectly aligned with canvas
 */
export function verifyTextLayerAlignment(
  canvas: HTMLCanvasElement,
  textLayer: HTMLElement,
  pageContainer: HTMLElement
): AlignmentCheck {
  const errors: string[] = []
  const warnings: string[] = []

  // Get bounding rectangles
  const canvasRect = canvas.getBoundingClientRect()
  const textLayerRect = textLayer.getBoundingClientRect()
  const containerRect = pageContainer.getBoundingClientRect()

  // Calculate offsets relative to container
  const canvasOffsetX = canvasRect.left - containerRect.left
  const canvasOffsetY = canvasRect.top - containerRect.top
  const textLayerOffsetX = textLayerRect.left - containerRect.left
  const textLayerOffsetY = textLayerRect.top - containerRect.top

  // Check position alignment
  const offsetX = textLayerOffsetX - canvasOffsetX
  const offsetY = textLayerOffsetY - canvasOffsetY
  const positionAligned = Math.abs(offsetX) <= ALIGNMENT_TOLERANCE && 
                          Math.abs(offsetY) <= ALIGNMENT_TOLERANCE

  if (!positionAligned) {
    errors.push(
      `Text layer offset mismatch: X=${offsetX.toFixed(2)}px, Y=${offsetY.toFixed(2)}px ` +
      `(canvas at ${canvasOffsetX.toFixed(2)}, ${canvasOffsetY.toFixed(2)}, ` +
      `textLayer at ${textLayerOffsetX.toFixed(2)}, ${textLayerOffsetY.toFixed(2)})`
    )
  }

  // Check dimension alignment
  const widthDiff = Math.abs(textLayerRect.width - canvasRect.width)
  const heightDiff = Math.abs(textLayerRect.height - canvasRect.height)
  const widthMatch = widthDiff <= DIMENSION_TOLERANCE
  const heightMatch = heightDiff <= DIMENSION_TOLERANCE

  if (!widthMatch) {
    errors.push(
      `Width mismatch: canvas=${canvasRect.width.toFixed(2)}px, ` +
      `textLayer=${textLayerRect.width.toFixed(2)}px, ` +
      `diff=${widthDiff.toFixed(2)}px`
    )
  }

  if (!heightMatch) {
    errors.push(
      `Height mismatch: canvas=${canvasRect.height.toFixed(2)}px, ` +
      `textLayer=${textLayerRect.height.toFixed(2)}px, ` +
      `diff=${heightDiff.toFixed(2)}px`
    )
  }

  // Check CSS transforms
  const canvasStyle = window.getComputedStyle(canvas)
  const textLayerStyle = window.getComputedStyle(textLayer)
  const canvasTransform = canvasStyle.transform
  const textLayerTransform = textLayerStyle.transform

  const transformMatch = canvasTransform === textLayerTransform || 
                        (canvasTransform === 'none' && textLayerTransform === 'none')

  if (!transformMatch) {
    warnings.push(
      `Transform mismatch: canvas="${canvasTransform}", textLayer="${textLayerTransform}"`
    )
  }

  // Check text layer positioning style
  const textLayerPosition = textLayerStyle.position
  if (textLayerPosition !== 'absolute' && textLayerPosition !== 'relative') {
    warnings.push(
      `Text layer position should be 'absolute' or 'relative', got '${textLayerPosition}'`
    )
  }

  // Check if text layer is at (0, 0) relative to container
  if (Math.abs(textLayerOffsetX) > ALIGNMENT_TOLERANCE || 
      Math.abs(textLayerOffsetY) > ALIGNMENT_TOLERANCE) {
    warnings.push(
      `Text layer not at (0,0) relative to container: ` +
      `(${textLayerOffsetX.toFixed(2)}, ${textLayerOffsetY.toFixed(2)})`
    )
  }

  const isAligned = positionAligned && widthMatch && heightMatch && errors.length === 0

  return {
    isAligned,
    canvasRect,
    textLayerRect,
    containerRect,
    offsetX,
    offsetY,
    widthMatch,
    heightMatch,
    transformMatch,
    errors,
    warnings
  }
}

/**
 * Attempt to fix text layer alignment issues
 */
export function fixTextLayerAlignment(
  textLayer: HTMLElement,
  pageContainer: HTMLElement,
  canvas: HTMLCanvasElement
): boolean {
  const check = verifyTextLayerAlignment(canvas, textLayer, pageContainer)
  
  if (check.isAligned) {
    return false // No fixes needed
  }

  let fixed = false

  // Fix position if needed
  if (Math.abs(check.offsetX) > ALIGNMENT_TOLERANCE || 
      Math.abs(check.offsetY) > ALIGNMENT_TOLERANCE) {
    textLayer.style.position = 'absolute'
    textLayer.style.left = '0px'
    textLayer.style.top = '0px'
    fixed = true
  }

  // Ensure text layer has correct positioning
  const computedStyle = window.getComputedStyle(textLayer)
  if (computedStyle.position !== 'absolute' && computedStyle.position !== 'relative') {
    textLayer.style.position = 'absolute'
    fixed = true
  }

  return fixed
}

