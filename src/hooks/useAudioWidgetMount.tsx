/**
 * useAudioWidgetMount - Manages AudioWidget mounting outside React lifecycle
 * 
 * This hook creates a persistent DOM element and mounts AudioWidget to it,
 * ensuring it stays mounted even when parent components re-render or remount.
 */

import { useEffect } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { useAppStore } from '../store/appStore'

let audioWidgetRoot: Root | null = null
let audioWidgetContainer: HTMLDivElement | null = null
let isInitialized = false

export const useAudioWidgetMount = () => {
  const currentDocument = useAppStore(state => state.currentDocument)

  useEffect(() => {
    // Only initialize once globally
    if (isInitialized) {
      console.log('🔊 useAudioWidgetMount: Already initialized, skipping')
      return
    }

    console.log('🔊 useAudioWidgetMount: Initializing AudioWidget mount')

    // Wait 1 second for app to initialize
    const timer = setTimeout(async () => {
      try {
        // Create persistent container
        audioWidgetContainer = document.createElement('div')
        audioWidgetContainer.id = 'audio-widget-root'
        // Start hidden, will show when document loads
        audioWidgetContainer.style.cssText = 'position: fixed; z-index: 100000; bottom: 20px; right: 20px; display: none;'
        document.body.appendChild(audioWidgetContainer)
        
        console.log('🔊 useAudioWidgetMount: Created container element (should have RED BORDER)', audioWidgetContainer)

        // Create React root
        audioWidgetRoot = createRoot(audioWidgetContainer)

        // Dynamically import AudioWidget to avoid circular dependency
        const { AudioWidget } = await import('../components/AudioWidget')
        
        console.log('🔊 useAudioWidgetMount: Mounting AudioWidget')
        audioWidgetRoot.render(<AudioWidget />)
        
        isInitialized = true
      } catch (error) {
        console.error('🔊 useAudioWidgetMount: Failed to mount AudioWidget', error)
      }
    }, 1000)

    // Cleanup only on app unmount (never happens in SPA)
    return () => {
      clearTimeout(timer)
      console.log('🔊 useAudioWidgetMount: App unmounting (cleanup)')
    }
  }, []) // Run once on app mount

  // Show/hide based on document state
  useEffect(() => {
    if (!audioWidgetContainer) return

    if (currentDocument) {
      console.log('🔊 useAudioWidgetMount: Document loaded, showing AudioWidget', {
        documentName: currentDocument.name,
        containerExists: !!audioWidgetContainer,
        containerDisplay: audioWidgetContainer?.style.display,
        containerInDOM: document.body.contains(audioWidgetContainer)
      })
      audioWidgetContainer.style.display = 'block'
    } else {
      console.log('🔊 useAudioWidgetMount: No document, hiding AudioWidget')
      audioWidgetContainer.style.display = 'none'
    }
  }, [currentDocument])
}

