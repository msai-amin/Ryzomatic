import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useOnboarding } from './OnboardingProvider'

export interface TourStep {
  targetId: string
  title: string
  body: string
  buttonLabel: string
  action?: string
  secondaryLabel?: string
  secondaryAction?: string
  icon?: string // Emoji or icon identifier
  image?: string // Optional image URL or path
  visualHint?: 'graph' | 'audio' | 'editor' | 'document' | 'chat' // Visual hint for styling
}

interface SpotlightTourProps {
  steps: TourStep[]
  onAction?: (action: string) => void
}

export const SpotlightTour: React.FC<SpotlightTourProps> = ({ steps = [], onAction }) => {
  const { isActive, currentStep, nextStep, previousStep, completeTour, closeTour } = useOnboarding()
  const [spotlightRect, setSpotlightRect] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' | 'left' | 'right' })

  const currentStepData = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  // Find and position target element
  const updateSpotlight = useCallback(() => {
    if (!currentStepData) return

    // Skip spotlight for setup/welcome steps (they use centered modals)
    if (currentStepData.targetId === 'onboarding-welcome' || currentStepData.targetId === 'onboarding-peer-review-setup') {
      return
    }

    const findAndPosition = () => {
      // Try ID first
      let element = document.getElementById(currentStepData.targetId)
      if (!element) {
        // Fallback to data-onboarding selector
        element = document.querySelector(`[data-onboarding="${currentStepData.targetId}"]`) as HTMLElement
      }
      
      if (element) {
        // For audio widget, ensure it's visible (it's fixed positioned)
        if (currentStepData.targetId === 'onboarding-audio-widget' || currentStepData.targetId === 'onboarding-tts-play') {
          // Audio widget is fixed, so we don't need to scroll it
          // Just get its position
        } else {
          // Scroll element into view for other elements
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        }

        // Use requestAnimationFrame to ensure layout is updated
        requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect()
          const { top, left, width, height } = rect

          if (width > 0 && height > 0) {
            const padding = 24
            setSpotlightRect({
              top: top - padding,
              left: left - padding,
              width: width + (padding * 2),
              height: height + (padding * 2)
            })
          }
        })
        return true
      }
      return false
    }

    // Try immediately
    if (!findAndPosition()) {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (findAndPosition() || attempts > 30) { // More attempts for audio widget which might load later
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [currentStepData])

  // Calculate optimal tooltip position
  useLayoutEffect(() => {
    if (!spotlightRect.width || !currentStepData) return

    // Responsive tooltip dimensions
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const MARGIN = 16 // Consistent margin on all sides
    const GAP = 24
    
    // Calculate actual tooltip width (responsive)
    const baseTooltipWidth = 400
    const maxTooltipWidth = windowWidth - (MARGIN * 2)
    const TOOLTIP_WIDTH = Math.min(baseTooltipWidth, maxTooltipWidth)
    const TOOLTIP_HEIGHT = 280

    let top = 0
    let left = 0
    let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

    const spaceBelow = windowHeight - (spotlightRect.top + spotlightRect.height + GAP)
    const spaceAbove = spotlightRect.top - GAP
    const spaceRight = windowWidth - (spotlightRect.left + spotlightRect.width + GAP)
    const spaceLeft = spotlightRect.left - GAP

    // Special handling for specific elements
    if (currentStepData.targetId === 'onboarding-audio-widget') {
      // Audio widget is in bottom-right, position tooltip above it
      placement = 'top'
      top = spotlightRect.top - TOOLTIP_HEIGHT - GAP
      left = spotlightRect.left + (spotlightRect.width / 2) - (TOOLTIP_WIDTH / 2)
      // Ensure it doesn't go off screen
      if (left < MARGIN) left = MARGIN
      if (left + TOOLTIP_WIDTH > windowWidth - MARGIN) {
        left = windowWidth - TOOLTIP_WIDTH - MARGIN
      }
    } else if (currentStepData.targetId === 'onboarding-tts-play') {
      // Second step: audio widget in document view, position tooltip to the left
      placement = 'left'
      top = spotlightRect.top + (spotlightRect.height / 2) - (TOOLTIP_HEIGHT / 2)
      left = spotlightRect.left - TOOLTIP_WIDTH - GAP
      // If not enough space on left, position above
      if (left < MARGIN || spaceLeft < TOOLTIP_WIDTH) {
        placement = 'top'
        top = spotlightRect.top - TOOLTIP_HEIGHT - GAP
        left = spotlightRect.left + (spotlightRect.width / 2) - (TOOLTIP_WIDTH / 2)
      }
    } else if (spotlightRect.left > windowWidth / 2 && spaceLeft > TOOLTIP_WIDTH) {
      placement = 'left'
      top = spotlightRect.top + (spotlightRect.height / 2) - (TOOLTIP_HEIGHT / 2)
      left = spotlightRect.left - TOOLTIP_WIDTH - GAP
      if (top < MARGIN) top = MARGIN
    } else if (spotlightRect.left < 300 && spaceRight > TOOLTIP_WIDTH) {
      placement = 'right'
      top = spotlightRect.top
      left = spotlightRect.left + spotlightRect.width + GAP
    } else if (spaceBelow > TOOLTIP_HEIGHT) {
      placement = 'bottom'
      top = spotlightRect.top + spotlightRect.height + GAP
      left = spotlightRect.left + (spotlightRect.width / 2) - (TOOLTIP_WIDTH / 2)
    } else {
      placement = 'top'
      top = spotlightRect.top - TOOLTIP_HEIGHT - GAP
      left = spotlightRect.left + (spotlightRect.width / 2) - (TOOLTIP_WIDTH / 2)
    }

    // Clamp to viewport with consistent margins
    const minLeft = MARGIN
    const maxLeft = windowWidth - TOOLTIP_WIDTH - MARGIN
    const minTop = MARGIN
    const maxTop = windowHeight - TOOLTIP_HEIGHT - MARGIN
    
    // Ensure tooltip stays within viewport bounds
    left = Math.max(minLeft, Math.min(left, maxLeft))
    top = Math.max(minTop, Math.min(top, maxTop))

    setTooltipPos({ top, left, placement })
  }, [spotlightRect, currentStepData?.targetId])

  useEffect(() => {
    if (isActive && currentStepData) {
      // Skip for welcome/setup steps (they use centered modals)
      if (currentStepData.targetId === 'onboarding-welcome' || currentStepData.targetId === 'onboarding-peer-review-setup') {
        return
      }
      
      // Reset positions to force recalculation
      setSpotlightRect({ top: 0, left: 0, width: 0, height: 0 })
      setTooltipPos({ top: 0, left: 0, placement: 'bottom' })
      
      // Wait a bit for DOM to be ready, then update spotlight
      const timeout1 = setTimeout(() => {
        updateSpotlight()
      }, 100)
      
      // Retry after a longer delay to ensure elements are fully rendered
      const timeout2 = setTimeout(() => {
        updateSpotlight()
      }, 500)
      
      return () => {
        clearTimeout(timeout1)
        clearTimeout(timeout2)
      }
    }
  }, [currentStep, isActive, steps, currentStepData?.targetId, updateSpotlight])

  // Handle window resize and scroll to recalculate tooltip position
  useEffect(() => {
    if (!isActive) return
    
    const handleResize = () => {
      // Force recalculation of tooltip position on resize
      if (spotlightRect.width > 0 && currentStepData) {
        updateSpotlight()
      }
    }
    
    const handleScroll = () => {
      // Recalculate position when scrolling (for audio widget which might move)
      if (spotlightRect.width > 0 && currentStepData) {
        updateSpotlight()
      }
    }
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true) // Use capture to catch all scroll events
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isActive, spotlightRect, currentStepData, updateSpotlight])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTour()
      } else if (e.key === 'ArrowRight' && !isLastStep) {
        handleNext()
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        previousStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isLastStep, isFirstStep, currentStep])

  const handleNext = () => {
    if (currentStepData.action && onAction) {
      onAction(currentStepData.action)
    }

    if (currentStepData.action === 'finishTour') {
      completeTour()
      return
    }

    // For actions that open modals/views or wait for setup, wait a bit then continue
    if (currentStepData.action === 'openGraph' || currentStepData.action === 'openPeerReview' || currentStepData.action === 'waitForDocument') {
      // These actions handle nextStep() themselves with setTimeout
      return
    }

    if (isLastStep) {
      completeTour()
    } else {
      nextStep()
    }
  }

  const handleSecondaryAction = () => {
    if (currentStepData.secondaryAction && onAction) {
      onAction(currentStepData.secondaryAction)
    }
  }

  if (!isActive || !currentStepData) return null

  // Special handling for welcome step and setup steps (centered modal)
  if (currentStepData.targetId === 'onboarding-welcome' || currentStepData.targetId === 'onboarding-peer-review-setup') {
    return (
      <div className="fixed inset-0 z-[100002] flex items-center justify-center font-sans">
        {/* Backdrop */}
        <div 
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
          onClick={() => closeTour()}
        />
        
        {/* Welcome Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-[100003] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl p-8 flex flex-col"
          style={{ 
            width: '500px',
            maxWidth: 'calc(100vw - 32px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => closeTour()}
            className="absolute top-4 right-4 p-1 rounded transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon - different for welcome vs setup */}
          {currentStepData.targetId === 'onboarding-welcome' ? (
            <motion.div 
              className="mb-6 flex items-center justify-center"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}
              >
                <span className="relative z-10">📚</span>
                <div 
                  className="absolute inset-0 rounded-full animate-pulse opacity-30"
                  style={{
                    background: 'var(--color-primary)',
                    transform: 'scale(1.3)'
                  }}
                />
              </div>
            </motion.div>
          ) : currentStepData.icon ? (
            <motion.div 
              className="mb-6 flex items-center justify-center"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl relative"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}
              >
                <span className="relative z-10">{currentStepData.icon}</span>
                <div 
                  className="absolute inset-0 rounded-full animate-pulse opacity-30"
                  style={{
                    background: 'var(--color-primary)',
                    transform: 'scale(1.3)'
                  }}
                />
              </div>
            </motion.div>
          ) : null}

          <h2 className="text-2xl font-bold mb-4 text-center" style={{ color: 'var(--color-text-primary)' }}>
            {currentStepData.title}
          </h2>
          <p className="text-base mb-6 text-center leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {currentStepData.body}
          </p>

          {/* Show tour selection buttons only for welcome step */}
          {currentStepData.targetId === 'onboarding-welcome' ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                if (onAction) onAction('startTTSTour')
              }}
              className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">🔊</span>
              <span>Start TTS Tour</span>
            </button>
            <button
              onClick={() => {
                if (onAction) onAction('startRelatedDocsTour')
              }}
              className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📊</span>
              <span>Start Related Documents Tour</span>
            </button>
            <button
              onClick={() => {
                if (onAction) onAction('startPeerReviewTour')
              }}
              className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📝</span>
              <span>Start Peer Review Tour</span>
            </button>
                   <div className="flex flex-col gap-3">
                     <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                       <input
                         type="checkbox"
                         id="dont-show-again"
                         className="w-4 h-4 rounded border"
                         style={{
                           accentColor: 'var(--color-primary)',
                           borderColor: 'var(--color-border)'
                         }}
                       />
                       <span className="text-sm">Don't show this again</span>
                     </label>
                     <button
                       onClick={() => {
                         const checkbox = document.getElementById('dont-show-again-welcome') as HTMLInputElement
                         closeTour(checkbox?.checked || false)
                       }}
                       className="px-6 py-3 border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-semibold rounded-md transition-colors"
                       style={{ color: 'var(--color-text-primary)' }}
                     >
                       Skip Tour
                     </button>
                   </div>
          </div>
          ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md transition-colors"
            >
              {currentStepData.buttonLabel}
            </button>
            <div className="flex justify-center gap-2 mt-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: idx === currentStep ? '24px' : '6px',
                    backgroundColor: idx === currentStep
                      ? 'var(--color-primary)'
                      : 'var(--color-border)'
                  }}
                />
              ))}
            </div>
          </div>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-[100001] pointer-events-none"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
      />
      
      <div className="fixed inset-0 z-[100002] pointer-events-none overflow-hidden font-sans">
        {/* Spotlight highlight */}
        <motion.div
          className="absolute rounded-xl pointer-events-none border-2 border-[var(--color-primary)]/50 transition-all duration-500"
          animate={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
          style={{
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)"
          }}
        >
          <div className="absolute inset-0 rounded-xl bg-[var(--color-primary)]/5 animate-pulse" />
        </motion.div>

        {/* Disable pointer events on target element */}
        {currentStepData && (
          <style>{`
            #${currentStepData.targetId}, [data-onboarding="${currentStepData.targetId}"] {
              pointer-events: none !important;
              position: relative;
              z-index: 100000;
            }
          `}</style>
        )}

        {/* Tooltip */}
        <AnimatePresence mode='wait'>
          <motion.div
            key={currentStepData.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute pointer-events-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-2xl p-6 flex flex-col"
            style={{ 
              top: `${tooltipPos.top}px`, 
              left: `${tooltipPos.left}px`,
              width: '400px',
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 100003,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span 
                className="text-[10px] font-mono tracking-wider px-2 py-1 rounded border"
                style={{
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-primary-light)',
                  borderColor: 'var(--color-primary)'
                }}
              >
                STEP {String(currentStep + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
              </span>
              <button
                onClick={() => closeTour()}
                className="p-1 rounded transition-colors hover:bg-[var(--color-surface-hover)]"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Close tour"
                title="Close tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Icon/Visual Indicator */}
            {(currentStepData.icon || currentStepData.visualHint) && (
              <div className="mb-4 flex items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, type: 'spring' }}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-4xl relative"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-primary) 100%)',
                    border: '2px solid var(--color-primary)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <span className="relative z-10">
                    {currentStepData.icon || (
                      currentStepData.visualHint === 'graph' ? '📊' :
                      currentStepData.visualHint === 'audio' ? '🔊' :
                      currentStepData.visualHint === 'editor' ? '✍️' :
                      currentStepData.visualHint === 'document' ? '📄' :
                      currentStepData.visualHint === 'chat' ? '💬' : '✨'
                    )}
                  </span>
                  <div 
                    className="absolute inset-0 rounded-full animate-pulse opacity-50"
                    style={{
                      background: 'var(--color-primary)',
                      transform: 'scale(1.2)'
                    }}
                  />
                </motion.div>
              </div>
            )}

            <h3 
              className="text-xl font-bold mb-3 text-center"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {currentStepData.title}
            </h3>

            {/* Image Preview - Display BEFORE body text */}
            {currentStepData.image && (
              <div className="mb-4 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
                <img 
                  src={currentStepData.image} 
                  alt={currentStepData.title}
                  className="w-full h-auto"
                  style={{ 
                    maxHeight: '300px', 
                    width: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  onError={(e) => {
                    console.error('Failed to load onboarding image:', currentStepData.image)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            <p 
              className="text-sm mb-6 leading-relaxed text-center"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {currentStepData.body}
            </p>

            <div className="flex justify-between items-center mt-auto">
              <div className="flex gap-2">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: idx === currentStep ? '24px' : '6px',
                      backgroundColor: idx === currentStep
                        ? 'var(--color-primary)'
                        : 'var(--color-border)'
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {!isFirstStep && (
                  <button
                    onClick={previousStep}
                    className="px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] font-medium rounded-md text-sm transition-colors"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Previous
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold rounded-md text-sm cursor-pointer transition-colors"
                >
                  {currentStepData.buttonLabel}
                </button>
              </div>
            </div>

            {currentStepData.secondaryLabel && (
              <button 
                onClick={handleSecondaryAction}
                className="mt-4 text-xs text-center w-full transition-colors pointer-events-auto underline"
                style={{
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }}
              >
                {currentStepData.secondaryLabel}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

