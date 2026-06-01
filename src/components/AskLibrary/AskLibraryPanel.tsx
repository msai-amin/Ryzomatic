import React, { useCallback, useRef, useState } from 'react'
import { Search, X, Loader2, BookOpen, CornerDownLeft } from 'lucide-react'
import { askLibraryService, type AskSource } from '../../services/askLibraryService'
import { useAppStore } from '../../store/appStore'

/**
 * Ask Your Library — the flagship RAG panel. A right-side drawer where the
 * user asks a question and gets an answer grounded ONLY in their own
 * highlights, with every claim cited [n] to a source card below.
 *
 * Pilot scope: whole-library search, non-streaming answer. Streaming + a
 * per-document scope toggle are easy follow-ups.
 */

type Status = 'idle' | 'loading' | 'answered' | 'no_sources' | 'embedding_unavailable' | 'error'

export const AskLibraryPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const user = useAppStore((s) => s.user)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<AskSource[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const runAsk = useCallback(async () => {
    const q = question.trim()
    if (!q || !user?.id) return
    setStatus('loading')
    setAnswer('')
    setSources([])
    const result = await askLibraryService.ask(q, user.id)
    setSources(result.sources)
    setAnswer(result.answer)
    if (result.status === 'ok') setStatus('answered')
    else if (result.status === 'no_sources') setStatus('no_sources')
    else if (result.status === 'embedding_unavailable') setStatus('embedding_unavailable')
    else setStatus('error')
  }, [question, user?.id])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit, Shift+Enter for newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      runAsk()
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">Ask Your Library</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Input */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Ask anything about what you've read — answers are grounded only in your highlights."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1 text-[10px] text-gray-400">
            <CornerDownLeft className="h-3 w-3" /> to ask
          </div>
        </div>
        <button
          type="button"
          onClick={runAsk}
          disabled={!question.trim() || status === 'loading' || !user?.id}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Searching your library…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" /> Ask
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {status === 'idle' && <IdleHint />}
        {status === 'no_sources' && (
          <Notice>
            No highlights in your library matched that question. Try rephrasing, or highlight more
            as you read — the more you highlight, the better this gets.
          </Notice>
        )}
        {status === 'embedding_unavailable' && (
          <Notice tone="warn">
            Semantic search is temporarily unavailable (embedding service not configured). Please
            try again later.
          </Notice>
        )}
        {status === 'error' && (
          <Notice tone="warn">Something went wrong generating an answer. Please try again.</Notice>
        )}

        {answer && (
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Answer
            </h3>
            <AnswerText text={answer} />
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Sources from your library ({sources.length})
            </h3>
            <ol className="space-y-3">
              {sources.map((s) => (
                <li
                  key={s.highlightId}
                  id={`ask-source-${s.index}`}
                  className="rounded-lg border border-gray-200 p-3 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {s.index}
                    </span>
                    <span className="truncate font-medium text-gray-800">
                      {s.bookTitle ?? 'Your highlight'}
                    </span>
                    {s.page != null && (
                      <span className="ml-auto shrink-0 text-xs text-gray-400">p.{s.page}</span>
                    )}
                  </div>
                  <p
                    className="border-l-2 pl-3 italic text-gray-600"
                    style={{ borderColor: s.colorHex ?? '#c7d2fe' }}
                  >
                    {s.excerpt}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

/** Render answer text, turning [n] citation tokens into small clickable badges. */
const AnswerText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\[\d+\])/g)
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/)
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>
        const n = m[1]
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              document
                .getElementById(`ask-source-${n}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-indigo-100 px-1 align-text-top text-[10px] font-semibold text-indigo-700 hover:bg-indigo-200"
            title="Jump to source"
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

const IdleHint: React.FC = () => (
  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
    <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
    Ask a question and get an answer drawn only from papers you&apos;ve highlighted — every claim
    cited back to the exact highlight.
  </div>
)

const Notice: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' }> = ({
  children,
  tone = 'info',
}) => (
  <div
    className={`rounded-md border p-3 text-sm ${
      tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-gray-200 bg-gray-50 text-gray-600'
    }`}
  >
    {children}
  </div>
)

export default AskLibraryPanel
