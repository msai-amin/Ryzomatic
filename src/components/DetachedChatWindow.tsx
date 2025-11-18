import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { AIChatPanel } from './ChatPanel'

const MIN_WIDTH = 360
const MIN_HEIGHT = 420
const MAX_WIDTH = 720
const MAX_HEIGHT = 900

export const DetachedChatWindow: React.FC = () => {
  const {
    chatWindowPosition,
    chatWindowSize,
    setChatWindowPosition,
    setChatWindowSize,
    toggleChat
  } = useAppStore()

  const windowRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; top: number; left: number } | null>(null)
  const resizeStateRef = useRef<{
    startX: number
    startY: number
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    const headerEl = windowRef.current?.querySelector<HTMLElement>('[data-chat-header]')
    if (!headerEl) return

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault()
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        top: chatWindowPosition.top,
        left: chatWindowPosition.left
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStateRef.current) return
        const deltaX = moveEvent.clientX - dragStateRef.current.startX
        const deltaY = moveEvent.clientY - dragStateRef.current.startY

        const nextTop = Math.max(24, dragStateRef.current.top + deltaY)
        const maxLeft = window.innerWidth - 120
        const nextLeft = Math.min(Math.max(24, dragStateRef.current.left + deltaX), maxLeft)

        setChatWindowPosition({
          top: Math.min(nextTop, window.innerHeight - 120),
          left: nextLeft
        })
      }

      const handleMouseUp = () => {
        dragStateRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    headerEl.addEventListener('mousedown', handleMouseDown)
    return () => {
      headerEl.removeEventListener('mousedown', handleMouseDown)
    }
  }, [chatWindowPosition.top, chatWindowPosition.left, setChatWindowPosition])

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: chatWindowSize.width,
      height: chatWindowSize.height
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStateRef.current) return
      const deltaX = moveEvent.clientX - resizeStateRef.current.startX
      const deltaY = moveEvent.clientY - resizeStateRef.current.startY

      const nextWidth = Math.min(
        Math.max(resizeStateRef.current.width + deltaX, MIN_WIDTH),
        Math.min(MAX_WIDTH, window.innerWidth - chatWindowPosition.left - 24)
      )
      const nextHeight = Math.min(
        Math.max(resizeStateRef.current.height + deltaY, MIN_HEIGHT),
        Math.min(MAX_HEIGHT, window.innerHeight - chatWindowPosition.top - 24)
      )

      setChatWindowSize({
        width: nextWidth,
        height: nextHeight
      })
    }

    const handleMouseUp = () => {
      resizeStateRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const { top, left } = chatWindowPosition
  const { width, height } = chatWindowSize

  return (
    <div
      ref={windowRef}
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        top,
        left,
        width,
        height,
        zIndex: 2000,
        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
        borderRadius: '18px',
        overflow: 'hidden',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="flex h-full flex-col w-full" style={{ margin: 0, padding: 0 }}>
        <AIChatPanel onClose={toggleChat} />
      </div>

      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '18px',
          height: '18px',
          cursor: 'nwse-resize'
        }}
      />
    </div>
  )
}

