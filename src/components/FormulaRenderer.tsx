/**
 * Formula Renderer Component
 * 
 * Renders mathematical formulas using KaTeX
 * with fallback handling and tooltips
 */

import React, { useMemo, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Copy, AlertCircle } from 'lucide-react'

export interface FormulaRendererProps {
  latex: string
  isBlock?: boolean
  fallback?: string
  showCopyButton?: boolean
  className?: string
}

export const FormulaRenderer: React.FC<FormulaRendererProps> = ({
  latex,
  isBlock = false,
  fallback,
  showCopyButton = true,
  className = '',
}) => {
  const [copied, setCopied] = useState(false)
  const [showError, setShowError] = useState(false)

  // Render LaTeX to HTML using KaTeX
  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
        strict: false,
        trust: false,
        output: 'html',
      })
    } catch (error) {
      console.warn('KaTeX rendering error:', error)
      setShowError(true)
      return null
    }
  }, [latex, isBlock])

  // Copy LaTeX to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latex)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy LaTeX:', error)
    }
  }

  // If rendering failed, show fallback
  if (!renderedHtml || showError) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${className}`}
        style={{
          fontFamily: 'monospace',
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          padding: '2px 4px',
          borderRadius: '3px',
          color: 'var(--color-text-primary)',
        }}
        title="Formula rendering failed. Showing original text."
      >
        <AlertCircle className="w-3 h-3" style={{ color: 'var(--color-error)' }} />
        {fallback || latex}
      </span>
    )
  }

  // Block formula (display mode)
  if (isBlock) {
    return (
      <div className={`formula-block ${className}`}>
        <div
          className="formula-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '1rem 0',
            padding: '1rem',
            backgroundColor: 'var(--color-background-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            position: 'relative',
            overflowX: 'auto',
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            style={{ color: 'var(--color-text-primary)' }}
          />
          
          {showCopyButton && (
            <button
              onClick={handleCopy}
              className="formula-copy-btn"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '4px 8px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7'
              }}
              title={copied ? 'Copied!' : 'Copy LaTeX'}
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'LaTeX'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Inline formula
  return (
    <span
      className={`formula-inline ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        margin: '0 2px',
        position: 'relative',
        cursor: showCopyButton ? 'pointer' : 'default',
      }}
      onClick={showCopyButton ? handleCopy : undefined}
      title={showCopyButton ? (copied ? 'Copied!' : 'Click to copy LaTeX') : latex}
    >
      <span
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        style={{ color: 'var(--color-text-primary)' }}
      />
      
      {copied && (
        <span
          style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-success)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          Copied!
        </span>
      )}
    </span>
  )
}

/**
 * Formula Placeholder Component
 * Shows loading state while formula is being converted
 */
export const FormulaPlaceholder: React.FC<{
  text: string
  isBlock?: boolean
}> = ({ text, isBlock = false }) => {
  if (isBlock) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '1rem 0',
          padding: '1rem',
          backgroundColor: 'var(--color-background-secondary)',
          borderRadius: '8px',
          border: '1px dashed var(--color-border)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'monospace',
          fontSize: '0.9em',
        }}
      >
        <div className="animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            className="spinner"
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Converting: {text.substring(0, 40)}{text.length > 40 ? '...' : ''}
        </div>
      </div>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 4px',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: '3px',
        color: 'var(--color-text-secondary)',
        fontFamily: 'monospace',
        fontSize: '0.9em',
      }}
      title="Converting formula..."
    >
      <span className="animate-pulse" style={{ width: '8px', height: '8px', backgroundColor: 'var(--color-primary)', borderRadius: '50%' }} />
      {text.substring(0, 20)}{text.length > 20 ? '...' : ''}
    </span>
  )
}

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

