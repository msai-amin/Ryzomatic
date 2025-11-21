/**
 * useDraggable Hook
 * 
 * Provides drag-and-drop functionality for UI elements.
 * Handles mouse events, position clamping, and viewport constraints.
 */

import { useState, useCallback, useRef, useEffect, RefObject } from 'react'

export interface DraggableOptions {
  initialPosition?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
  elementRef: RefObject<HTMLElement>
  sidebarWidth?: number
  isSidebarOpen?: boolean
}

export interface DraggableResult {
  position: { x: number; y: number }
  isDragging: boolean
  handleMouseDown: (e: React.MouseEvent) => void
  setPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
}

export const useDraggable = ({
  initialPosition = { x: 0, y: 0 },
  onPositionChange,
  elementRef,
  sidebarWidth = 0,
  isSidebarOpen = false
}: DraggableOptions): DraggableResult => {
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number }>(initialPosition)
  
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const elementSizeRef = useRef({ width: 280, height: 160 })
  
  // Clamp position to viewport bounds
  const clampPosition = useCallback(
    (pos: { x: number; y: number }) => {
      if (typeof window === 'undefined') {
        return pos
      }
      
      const viewportWidth = window.innerWidth || 1200
      const viewportHeight = window.innerHeight || 800
      const measuredWidth = elementRef.current?.offsetWidth ?? elementSizeRef.current.width
      const measuredHeight = elementRef.current?.offsetHeight ?? elementSizeRef.current.height
      
      const sidebarGuard = isSidebarOpen ? sidebarWidth + 24 : 24
      const maxX = Math.max(16, viewportWidth - measuredWidth - sidebarGuard)
      const maxY = Math.max(16, viewportHeight - measuredHeight - 24)
      
      const clampedX = Math.min(Math.max(pos.x, 16), maxX)
      const clampedY = Math.min(Math.max(pos.y, 16), maxY)
      
      return { x: clampedX, y: clampedY }
    },
    [isSidebarOpen, sidebarWidth, elementRef]
  )
  
  // Measure element size
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const measure = () => {
      if (!elementRef.current) return
      elementSizeRef.current = {
        width: elementRef.current.offsetWidth || elementSizeRef.current.width,
        height: elementRef.current.offsetHeight || elementSizeRef.current.height
      }
    }
    
    measure()
  }, [elementRef])
  
  // Initialize position if needed
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (initialPosition.x === 0 && initialPosition.y === 0) {
      const elementWidth = elementRef.current?.offsetWidth ?? elementSizeRef.current.width
      const elementHeight = elementRef.current?.offsetHeight ?? elementSizeRef.current.height
      const sidebarGuard = isSidebarOpen ? sidebarWidth + 24 : 24
      
      const defaultPos = {
        x: (window.innerWidth || 1200) - elementWidth - sidebarGuard,
        y: (window.innerHeight || 800) - elementHeight - 24
      }
      
      const clamped = clampPosition(defaultPos)
      setPosition(clamped)
      onPositionChange?.(clamped)
    }
  }, [initialPosition.x, initialPosition.y, clampPosition, isSidebarOpen, sidebarWidth, onPositionChange, elementRef])
  
  // Sync position from props
  useEffect(() => {
    if (isDragging) return
    if (initialPosition.x === 0 && initialPosition.y === 0) return
    
    setPosition(prev => {
      if (Math.abs(prev.x - initialPosition.x) < 0.5 && Math.abs(prev.y - initialPosition.y) < 0.5) {
        return prev
      }
      return clampPosition(initialPosition)
    })
  }, [initialPosition.x, initialPosition.y, isDragging, clampPosition])
  
  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!elementRef.current) return
    
    const rect = elementRef.current.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    
    setIsDragging(true)
  }, [elementRef])
  
  // Handle mouse move
  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const newPos = {
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      }
      
      const clamped = clampPosition(newPos)
      setPosition(clamped)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      
      // Save final position
      setPosition(prev => {
        const final = clampPosition(prev)
        onPositionChange?.(final)
        return final
      })
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, clampPosition, onPositionChange])
  
  return {
    position,
    isDragging,
    handleMouseDown,
    setPosition
  }
}

