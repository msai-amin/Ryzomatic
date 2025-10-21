export interface TextSelectionContext {
  selectedText: string
  beforeContext: string
  afterContext: string
  pageNumber?: number
  fullContext: string
}

/**
 * Extract selected text and surrounding context from the document
 */
export function getTextSelectionContext(pageNumber?: number): TextSelectionContext | null {
  const selection = window.getSelection()
  
  if (!selection || selection.toString().trim().length === 0) {
    return null
  }

  const selectedText = selection.toString().trim()
  
  // Get the range and container
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  
  // Get the parent element (could be text node's parent)
  const parentElement = container.nodeType === Node.TEXT_NODE 
    ? container.parentElement 
    : container as Element

  if (!parentElement) {
    return {
      selectedText,
      beforeContext: '',
      afterContext: '',
      pageNumber,
      fullContext: selectedText,
    }
  }

  // Try to find the containing paragraph or section
  const paragraph = findContainingParagraph(parentElement)
  const fullText = paragraph?.textContent || parentElement.textContent || ''
  
  // Find the position of selected text within the full text
  const selectedIndex = fullText.indexOf(selectedText)
  
  if (selectedIndex === -1) {
    // Fallback if we can't find exact match
    return {
      selectedText,
      beforeContext: '',
      afterContext: '',
      pageNumber,
      fullContext: selectedText,
    }
  }

  // Extract context before and after (aim for ~200 chars each)
  const contextLength = 200
  const beforeStart = Math.max(0, selectedIndex - contextLength)
  const beforeContext = fullText.substring(beforeStart, selectedIndex).trim()
  
  const afterEnd = Math.min(fullText.length, selectedIndex + selectedText.length + contextLength)
  const afterContext = fullText.substring(selectedIndex + selectedText.length, afterEnd).trim()

  const fullContext = `${beforeContext} ${selectedText} ${afterContext}`.trim()

  return {
    selectedText,
    beforeContext,
    afterContext,
    pageNumber,
    fullContext,
  }
}

/**
 * Find the containing paragraph element
 */
function findContainingParagraph(element: Element): Element | null {
  let current: Element | null = element

  // Walk up the DOM tree to find a paragraph-like container
  while (current && current !== document.body) {
    const tagName = current.tagName.toLowerCase()
    
    // Check for common paragraph-like elements
    if (
      tagName === 'p' ||
      tagName === 'div' ||
      tagName === 'section' ||
      tagName === 'article' ||
      tagName === 'pre' ||
      current.classList.contains('prose') ||
      current.classList.contains('paragraph')
    ) {
      return current
    }
    
    current = current.parentElement
  }

  return element
}

/**
 * Get text selection context specifically for PDF viewers
 */
export function getPDFTextSelectionContext(pageNumber: number, pageText?: string): TextSelectionContext | null {
  const selection = window.getSelection()
  
  if (!selection || selection.toString().trim().length === 0) {
    return null
  }

  const selectedText = selection.toString().trim()

  // If we have page text available, use it for better context
  if (pageText) {
    const selectedIndex = pageText.indexOf(selectedText)
    
    if (selectedIndex !== -1) {
      const contextLength = 200
      const beforeStart = Math.max(0, selectedIndex - contextLength)
      const beforeContext = pageText.substring(beforeStart, selectedIndex).trim()
      
      const afterEnd = Math.min(pageText.length, selectedIndex + selectedText.length + contextLength)
      const afterContext = pageText.substring(selectedIndex + selectedText.length, afterEnd).trim()

      const fullContext = `${beforeContext} ${selectedText} ${afterContext}`.trim()

      return {
        selectedText,
        beforeContext,
        afterContext,
        pageNumber,
        fullContext,
      }
    }
  }

  // Fallback to basic selection without page context
  return {
    selectedText,
    beforeContext: '',
    afterContext: '',
    pageNumber,
    fullContext: selectedText,
  }
}

/**
 * Clear current text selection
 */
export function clearSelection(): void {
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
  }
}

/**
 * Check if there's an active text selection
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection()
  return !!(selection && selection.toString().trim().length > 0)
}

