import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadModule = async () => await import('../../src/styles/ensurePdfViewerStyles')

describe('ensurePdfViewerStyles', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('injects the critical style element exactly once', async () => {
    const { ensurePdfViewerStyles } = await loadModule()
    ensurePdfViewerStyles()
    ensurePdfViewerStyles()
    const styles = document.querySelectorAll('#pdf-viewer-critical-styles')
    expect(styles).toHaveLength(1)
  })

  it('applies pointer-events:auto to the text layer probe', async () => {
    const { ensurePdfViewerStyles, arePdfViewerStylesApplied } = await loadModule()
    ensurePdfViewerStyles()
    expect(arePdfViewerStylesApplied()).toBe(true)
  })
})
