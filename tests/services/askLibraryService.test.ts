/**
 * Tests for askLibraryService — the Ask Your Library RAG orchestration.
 * embeddingService, supabase, and aiService are mocked at module boundary so
 * no network/DB/LLM contact happens. We assert the contract the UI depends on:
 * status transitions, source indexing, and graceful degradation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const { mockEmbed, mockFormat, mockRpc, mockFrom, mockSend } = vi.hoisted(() => ({
  mockEmbed: vi.fn(),
  mockFormat: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSend: vi.fn(),
}))

vi.mock('../../lib/embeddingService', () => ({
  embeddingService: {
    embed: mockEmbed,
    formatForPgVector: mockFormat,
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}))

vi.mock('../../src/services/aiService', () => ({
  sendMessageToAI: (...args: any[]) => mockSend(...args),
}))

import { askLibraryService } from '../../src/services/askLibraryService'

beforeEach(() => {
  vi.clearAllMocks()
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3])
  mockFormat.mockReturnValue('[0.1,0.2,0.3]')
  // Default: book-title enrichment degrades (returns error) so we don't have
  // to mock the full from().select().in() chain unless a test wants titles.
  mockFrom.mockReturnValue({
    select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'skip' } }) }),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('askLibraryService.ask', () => {
  it('returns error status for an empty question without calling anything', async () => {
    const res = await askLibraryService.ask('   ', 'user-1')
    expect(res.status).toBe('error')
    expect(mockEmbed).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns embedding_unavailable when the embedding service is down', async () => {
    mockEmbed.mockRejectedValueOnce(new Error('Embedding service unavailable'))
    const res = await askLibraryService.ask('what is X?', 'user-1')
    expect(res.status).toBe('embedding_unavailable')
    expect(res.sources).toEqual([])
  })

  it('returns no_sources when retrieval finds nothing', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    const res = await askLibraryService.ask('obscure question', 'user-1')
    expect(res.status).toBe('no_sources')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('grounds an answer in retrieved highlights and indexes sources 1..n', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { id: 'h1', highlighted_text: 'Transformers use self-attention.', page_number: 3, color_hex: '#ff0', similarity: 0.91 },
        { id: 'h2', highlighted_text: 'Attention scales with sequence length squared.', page_number: 5, color_hex: '#0ff', similarity: 0.82 },
      ],
      error: null,
    })
    mockSend.mockResolvedValueOnce('Self-attention is the core mechanism [1], though it is costly [2].')

    const res = await askLibraryService.ask('how does attention work?', 'user-1')

    expect(res.status).toBe('ok')
    expect(res.sources).toHaveLength(2)
    expect(res.sources[0]).toMatchObject({ index: 1, highlightId: 'h1', page: 3 })
    expect(res.sources[1]).toMatchObject({ index: 2, highlightId: 'h2', page: 5 })
    expect(res.answer).toContain('[1]')

    // The excerpts must be passed to the LLM as grounding context (2nd arg),
    // and the instructions (1st arg) must forbid outside knowledge.
    const [instructions, context] = mockSend.mock.calls[0]
    expect(context).toContain('Transformers use self-attention.')
    expect(instructions.toLowerCase()).toContain('only')
  })

  it('still returns sources (status error) if the LLM call fails after retrieval', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'h1', highlighted_text: 'x', page_number: 1, color_hex: null, similarity: 0.7 }],
      error: null,
    })
    mockSend.mockRejectedValueOnce(new Error('LLM down'))

    const res = await askLibraryService.ask('q', 'user-1')
    expect(res.status).toBe('error')
    expect(res.sources).toHaveLength(1)
  })

  it('passes p_book_id through when scoped to a single book', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    await askLibraryService.ask('q', 'user-1', { bookId: 'book-42' })
    expect(mockRpc).toHaveBeenCalledWith(
      'find_similar_highlights',
      expect.objectContaining({ p_user_id: 'user-1', p_book_id: 'book-42' })
    )
  })
})
