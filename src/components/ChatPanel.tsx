import React, { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Sparkles, FileText, Upload, BookOpen, Save, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { ChatMessage } from './ChatMessage'
import { sendMessageToAI, askForClarification, getFurtherReading } from '../services/aiService'
import { notesIntegrationService } from '../services/notesIntegrationService'
import { Tooltip } from './Tooltip'

interface AIChatPanelProps {
  onClose: () => void
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ onClose }) => {
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
    user
  } = useAppStore()

  const [inputValue, setInputValue] = useState('')
  const [includeNotes, setIncludeNotes] = useState(true)
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentDocument) {
      inputRef.current?.focus()
    }
  }, [currentDocument])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  useEffect(() => {
    const runContextBasedQuery = async () => {
      if (!selectedTextContext) return

      setTyping(true)

      try {
        let response: string
        const context = selectedTextContext.fullContext

        if (chatMode === 'clarification') {
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
        console.error('AI clarification error:', error)
        addChatMessage({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        })
      } finally {
        setTyping(false)
        setChatMode('general')
        setSelectedTextContext(null)
      }
    }

    if (selectedTextContext && chatMode !== 'general') {
      runContextBasedQuery()
    }
  }, [
    selectedTextContext,
    chatMode,
    addChatMessage,
    setTyping,
    currentDocument,
    user,
    setChatMode,
    setSelectedTextContext
  ])

  const createMessageId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping || !currentDocument) return

    const userMessage = inputValue.trim()
    const userMessageId = createMessageId()
    setInputValue('')
    addChatMessage({ role: 'user', content: userMessage, id: userMessageId })

    try {
      setTyping(true)

      let documentContext = ''
      if (currentDocument.pageTexts && currentDocument.pageTexts.length > 0) {
        documentContext = currentDocument.pageTexts.join('\n\n')
      } else if (typeof currentDocument.content === 'string') {
        documentContext = currentDocument.content
      }

      if (includeNotes) {
        const relevantNotes = notesIntegrationService.getRelevantNotes(
          currentDocument.id,
          userMessage
        )

        if (relevantNotes.length > 0) {
          const notesContext = notesIntegrationService.formatNotesForAIContext(
            relevantNotes.slice(0, 5)
          )
          documentContext = `${notesContext}\n\n${documentContext}`
        }
      }

      const response = await sendMessageToAI(
        userMessage,
        documentContext,
        user?.tier || 'free'
      )
      addChatMessage({ role: 'assistant', content: response, id: createMessageId() })
    } catch (error) {
      console.error('AI chat error:', error)
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        id: createMessageId()
      })
    } finally {
      setTyping(false)
    }
  }

  const handleSaveAsNote = async (message: typeof chatMessages[0]) => {
    if (!currentDocument || message.role !== 'assistant' || !message.id) return

    setSavingNoteId(message.id)

    try {
      let mode: 'clarification' | 'further-reading' | 'general' = 'general'
      if (message.content.toLowerCase().includes('clarify')) {
        mode = 'clarification'
      } else if (message.content.toLowerCase().includes('further reading')) {
        mode = 'further-reading'
      }

      await notesIntegrationService.saveAIResponseAsNote(
        message.content,
        currentDocument.id,
        currentDocument.name,
        Math.max(1, currentDocument.currentPage || 1),
        selectedTextContext?.selectedText,
        mode
      )

      setTimeout(() => setSavingNoteId(null), 800)
    } catch (error) {
      console.error('Failed to save note:', error)
      setSavingNoteId(null)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
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

  const triggerUpload = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-upload'))
    }
  }

  const triggerLibrary = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-library'))
    }
  }

  const disableInput = !currentDocument || isTyping
  const showEmptyState = !currentDocument && chatMessages.length === 0

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-3 pb-4"
        data-chat-header
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)'
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {getModeLabel()}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {currentDocument
                ? `Focused on "${currentDocument.name}"`
                : 'Upload a document to get started'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentDocument && (
            <Tooltip
              content={
                includeNotes
                  ? 'Including your notes for richer context'
                  : 'Click to include your notes in responses'
              }
              position="bottom"
            >
              <button
                onClick={() => setIncludeNotes((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  borderColor: includeNotes
                    ? 'rgba(59, 130, 246, 0.35)'
                    : 'var(--color-border)',
                  color: includeNotes
                    ? 'var(--color-primary)'
                    : 'var(--color-text-secondary)',
                  backgroundColor: includeNotes
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'transparent'
                }}
              >
                <FileText className="h-4 w-4" />
                Notes Context
              </button>
            </Tooltip>
          )}
          <Tooltip content="Close AI assistant" position="bottom">
            <button
              onClick={onClose}
              className="rounded-lg border p-2 transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              aria-label="Close AI assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto py-6 pr-1">
        {showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)' }}
            >
              <Sparkles className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="space-y-2">
              <p
                className="text-base font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Upload a document to start chatting
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                The assistant reads alongside you and answers with relevant context.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={triggerUpload}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)'
                }}
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
              <button
                onClick={triggerLibrary}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <BookOpen className="h-4 w-4" />
                Open Library
              </button>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.length === 0 && currentDocument && (
              <div
                className="rounded-lg border p-4 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                Ask anything about "{currentDocument.name}" or select text in the document for
                context-aware questions.
              </div>
            )}
            {chatMessages.map((message) => (
              <div key={message.id} className="relative group">
                <ChatMessage message={message} />
                {message.role === 'assistant' && currentDocument && (
                  <button
                    onClick={() => handleSaveAsNote(message)}
                    disabled={savingNoteId === message.id}
                    className="absolute -top-2 right-0 flex items-center gap-1 rounded-lg border px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    {savingNoteId === message.id ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3" />
                        Save note
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
            {isTyping && (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Sparkles className="h-5 w-5" />
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: 'var(--color-text-tertiary)' }} />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.12s' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ backgroundColor: 'var(--color-text-tertiary)', animationDelay: '0.24s' }}
                  />
                </div>
                AI is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="px-6 pt-4 pb-6" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-4">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              currentDocument
                ? `Ask about "${currentDocument.name}"...`
                : 'Upload a document to ask questions'
            }
            className="flex-1 rounded-md px-4 py-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--border-radius-md)'
            }}
            disabled={disableInput}
          />
          <button
            onClick={handleSendMessage}
            disabled={disableInput || !inputValue.trim()}
            className="flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              borderRadius: 'var(--border-radius-md)'
            }}
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
        {!currentDocument && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Upload a document to ask questions.
          </p>
        )}
      </div>
    </div>
  )
}

