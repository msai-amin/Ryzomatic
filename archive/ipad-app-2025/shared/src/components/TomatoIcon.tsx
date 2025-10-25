import React from 'react'

interface TomatoIconProps {
  className?: string
  size?: number
  style?: React.CSSProperties
}

export const TomatoIcon: React.FC<TomatoIconProps> = ({ className = '', size = 24, style }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className={className}
      style={style}
    >
      {/* Tomato leaf/stem */}
      <path 
        d="M12 2C11 2 10.5 2.5 10 3C9.5 3.5 9 4 8 4C7 4 6.5 3.5 6 3C5.5 2.5 5 2 4 2C3 2 2.5 2.5 2.5 3.5C2.5 4.5 3 5 4 5.5C5 6 6 6.5 7 7C7.5 7.5 8 8 8 9" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Main tomato body */}
      <path 
        d="M6 11C6 9 7 8 8 8C9 8 9.5 8.5 10 9C10.5 9.5 11 10 12 10C13 10 13.5 9.5 14 9C14.5 8.5 15 8 16 8C17 8 18 9 18 11C18 12 18 13 17.5 14.5C17 16 16 17.5 15 18.5C14 19.5 13 20 12 20C11 20 10 19.5 9 18.5C8 17.5 7 16 6.5 14.5C6 13 6 12 6 11Z"
        fill="currentColor"
        opacity="0.9"
      />
      
      {/* Highlight on tomato */}
      <ellipse 
        cx="10" 
        cy="13" 
        rx="2" 
        ry="3" 
        fill="white" 
        opacity="0.2"
      />
    </svg>
  )
}

