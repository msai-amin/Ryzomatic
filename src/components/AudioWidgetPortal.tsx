/**
 * AudioWidgetPortal - Renders AudioWidget outside React tree to avoid circular dependencies
 * 
 * This component uses a portal to render AudioWidget directly to document.body,
 * completely bypassing the React component tree and avoiding any circular dependency issues.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioWidget } from './AudioWidget'

export const AudioWidgetPortal: React.FC = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log('🔊 AudioWidgetPortal: Mounted and ready to render')
    return () => {
      console.log('🔊 AudioWidgetPortal: Unmounting')
    }
  }, [])

  // Don't render on server
  if (typeof document === 'undefined' || !mounted) {
    return null
  }

  // Render AudioWidget directly to document.body via portal
  return createPortal(
    <AudioWidget />,
    document.body
  )
}

