import { describe, expect, it } from 'vitest'
import { buildScreenGeometry, normalizeRectWithinBounds, RECT_SIZE_EPSILON } from '../../src/utils/pdfHighlightGeometry'

const createDOMRect = (x: number, y: number, width: number, height: number) =>
  new DOMRect(x, y, width, height)

describe('normalizeRectWithinBounds', () => {
  it('clips rectangles that exceed container bounds', () => {
    const rect = { x: -10, y: -5, width: 120, height: 40 }
    const normalized = normalizeRectWithinBounds(rect, 100, 30)
    expect(normalized).toEqual({ x: 0, y: 0, width: 100, height: 30 })
  })

  it('returns null when width or height collapses below epsilon', () => {
    const rect = { x: 0, y: 0, width: RECT_SIZE_EPSILON / 2, height: 10 }
    expect(normalizeRectWithinBounds(rect, 100, 100)).toBeNull()
  })
})

describe('buildScreenGeometry', () => {
  const containerRect = new DOMRect(0, 0, 200, 200)

  it('merges line fragments into a single line rect', () => {
    const rects = [
      createDOMRect(10, 20, 40, 12),
      createDOMRect(55, 21, 35, 12)
    ]

    const geometry = buildScreenGeometry(rects, containerRect, 200, 200)
    expect(geometry).not.toBeNull()
    expect(geometry!.screenRects).toHaveLength(1)
    expect(geometry!.boundingScreenRect.width).toBeCloseTo(80)
  })

  it('clips merged rects to container limits', () => {
    const rects = [createDOMRect(180, 50, 50, 10)]
    const geometry = buildScreenGeometry(rects, containerRect, 200, 200)
    expect(geometry).not.toBeNull()
    expect(geometry!.screenRects[0].x).toBeCloseTo(180)
    expect(geometry!.screenRects[0].width).toBeCloseTo(20)
  })

  it('returns null when rects collapse below epsilon after normalization', () => {
    const rects = [createDOMRect(199.8, 10, 0.1, 5)]
    const geometry = buildScreenGeometry(rects, containerRect, 200, 200)
    expect(geometry).toBeNull()
  })
})
