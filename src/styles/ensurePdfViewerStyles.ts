let injected = false

const CRITICAL_STYLES = `
/* Critical PDF.js text layer styles to keep selection functional even if bundled CSS fails */
.textLayer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  color: #000;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  overflow: hidden;
  opacity: 1;
}

.textLayer span,
.textLayer .endOfContent {
  position: absolute;
  white-space: pre;
  transform-origin: 0 0;
}

.textLayer span {
  pointer-events: auto;
}

.textLayer .endOfContent {
  pointer-events: none;
}

.annotationLayer,
.highlightLayer {
  pointer-events: none;
}

.highlightLayer button,
.highlightLayer [data-highlight-action] {
  pointer-events: auto;
}
`

export function ensurePdfViewerStyles(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (injected) {
    return
  }

  const existing = document.getElementById('pdf-viewer-critical-styles')
  if (existing) {
    injected = true
    return
  }

  const style = document.createElement('style')
  style.id = 'pdf-viewer-critical-styles'
  style.setAttribute('data-origin', 'ryzomatic-critical-pdf-styles')
  style.textContent = CRITICAL_STYLES
  document.head.appendChild(style)
  injected = true
}

export function arePdfViewerStylesApplied(): boolean {
  if (typeof document === 'undefined') {
    return true
  }
  const styleEl = document.getElementById('pdf-viewer-critical-styles')
  if (!styleEl) {
    return false
  }
  const probe = document.createElement('div')
  probe.className = 'textLayer'
  document.body.appendChild(probe)
  const pointerEvents = window.getComputedStyle(probe).pointerEvents
  document.body.removeChild(probe)
  return pointerEvents === 'auto'
}
