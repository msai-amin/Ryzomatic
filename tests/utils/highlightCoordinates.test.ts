import { describe, expect, it } from 'vitest'
import { convertScreenRectToBaseViewportRect } from '../../src/utils/highlightCoordinates'

describe('convertScreenRectToBaseViewportRect', () => {
  const createViewport = (scale: number) => ({
    convertToPdfPoint(x: number, y: number) {
      return [x / scale, y / scale] as [number, number]
    },
    convertToViewportPoint(x: number, y: number) {
      return [x * scale, y * scale] as [number, number]
    }
  })

  const baseViewport = createViewport(1)

  const makeScreenRect = (scale: number) => ({
    x: 120 * scale,
    y: 180 * scale,
    width: 160 * scale,
    height: 32 * scale
  })

  ;[1, 1.4, 2].forEach(scale => {
    it(`round-trips selection coordinates at ${scale * 100}% zoom`, () => {
      const screenRect = makeScreenRect(scale)
      const currentViewport = createViewport(scale)

      const storedRect = convertScreenRectToBaseViewportRect(screenRect, currentViewport, baseViewport)

      const roundTripRect = {
        x: storedRect.x * scale,
        y: storedRect.y * scale,
        width: storedRect.width * scale,
        height: storedRect.height * scale
      }

      expect(roundTripRect.x).toBeCloseTo(screenRect.x, 5)
      expect(roundTripRect.y).toBeCloseTo(screenRect.y, 5)
      expect(roundTripRect.width).toBeCloseTo(screenRect.width, 5)
      expect(roundTripRect.height).toBeCloseTo(screenRect.height, 5)
    })
  })
})

