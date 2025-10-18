import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

export const useKeyboardShortcuts = () => {
  const { toggleChat, isChatOpen } = useAppStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement as HTMLElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.contentEditable === 'true'

      // Don't trigger shortcuts when typing in inputs
      if (isInputFocused) return

      // Check for modifier keys
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'k':
            event.preventDefault()
            toggleChat()
            break
          case 'u':
            event.preventDefault()
            // Trigger upload modal - would need to be passed as prop or from context
            console.log('Upload shortcut triggered')
            break
          case 'l':
            event.preventDefault()
            // Trigger library modal - would need to be passed as prop or from context
            console.log('Library shortcut triggered')
            break
        }
      }

      // Escape key to close modals
      if (event.key === 'Escape') {
        if (isChatOpen) {
          event.preventDefault()
          toggleChat()
        }
        // Add other modal close logic here
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleChat, isChatOpen])

  return null
}
