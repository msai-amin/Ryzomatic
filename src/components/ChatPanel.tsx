import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2, ChevronLeft, ChevronRight, Maximize2, Minimize2, Save, Sparkles, BookOpen, FileText } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { ChatMessage } from './ChatMessage'
import { sendMessageToAI, askForClarification, getFurtherReading } from '../services/aiService'
import { notesIntegrationService } from '../services/notesIntegrationService'

interface ChatPanelProps {
  onClose: () => void
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const { 
    chatMessages, 
    addChatMessage, 
    isTyping, 
    setTyping, 
    currentDocument,
    selectedTextContext,
    chatMode,
    setChatMode,
    setSelectedTextContext,
    user,
  } = useAppStore()
  
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus()
    }
  }, [isMinimized])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  // Handle initial message based on selected text and mode
  useEffect(() => {
    if (selectedTextContext && chatMode !== 'general') {
      handleContextBasedQuery()
    }
  }, [selectedTextContext, chatMode])

  const handleContextBasedQuery = async () => {
    if (!selectedTextContext) return

    setTyping(true)
    
    try {
      let response: string
      const context = selectedTextContext.fullContext

      if (chatMode === 'clarification') {
        // Add user message
        addChatMessage({ 
          role: 'user', 
          content: `Please clarify: "${selectedTextContext.selectedText}"` 
        })
        
        response = await askForClarification(
          selectedTextContext.selectedText,
          context,
          currentDocument?.content,
          user?.tier || 'free'
        )
      } else if (chatMode === 'further-reading') {
        // Add user message
        addChatMessage({ 
          role: 'user', 
          content: `Suggest further reading for: "${selectedTextContext.selectedText}"` 
        })
        
        response = await getFurtherReading(
          selectedTextContext.selectedText,
          context,
          currentDocument?.content,
          user?.tier || 'free'
        )
      } else {
        return
      }

      addChatMessage({ role: 'assistant', content: response })
    } catch (error) {
      addChatMessage({ 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      })
    } finally {
      setTyping(false)
      // Reset to general mode after handling context
      setChatMode('general')
      setSelectedTextContext(null)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage = inputValue.trim()
    setInputValue('')
    addChatMessage({ role: 'user', content: userMessage })

    try {
      setTyping(true)
      
      // Build context with notes if enabled
      // Extract text from pageTexts or content
      let documentContext = ''
      if (currentDocument) {
        if (currentDocument.pageTexts && currentDocument.pageTexts.length > 0) {
          // Use pageTexts (array of strings per page)
          documentContext = currentDocument.pageTexts.join('\n\n')
        } else if (currentDocument.content && typeof currentDocument.content === 'string') {
          // Use string content directly
          documentContext = currentDocument.content
        }
      }
      
      if (includeNotes && currentDocument) {
        const relevantNotes = notesIntegrationService.getRelevantNotes(
          currentDocument.id,
          userMessage
        )
        if (relevantNotes.length > 0) {
          const notesContext = notesIntegrationService.formatNotesForAIContext(
            relevantNotes.slice(0, 5) // Limit to 5 most relevant notes
          )
          documentContext = notesContext + '\n\n' + documentContext
        }
      }
      
      const response = await sendMessageToAI(userMessage, documentContext, user?.tier || 'free')
      addChatMessage({ role: 'assistant', content: response })
    } catch (error) {
      addChatMessage({ 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      })
    } finally {
      setTyping(false)
    }
  }

  const handleSaveAsNote = async (message: typeof chatMessages[0]) => {
    if (!currentDocument || message.role !== 'assistant') return

    setSavingNoteId(message.id)
    
    try {
      // Determine the mode based on message content or current context
      let mode: 'clarification' | 'further-reading' | 'general' = 'general'
      if (message.content.includes('clarify') || message.content.includes('Clarification')) {
        mode = 'clarification'
      } else if (message.content.includes('further reading') || message.content.includes('Further Reading')) {
        mode = 'further-reading'
      }

      await notesIntegrationService.saveAIResponseAsNote(
        message.content,
        currentDocument.id,
        currentDocument.name,
        currentDocument.totalPages ? 1 : 1, // Use current page if available
        selectedTextContext?.selectedText,
        mode
      )

      // Show success feedback (you could add a toast notification here)
      console.log('Note saved successfully')
      
      // Reset saving state after a brief delay
      setTimeout(() => {
        setSavingNoteId(null)
      }, 1000)
    } catch (error) {
      console.error('Failed to save note:', error)
      setSavingNoteId(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const panelWidth = isExpanded ? 'w-[700px]' : 'w-[500px]'
  const panelHeight = isMinimized ? 'h-16' : 'h-full'

  const getModeIcon = () => {
    switch (chatMode) {
      case 'clarification':
        return <Sparkles className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
      case 'further-reading':
        return <BookOpen className="w-5 h-5" style={{ color: 'var(--color-secondary, #10b981)' }} />
      default:
        return <Bot className="w-5 h-5" style={{ color: 'var(--color-text-inverse)' }} />
    }
  }

  const getModeLabel = () => {
    switch (chatMode) {
      case 'clarification':
        return 'Clarification Mode'
      case 'further-reading':
        return 'Further Reading Mode'
      default:
        return 'AI Assistant'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 transition-opacity duration-200"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Chat Panel */}
      <div 
        ref={panelRef}
        className={`fixed right-0 top-0 ${panelWidth} ${panelHeight} shadow-2xl flex flex-col border-l transition-all duration-300 ease-in-out`}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          zIndex: 9999, // Ensure it's above everything
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
              {getModeIcon()}
            </div>
            <div>
              <h2 className="text-heading-3" style={{ color: 'var(--color-text-primary)' }}>{getModeLabel()}</h2>
              <p className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>
                {currentDocument ? `"${currentDocument.name}"` : 'No document loaded'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {currentDocument && (
              <button
                onClick={() => setIncludeNotes(!includeNotes)}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  color: includeNotes ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: includeNotes ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                }}
                title={includeNotes ? 'Notes context enabled' : 'Notes context disabled'}
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              title={isMinimized ? 'Restore' : 'Minimize'}
            >
              {isMinimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label="Close AI Assistant"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    {currentDocument 
                      ? `Ask me anything about "${currentDocument.name}"`
                      : 'Upload a document to start chatting'
                    }
                  </p>
                  {includeNotes && currentDocument && (
                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      💡 I'll include your notes for better context
                    </p>
                  )}
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className="relative group">
                    <ChatMessage message={message} />
                    {message.role === 'assistant' && (
                      <button
                        onClick={() => handleSaveAsNote(message)}
                        disabled={savingNoteId === message.id}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg text-xs flex items-center space-x-1"
                        style={{
                          backgroundColor: 'var(--color-background)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}
                        title="Save as note"
                      >
                        {savingNoteId === message.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3" />
                            <span>Save Note</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
              
              {isTyping && (
                <div className="flex items-center space-x-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <Bot className="w-5 h-5" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-tertiary)' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm">AI is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex space-x-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={currentDocument ? `Ask about "${currentDocument.name}"...` : 'Upload a document first...'}
                  className="flex-1 px-4 py-2 rounded-md focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                  disabled={isTyping || !currentDocument}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping || !currentDocument}
                  className="flex items-center space-x-2 px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                    borderRadius: 'var(--border-radius-md)',
                  }}
                >
                  {isTyping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

