import React from 'react'

/**
 * Reading position: printed page number, total, and a percent ring.
 *
 * ## Why page number leads and percent is secondary
 *
 * The mockup put "p. xv of 272" in the primary slot and the percentage in a
 * small ring beside it, which is the right call for this audience: a page
 * number is what gets cited and what a colleague can act on, while a
 * percentage is only meaningful relative to a document you are already in.
 *
 * ## Why there is no "time remaining"
 *
 * The mockup showed "≈ 9 h 20 m left". That needs a per-user reading-speed
 * model, and a wrong estimate is worse than none — it is the kind of number
 * people plan an afternoon around. Deferred until there is real session data
 * to derive it from (the Pomodoro/timer tables are the obvious source).
 */

export interface ReadingProgressRingProps {
  /** 1-based page currently displayed. */
  currentPage: number
  /** Total pages, or null while the document is still loading. */
  totalPages: number | null
  /** Optional count shown alongside, e.g. notes on this document. */
  annotationCount?: number
  /** Diameter in px. */
  size?: number
  className?: string
}

/**
 * Percent read, clamped to 0-100 and safe for a not-yet-loaded document.
 * Exported for tests: the clamping is the part worth pinning.
 */
export function computeProgressPercent(
  currentPage: number,
  totalPages: number | null
): number {
  if (!totalPages || totalPages <= 0) return 0
  if (!Number.isFinite(currentPage) || currentPage <= 0) return 0
  const ratio = Math.min(currentPage, totalPages) / totalPages
  return Math.round(ratio * 100)
}

export const ReadingProgressRing: React.FC<ReadingProgressRingProps> = ({
  currentPage,
  totalPages,
  annotationCount,
  size = 34,
  className = '',
}) => {
  const percent = computeProgressPercent(currentPage, totalPages)

  // Geometry: stroke is inset by half its width so the ring is not clipped.
  const stroke = 3
  const radius = (size - stroke * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent / 100)

  const pageLabel = totalPages ? `p. ${currentPage} of ${totalPages}` : `p. ${currentPage}`

  return (
    <div className={`rv-progress ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ textAlign: 'right', lineHeight: 1.35 }}>
        <b style={{ fontSize: 13, fontWeight: 600, display: 'block', color: 'var(--rv-txt, inherit)' }}>
          {pageLabel}
        </b>
        {annotationCount !== undefined && (
          <span style={{ fontSize: 11.5, color: 'var(--rv-txt-2, inherit)' }}>
            {annotationCount} {annotationCount === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      <div
        style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px` }}
        role="img"
        aria-label={`${percent}% read, ${pageLabel}`}
      >
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--rv-chrome-4, #343643)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--rv-accent, #4ade80)"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 9.5,
            fontWeight: 600,
            color: 'var(--rv-txt-2, inherit)',
          }}
        >
          {percent}%
        </span>
      </div>
    </div>
  )
}

export default ReadingProgressRing
