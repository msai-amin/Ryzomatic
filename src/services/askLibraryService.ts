/**
 * Ask Your Library — RAG service grounded in user highlights.
 *
 * Orchestration (zero new migrations or endpoints — all infra already exists):
 *   1. Embed the question via /api/utils?action=embedding
 *   2. Call find_similar_highlights RPC (migration 067, HNSW index on
 *      user_highlights.embedding) for the top-K matching passages
 *   3. Fetch book titles from user_books to attribute each source
 *   4. Build a grounded Gemini prompt and call sendMessageToAI
 *
 * Every claim in the answer is tagged [n] pointing to a numbered source.
 * The panel renders those as jump-to-source citation badges.
 */

import { embeddingService } from '../../lib/embeddingService'
import { supabase } from '../../lib/supabase'
import { sendMessageToAI } from './aiService'

// ── Public types ────────────────────────────────────────────────────────────

/** A single highlight retrieved from the user's library */
export interface AskSource {
  index: number
  highlightId: string
  excerpt: string
  page: number | null
  colorHex: string | null
  bookId: string | null
  bookTitle: string | null
  similarity: number
}

export interface AskResult {
  status: 'ok' | 'no_sources' | 'embedding_unavailable' | 'error'
  answer: string
  sources: AskSource[]
}

// ── Configuration ────────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.45  // fairly generous for pilot
const MAX_SOURCES = 8
const MAX_EXCERPT_CHARS = 450

// ── Service class ────────────────────────────────────────────────────────────

class AskLibraryService {
  /**
   * Main entry point: ask a question against the user's full highlight library.
   */
  async ask(question: string, userId: string): Promise<AskResult> {
    // 1. Embed the question
    let queryEmbedding: number[]
    try {
      queryEmbedding = await embeddingService.embed(question)
    } catch {
      return { status: 'embedding_unavailable', answer: '', sources: [] }
    }

    const queryVector = embeddingService.formatForPgVector(queryEmbedding)

    // 2. Retrieve similar highlights via pgvector RPC
    const hits = await this.retrieveHits(userId, queryVector)
    if (hits.length === 0) {
      return { status: 'no_sources', answer: '', sources: [] }
    }

    // 3. Enrich with book titles
    const sources = await this.enrichWithTitles(hits)

    // 4. Build grounded prompt and call Gemini
    const prompt = this.buildPrompt(question, sources)
    let answer: string
    try {
      answer = await sendMessageToAI(prompt, undefined, 'free', 'general')
    } catch (err: any) {
      console.error('AskLibrary LLM error:', err)
      return { status: 'error', answer: '', sources }
    }

    return { status: 'ok', answer, sources }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async retrieveHits(userId: string, queryVector: string): Promise<any[]> {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('find_similar_highlights', {
      query_embedding: queryVector,
      p_user_id: userId,
      p_book_id: null,           // null = cross-library (all books)
      similarity_threshold: SIMILARITY_THRESHOLD,
      result_limit: MAX_SOURCES,
      include_orphaned: false,
    })
    if (error) {
      console.warn('find_similar_highlights RPC error:', error)
      return []
    }
    return data ?? []
  }

  private async enrichWithTitles(hits: any[]): Promise<AskSource[]> {
    // Collect distinct book ids for a single titles query
    const bookIds = [...new Set(hits.map((h) => h.book_id).filter(Boolean))]
    let titleMap: Record<string, string> = {}

    if (supabase && bookIds.length > 0) {
      const { data: books } = await supabase
        .from('user_books')
        .select('id, title, file_name')
        .in('id', bookIds)

      if (books) {
        titleMap = Object.fromEntries(
          books.map((b: any) => [b.id, b.title || b.file_name || 'Untitled'])
        )
      }
    }

    return hits.map((h, i): AskSource => ({
      index: i + 1,
      highlightId: h.id,
      excerpt: h.highlighted_text?.slice(0, MAX_EXCERPT_CHARS) ?? '',
      page: h.page_number ?? null,
      colorHex: h.color_hex ?? null,
      bookId: h.book_id ?? null,
      bookTitle: h.book_id ? (titleMap[h.book_id] ?? null) : null,
      similarity: h.similarity ?? 0,
    }))
  }

  private buildPrompt(question: string, sources: AskSource[]): string {
    const sourceList = sources
      .map((s) => {
        const paper = s.bookTitle
          ? `${s.bookTitle}${s.page != null ? `, p. ${s.page}` : ''}`
          : s.page != null ? `p. ${s.page}` : 'Your library'
        return `[${s.index}] (${paper}): "${s.excerpt}"`
      })
      .join('\n\n')

    return `You are answering a question grounded STRICTLY in the user's own research highlights.

CRITICAL RULES:
1. Use ONLY the SOURCES provided below — no outside knowledge.
2. After every claim, append the citation number like [1] or [2].
3. If the question cannot be answered from the sources, say so clearly.
4. Do not invent papers, authors, data, or page numbers.
5. Be concise and scholarly.

SOURCES FROM THE USER'S LIBRARY:
${sourceList}

QUESTION: ${question}

Answer (with [n] citations after each claim):`
  }
}

export const askLibraryService = new AskLibraryService()
