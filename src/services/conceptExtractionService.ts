import { embeddingService } from '../../lib/embeddingService'
import { cognitivePathService } from './cognitivePathService'
import { supabase } from '../../lib/supabase'

export interface ExtractedConcept {
  text: string
  confidence: number
  context: string
  embedding?: number[]
}

class ConceptExtractionService {
  /**
   * Extract concepts from text using AI
   * Uses Gemini to identify key concepts, topics, and ideas
   */
  async extractConcepts(
    text: string,
    userId: string,
    sourceType: 'highlight' | 'note' | 'document',
    sourceId: string,
    pageNumber?: number | null
  ): Promise<ExtractedConcept[]> {
    try {
      // Get auth token for API
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      // Call API endpoint for concept extraction
      const response = await fetch('/api/gemini/embedding', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          text,
          extractConcepts: true // Flag to extract concepts instead of just embedding
        }),
      })

      if (!response.ok) {
        console.warn('Concept extraction API unavailable, using fallback')
        return this.extractConceptsFallback(text)
      }

      const data = await response.json()
      
      if (data.concepts && Array.isArray(data.concepts)) {
        // Process and store concepts
        const concepts: ExtractedConcept[] = []
        
        for (const conceptData of data.concepts) {
          const concept = await this.storeConcept(
            userId,
            conceptData.text || conceptData.concept,
            conceptData.embedding,
            sourceType,
            sourceId,
            text.substring(0, 200), // Context
            pageNumber
          )
          
          if (concept) {
            concepts.push({
              text: conceptData.text || conceptData.concept,
              confidence: conceptData.confidence || 0.8,
              context: text.substring(0, 200),
              embedding: conceptData.embedding
            })
          }
        }
        
        return concepts
      }

      // Fallback if API doesn't return concepts
      return this.extractConceptsFallback(text)
    } catch (error) {
      console.error('Error extracting concepts:', error)
      return this.extractConceptsFallback(text)
    }
  }

  /**
   * Fallback: Extract concepts using keyword extraction
   * Simple heuristic-based extraction when AI is unavailable
   */
  private extractConceptsFallback(text: string): ExtractedConcept[] {
    // Simple keyword extraction - look for capitalized phrases, technical terms
    const words = text.split(/\s+/)
    const concepts: ExtractedConcept[] = []
    const seen = new Set<string>()

    // Look for capitalized phrases (potential concepts)
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i]
      const word2 = words[i + 1]
      
      // Check for capitalized phrases (e.g., "Machine Learning", "Quantum Physics")
      if (word1[0] && word1[0] === word1[0].toUpperCase() && 
          word2[0] && word2[0] === word2[0].toUpperCase() &&
          word1.length > 2 && word2.length > 2) {
        const phrase = `${word1} ${word2}`.toLowerCase()
        if (!seen.has(phrase) && phrase.length > 5) {
          seen.add(phrase)
          concepts.push({
            text: `${word1} ${word2}`,
            confidence: 0.6,
            context: text.substring(Math.max(0, i * 10 - 50), Math.min(text.length, i * 10 + 50))
          })
        }
      }
    }

    // Also look for single important words (long, capitalized)
    words.forEach((word, i) => {
      if (word.length > 6 && word[0] === word[0].toUpperCase() && 
          !seen.has(word.toLowerCase()) &&
          !this.isCommonWord(word.toLowerCase())) {
        seen.add(word.toLowerCase())
        concepts.push({
          text: word,
          confidence: 0.5,
          context: text.substring(Math.max(0, i * 10 - 50), Math.min(text.length, i * 10 + 50))
        })
      }
    })

    return concepts.slice(0, 10) // Limit to top 10
  }

  /**
   * Check if word is a common word (should be filtered out)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    ])
    return commonWords.has(word.toLowerCase())
  }

  /**
   * Store concept in database and create occurrence
   */
  private async storeConcept(
    userId: string,
    conceptText: string,
    embedding: number[] | undefined,
    sourceType: 'highlight' | 'note' | 'document',
    sourceId: string,
    contextText: string,
    pageNumber?: number | null
  ): Promise<boolean> {
    try {
      // Generate embedding if not provided
      let conceptEmbedding = embedding
      if (!conceptEmbedding) {
        try {
          conceptEmbedding = await embeddingService.embed(conceptText)
        } catch (error) {
          console.warn('Failed to generate embedding for concept, storing without embedding')
        }
      }

      // Get or create concept
      const concept = await cognitivePathService.getOrCreateConcept(
        userId,
        conceptText,
        conceptEmbedding,
        sourceType === 'document' ? sourceId : null,
        sourceType === 'highlight' ? sourceId : null,
        sourceType === 'note' ? sourceId : null
      )

      if (!concept) {
        return false
      }

      // Create occurrence
      await cognitivePathService.createConceptOccurrence(
        userId,
        concept.id,
        sourceType,
        sourceId,
        contextText,
        pageNumber || null
      )

      return true
    } catch (error) {
      console.error('Error storing concept:', error)
      return false
    }
  }

  /**
   * Extract concepts from highlight text
   */
  async extractFromHighlight(
    highlightId: string,
    highlightText: string,
    userId: string,
    bookId: string,
    pageNumber?: number | null
  ): Promise<ExtractedConcept[]> {
    return this.extractConcepts(
      highlightText,
      userId,
      'highlight',
      highlightId,
      pageNumber
    )
  }

  /**
   * Extract concepts from note text
   */
  async extractFromNote(
    noteId: string,
    noteText: string,
    userId: string,
    bookId: string,
    pageNumber?: number | null
  ): Promise<ExtractedConcept[]> {
    return this.extractConcepts(
      noteText,
      userId,
      'note',
      noteId,
      pageNumber
    )
  }

  /**
   * Extract concepts from document (uses description or content)
   */
  async extractFromDocument(
    documentId: string,
    documentText: string,
    userId: string
  ): Promise<ExtractedConcept[]> {
    // For documents, extract from first 2000 chars to avoid too many concepts
    const textToAnalyze = documentText.substring(0, 2000)
    
    return this.extractConcepts(
      textToAnalyze,
      userId,
      'document',
      documentId,
      null
    )
  }

  /**
   * Batch extract concepts from multiple texts
   */
  async extractBatch(
    texts: Array<{ text: string; sourceType: 'highlight' | 'note' | 'document'; sourceId: string; pageNumber?: number }>,
    userId: string
  ): Promise<Map<string, ExtractedConcept[]>> {
    const results = new Map<string, ExtractedConcept[]>()

    // Process in parallel (limit to 5 concurrent to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(item =>
          this.extractConcepts(
            item.text,
            userId,
            item.sourceType,
            item.sourceId,
            item.pageNumber
          ).then(concepts => ({ sourceId: item.sourceId, concepts }))
        )
      )

      batchResults.forEach(({ sourceId, concepts }) => {
        results.set(sourceId, concepts)
      })
    }

    return results
  }
}

export const conceptExtractionService = new ConceptExtractionService()

