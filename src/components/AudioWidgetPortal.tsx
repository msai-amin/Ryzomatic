/**
 * AudioWidgetPortal - Renders AudioWidget outside React tree to avoid circular dependencies
 * 
 * This component uses a portal to render AudioWidget directly to document.body,
 * with a delay to ensure all other components are fully initialized first.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioWidget } from './AudioWidget'

export const AudioWidgetPortal: React.FC = () => {
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log('🔊 AudioWidgetPortal: Mounted, waiting for app initialization...')
    
    // Wait 1 second for app to fully initialize before rendering AudioWidget
    const timer = setTimeout(() => {
      console.log('🔊 AudioWidgetPortal: Ready to render AudioWidget')
      setReady(true)
    }, 1000)
    
    return () => {
      console.log('🔊 AudioWidgetPortal: Unmounting')
      clearTimeout(timer)
    }
  }, [])

  // Don't render on server or before ready
  if (typeof document === 'undefined' || !mounted || !ready) {
    return null
  }

  // Render AudioWidget directly to document.body via portal
  return createPortal(
    <AudioWidget />,
    document.body
  )
}

