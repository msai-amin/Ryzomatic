import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAppStore } from '../../store/appStore'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  target?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: () => void
  skipable?: boolean
  required?: boolean
  category: 'welcome' | 'document' | 'ai' | 'productivity' | 'advanced'
}

export interface OnboardingContextType {
  isActive: boolean
  currentStep: number
  steps: OnboardingStep[]
  startOnboarding: (category?: string) => void
  nextStep: () => void
  previousStep: () => void
  skipStep: () => void
  completeOnboarding: () => void
  closeOnboarding: () => void
  isStepCompleted: (stepId: string) => boolean
  markStepCompleted: (stepId: string) => void
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
  const { user, currentDocument } = useAppStore()
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [steps, setSteps] = useState<OnboardingStep[]>([])

  // Define onboarding steps based on app features
  const allSteps: OnboardingStep[] = [
    // Welcome & Getting Started
    {
      id: 'welcome',
      title: 'Welcome to ryzomatic! 🎓',
      description: 'Let\'s take a quick tour to help you get the most out of your reading experience. We\'ll show you the key features step by step.',
      placement: 'center',
      category: 'welcome',
      skipable: false,
      required: true
    },
    {
      id: 'upload-document',
      title: 'Upload Your First Document 📄',
      description: 'Click the "New Material" button to upload a PDF or text document. This is where your reading journey begins!',
      target: '[data-tour="upload-button"]',
      placement: 'bottom',
      category: 'document',
      skipable: true,
      required: true
    },
    {
      id: 'document-library',
      title: 'Document Library 📚',
      description: 'Access all your uploaded documents here. Organize them with tags, search through them, and track your reading progress.',
      target: '[data-tour="library-button"]',
      placement: 'bottom',
      category: 'document',
      skipable: true
    },
    
    // AI Features
    {
      id: 'ai-chat',
      title: 'AI Chat Assistant 🤖',
      description: 'Click here to open the AI chat. Select text in your document and right-click to get AI explanations, summaries, or further reading suggestions.',
      target: '[data-tour="chat-button"]',
      placement: 'bottom',
      category: 'ai',
      skipable: true
    },
    {
      id: 'text-selection',
      title: 'Smart Text Selection ✨',
      description: 'Select any text in your document and right-click to access AI features like clarification, further reading, or saving notes.',
      target: 'body',
      placement: 'center',
      category: 'ai',
      skipable: true
    },
    
    // Productivity Features
    {
      id: 'pomodoro-timer',
      title: 'Focus with Pomodoro Timer 🍅',
      description: 'Boost your reading focus with our Pomodoro timer! Click here to start a 25-minute focused reading session, followed by a 5-minute break. Perfect for maintaining concentration during long study sessions.',
      target: '[data-tour="pomodoro-button"]',
      placement: 'bottom',
      category: 'productivity',
      skipable: true
    },
    {
      id: 'pomodoro-stats',
      title: 'Track Your Progress 📊',
      description: 'View your reading statistics and Pomodoro sessions in the sidebar. See how much time you\'ve spent reading, your focus patterns, and celebrate your productivity achievements!',
      target: '[data-tour="sidebar-stats"]',
      placement: 'right',
      category: 'productivity',
      skipable: true
    },
    {
      id: 'pomodoro-widget',
      title: 'Floating Pomodoro Widget ⏱️',
      description: 'See that floating timer in the corner? You can drag it anywhere on screen! Click the expand button to open the full Pomodoro dashboard with detailed controls and settings.',
      target: 'body',
      placement: 'center',
      category: 'productivity',
      skipable: true
    },
    {
      id: 'highlighting',
      title: 'Smart Highlighting & Annotations 🎨',
      description: 'Highlight important text with different colors to organize your thoughts. Each color has a special meaning: yellow for interesting points, blue for key concepts, red for critiques, green for evidence, and teal for questions.',
      target: 'body',
      placement: 'center',
      category: 'productivity',
      skipable: true
    },
    {
      id: 'annotation-colors',
      title: 'Color-Coded Annotations 📝',
      description: 'Right-click on highlighted text to add notes, edit annotations, or change colors. This helps you build a personal knowledge base as you read.',
      target: 'body',
      placement: 'center',
      category: 'productivity',
      skipable: true
    },
    
    // Advanced Features
    {
      id: 'settings',
      title: 'Customize Your Experience ⚙️',
      description: 'Adjust typography, themes, and reading preferences to match your style. Make the app truly yours!',
      target: '[data-tour="settings-button"]',
      placement: 'bottom',
      category: 'advanced',
      skipable: true
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts ⌨️',
      description: 'Use keyboard shortcuts for faster navigation. Press Ctrl+/ (or Cmd+/) to see all available shortcuts.',
      target: 'body',
      placement: 'center',
      category: 'advanced',
      skipable: true
    }
  ]

  // Filter steps based on context
  useEffect(() => {
    let filteredSteps = allSteps

    // If no document is loaded, prioritize document-related steps
    if (!currentDocument) {
      filteredSteps = allSteps.filter(step => 
        step.category === 'welcome' || 
        step.category === 'document' ||
        step.id === 'ai-chat' // Show AI chat even without document
      )
    }

    setSteps(filteredSteps)
  }, [currentDocument])

  // Auto-start onboarding for new users
  useEffect(() => {
    if (user && !isActive && steps.length > 0) {
      const hasCompletedOnboarding = localStorage.getItem('onboarding-completed')
      const hasDismissedOnboarding = localStorage.getItem('onboarding-dismissed')
      // Only start onboarding if user hasn't completed it AND hasn't dismissed it
      if (!hasCompletedOnboarding && !hasDismissedOnboarding) {
        // Small delay to ensure UI is rendered
        const timer = setTimeout(() => {
          startOnboarding()
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [user, isActive, steps.length])

  const startOnboarding = (category?: string) => {
    let filteredSteps = steps
    if (category) {
      filteredSteps = steps.filter(step => step.category === category)
    }
    setSteps(filteredSteps)
    setCurrentStep(0)
    setIsActive(true)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeOnboarding()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipStep = () => {
    const currentStepData = steps[currentStep]
    if (currentStepData) {
      markStepCompleted(currentStepData.id)
    }
    nextStep()
  }

  const completeOnboarding = () => {
    localStorage.setItem('onboarding-completed', 'true')
    setIsActive(false)
    setCurrentStep(0)
  }

  const closeOnboarding = () => {
    // Save dismissal flag so it doesn't pop up again
    localStorage.setItem('onboarding-dismissed', 'true')
    setIsActive(false)
    setCurrentStep(0)
  }

  const isStepCompleted = (stepId: string) => {
    return completedSteps.has(stepId)
  }

  const markStepCompleted = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
  }

  const contextValue: OnboardingContextType = {
    isActive,
    currentStep,
    steps,
    startOnboarding,
    nextStep,
    previousStep,
    skipStep,
    completeOnboarding,
    closeOnboarding,
    isStepCompleted,
    markStepCompleted
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  )
}
