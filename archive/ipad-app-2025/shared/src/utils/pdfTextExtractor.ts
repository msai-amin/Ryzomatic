/**
 * PDF Text Extraction Utility
 * 
 * Enhances PDF text extraction to:
 * - Maintain proper reading order (top-to-bottom, left-to-right)
 * - Preserve paragraph structure
 * - Handle multi-column layouts
 * - Detect and preserve line/paragraph breaks
 */

interface PDFTextItem {
  str: string
  transform: number[]  // [scaleX, skewY, skewX, scaleY, translateX, translateY]
  width: number
  height: number
}

interface PositionedTextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

interface TextLine {
  items: PositionedTextItem[]
  y: number
  avgFontSize: number
}

/**
 * Extract font size from PDF transform matrix
 */
function getFontSize(transform: number[]): number {
  // Font size is derived from the vertical scaling factor
  // transform[3] is scaleY, which represents the font height
  const scaleY = Math.abs(transform[3])
  const skewX = transform[2]
  
  // Calculate the actual font height considering skew
  return Math.sqrt(scaleY * scaleY + skewX * skewX)
}

/**
 * Convert PDF text items to positioned items with coordinates
 */
function toPositionedItems(items: PDFTextItem[]): PositionedTextItem[] {
  return items
    .filter(item => item.str.trim().length > 0) // Skip empty items
    .map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
      height: item.height || getFontSize(item.transform),
      fontSize: getFontSize(item.transform)
    }))
}

/**
 * Group text items into lines based on Y position
 * Items with similar Y coordinates are considered on the same line
 */
function groupIntoLines(items: PositionedTextItem[]): TextLine[] {
  if (items.length === 0) return []

  // Sort by Y position (descending, since PDF Y=0 is at bottom)
  const sortedByY = [...items].sort((a, b) => b.y - a.y)

  const lines: TextLine[] = []
  let currentLine: PositionedTextItem[] = [sortedByY[0]]
  let currentY = sortedByY[0].y

  for (let i = 1; i < sortedByY.length; i++) {
    const item = sortedByY[i]
    const yDiff = Math.abs(item.y - currentY)
    
    // Use a tolerance based on font size (items within 2px are on same line)
    const tolerance = Math.max(2, item.fontSize * 0.2)

    if (yDiff <= tolerance) {
      // Same line
      currentLine.push(item)
    } else {
      // New line - sort current line by X position and save it
      currentLine.sort((a, b) => a.x - b.x)
      const avgFontSize = currentLine.reduce((sum, item) => sum + item.fontSize, 0) / currentLine.length
      lines.push({
        items: currentLine,
        y: currentY,
        avgFontSize
      })
      
      // Start new line
      currentLine = [item]
      currentY = item.y
    }
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x)
    const avgFontSize = currentLine.reduce((sum, item) => sum + item.fontSize, 0) / currentLine.length
    lines.push({
      items: currentLine,
      y: currentY,
      avgFontSize
    })
  }

  return lines
}

/**
 * Detect columns by analyzing X-position distribution
 * Returns column boundaries (X coordinates)
 * Enhanced with dynamic threshold based on page width
 */
function detectColumns(lines: TextLine[]): number[] {
  if (lines.length === 0) return []

  // Collect all starting X positions and calculate page width
  const xPositions = lines.map(line => line.items[0]?.x || 0)
  const pageWidth = Math.max(...lines.map(line => {
    const lastItem = line.items[line.items.length - 1]
    return lastItem ? lastItem.x + lastItem.width : 0
  }))
  
  // Simple clustering: if there are distinct groups of X positions,
  // we likely have columns
  const sortedX = [...xPositions].sort((a, b) => a - b)
  const columns: number[] = [sortedX[0]]
  
  // Dynamic threshold based on page width (15% of page width, minimum 50px)
  const columnGapThreshold = Math.max(50, pageWidth * 0.15)
  
  // Detect significant gaps in X positions (potential column boundaries)
  for (let i = 1; i < sortedX.length; i++) {
    const gap = sortedX[i] - sortedX[i - 1]
    
    // Use dynamic threshold instead of hardcoded 100px
    if (gap > columnGapThreshold) {
      // Check if this X position appears frequently (actual column start)
      const frequency = xPositions.filter(x => Math.abs(x - sortedX[i]) < 20).length
      if (frequency > lines.length * 0.1) { // At least 10% of lines start here
        columns.push(sortedX[i])
      }
    }
  }

  return columns.sort((a, b) => a - b)
}

/**
 * Assign each line to a column
 */
function assignLinesToColumns(lines: TextLine[], columns: number[]): Map<number, TextLine[]> {
  const columnMap = new Map<number, TextLine[]>()
  
  // Initialize map
  columns.forEach(col => columnMap.set(col, []))

  lines.forEach(line => {
    const lineX = line.items[0]?.x || 0
    
    // Find closest column
    let closestColumn = columns[0]
    let minDistance = Math.abs(lineX - columns[0])
    
    for (let i = 1; i < columns.length; i++) {
      const distance = Math.abs(lineX - columns[i])
      if (distance < minDistance) {
        minDistance = distance
        closestColumn = columns[i]
      }
    }
    
    const columnLines = columnMap.get(closestColumn) || []
    columnLines.push(line)
    columnMap.set(closestColumn, columnLines)
  })

  return columnMap
}

/**
 * Detect if a line looks like it's part of a table
 * Tables have regular spacing and often contain numbers/symbols
 */
function looksLikeTableRow(line: TextLine): boolean {
  // Multiple items with regular spacing
  if (line.items.length < 2) return false
  
  // Check for regular spacing between items
  const gaps: number[] = []
  for (let i = 1; i < line.items.length; i++) {
    const gap = line.items[i].x - (line.items[i-1].x + line.items[i-1].width)
    if (gap > 10) { // Only count significant gaps
      gaps.push(gap)
    }
  }
  
  // If we have multiple large gaps of similar size, likely a table
  if (gaps.length >= 2) {
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const variance = gaps.reduce((sum, gap) => sum + Math.abs(gap - avgGap), 0) / gaps.length
    
    // Regular spacing indicates a table (variance < 30% of average)
    return variance < avgGap * 0.3
  }
  
  return false
}

/**
 * Detect if items contain mathematical symbols
 */
function containsMathSymbols(text: string): boolean {
  const mathSymbols = /[∑∏∫√±×÷≠≈≤≥∞∂∇α-ωΑ-Ω]/
  return mathSymbols.test(text)
}

/**
 * Mark formulas with special markers for later processing
 */
function markFormula(text: string, isBlock: boolean): string {
  if (isBlock) {
    return `\n|||FORMULA_BLOCK_START|||${text}|||FORMULA_BLOCK_END|||\n`
  } else {
    return `|||FORMULA_INLINE_START|||${text}|||FORMULA_INLINE_END|||`
  }
}

/**
 * Build line text with intelligent word spacing
 * Analyzes gaps between text items to determine if spaces are needed
 */
function buildLineText(items: PositionedTextItem[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0].text
  
  let text = ''
  for (let i = 0; i < items.length; i++) {
    text += items[i].text
    
    if (i < items.length - 1) {
      const currentItem = items[i]
      const nextItem = items[i + 1]
      
      // Calculate gap between current and next item
      const gap = nextItem.x - (currentItem.x + currentItem.width)
      
      // Use font size to determine if gap is significant enough for a space
      // Typical space width is about 25% of font size
      const spaceWidth = currentItem.fontSize * 0.25
      
      if (gap > spaceWidth) {
        text += ' '
      }
    }
  }
  
  return text
}

/**
 * Format a table row with proper column alignment
 */
function formatTableRow(line: TextLine): string {
  // Group items into columns based on X position
  const items = [...line.items].sort((a, b) => a.x - b.x)
  
  // Use tabs to preserve column structure
  let result = ''
  let lastX = items[0].x
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const gap = item.x - lastX
    
    if (i > 0 && gap > 15) {
      // Significant gap - use tab
      result += '\t'
    } else if (i > 0) {
      // Small gap - use space
      result += ' '
    }
    
    result += item.text
    lastX = item.x + item.width
  }
  
  return result
}

/**
 * Detect table regions in lines
 */
function detectTableRegions(lines: TextLine[]): Set<number> {
  const tableLines = new Set<number>()
  
  for (let i = 0; i < lines.length; i++) {
    if (looksLikeTableRow(lines[i])) {
      tableLines.add(i)
      
      // Look ahead and behind for additional table rows
      // Tables typically have multiple consecutive rows
      if (i > 0 && looksLikeTableRow(lines[i-1])) {
        tableLines.add(i-1)
      }
      if (i < lines.length - 1 && looksLikeTableRow(lines[i+1])) {
        tableLines.add(i+1)
      }
    }
  }
  
  return tableLines
}

/**
 * Detect if line is a heading based on font size and formatting
 */
function detectHeading(line: TextLine, medianFontSize: number, lineText: string): boolean {
  const isBold = line.avgFontSize > medianFontSize * 1.2
  const isShort = line.items.length < 10
  const hasTrailingColon = lineText.trim().endsWith(':')
  const allCaps = lineText === lineText.toUpperCase() && lineText.length > 3
  
  return (isBold && isShort) || hasTrailingColon || (allCaps && isShort)
}

/**
 * Check if line ends with hyphenation that should be merged
 */
function shouldMergeHyphenation(currentLineText: string, nextLine?: TextLine): boolean {
  if (!nextLine || !currentLineText.endsWith('-')) return false
  
  // Get first word of next line
  const nextLineFirstChar = nextLine.items[0]?.text.trim()[0]
  if (!nextLineFirstChar) return false
  
  // Merge if next line starts with lowercase (word continuation)
  return /[a-z]/.test(nextLineFirstChar)
}

/**
 * Build text from lines with proper line and paragraph breaks
 * Enhanced with table and formula detection, hyphenation, and sentence-aware breaks
 */
function buildTextWithBreaks(lines: TextLine[]): string {
  if (lines.length === 0) return ''

  // Calculate median font size for the page
  const fontSizes = lines.map(line => line.avgFontSize)
  const medianFontSize = fontSizes.sort((a, b) => a - b)[Math.floor(fontSizes.length / 2)] || 12

  // Detect table regions
  const tableLines = detectTableRegions(lines)
  
  let result = ''
  let previousY = lines[0].y
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = i < lines.length - 1 ? lines[i + 1] : undefined
    const isTableLine = tableLines.has(i)
    
    // Use intelligent word spacing for non-table lines
    let lineText = isTableLine ? formatTableRow(line) : buildLineText(line.items)
    const hasMath = containsMathSymbols(lineText)
    const isHeading = !isTableLine && detectHeading(line, medianFontSize, lineText)
    
    // Handle table transitions
    if (isTableLine && !inTable) {
      // Starting a table
      if (i > 0) result += '\n\n'
      result += '```table\n'
      inTable = true
    } else if (!isTableLine && inTable) {
      // Ending a table
      result += '\n```\n\n'
      inTable = false
    }
    
    // Handle hyphenation merging
    const shouldMergeHyphen = shouldMergeHyphenation(lineText, nextLine)
    if (shouldMergeHyphen) {
      lineText = lineText.slice(0, -1) // Remove trailing hyphen
    }
    
    if (i > 0 && !inTable) {
      const yGap = previousY - line.y // Remember Y decreases as we go down
      const normalizedGap = yGap / medianFontSize
      
      // Check for sentence endings and indentation for better paragraph detection
      const prevLineText = result.trim()
      const endsWithSentence = /[.!?]["']?\s*$/.test(prevLineText)
      const nextStartsCapital = /^[A-Z]/.test(lineText)
      const hasIndent = line.items[0] && lines[i-1].items[0] && 
                        (line.items[0].x - lines[i-1].items[0].x) > 20
      
      if (shouldMergeHyphen) {
        // Hyphenated word continuation - no break
        // Don't add any spacing
      } else if (normalizedGap > 3.0 || isHeading) {
        // Section break (very large gap or heading)
        result += '\n\n\n'
      } else if (normalizedGap > 2.0 || (normalizedGap > 0.8 && endsWithSentence && nextStartsCapital) || hasIndent) {
        // Paragraph break - enhanced with sentence detection
        result += '\n\n'
      } else if (normalizedGap > 1.2) {
        // Line break
        result += '\n'
      } else if (hasMath) {
        // Math formulas often need special spacing
        result += ' '
      } else {
        // Same paragraph, add space
        result += ' '
      }
    } else if (i > 0 && inTable) {
      // In table, just use newlines
      result += '\n'
    }
    
    // Mark formulas for special rendering
    if (hasMath && !inTable) {
      // Determine if this should be a block formula
      const isBlockFormula = lineText.length > 40 || /[∑∏∫]/.test(lineText)
      result += markFormula(lineText, isBlockFormula)
    } else {
      result += lineText
    }
    
    previousY = line.y
  }
  
  // Close table if we ended while in one
  if (inTable) {
    result += '\n```'
  }

  return result
}

/**
 * Detect and filter out header/footer lines
 * Headers/footers are typically in top/bottom 10% of page and may contain page numbers
 */
function filterHeadersFooters(lines: TextLine[]): TextLine[] {
  if (lines.length < 5) return lines // Too few lines to have headers/footers
  
  // Calculate page height from Y positions
  const minY = Math.min(...lines.map(l => l.y))
  const maxY = Math.max(...lines.map(l => l.y))
  const pageHeight = maxY - minY
  
  if (pageHeight === 0) return lines
  
  const headerThreshold = maxY - (pageHeight * 0.10) // Top 10%
  const footerThreshold = minY + (pageHeight * 0.10) // Bottom 10%
  
  return lines.filter(line => {
    const isInHeaderZone = line.y > headerThreshold
    const isInFooterZone = line.y < footerThreshold
    
    if (!isInHeaderZone && !isInFooterZone) return true
    
    // Check if line looks like header/footer content
    const lineText = line.items.map(item => item.text).join('').trim()
    const isPageNumber = /^(Page\s+)?\d+(\s+of\s+\d+)?$/i.test(lineText)
    const isShortAndIsolated = lineText.length < 50 && line.items.length < 5
    
    // Filter out likely headers/footers
    if ((isInHeaderZone || isInFooterZone) && (isPageNumber || isShortAndIsolated)) {
      return false
    }
    
    return true
  })
}

/**
 * Main function: Extract structured text from PDF text items
 * 
 * @param items - Raw PDF text items from PDF.js getTextContent()
 * @returns Structured text with proper ordering and paragraph breaks
 */
export function extractStructuredText(items: any[]): string {
  if (!items || items.length === 0) {
    return ''
  }

  // Step 1: Convert to positioned items
  const positionedItems = toPositionedItems(items as PDFTextItem[])
  
  if (positionedItems.length === 0) {
    return ''
  }

  // Step 2: Group into lines
  let lines = groupIntoLines(positionedItems)
  
  if (lines.length === 0) {
    return ''
  }

  // Step 3: Filter out headers and footers
  lines = filterHeadersFooters(lines)
  
  if (lines.length === 0) {
    return ''
  }

  // Step 4: Detect columns
  const columns = detectColumns(lines)
  
  if (columns.length <= 1) {
    // Single column - simple case
    return buildTextWithBreaks(lines)
  }

  // Step 5: Multi-column layout
  const columnMap = assignLinesToColumns(lines, columns)
  
  // Step 6: Process each column separately and combine
  let result = ''
  
  columns.forEach((columnX, index) => {
    const columnLines = columnMap.get(columnX) || []
    
    if (columnLines.length > 0) {
      // Sort lines within column by Y position
      columnLines.sort((a, b) => b.y - a.y)
      
      const columnText = buildTextWithBreaks(columnLines)
      
      if (columnText.trim()) {
        if (index > 0) {
          // Add separator between columns
          result += '\n\n---\n\n'
        }
        result += columnText
      }
    }
  })

  return result.trim()
}

/**
 * Sort text items by position (top-to-bottom, left-to-right)
 * For debugging or custom processing
 */
export function sortTextItemsByPosition(items: any[]): any[] {
  const positioned = toPositionedItems(items as PDFTextItem[])
  const lines = groupIntoLines(positioned)
  
  // Flatten back to items in reading order
  const sorted: any[] = []
  lines.forEach(line => {
    line.items.forEach(item => {
      // Find original item
      const original = items.find(i => 
        i.str === item.text && 
        Math.abs(i.transform[4] - item.x) < 0.1 &&
        Math.abs(i.transform[5] - item.y) < 0.1
      )
      if (original) {
        sorted.push(original)
      }
    })
  })
  
  return sorted
}

/**
 * Extract formulas from text with markers
 * Returns array of formulas with their types
 */
export function extractMarkedFormulas(text: string): Array<{
  formula: string
  isBlock: boolean
  marker: string
}> {
  const formulas: Array<{ formula: string; isBlock: boolean; marker: string }> = []
  
  // Extract block formulas
  const blockRegex = /\|\|\|FORMULA_BLOCK_START\|\|\|(.*?)\|\|\|FORMULA_BLOCK_END\|\|\|/g
  let match
  while ((match = blockRegex.exec(text)) !== null) {
    formulas.push({
      formula: match[1],
      isBlock: true,
      marker: match[0],
    })
  }
  
  // Extract inline formulas
  const inlineRegex = /\|\|\|FORMULA_INLINE_START\|\|\|(.*?)\|\|\|FORMULA_INLINE_END\|\|\|/g
  while ((match = inlineRegex.exec(text)) !== null) {
    formulas.push({
      formula: match[1],
      isBlock: false,
      marker: match[0],
    })
  }
  
  return formulas
}

