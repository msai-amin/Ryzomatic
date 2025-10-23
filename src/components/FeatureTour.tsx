import React, { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Clock, Target, Trophy } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface TourStep {
  id: string
  target: string
  title: string
  content: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  action?: () => void
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: 'Welcome to Academic Reader Pro! 🎓',
    content: 'Let\'s take a quick tour to help you get the most out of your reading experience.',
    placement: 'bottom'
  },
  {
    id: 'pomodoro-button',
    target: '[data-tour="pomodoro-button"]',
    title: 'Pomodoro Timer 🍅',
    content: 'Track your focus sessions with our built-in Pomodoro timer. Click here to start a 25-minute focused reading session.',
    placement: 'bottom',
    action: () => {
      // This will be handled by the parent component
    }
  },
  {
    id: 'tts-button',
    target: '[data-tour="tts-button"]',
    title: 'Text-to-Speech 🔊',
    content: 'Listen to your documents with natural voice synthesis. Perfect for multitasking or accessibility.',
    placement: 'bottom'
  },
  {
    id: 'settings-button',
    target: '[data-tour="settings-button"]',
    title: 'Customize Your Experience ⚙️',
    content: 'Adjust typography, themes, and reading preferences to match your style.',
    placement: 'bottom'
  },
  {
    id: 'library-button',
    target: '[data-tour="library-button"]',
    title: 'Document Library 📚',
    content: 'Access all your uploaded documents, organize them with tags, and track your reading progress.',
    placement: 'bottom'
  },
  {
    id: 'sidebar-stats',
    target: '[data-tour="sidebar-stats"]',
    title: 'Reading Analytics 📊',
    content: 'View your Pomodoro sessions, reading time, and productivity stats right here in the sidebar.',
    placement: 'right'
  }
]

interface FeatureTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export const FeatureTour: React.FC<FeatureTourProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const { hasSeenPomodoroTour, setHasSeenPomodoroTour } = useAppStore()

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Focus the target element if it exists
      const targetElement = document.querySelector(tourSteps[currentStep].target)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [isOpen, currentStep])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setHasSeenPomodoroTour(true)
    onComplete()
    onClose()
  }

  const handleSkip = () => {
    setHasSeenPomodoroTour(true)
    onClose()
  }

  if (!isOpen || !isVisible) return null

  const currentStepData = tourSteps[currentStep]
  const targetElement = document.querySelector(currentStepData.target)

  if (!targetElement) {
    // If target element doesn't exist, skip to next step
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
      return null
    } else {
      handleComplete()
      return null
    }
  }

  const rect = targetElement.getBoundingClientRect()
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

  const getTooltipPosition = () => {
    const spacing = 20
    const tooltipWidth = 320
    const tooltipHeight = 200

    let top = rect.top + scrollTop
    let left = rect.left + scrollLeft

    switch (currentStepData.placement) {
      case 'top':
        top = rect.top + scrollTop - tooltipHeight - spacing
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2)
        break
      case 'bottom':
        top = rect.bottom + scrollTop + spacing
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2)
        break
      case 'left':
        top = rect.top + scrollTop + (rect.height / 2) - (tooltipHeight / 2)
        left = rect.left + scrollLeft - tooltipWidth - spacing
        break
      case 'right':
        top = rect.top + scrollTop + (rect.height / 2) - (tooltipHeight / 2)
        left = rect.right + scrollLeft + spacing
        break
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < 10) left = 10
    if (left + tooltipWidth > viewportWidth - 10) {
      left = viewportWidth - tooltipWidth - 10
    }
    if (top < 10) top = 10
    if (top + tooltipHeight > viewportHeight - 10) {
      top = viewportHeight - tooltipHeight - 10
    }

    return { top, left }
  }

  const tooltipPosition = getTooltipPosition()

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleSkip}
      />
      
      {/* Highlight overlay for target element */}
      <div
        className="fixed z-50 pointer-events-none"
        style={{
          top: rect.top + scrollTop - 4,
          left: rect.left + scrollLeft - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          border: '3px solid #3b82f6',
          borderRadius: '8px',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)'
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 max-w-sm"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: '320px'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {currentStepData.id === 'pomodoro-button' && <Clock className="w-5 h-5 text-red-500" />}
            {currentStepData.id === 'sidebar-stats' && <Trophy className="w-5 h-5 text-yellow-500" />}
            {currentStepData.id === 'welcome' && <Target className="w-5 h-5 text-blue-500" />}
            <h3 className="text-lg font-semibold text-gray-900">
              {currentStepData.title}
            </h3>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-gray-700 mb-6 leading-relaxed">
          {currentStepData.content}
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {currentStep + 1} of {tourSteps.length}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>{currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default FeatureTour
