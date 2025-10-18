import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { ChatMessage } from './ChatMessage'
import { sendMessageToAI } from '../services/aiService'

interface ChatModalProps {
  onClose: () => void
}

export const ChatModal: React.FC<ChatModalProps> = ({ onClose }) => {
  const { 
    chatMessages, 
    addChatMessage, 
    isTyping, 
    setTyping, 
    currentDocument 
  } = useAppStore()
  
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return

    const userMessage = inputValue.trim()
    setInputValue('')
    addChatMessage({ role: 'user', content: userMessage })

    try {
      setTyping(true)
      const response = await sendMessageToAI(userMessage, currentDocument?.content || '')
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 pt-20 pb-8 px-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-lg shadow-xl w-full max-w-4xl flex flex-col animate-scale-in my-auto" style={{ backgroundColor: 'var(--color-surface)', maxHeight: '80vh' }}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
              <Bot className="w-5 h-5" style={{ color: 'var(--color-text-inverse)' }} />
            </div>
            <div>
              <h2 className="text-heading-3" style={{ color: 'var(--color-text-primary)' }}>AI Assistant</h2>
              <p className="text-caption" style={{ color: 'var(--color-text-secondary)' }}>
                {currentDocument ? `Ask about "${currentDocument.name}"` : 'Ask me anything'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            aria-label="Close AI Assistant"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {currentDocument 
                    ? `Ask me anything about "${currentDocument.name}"`
                    : 'Start a conversation with the AI assistant'
                  }
                </p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
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
                placeholder={currentDocument ? `Ask about "${currentDocument.name}"...` : 'Ask me anything...'}
                className="flex-1 px-4 py-2 rounded-md focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--border-radius-md)',
                }}
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
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
      </div>
    </div>
  )
}


