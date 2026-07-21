# Ryzomatic

An AI-powered reading platform for researchers. Upload papers, read and annotate them, listen to them, and let the app discover how your documents connect to each other — and what you should read next.

The name comes from *rhizomatic*: knowledge as a network where any node can connect to any other. That idea drives the product — your library isn't a folder tree, it's a living map.

## Core features

- **Document library** — PDF/text upload, extraction (PDF.js with OCR fallback), collections, tags, full-text search
- **PDF reading** — text, PDF, and split view modes; highlights with color options; contextual notes
- **AI chat** — context-aware conversations about the open document (Gemini primary, OpenAI fallback), clarification and further-reading modes, notes-aware answers
- **Paper recommendations** — OpenAlex citation-graph discovery with hybrid ranking (graph similarity, citations, recency, venue, open access)
- **Document relationships** — pgvector embeddings auto-link related documents in your library, with an interactive graph view
- **Text-to-speech** — natural voices (Azure / Google Cloud / native browser) with word-level highlighting and smart cleanup of publication metadata
- **PWA** — installable, offline-capable

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind, Zustand |
| PDF | PDF.js + react-pdf-viewer |
| Backend | Vercel serverless functions (`api/`), service modules in `lib/` |
| Database | Supabase (PostgreSQL + pgvector), Row-Level Security |
| Storage | Supabase Storage + AWS S3 |
| AI | Gemini 2.5 Flash (primary), GPT-4o-mini (fallback), OpenAlex API |
| Testing | Vitest (unit) + Playwright (e2e) |

## Getting started

Prerequisites: Node 20+, a Supabase project, and at least one AI key (Gemini or OpenAI).

```bash
npm install
cp .env.example .env.local   # fill in Supabase + AI keys
```

Set up the database: enable the `vector` extension in Supabase, then apply migrations from `supabase/migrations/` (in order, via `supabase db push` or the SQL editor).

Run locally:

```bash
vercel dev --listen 3001   # full stack (frontend + api functions)
npm run dev                # frontend only
```

## Scripts

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint (zero-warning policy)
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright
npm run build        # production build
```

Husky runs lint-staged on commit and type-check + tests on push.

## Project structure

```
src/
  components/     # React components (viewer, library, chat, notes)
  services/       # client-side business logic
  store/          # Zustand app store
  hooks/, utils/, styles/
themes/           # app shell (ThemedApp, ThemedHeader, ThemedSidebar)
lib/              # server-side services (embeddings, graph, recommendations)
api/              # Vercel serverless functions
supabase/         # database migrations
tests/            # unit + e2e tests
docs/             # documentation and audits
```

## Documentation

- [Database schema](./docs/architecture/DATABASE_SCHEMA.md)
- [Paper recommendations](./docs/features/paper-recommendations/IMPLEMENTATION.md)
- [AI features](./docs/features/ai/AI_FEATURES_QUICK_START.md)
- [Deployment](./docs/deployment/DEPLOYMENT.md)

## License

MIT — see [LICENSE](./LICENSE).
