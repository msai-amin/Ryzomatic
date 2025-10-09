import React from 'react'
import { Bot, User } from 'lucide-react'
import { ChatMessage as ChatMessageType } from '../store/appStore'

interface ChatMessageProps {
  message: ChatMessageType
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user'
  // const isAssistant = message.role === 'assistant' // Currently unused but may be needed for future features

  return (
    <div className={`flex space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Avatar */}
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-background)',
        }}
      >
        {isUser ? (
          <User className="w-4 h-4" style={{ color: 'var(--color-text-inverse)' }} />
        ) : (
          <Bot className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-xs lg:max-w-md ${
        isUser ? 'text-right' : ''
      }`}>
        <div 
          className="inline-block p-3 rounded-lg"
          style={{
            backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-background)',
            color: isUser ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}


