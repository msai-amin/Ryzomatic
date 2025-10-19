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
 */
function detectColumns(lines: TextLine[]): number[] {
  if (lines.length === 0) return []

  // Collect all starting X positions
  const xPositions = lines.map(line => line.items[0]?.x || 0)
  
  // Simple clustering: if there are distinct groups of X positions,
  // we likely have columns
  const sortedX = [...xPositions].sort((a, b) => a - b)
  const columns: number[] = [sortedX[0]]
  
  // Detect significant gaps in X positions (potential column boundaries)
  for (let i = 1; i < sortedX.length; i++) {
    const gap = sortedX[i] - sortedX[i - 1]
    
    // If gap is > 100px, it's likely a new column
    if (gap > 100) {
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
 * Build text from lines with proper line and paragraph breaks
 * Enhanced with table and formula detection
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
    const isTableLine = tableLines.has(i)
    const lineText = isTableLine ? formatTableRow(line) : line.items.map(item => item.text).join('')
    const hasMath = containsMathSymbols(lineText)
    
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
    
    if (i > 0 && !inTable) {
      const yGap = previousY - line.y // Remember Y decreases as we go down
      const normalizedGap = yGap / medianFontSize
      
      if (normalizedGap > 3.0) {
        // Section break (very large gap)
        result += '\n\n\n'
      } else if (normalizedGap > 2.0) {
        // Paragraph break
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
      result += '`' + lineText + '`'
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
  const lines = groupIntoLines(positionedItems)
  
  if (lines.length === 0) {
    return ''
  }

  // Step 3: Detect columns
  const columns = detectColumns(lines)
  
  if (columns.length <= 1) {
    // Single column - simple case
    return buildTextWithBreaks(lines)
  }

  // Step 4: Multi-column layout
  const columnMap = assignLinesToColumns(lines, columns)
  
  // Step 5: Process each column separately and combine
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

