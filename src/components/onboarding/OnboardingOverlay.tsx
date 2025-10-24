import React, { useEffect, useState, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, SkipForward, CheckCircle } from 'lucide-react'
import { useOnboarding } from './OnboardingProvider'

export const OnboardingOverlay: React.FC = () => {
  const {
    isActive,
    currentStep,
    steps,
    nextStep,
    previousStep,
    skipStep,
    completeOnboarding,
    closeOnboarding,
    isStepCompleted
  } = useOnboarding()

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)

  const currentStepData = steps[currentStep]

  // Find and position target element
  useEffect(() => {
    if (!isActive || !currentStepData?.target) {
      setTargetElement(null)
      return
    }

    const findTarget = () => {
      const element = document.querySelector(currentStepData.target!) as HTMLElement
      if (element) {
        setTargetElement(element)
        const rect = element.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        })
      } else {
        // Retry after a short delay if element not found
        setTimeout(findTarget, 100)
      }
    }

    findTarget()
  }, [isActive, currentStep, currentStepData?.target])

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetElement || !currentStepData?.placement) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const tooltipWidth = 360
    const tooltipHeight = 200
    const spacing = 20

    const rect = targetElement.getBoundingClientRect()
    let top: number | string = rect.top + window.scrollY
    let left: number | string = rect.left + window.scrollX

    switch (currentStepData.placement) {
      case 'top':
        top = rect.top + window.scrollY - tooltipHeight - spacing
        left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2)
        break
      case 'bottom':
        top = rect.bottom + window.scrollY + spacing
        left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2)
        break
      case 'left':
        top = rect.top + window.scrollY + (rect.height / 2) - (tooltipHeight / 2)
        left = rect.left + window.scrollX - tooltipWidth - spacing
        break
      case 'right':
        top = rect.top + window.scrollY + (rect.height / 2) - (tooltipHeight / 2)
        left = rect.right + window.scrollX + spacing
        break
      case 'center':
        top = '50%'
        left = '50%'
        break
    }

    // Ensure tooltip stays within viewport
    if (typeof top === 'number') {
      if (top < spacing) top = spacing
      if (top + tooltipHeight > viewportHeight - spacing) {
        top = viewportHeight - tooltipHeight - spacing
      }
    }
    if (typeof left === 'number') {
      if (left < spacing) left = spacing
      if (left + tooltipWidth > viewportWidth - spacing) {
        left = viewportWidth - tooltipWidth - spacing
      }
    }

    return {
      top: typeof top === 'number' ? `${top}px` : top,
      left: typeof left === 'number' ? `${left}px` : left,
      transform: currentStepData.placement === 'center' ? 'translate(-50%, -50%)' : 'none'
    }
  }

  if (!isActive || !currentStepData) return null

  const tooltipPosition = getTooltipPosition()
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0
  const canSkip = currentStepData.skipable !== false

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={closeOnboarding}
      />

      {/* Target Highlight */}
      {targetElement && currentStepData.placement !== 'center' && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: position.top - 4,
            left: position.left - 4,
            width: position.width + 8,
            height: position.height + 8,
            border: '3px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)'
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={overlayRef}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 max-w-sm"
        style={{
          ...tooltipPosition,
          width: '360px',
          maxWidth: '90vw'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {currentStep + 1}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={closeOnboarding}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-gray-700 mb-6 leading-relaxed">
          {currentStepData.description}
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-blue-500' 
                    : index < currentStep 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {currentStep + 1} of {steps.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <div className="flex space-x-2">
            <button
              onClick={previousStep}
              disabled={isFirstStep}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {canSkip && (
              <button
                onClick={skipStep}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>Skip</span>
              </button>
            )}
          </div>

          <button
            onClick={isLastStep ? completeOnboarding : nextStep}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>{isLastStep ? 'Get Started' : 'Next'}</span>
            {isLastStep ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Arrow indicator */}
        {targetElement && currentStepData.placement !== 'center' && (
          <div
            className="absolute w-0 h-0 border-8 border-transparent"
            style={{
              ...(currentStepData.placement === 'top' && {
                bottom: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderTopColor: 'white'
              }),
              ...(currentStepData.placement === 'bottom' && {
                top: '-16px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderBottomColor: 'white'
              }),
              ...(currentStepData.placement === 'left' && {
                right: '-16px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderLeftColor: 'white'
              }),
              ...(currentStepData.placement === 'right' && {
                left: '-16px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderRightColor: 'white'
              })
            }}
          />
        )}
      </div>
    </>
  )
}
