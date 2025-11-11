import React, { useState, useEffect, useRef } from 'react'
import { HelpCircle, X, BookOpen, Zap, Settings, Brain } from 'lucide-react'
import { useOnboarding } from './OnboardingProvider'

interface HelpTopic {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: string
  steps: string[]
}

const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of using ryzomatic',
    icon: <BookOpen className="w-5 h-5" />,
    category: 'basics',
    steps: [
      'Upload your first document using the "New Material" button',
      'Open the document library to organize your files',
      'Use the AI chat to get help with your reading',
      'Try highlighting important text with different colors'
    ]
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    description: 'Make the most of AI-powered reading assistance',
    icon: <Brain className="w-5 h-5" />,
    category: 'ai',
    steps: [
      'Select text and right-click for AI options',
      'Ask for clarification on complex concepts',
      'Get suggestions for further reading',
      'Save AI insights as notes for later reference'
    ]
  },
  {
    id: 'productivity',
    title: 'Productivity Tools',
    description: 'Boost your reading efficiency and focus',
    icon: <Zap className="w-5 h-5" />,
    category: 'productivity',
    steps: [
      'Use the Pomodoro timer for focused 25-minute reading sessions',
      'Drag the floating Pomodoro widget anywhere on screen',
      'Highlight text with color-coded annotations for better organization',
      'Access text-to-speech controls when viewing documents',
      'Track your reading progress and focus statistics',
      'Use keyboard shortcuts for faster navigation'
    ]
  },
  {
    id: 'annotations',
    title: 'Smart Annotations',
    description: 'Master the art of organized note-taking',
    icon: <BookOpen className="w-5 h-5" />,
    category: 'productivity',
    steps: [
      'Select text and choose from 5 color-coded highlight options',
      'Right-click highlighted text to add personal notes',
      'Use yellow for interesting points, blue for key concepts',
      'Use red for critiques, green for evidence, teal for questions',
      'Edit or delete annotations anytime by right-clicking',
      'Build a searchable knowledge base as you read'
    ]
  },
  {
    id: 'customization',
    title: 'Customization',
    description: 'Personalize your reading experience',
    icon: <Settings className="w-5 h-5" />,
    category: 'advanced',
    steps: [
      'Adjust typography settings for better readability',
      'Choose from different themes and color schemes',
      'Configure text-to-speech voice and speed',
      'Set up keyboard shortcuts for your workflow'
    ]
  }
]

export const ContextualHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null)
  const [helpDismissed, setHelpDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('helpButtonDismissed') === 'true'
  })
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 120, left: 120 })

  const dragStateRef = useRef<{
    startX: number
    startY: number
    top: number
    left: number
  } | null>(null)
  const draggedRef = useRef(false)

  const { startOnboarding } = useOnboarding()

  const handleTopicSelect = (topic: HelpTopic) => {
    setSelectedTopic(topic)
  }

  const handleStartTour = (category?: string) => {
    startOnboarding(category)
    setIsOpen(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedTop = Number(window.localStorage.getItem('helpButtonTop'))
    const storedLeft = Number(window.localStorage.getItem('helpButtonLeft'))

    const defaultTop = window.innerHeight - 120
    const defaultLeft = window.innerWidth - 96

    setPosition({
      top: Number.isFinite(storedTop) ? storedTop : defaultTop,
      left: Number.isFinite(storedLeft) ? storedLeft : defaultLeft
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      setPosition((prev) => ({
        top: Math.min(prev.top, window.innerHeight - 80),
        left: Math.min(prev.left, window.innerWidth - 80)
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('helpButtonTop', String(position.top))
    window.localStorage.setItem('helpButtonLeft', String(position.left))
  }, [position.top, position.left])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('helpButtonDismissed', String(helpDismissed))
  }, [helpDismissed])

  const handleDismiss = () => {
    setIsOpen(false)
    setHelpDismissed(true)
  }

  const handleFloatingMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    draggedRef.current = false
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      top: position.top,
      left: position.left
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStateRef.current) return
      const deltaX = moveEvent.clientX - dragStateRef.current.startX
      const deltaY = moveEvent.clientY - dragStateRef.current.startY

      if (!draggedRef.current && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        draggedRef.current = true
      }

      const nextTop = Math.min(
        Math.max(dragStateRef.current.top + deltaY, 24),
        window.innerHeight - 80
      )
      const nextLeft = Math.min(
        Math.max(dragStateRef.current.left + deltaX, 24),
        window.innerWidth - 80
      )

      setPosition({ top: nextTop, left: nextLeft })
    }

    const handleMouseUp = () => {
      dragStateRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleFloatingButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (draggedRef.current) {
      event.preventDefault()
      event.stopPropagation()
      draggedRef.current = false
      return
    }
    setHelpDismissed(false)
    setIsOpen(true)
  }

  const handleFloatingButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setHelpDismissed(false)
      setIsOpen(true)
    }
  }

  if (!isOpen && helpDismissed) {
    return null
  }

  if (!isOpen) {
    return (
      <div
        className="fixed z-40 flex items-center gap-2"
        style={{ top: position.top, left: position.left }}
        onMouseDown={handleFloatingMouseDown}
      >
        <button
          onClick={handleFloatingButtonClick}
          onKeyDown={handleFloatingButtonKeyDown}
          className="p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-primary)',
          }}
          title="Get help and take a tour"
          aria-label="Get help and take a tour"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors hover:bg-[var(--color-surface-hover)]"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-surface)'
          }}
          title="Hide help button"
          aria-label="Hide help button"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Help Panel */}
      <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Help & Tours</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {!selectedTopic ? (
            <div className="space-y-3">
              <div className="mb-4">
                <button
                  onClick={() => handleStartTour()}
                  className="w-full p-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">🎯</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Take Full Tour</h4>
                      <p className="text-sm text-gray-600">Complete walkthrough of all features</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quick Help Topics</h4>
                {helpTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleTopicSelect(topic)}
                    className="w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-600">
                        {topic.icon}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{topic.title}</h4>
                        <p className="text-sm text-gray-600">{topic.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Topic Header */}
              <div className="flex items-center space-x-3 mb-4">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="text-gray-600">
                  {selectedTopic.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{selectedTopic.title}</h4>
                  <p className="text-sm text-gray-600">{selectedTopic.description}</p>
                </div>
              </div>

              {/* Topic Steps */}
              <div className="space-y-3 mb-4">
                {selectedTopic.steps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 font-semibold text-xs">{index + 1}</span>
                    </div>
                    <p className="text-sm text-gray-700">{step}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleStartTour(selectedTopic.category)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Take {selectedTopic.title} Tour
                </button>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
