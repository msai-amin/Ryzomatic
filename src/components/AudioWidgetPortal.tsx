/**
 * AudioWidgetPortal - Renders AudioWidget outside React tree to avoid circular dependencies
 * 
 * This component uses a portal to render AudioWidget directly to document.body,
 * with a delay to ensure all other components are fully initialized first.
 */

import { useEffect, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/appStore'
import { AudioWidget } from './AudioWidget'

const AudioWidgetPortalComponent: React.FC = () => {
  const [ready, setReady] = useState(false)
  const currentDocument = useAppStore(state => state.currentDocument)

  useEffect(() => {
    console.log('🔊 AudioWidgetPortal: Mounted, waiting for app initialization...')
    
    // Wait 1 second for app to fully initialize before rendering AudioWidget
    const timer = setTimeout(() => {
      console.log('🔊 AudioWidgetPortal: Ready to render AudioWidget (when document loads)')
      setReady(true)
    }, 1000)
    
    return () => {
      console.log('🔊 AudioWidgetPortal: Cleanup (component unmounting)')
      clearTimeout(timer)
    }
  }, []) // Empty deps = only run once on mount

  // Don't render if:
  // 1. On server
  // 2. Not ready yet (1 second delay)
  // 3. No document loaded
  if (typeof document === 'undefined' || !ready || !currentDocument) {
    if (ready && !currentDocument) {
      console.log('🔊 AudioWidgetPortal: No document loaded, not rendering AudioWidget')
    }
    return null
  }

  console.log('🔊 AudioWidgetPortal: Rendering AudioWidget to document.body (document:', currentDocument.name, ')')

  // Render AudioWidget directly to document.body via portal
  return createPortal(
    <AudioWidget />,
    document.body
  )
}

// Memoize to prevent re-renders when parent (ThemedApp) re-renders
export const AudioWidgetPortal = memo(AudioWidgetPortalComponent)

