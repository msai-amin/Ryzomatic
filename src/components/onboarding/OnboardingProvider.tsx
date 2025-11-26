import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import { useAppStore } from '../../store/appStore'
import { TourStep } from './SpotlightTour'
import { TTS_TOUR_STEPS, RELATED_DOCS_TOUR_STEPS, PEER_REVIEW_TOUR_STEPS, WELCOME_STEP } from './tourSteps'
import { createMockDocument, createMockRelatedDocuments } from './mockDocument'
import { Document } from '../../store/appStore'
import { DocumentRelationshipWithDetails } from '../../../lib/supabase'

export type TourType = 'tts' | 'relatedDocs' | 'peerReview' | null

export interface OnboardingContextType {
  isActive: boolean
  currentStep: number
  currentTour: TourType
  tourSteps: TourStep[]
  startTour: (tourType: TourType) => void
  nextStep: () => void
  previousStep: () => void
  skipTour: () => void
  completeTour: () => void
  closeTour: (dontShowAgain?: boolean) => void
  handleTourAction: (action: string) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

export const useOnboarding = () => {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

interface OnboardingProviderProps {
  children: ReactNode
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const { 
    user, 
    currentDocument, 
    setCurrentDocument, 
    setRelatedDocuments,
    setEditorialMode
  } = useAppStore()
  
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [currentTour, setCurrentTour] = useState<TourType>(null)
  const [tourSteps, setTourSteps] = useState<TourStep[]>([])
  
  // Store previous document state to restore after onboarding
  const previousDocumentRef = useRef<Document | null>(null)
  const previousRelatedDocsRef = useRef<DocumentRelationshipWithDetails[]>([])

  // Auto-start welcome screen for new users
  useEffect(() => {
    if (user && !isActive) {
      const hasCompletedOnboarding = localStorage.getItem('onboarding-completed')
      const hasDismissedOnboarding = localStorage.getItem('onboarding-dismissed')
      if (!hasCompletedOnboarding && !hasDismissedOnboarding) {
        // Show welcome screen after brief delay
        const timer = setTimeout(() => {
          setIsActive(true)
          setTourSteps([WELCOME_STEP])
          setCurrentStep(0)
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [user, isActive])

  const loadMockDocument = () => {
    // Save current state
    previousDocumentRef.current = currentDocument
    previousRelatedDocsRef.current = useAppStore.getState().relatedDocuments
    
    // Load mock document
    const mockDoc = createMockDocument()
    setCurrentDocument(mockDoc)
    
    // Load mock related documents
    const mockRelatedDocs = createMockRelatedDocuments()
    setRelatedDocuments(mockRelatedDocs)
  }

  const restorePreviousState = () => {
    // Restore previous document or clear if none
    if (previousDocumentRef.current) {
      setCurrentDocument(previousDocumentRef.current)
      setRelatedDocuments(previousRelatedDocsRef.current)
    } else {
      setCurrentDocument(null)
      setRelatedDocuments([])
    }
    
    // Clear refs
    previousDocumentRef.current = null
    previousRelatedDocsRef.current = []
  }

  const startTour = (tourType: TourType) => {
    if (!tourType) return

    // Load mock document for the tour (except for peer review which loads it after first step)
    if (tourType !== 'peerReview') {
      loadMockDocument()
    }

    // Set tour steps based on type
    let steps: TourStep[] = []
    switch (tourType) {
      case 'tts':
        steps = TTS_TOUR_STEPS
        break
      case 'relatedDocs':
        steps = RELATED_DOCS_TOUR_STEPS
        break
      case 'peerReview':
        steps = PEER_REVIEW_TOUR_STEPS
        // For peer review, load document after first step
        break
    }

    setTourSteps(steps)
    setCurrentTour(tourType)
    setCurrentStep(0)
    setIsActive(true)
  }

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    restorePreviousState()
    setIsActive(false)
    setCurrentStep(0)
    setCurrentTour(null)
    setTourSteps([])
  }

  const completeTour = () => {
    // Return to welcome menu instead of closing
    restorePreviousState()
    setEditorialMode(false) // Ensure editorial mode is off
    setTourSteps([WELCOME_STEP])
    setCurrentStep(0)
    setCurrentTour(null)
    setIsActive(true) // Keep onboarding active to show welcome menu
  }

  const closeTour = (dontShowAgain: boolean = false) => {
    if (dontShowAgain) {
      localStorage.setItem('onboarding-completed', 'true')
    } else {
      localStorage.setItem('onboarding-dismissed', 'true')
    }
    restorePreviousState()
    setIsActive(false)
    setCurrentStep(0)
    setCurrentTour(null)
    setTourSteps([])
  }

  const handleTourAction = (action: string) => {
    switch (action) {
      case 'startTTSTour':
        startTour('tts')
        break
      case 'startRelatedDocsTour':
        startTour('relatedDocs')
        break
      case 'startPeerReviewTour':
        startTour('peerReview')
        break
      case 'openRelevanceAnalysis':
        // For now, just advance to next step (relevance analysis would open a modal)
        // In a real implementation, this would open the relevance analysis view
        setTimeout(() => {
          // Use functional updates to get current state for both step and steps
          setTourSteps((steps) => {
            setCurrentStep((step) => {
              const nextStep = step + 1
              if (nextStep >= steps.length) {
                completeTour()
                return step // Keep current step since we're completing
              }
              return nextStep
            })
            return steps
          })
        }, 500)
        break
      case 'openGraph':
        // Trigger graph modal via button click
        const graphButton = document.querySelector('[data-onboarding="graph-button"]') as HTMLElement
        if (graphButton) {
          graphButton.click()
        }
        // Auto-advance after graph opens
        setTimeout(() => {
          // Use functional updates to get current state for both step and steps
          setTourSteps((steps) => {
            setCurrentStep((step) => {
              const nextStep = step + 1
              if (nextStep >= steps.length) {
                completeTour()
                return step // Keep current step since we're completing
              }
              return nextStep
            })
            return steps
          })
        }, 500)
        break
      case 'closeGraph':
        // Find and click close button in graph modal
        const closeButton = document.querySelector('[data-onboarding="close-graph"], .modal-close, [aria-label="Close"]') as HTMLElement
        if (closeButton) {
          closeButton.click()
        }
        // Auto-advance after graph closes
        setTimeout(() => {
          // Use functional updates to get current state for both step and steps
          setTourSteps((steps) => {
            setCurrentStep((step) => {
              const nextStep = step + 1
              if (nextStep >= steps.length) {
                completeTour()
                return step // Keep current step since we're completing
              }
              return nextStep
            })
            return steps
          })
        }, 300)
        break
      case 'waitForDocument':
        // Load mock document and wait for it to be ready
        loadMockDocument()
        // Wait a bit for document to load, then advance
        setTimeout(() => {
          // Use functional updates to get current state for both step and steps
          setTourSteps((steps) => {
            setCurrentStep((step) => {
              const nextStep = step + 1
              if (nextStep >= steps.length) {
                completeTour()
                return step // Keep current step since we're completing
              }
              return nextStep
            })
            return steps
          })
        }, 800)
        break
      case 'openPeerReview':
        setEditorialMode(true)
        // Auto-advance after editorial mode opens
        setTimeout(() => {
          // Use functional updates to get current state for both step and steps
          setTourSteps((steps) => {
            setCurrentStep((step) => {
              const nextStep = step + 1
              if (nextStep >= steps.length) {
                completeTour()
                return step // Keep current step since we're completing
              }
              return nextStep
            })
            return steps
          })
        }, 500)
        break
      case 'finishTour':
        completeTour()
        break
      default:
        console.warn(`Unknown tour action: ${action}`)
    }
  }

  const value: OnboardingContextType = {
    isActive,
    currentStep,
    currentTour,
    tourSteps,
    startTour,
    nextStep,
    previousStep,
    skipTour,
    completeTour,
    closeTour,
    handleTourAction,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

