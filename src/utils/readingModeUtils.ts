/**
 * Reading Mode Utilities
 * Shared utilities for reading mode rendering in PDFViewer and PDFViewerV2
 */

export interface TextSegment {
  type: 'word' | 'break' | 'table' | 'formula'
  content: string
  breakLevel?: number // 1=space, 2=line, 3=paragraph, 4=section
  wordIndex?: number
  paragraphIndex?: number
  tableData?: string[] // For table rows
}

/**
 * Parse text to preserve paragraph structure
 * Used for reading mode rendering
 */
export function parseTextWithBreaks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let wordIndex = 0
  let paragraphIndex = 0
  
  // Comprehensive text sanitization
  if (text === null || text === undefined) {
    console.warn('parseTextWithBreaks: text is null/undefined, using empty string')
    text = ''
  } else if (typeof text !== 'string') {
    console.warn('parseTextWithBreaks: text is not a string, converting...', {
      type: typeof text,
      constructor: (text as any)?.constructor?.name,
      value: String(text).substring(0, 100) + (String(text).length > 100 ? '...' : '')
    })
    
    if (typeof text === 'object') {
      try {
        text = JSON.stringify(text)
      } catch (e) {
        console.warn('parseTextWithBreaks: Failed to stringify object, using fallback')
        text = String(text)
      }
    } else {
      text = String(text)
    }
  }
  
  // Final safety check
  if (typeof text !== 'string') {
    console.error('parseTextWithBreaks: Failed to convert to string, using empty string')
    text = ''
  }
  
  // First, extract tables and formulas
  const tableRegex = /```table\n([\s\S]*?)\n```/g
  const formulaRegex = /`([^`]+)`/g
  
  let processedText = text
  const tables: { index: number, content: string[] }[] = []
  const formulas: { index: number, content: string }[] = []
  
  // Extract tables
  let tableMatch
  while ((tableMatch = tableRegex.exec(text)) !== null) {
    const tableText = typeof tableMatch[1] === 'string' ? tableMatch[1] : String(tableMatch[1] || '')
    const tableContent = tableText.split('\n').filter(row => row.trim().length > 0)
    const placeholder = `__TABLE_${tables.length}__`
    tables.push({ index: tableMatch.index, content: tableContent })
    processedText = processedText.replace(tableMatch[0], placeholder)
  }
  
  // Extract formulas (but not tables)
  let formulaMatch
  const tempText = processedText
  while ((formulaMatch = formulaRegex.exec(tempText)) !== null) {
    const formulaText = typeof formulaMatch[1] === 'string' ? formulaMatch[1] : String(formulaMatch[1] || '')
    // Skip if it's a table placeholder
    if (!formulaText.startsWith('__TABLE_')) {
      const placeholder = `__FORMULA_${formulas.length}__`
      formulas.push({ index: formulaMatch.index, content: formulaText })
      processedText = processedText.replace(formulaMatch[0], placeholder)
    }
  }
  
  // Ensure processedText is a string before splitting
  if (typeof processedText !== 'string') {
    console.warn('parseTextWithBreaks: processedText is not a string, converting...', typeof processedText, processedText)
    processedText = String(processedText || '')
  }
  
  // Split by section breaks first (\n\n\n)
  const sections = processedText.split(/\n\n\n/)
  
  sections.forEach((section, sectionIdx) => {
    // Ensure section is a string
    if (typeof section !== 'string') {
      console.warn('parseTextWithBreaks: section is not a string, skipping...', typeof section, section)
      return
    }
    
    if (sectionIdx > 0) {
      segments.push({ type: 'break', content: '', breakLevel: 4 }) // Section break
    }
    
    // Ensure section is a string before splitting
    const safeSection = typeof section === 'string' ? section : String(section || '')
    
    // Split by paragraph breaks (\n\n)
    const paragraphs = safeSection.split(/\n\n/)
    
    paragraphs.forEach((paragraph, paraIdx) => {
      // Ensure paragraph is a string
      if (typeof paragraph !== 'string') {
        console.warn('parseTextWithBreaks: paragraph is not a string, skipping...', typeof paragraph, paragraph)
        return
      }
      
      if (paraIdx > 0) {
        segments.push({ type: 'break', content: '', breakLevel: 3 }) // Paragraph break
        paragraphIndex++
      }
      
      // Ensure paragraph is a string before splitting
      const safeParagraph = typeof paragraph === 'string' ? paragraph : String(paragraph || '')
      
      // Split by line breaks (\n)
      const lines = safeParagraph.split(/\n/)
      
      lines.forEach((line, lineIdx) => {
        // Ensure line is a string
        if (typeof line !== 'string') {
          console.warn('parseTextWithBreaks: line is not a string, skipping...', typeof line, line)
          return
        }
        
        if (lineIdx > 0) {
          segments.push({ type: 'break', content: '', breakLevel: 2 }) // Line break
        }
        
        // Ensure line is a string before splitting
        const safeLine = typeof line === 'string' ? line : String(line || '')
        
        // Split into words
        const words = safeLine.split(/\s+/).filter(w => w.trim().length > 0)
        
        words.forEach((word, idx) => {
          // Check if this word is a table placeholder
          if (word.startsWith('__TABLE_')) {
            const tableIdx = parseInt(word.match(/__TABLE_(\d+)__/)?.[1] || '0')
            const table = tables[tableIdx]
            if (table) {
              segments.push({
                type: 'table',
                content: '',
                tableData: table.content,
                wordIndex: wordIndex++,
                paragraphIndex
              })
            }
          }
          // Check if this word is a formula placeholder
          else if (word.startsWith('__FORMULA_')) {
            const formulaIdx = parseInt(word.match(/__FORMULA_(\d+)__/)?.[1] || '0')
            const formula = formulas[formulaIdx]
            if (formula) {
              segments.push({
                type: 'formula',
                content: formula.content,
                wordIndex: wordIndex++,
                paragraphIndex
              })
            }
          }
          // Regular word
          else {
            segments.push({ 
              type: 'word', 
              content: word, 
              wordIndex: wordIndex++,
              paragraphIndex 
            })
          }
          
          // Add space between words (except last word in line)
          if (idx < words.length - 1) {
            segments.push({ type: 'break', content: ' ', breakLevel: 1 })
          }
        })
      })
    })
  })
  
  return segments
}

