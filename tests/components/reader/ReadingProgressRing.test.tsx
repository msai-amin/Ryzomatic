/**
 * Tests for ReadingProgressRing.
 *
 * The arithmetic matters more than it looks: this renders while a document is
 * still loading (`totalPages` null) and while `currentPage` can transiently
 * exceed `totalPages` during page-count updates. Either produces a visibly
 * broken ring — NaN in the SVG dash offset, or an arc past full — so the
 * clamping is pinned here rather than left to the renderer.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ReadingProgressRing,
  computeProgressPercent,
} from '../../../src/components/reader/ReadingProgressRing'

describe('computeProgressPercent', () => {
  it('reports the expected percentage through a document', () => {
    expect(computeProgressPercent(1, 100)).toBe(1)
    expect(computeProgressPercent(50, 100)).toBe(50)
    expect(computeProgressPercent(100, 100)).toBe(100)
  })

  it('returns 0 while the page count is unknown', () => {
    // Documents render before pdf.js reports numPages.
    expect(computeProgressPercent(1, null)).toBe(0)
    expect(computeProgressPercent(1, 0)).toBe(0)
  })

  it('clamps past-the-end pages instead of exceeding 100', () => {
    // currentPage can briefly lead totalPages while the count updates.
    expect(computeProgressPercent(120, 100)).toBe(100)
  })

  it('is safe on nonsense input', () => {
    expect(computeProgressPercent(0, 100)).toBe(0)
    expect(computeProgressPercent(-5, 100)).toBe(0)
    expect(computeProgressPercent(NaN, 100)).toBe(0)
  })

  it('rounds rather than truncating', () => {
    // 2/3 is 66.67% — a truncating implementation would show 66.
    expect(computeProgressPercent(2, 3)).toBe(67)
  })
})

describe('ReadingProgressRing', () => {
  it('leads with the page number, which is what gets cited', () => {
    render(<ReadingProgressRing currentPage={15} totalPages={272} />)
    expect(screen.getByText('p. 15 of 272')).toBeInTheDocument()
  })

  it('omits the total until the page count is known', () => {
    render(<ReadingProgressRing currentPage={1} totalPages={null} />)
    expect(screen.getByText('p. 1')).toBeInTheDocument()
  })

  it('exposes progress to assistive tech as text, not just a drawing', () => {
    render(<ReadingProgressRing currentPage={50} totalPages={100} />)
    expect(screen.getByRole('img', { name: '50% read, p. 50 of 100' })).toBeInTheDocument()
  })

  it('pluralises the annotation count', () => {
    const { rerender } = render(
      <ReadingProgressRing currentPage={1} totalPages={10} annotationCount={1} />
    )
    expect(screen.getByText('1 note')).toBeInTheDocument()

    rerender(<ReadingProgressRing currentPage={1} totalPages={10} annotationCount={47} />)
    expect(screen.getByText('47 notes')).toBeInTheDocument()
  })

  it('hides the annotation line when no count is supplied', () => {
    render(<ReadingProgressRing currentPage={1} totalPages={10} />)
    expect(screen.queryByText(/notes?$/)).not.toBeInTheDocument()
  })

  it('never emits NaN into the SVG geometry', () => {
    // A NaN dash offset silently renders nothing, which looks like a styling
    // bug rather than a maths bug.
    const { container } = render(<ReadingProgressRing currentPage={1} totalPages={null} />)
    const svgHtml = container.querySelector('svg')?.outerHTML ?? ''
    expect(svgHtml).not.toContain('NaN')
  })
})
