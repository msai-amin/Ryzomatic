import React, { useMemo, useEffect, useRef, useState } from 'react'
import { Bot, User } from 'lucide-react'
import { marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import { ChatMessage as ChatMessageType } from '../store/appStore'

interface ChatMessageProps {
  message: ChatMessageType
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const contentRef = useRef<HTMLDivElement>(null)
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null)

  // Configure marked for better rendering
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true, // GitHub Flavored Markdown
      headerIds: false,
      mangle: false,
    })
  }, [])

  // Process markdown content: render markdown, extract code blocks, and detect LaTeX
  const processedContent = useMemo(() => {
    if (isUser) {
      // User messages don't need markdown rendering
      return { html: message.content, isPlainText: true }
    }

    try {
      // Convert markdown to HTML
      const html = marked.parse(message.content) as string
      
      // Post-process: wrap code blocks for syntax highlighting and copy buttons
      const codeBlockRegex = /<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g
      let processedHtml = html
      let codeBlockIndex = 0

      processedHtml = processedHtml.replace(codeBlockRegex, (match, lang, code) => {
        const decodedCode = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
        
        const currentIndex = codeBlockIndex++
        const language = lang || 'text'
        
        return `
          <div class="code-block-wrapper" data-code-index="${currentIndex}">
            <div class="code-block-header">
              <span class="code-language">${language}</span>
              <button class="code-copy-btn" data-index="${currentIndex}" title="Copy code">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span class="copy-text">Copy</span>
              </button>
            </div>
            <pre class="language-${language}"><code class="language-${language}">${code}</code></pre>
          </div>
        `
      })

      return { html: processedHtml, isPlainText: false }
    } catch (error) {
      console.error('Markdown rendering error:', error)
      return { html: message.content, isPlainText: true }
    }
  }, [message.content, isUser])

  // Apply syntax highlighting after content is rendered
  useEffect(() => {
    if (!isUser && contentRef.current) {
      // Highlight all code blocks within the content
      const codeBlocks = contentRef.current.querySelectorAll('pre code')
      codeBlocks.forEach((block) => {
        Prism.highlightElement(block as HTMLElement)
      })
      
      // Attach copy button handlers
      const copyButtons = contentRef.current.querySelectorAll('.code-copy-btn')
      copyButtons.forEach((button) => {
        const existingHandler = (button as HTMLElement).dataset.hasHandler
        if (!existingHandler) {
          (button as HTMLElement).dataset.hasHandler = 'true'
          button.addEventListener('click', async (e) => {
            e.stopPropagation()
            const wrapper = (e.target as HTMLElement).closest('.code-block-wrapper')
            if (!wrapper) return
            
            const codeElement = wrapper.querySelector('code')
            if (!codeElement) return
            
            const code = codeElement.textContent || ''
            const index = parseInt(wrapper.getAttribute('data-code-index') || '0')
            
            try {
              await navigator.clipboard.writeText(code)
              setCopiedCodeIndex(index)
              
              // Update button appearance
              button.classList.add('copied')
              const copyText = button.querySelector('.copy-text')
              if (copyText) {
                copyText.textContent = 'Copied!'
              }
              
              setTimeout(() => {
                setCopiedCodeIndex(null)
                button.classList.remove('copied')
                if (copyText) {
                  copyText.textContent = 'Copy'
                }
              }, 2000)
            } catch (error) {
              console.error('Failed to copy code:', error)
            }
          })
        }
      })
    }
  }, [processedContent, isUser])

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
      <div className={`flex-1 ${isUser ? 'max-w-xs lg:max-w-md' : 'max-w-full'} ${
        isUser ? 'text-right' : ''
      }`}>
        <div 
          className={`inline-block p-3 rounded-lg ${isUser ? '' : 'chat-message-content'}`}
          style={{
            backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-background)',
            color: isUser ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            borderRadius: 'var(--border-radius-md)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
            maxWidth: isUser ? '100%' : '800px',
          }}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div 
              ref={contentRef}
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: processedContent.html }}
            />
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}


