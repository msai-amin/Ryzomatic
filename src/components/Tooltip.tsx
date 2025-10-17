import React, { useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'bottom',
  delay = 300 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
    }, delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setIsVisible(false)
  }

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      zIndex: 9999,
      pointerEvents: 'none' as const,
      whiteSpace: 'nowrap' as const,
    }

    switch (position) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
        }
      case 'bottom':
        return {
          ...baseStyles,
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px',
        }
      case 'left':
        return {
          ...baseStyles,
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px',
        }
      case 'right':
        return {
          ...baseStyles,
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px',
        }
      default:
        return baseStyles
    }
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          style={{
            ...getPositionStyles(),
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#ffffff',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {content}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              ...(position === 'bottom' && {
                top: '-5px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderWidth: '0 5px 5px 5px',
                borderColor: 'transparent transparent rgba(0, 0, 0, 0.9) transparent',
              }),
              ...(position === 'top' && {
                bottom: '-5px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderWidth: '5px 5px 0 5px',
                borderColor: 'rgba(0, 0, 0, 0.9) transparent transparent transparent',
              }),
              ...(position === 'left' && {
                right: '-5px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderWidth: '5px 0 5px 5px',
                borderColor: 'transparent transparent transparent rgba(0, 0, 0, 0.9)',
              }),
              ...(position === 'right' && {
                left: '-5px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderWidth: '5px 5px 5px 0',
                borderColor: 'transparent rgba(0, 0, 0, 0.9) transparent transparent',
              }),
            }}
          />
        </div>
      )}
    </div>
  )
}

