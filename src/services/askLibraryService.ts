import { embeddingService } from '../../lib/embeddingService'
import { supabase } from '../../lib/supabase'
import { sendMessageToAI } from './aiService'

/**
 * Ask Your Library — RAG chat grounded in the user's own highlights.
 *
 * Pilot architecture (deliberately client-side, zero new infra):
 *   1. embed the question                         → embeddingService.embed
 *   2. semantic-retrieve the user's highlights     → find_similar_highlights RPC
 *      (added in migration 067, already used by lib/contextBuilder.ts)
 *   3. answer with an LLM constrained to those      → sendMessageToAI
 *      excerpts, forced to cite [n].
 *
 * The whole point — and the thing ChatGPT structurally cannot do — is that
 * every answer is grounded in *this user's* library and every claim is
 * traceable to the highlight it came from. So we return the sources alongside
 * the answer and the prompt forbids outside knowledge.
 */

export interface AskSource {
  index: number // 1-based; matches the [n] tokens in the answer
  highlightId: string
  excerpt: string
  page: number | null
  bookTitle: string | null
  colorHex: string | null
  similarity: number
}

export interface AskResult {
  answer: string
  sources: AskSource[]
  /** Non-fatal status the UI can surface (e.g. nothing relevant found). */
  status: 'ok' | 'no_sources' | 'embedding_unavailable' | 'error'
}

interface AskOptions {
  /** Restrict retrieval to a single book; omit for whole-library search. */
  bookId?: string | null
  /** How many highlights to retrieve as grounding context. */
  k?: number
  /** Minimum cosine similarity (0-1). Lower = more permissive recall. */
  threshold?: number
}

const DEFAULT_K = 8
// Pilot uses a permissive threshold: better to show loosely-related highlights
// and let the LLM decide they don't answer the question than to return nothing.
const DEFAULT_THRESHOLD = 0.3

interface RpcHighlightRow {
  id: string
  highlighted_text: string
  page_number: number | null
  color_hex: string | null
  similarity: number
}

class AskLibraryService {
  /**
   * Retrieve the top-K highlights semantically closest to `query`, enriched
   * with their source-paper titles. Exposed separately so the UI can preview
   * sources before/without generating an answer if it wants.
   */
  async retrieve(query: string, userId: string, opts: AskOptions = {}): Promise<AskSource[]> {
    if (!supabase) return []
    const k = opts.k ?? DEFAULT_K
    const threshold = opts.threshold ?? DEFAULT_THRESHOLD

    const queryEmbedding = await embeddingService.embed(query)
    const queryVector = embeddingService.formatForPgVector(queryEmbedding)

    const { data, error } = await supabase.rpc('find_similar_highlights', {
      query_embedding: queryVector,
      p_user_id: userId,
      p_book_id: opts.bookId ?? null,
      similarity_threshold: threshold,
      result_limit: k,
      include_orphaned: false,
    })

    if (error) {
      console.error('askLibraryService.retrieve RPC error:', error)
      throw error
    }

    const rows = (data ?? []) as RpcHighlightRow[]
    if (rows.length === 0) return []

    const bookTitles = await this.fetchBookTitles(rows.map((r) => r.id))

    return rows.map((r, i) => ({
      index: i + 1,
      highlightId: r.id,
      excerpt: r.highlighted_text,
      page: r.page_number,
      bookTitle: bookTitles.get(r.id) ?? null,
      colorHex: r.color_hex,
      similarity: r.similarity,
    }))
  }

  /**
   * Full ask: retrieve → ground → answer. Returns the answer text (with inline
   * [n] citations) and the ordered sources those [n] refer to.
   */
  async ask(query: string, userId: string, opts: AskOptions = {}): Promise<AskResult> {
    const trimmed = query.trim()
    if (!trimmed) return { answer: '', sources: [], status: 'error' }

    let sources: AskSource[]
    try {
      sources = await this.retrieve(trimmed, userId, opts)
    } catch (err: any) {
      // embeddingService throws a specific "unavailable" error when no key is set
      if (err?.message?.includes('unavailable')) {
        return { answer: '', sources: [], status: 'embedding_unavailable' }
      }
      return { answer: '', sources: [], status: 'error' }
    }

    if (sources.length === 0) {
      return { answer: '', sources: [], status: 'no_sources' }
    }

    const excerptBlock = sources
      .map((s) => {
        const where = [
          s.bookTitle ? `"${s.bookTitle}"` : null,
          s.page != null ? `p.${s.page}` : null,
        ]
          .filter(Boolean)
          .join(', ')
        return `[${s.index}]${where ? ` (${where})` : ''} ${s.excerpt}`
      })
      .join('\n\n')

    const instructions = [
      'You are answering a question using ONLY the excerpts below, which come from the user\'s own research library (their highlights).',
      '',
      'Rules:',
      '- Use only information contained in the excerpts. Do NOT use outside knowledge.',
      '- After each claim, cite the supporting excerpt(s) with bracket notation like [1] or [2][3].',
      '- If the excerpts do not contain enough information to answer, say so plainly in one sentence and do not pad the answer.',
      '- Be concise and precise. Prefer the user\'s own wording where it helps.',
      '',
      `Question: ${trimmed}`,
      '',
      'Answer (with [n] citations):',
    ].join('\n')

    try {
      const answer = await sendMessageToAI(instructions, excerptBlock, 'free', 'general')
      return { answer: (answer || '').trim(), sources, status: 'ok' }
    } catch (err) {
      console.error('askLibraryService.ask LLM error:', err)
      // We still have sources — return them so the UI can show grounding even
      // if generation failed.
      return { answer: '', sources, status: 'error' }
    }
  }

  /**
   * Map highlight ids → source-paper title. Best-effort: highlight rows from
   * the RPC don't carry book_id, so we look it up, then resolve titles. Any
   * failure degrades silently to "no title" (sources still render by page).
   */
  private async fetchBookTitles(highlightIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (!supabase || highlightIds.length === 0) return result

    try {
      const { data: highlights, error: hErr } = await supabase
        .from('user_highlights')
        .select('id, book_id')
        .in('id', highlightIds)
      if (hErr || !highlights) return result

      const bookIdByHighlight = new Map<string, string>()
      const bookIds = new Set<string>()
      for (const h of highlights as Array<{ id: string; book_id: string }>) {
        if (h.book_id) {
          bookIdByHighlight.set(h.id, h.book_id)
          bookIds.add(h.book_id)
        }
      }
      if (bookIds.size === 0) return result

      const { data: books, error: bErr } = await supabase
        .from('user_books')
        .select('id, title, file_name')
        .in('id', Array.from(bookIds))
      if (bErr || !books) return result

      const titleByBook = new Map<string, string>()
      for (const b of books as Array<{ id: string; title?: string; file_name?: string }>) {
        titleByBook.set(b.id, b.title || b.file_name || 'Untitled')
      }

      for (const [highlightId, bookId] of bookIdByHighlight) {
        const title = titleByBook.get(bookId)
        if (title) result.set(highlightId, title)
      }
    } catch (err) {
      console.warn('askLibraryService.fetchBookTitles failed (non-fatal):', err)
    }
    return result
  }
}

export const askLibraryService = new AskLibraryService()
