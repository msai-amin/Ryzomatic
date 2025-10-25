import React, { useState, useRef, useEffect } from 'react'

const TouchGesturesDemo = () => {
  const [gestures, setGestures] = useState<string[]>([])
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const addGesture = (message: string) => {
    setGestures(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    setLastTouch({ x: touch.clientX, y: touch.clientY })
    setIsDragging(true)
    addGesture(`Touch started at (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    
    if (e.touches.length === 1 && isDragging && lastTouch) {
      // Single finger drag
      const touch = e.touches[0]
      const deltaX = touch.clientX - lastTouch.x
      const deltaY = touch.clientY - lastTouch.y
      
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setLastTouch({ x: touch.clientX, y: touch.clientY })
      addGesture(`Drag: (${Math.round(deltaX)}, ${Math.round(deltaY)})`)
    } else if (e.touches.length === 2) {
      // Two finger pinch
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      
      // Calculate scale based on distance (simplified)
      const newScale = Math.max(0.5, Math.min(3, distance / 200))
      setScale(newScale)
      addGesture(`Pinch: scale ${newScale.toFixed(2)}`)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setLastTouch(null)
    addGesture('Touch ended')
  }

  // Swipe detection
  const handleSwipe = (direction: string) => {
    addGesture(`Swipe ${direction} detected`)
  }

  // Keyboard shortcuts for testing
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'r':
          setScale(1)
          setPosition({ x: 0, y: 0 })
          addGesture('Reset position and scale')
          break
        case 'z':
          setScale(prev => Math.min(3, prev + 0.1))
          addGesture('Zoom in')
          break
        case 'x':
          setScale(prev => Math.max(0.5, prev - 0.1))
          addGesture('Zoom out')
          break
        case 'c':
          setGestures([])
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid #9ca3af'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          color: '#9ca3af',
          margin: 0 
        }}>
          📱 Touch Gestures Demo
        </h1>
        <button
          onClick={() => setGestures([])}
          style={{
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: '1px solid #9ca3af',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '30px',
        border: '1px solid #9ca3af'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          Touch Gestures to Test
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          color: '#d1d5db',
          lineHeight: '1.6'
        }}>
          <div>
            <strong>Single Finger:</strong><br/>
            • Drag to move content<br/>
            • Tap to select
          </div>
          <div>
            <strong>Two Fingers:</strong><br/>
            • Pinch to zoom in/out<br/>
            • Two-finger drag
          </div>
          <div>
            <strong>Keyboard:</strong><br/>
            • R = Reset<br/>
            • Z = Zoom in<br/>
            • X = Zoom out<br/>
            • C = Clear logs
          </div>
        </div>
      </div>

      {/* Interactive Area */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '20px',
        height: '60vh'
      }}>
        {/* Touch Area */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            backgroundColor: '#111827',
            borderRadius: '12px',
            border: '2px solid #9ca3af',
            position: 'relative',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}
          >
            <div style={{
              fontSize: '3rem',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              📱
            </div>
            <div style={{
              fontSize: '1.5rem',
              color: '#9ca3af',
              textAlign: 'center',
              marginBottom: '10px'
            }}>
              Touch & Gesture Area
            </div>
            <div style={{
              fontSize: '1rem',
              color: '#d1d5db',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              Scale: {scale.toFixed(2)} | Position: ({Math.round(position.x)}, {Math.round(position.y)})
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              width: '200px'
            }}>
              <button
                onClick={() => handleSwipe('Left')}
                style={{
                  backgroundColor: '#9ca3af',
                  color: '#000000',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ← Left
              </button>
              <button
                onClick={() => handleSwipe('Up')}
                style={{
                  backgroundColor: '#9ca3af',
                  color: '#000000',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ↑ Up
              </button>
              <button
                onClick={() => handleSwipe('Right')}
                style={{
                  backgroundColor: '#9ca3af',
                  color: '#000000',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Right →
              </button>
            </div>
          </div>
        </div>

        {/* Gesture Log */}
        <div style={{
          backgroundColor: '#111827',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #9ca3af',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{
            fontSize: '1.3rem',
            color: '#ffffff',
            marginBottom: '15px'
          }}>
            Gesture Log
          </h3>
          
          <div style={{
            backgroundColor: '#000000',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            color: '#ffffff',
            flex: 1,
            overflowY: 'auto',
            minHeight: '200px'
          }}>
            {gestures.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic' }}>
                No gestures detected yet.<br/>
                Try touching the area!
              </div>
            ) : (
              gestures.map((gesture, index) => (
                <div key={index} style={{ marginBottom: '5px' }}>
                  {gesture}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#111827',
        borderRadius: '8px',
        border: '1px solid #9ca3af',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: '#d1d5db' }}>
          <strong>Status:</strong> {isDragging ? 'Dragging' : 'Ready'} | 
          Scale: {scale.toFixed(2)} | 
          Position: ({Math.round(position.x)}, {Math.round(position.y)})
        </div>
        <button
          onClick={() => {
            setScale(1)
            setPosition({ x: 0, y: 0 })
            addGesture('Reset position and scale')
          }}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default TouchGesturesDemo
