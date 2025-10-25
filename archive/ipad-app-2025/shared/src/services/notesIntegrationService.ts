import { storageService, Note } from './storageService'

/**
 * Service for integrating AI responses with the note-taking system
 */
class NotesIntegrationService {
  /**
   * Save an AI response as a note
   */
  async saveAIResponseAsNote(
    response: string,
    bookId: string,
    bookName: string,
    pageNumber: number,
    selectedText?: string,
    mode?: 'clarification' | 'further-reading' | 'general'
  ): Promise<Note> {
    // Create a formatted note with context
    let noteContent = response

    // Add context header based on mode
    if (mode === 'clarification' && selectedText) {
      noteContent = `📝 AI Clarification\n\nSelected Text:\n"${selectedText}"\n\n${response}`
    } else if (mode === 'further-reading' && selectedText) {
      noteContent = `📚 Further Reading Suggestions\n\nBased on:\n"${selectedText}"\n\n${response}`
    } else if (selectedText) {
      noteContent = `💡 AI Response\n\nRegarding:\n"${selectedText}"\n\n${response}`
    }

    const note: Note = {
      id: crypto.randomUUID(),
      bookId,
      bookName,
      pageNumber,
      content: noteContent,
      selectedText,
      createdAt: new Date(),
    }

    // Save the note using the storage service
    storageService.saveNote(note)

    return note
  }

  /**
   * Get relevant notes for current document that might help answer questions
   */
  getRelevantNotes(bookId: string, searchText?: string): Note[] {
    const allNotes = storageService.getAllNotes()
    let relevantNotes = allNotes.filter(note => note.bookId === bookId)

    // If search text provided, filter by relevance
    if (searchText && searchText.trim()) {
      const searchLower = searchText.toLowerCase()
      relevantNotes = relevantNotes.filter(note => {
        const contentMatch = note.content.toLowerCase().includes(searchLower)
        const selectedTextMatch = note.selectedText?.toLowerCase().includes(searchLower)
        return contentMatch || selectedTextMatch
      })
    }

    // Sort by creation date (most recent first)
    relevantNotes.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return relevantNotes
  }

  /**
   * Format notes for AI context
   * Returns a formatted string that can be included in AI prompts
   */
  formatNotesForAIContext(notes: Note[]): string {
    if (notes.length === 0) {
      return ''
    }

    const formattedNotes = notes.map((note, index) => {
      const header = `Note ${index + 1} (Page ${note.pageNumber})`
      const selectedText = note.selectedText ? `\nSelected Text: "${note.selectedText}"` : ''
      const content = `\nContent: ${note.content}`
      return `${header}${selectedText}${content}`
    }).join('\n\n---\n\n')

    return `Here are some existing notes from this document that might be relevant:\n\n${formattedNotes}\n\n---\n\n`
  }

  /**
   * Check if a note was created from an AI response
   */
  isAIGeneratedNote(note: Note): boolean {
    return (
      note.content.includes('AI Clarification') ||
      note.content.includes('Further Reading Suggestions') ||
      note.content.includes('AI Response')
    )
  }

  /**
   * Get notes for a specific page
   */
  getNotesForPage(bookId: string, pageNumber: number): Note[] {
    const allNotes = storageService.getAllNotes()
    return allNotes.filter(
      note => note.bookId === bookId && note.pageNumber === pageNumber
    )
  }

  /**
   * Get all notes for a book grouped by page
   */
  getNotesGroupedByPage(bookId: string): Map<number, Note[]> {
    const allNotes = storageService.getAllNotes()
    const bookNotes = allNotes.filter(note => note.bookId === bookId)

    const grouped = new Map<number, Note[]>()
    
    for (const note of bookNotes) {
      const pageNotes = grouped.get(note.pageNumber) || []
      pageNotes.push(note)
      grouped.set(note.pageNumber, pageNotes)
    }

    return grouped
  }

  /**
   * Search notes across all books
   */
  searchAllNotes(searchQuery: string): Note[] {
    const allNotes = storageService.getAllNotes()
    const searchLower = searchQuery.toLowerCase()

    return allNotes.filter(note => {
      const contentMatch = note.content.toLowerCase().includes(searchLower)
      const selectedTextMatch = note.selectedText?.toLowerCase().includes(searchLower)
      const bookNameMatch = note.bookName.toLowerCase().includes(searchLower)
      return contentMatch || selectedTextMatch || bookNameMatch
    })
  }
}

// Export singleton instance
export const notesIntegrationService = new NotesIntegrationService()

