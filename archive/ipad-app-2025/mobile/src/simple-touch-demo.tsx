import React, { useState } from 'react'

const SimpleTouchDemo = () => {
  const [touchCount, setTouchCount] = useState(0)
  const [lastTouch, setLastTouch] = useState<string>('None')
  const [gestures, setGestures] = useState<string[]>([])

  const addGesture = (message: string) => {
    setGestures(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    setTouchCount(prev => prev + 1)
    setLastTouch(`(${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`)
    addGesture(`Touch at ${lastTouch}`)
  }

  const handleClick = () => {
    setTouchCount(prev => prev + 1)
    addGesture('Button clicked')
  }

  const clearGestures = () => {
    setGestures([])
    setTouchCount(0)
    setLastTouch('None')
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#000000',
      color: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
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
          📱 Simple Touch Demo
        </h1>
        <button
          onClick={clearGestures}
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

      {/* Touch Area */}
      <div
        onTouchStart={handleTouch}
        onTouchEnd={handleTouch}
        style={{
          backgroundColor: '#111827',
          padding: '40px',
          borderRadius: '12px',
          border: '2px solid #9ca3af',
          textAlign: 'center',
          marginBottom: '30px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👆</div>
        <h2 style={{
          fontSize: '1.5rem',
          color: '#9ca3af',
          marginBottom: '10px'
        }}>
          Touch This Area
        </h2>
        <p style={{
          color: '#d1d5db',
          marginBottom: '20px'
        }}>
          Touch anywhere in this box to test touch events
        </p>
        <div style={{
          backgroundColor: '#9ca3af',
          color: '#000000',
          padding: '15px',
          borderRadius: '8px',
          display: 'inline-block'
        }}>
          Touch Count: {touchCount}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <button
          onClick={handleClick}
          style={{
            backgroundColor: '#9ca3af',
            color: '#000000',
            border: 'none',
            padding: '15px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          Click Me
        </button>
        
        <button
          onClick={() => addGesture('Manual gesture added')}
          style={{
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: '1px solid #9ca3af',
            padding: '15px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Add Gesture
        </button>
      </div>

      {/* Status */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid #9ca3af'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          Touch Status
        </h3>
        <div style={{
          color: '#d1d5db',
          lineHeight: '1.6'
        }}>
          <div>Total Touches: {touchCount}</div>
          <div>Last Touch: {lastTouch}</div>
          <div>Touch Events: Working ✅</div>
        </div>
      </div>

      {/* Gesture Log */}
      <div style={{
        backgroundColor: '#111827',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #9ca3af'
      }}>
        <h3 style={{
          fontSize: '1.3rem',
          color: '#ffffff',
          marginBottom: '15px'
        }}>
          Gesture Log
        </h3>
        
        {gestures.length === 0 ? (
          <p style={{
            color: '#d1d5db',
            fontStyle: 'italic'
          }}>
            No gestures yet. Touch the area above!
          </p>
        ) : (
          <div style={{
            backgroundColor: '#000000',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '0.9rem',
            color: '#ffffff'
          }}>
            {gestures.map((gesture, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {gesture}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SimpleTouchDemo
