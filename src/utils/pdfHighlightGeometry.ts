import type { RectLike } from './highlightCoordinates'

export const RECT_SIZE_EPSILON = 0.5
export const LINE_MERGE_THRESHOLD_PX = 2

export type LineRect = { left: number; right: number; top: number; bottom: number }

export interface ScreenGeometryResult {
  screenRects: RectLike[]
  boundingScreenRect: RectLike
}

export const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

export const normalizeRectWithinBounds = (
  rect: RectLike,
  widthLimit: number,
  heightLimit: number
): RectLike | null => {
  const safeWidthLimit = Math.max(widthLimit, RECT_SIZE_EPSILON)
  const safeHeightLimit = Math.max(heightLimit, RECT_SIZE_EPSILON)

  let x = rect.x
  let y = rect.y
  let width = rect.width
  let height = rect.height

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  if (width <= RECT_SIZE_EPSILON || height <= RECT_SIZE_EPSILON) {
    return null
  }

  if (x < 0) {
    width += x
    x = 0
  }
  if (y < 0) {
    height += y
    y = 0
  }

  if (x + width > safeWidthLimit) {
    width = safeWidthLimit - x
  }
  if (y + height > safeHeightLimit) {
    height = safeHeightLimit - y
  }

  if (width <= RECT_SIZE_EPSILON || height <= RECT_SIZE_EPSILON) {
    return null
  }

  return { x, y, width, height }
}

export const mergeSpanRectsByLine = (rects: DOMRect[]): LineRect[] => {
  const sorted = [...rects].sort((a, b) => {
    // Sort by top first, then by left
    if (Math.abs(a.top - b.top) > LINE_MERGE_THRESHOLD_PX) {
      return a.top - b.top
    }
    return a.left - b.left
  })
  const groups: LineRect[] = []

  // Calculate average rect width to detect column gaps
  const avgWidth = rects.reduce((sum, r) => sum + r.width, 0) / rects.length
  // Column gap threshold: if horizontal gap is > 3x average width, treat as different column
  const COLUMN_GAP_THRESHOLD = Math.max(avgWidth * 3, 50) // At least 50px gap

  sorted.forEach(rect => {
    if (rect.width <= RECT_SIZE_EPSILON || rect.height <= RECT_SIZE_EPSILON) {
      return
    }

    // Find a group on the same line where this rect overlaps or is adjacent
    const match = groups.find(group => {
      const sameLine = Math.abs(group.top - rect.top) <= LINE_MERGE_THRESHOLD_PX ||
                       Math.abs(group.bottom - rect.bottom) <= LINE_MERGE_THRESHOLD_PX
      
      if (!sameLine) return false
      
      // CRITICAL: Check for column boundaries FIRST - if horizontal gap is too large, don't merge
      // This prevents merging rects from different columns in multi-column layouts
      // Calculate the horizontal distance between rects (handles both overlapping and non-overlapping cases)
      const horizontalGap = rect.left > group.right 
        ? rect.left - group.right  // rect is to the right of group
        : group.left > rect.right
        ? group.left - rect.right   // group is to the right of rect
        : 0                          // they overlap horizontally
      
      // If there's a significant horizontal gap (likely a column boundary), don't merge
      if (horizontalGap > COLUMN_GAP_THRESHOLD) {
        return false
      }
      
      // Check if rect overlaps or is adjacent to the group
      // Adjacent means rect starts within threshold of group end, or group starts within threshold of rect end
      const isOverlapping = !(rect.right < group.left - LINE_MERGE_THRESHOLD_PX || 
                              rect.left > group.right + LINE_MERGE_THRESHOLD_PX)
      
      return isOverlapping
    })

    if (match) {
      // Only expand to actual bounds of selected rects, don't expand beyond
      match.left = Math.min(match.left, rect.left)
      match.right = Math.max(match.right, rect.right)
      match.top = Math.min(match.top, rect.top)
      match.bottom = Math.max(match.bottom, rect.bottom)
    } else {
      // Create new group with actual rect bounds
      groups.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom
      })
    }
  })

  return groups
}

export const convertLineRectToScreenRect = (
  lineRect: LineRect,
  containerRect: DOMRect,
  widthLimit?: number,
  heightLimit?: number,
  isRelativeToContainer: boolean = false,
  skipNormalization: boolean = false
): RectLike | null => {
  // If rects are already relative to container (e.g., text layer), don't subtract container position
  const rawRect: RectLike = isRelativeToContainer
    ? {
        x: lineRect.left,
        y: lineRect.top,
        width: lineRect.right - lineRect.left,
        height: lineRect.bottom - lineRect.top
      }
    : {
        x: lineRect.left - containerRect.left,
        y: lineRect.top - containerRect.top,
        width: lineRect.right - lineRect.left,
        height: lineRect.bottom - lineRect.top
      }

  // If skipNormalization is true (e.g., when using selectionClientRects), return raw rect
  // Only validate that values are finite and positive
  if (skipNormalization) {
    if (!Number.isFinite(rawRect.x) || !Number.isFinite(rawRect.y) || 
        !Number.isFinite(rawRect.width) || !Number.isFinite(rawRect.height) ||
        rawRect.width <= RECT_SIZE_EPSILON || rawRect.height <= RECT_SIZE_EPSILON) {
      return null
    }
    return rawRect
  }

  const effectiveWidthLimit = widthLimit ?? containerRect.width
  const effectiveHeightLimit = heightLimit ?? containerRect.height

  return normalizeRectWithinBounds(rawRect, effectiveWidthLimit, effectiveHeightLimit)
}

export const buildScreenGeometry = (
  rects: DOMRect[],
  containerRect: DOMRect,
  widthLimit: number,
  heightLimit: number,
  isRelativeToContainer: boolean = false,
  skipNormalization: boolean = false
): ScreenGeometryResult | null => {
  if (!rects.length) {
    return null
  }

  const mergedLineRects = mergeSpanRectsByLine(rects)
  const normalizedScreenRects = mergedLineRects
    .map(lineRect => convertLineRectToScreenRect(lineRect, containerRect, widthLimit, heightLimit, isRelativeToContainer, skipNormalization))
    .filter((rect): rect is RectLike => !!rect)

  if (!normalizedScreenRects.length) {
    return null
  }

  const bounding = normalizedScreenRects.reduce(
    (acc, rect) => ({
      minX: Math.min(acc.minX, rect.x),
      minY: Math.min(acc.minY, rect.y),
      maxX: Math.max(acc.maxX, rect.x + rect.width),
      maxY: Math.max(acc.maxY, rect.y + rect.height)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  )

  if (!Number.isFinite(bounding.minX) || !Number.isFinite(bounding.minY) || !Number.isFinite(bounding.maxX) || !Number.isFinite(bounding.maxY)) {
    return null
  }

  const boundingScreenRect: RectLike = {
    x: bounding.minX,
    y: bounding.minY,
    width: bounding.maxX - bounding.minX,
    height: bounding.maxY - bounding.minY
  }

  if (boundingScreenRect.width <= RECT_SIZE_EPSILON || boundingScreenRect.height <= RECT_SIZE_EPSILON) {
    return null
  }

  return {
    screenRects: normalizedScreenRects,
    boundingScreenRect
  }
}
