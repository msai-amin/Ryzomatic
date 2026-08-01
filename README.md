ryzomatic

A research reading platform that reads academic PDFs aloud with word-level highlighting, and recommends what to read next from the OpenAlex citation graph.

Live app · React 18 + TypeScript · Supabase/pgvector · Vercel serverless

<!-- TODO: replace with a 20-second GIF of TTS word-sync running over a real PDF.
     This is the single highest-value thing on the page. Record with Kap or LICEcap,
     keep it under 5MB, commit to docs/assets/demo.gif -->
![Demo](docs/assets/demo.gif)
***
Why I built it

Reading papers is a bottleneck that tooling has mostly ignored. Reference managers solved storage (Zotero, Mendeley); AI tools solved summarising (NotebookLM, Elicit). Neither helps with the actual act of getting through a 30-page methods section — especially for people who read slowly, read in a second language, or want to read while commuting.

ryzomatic is my attempt at the reading layer: a PDF viewer that can read to you at the word level, remembers what you highlighted, and tells you what to read next.

I built it solo over ~10 months. Below are the three parts I think are actually worth reviewing.

***
Three things worth looking at

1. Word-level TTS sync over a rendered PDF

The problem. Highlighting each word as it's spoken sounds trivial and isn't. Speech synthesis emits boundary events in audio time against the string you submitted. A PDF's text lives in a separately rendered text layer with its own coordinate space and its own tokenisation — PDF.js will happily split a word across spans, or merge two words that were never adjacent on the page. There is no shared index between "the 412th character of the string I sent to Azure" and "the DOM node currently painted at x=203, y=88."

What I did. Providers expose a uniform speak(text, onEnd, onWord) contract where onWord fires with (word, charIndex). charIndex is the offset into the submitted string, which I map back onto PDF.js text-layer spans via an offset table built at extraction time. Long documents are chunked below each provider's character ceiling and the offsets are rebased per chunk, so highlighting stays correct across chunk boundaries — this was where most of the bugs lived.

Where it still breaks. Ligatures and hyphenated line-breaks desync the highlight by a word or two; two-column layouts with sidebars occasionally produce out-of-order spans. Both are documented in the issues.

src/services/azureTTSService.ts, src/services/ttsManager.ts

2. A three-tier TTS cache, because synthesis is billed per character

Azure and Google Cloud both bill per character synthesised. Naively, re-opening a paper re-synthesises it and re-bills it — and users re-read the same papers constantly. So audio is cached at three levels:

Tier	Store	Purpose
1	In-memory LRU, 50 entries	Instant replay within a session
2	Supabase tts_audio_cache	Survives reloads, shared across a user's devices
3	Provider API	Cold path only
	Cache keys are a SHA-256 over text + voiceName + speakingRate + pitch via crypto.subtle — so changing the voice or speed correctly misses, but re-reading the same page at the same settings never re-bills.

src/services/ttsCacheService.ts

3. A hybrid recommender over the OpenAlex citation graph

"Related papers" from a single similarity metric is a known-bad experience: pure citation overlap surfaces ancient canonical papers, pure recency surfaces noise. So recommendations are a weighted combination of six normalised signals:

citationSimilarity  0.30   position in the seed paper's citation neighbourhood
citationCount       0.25   quality proxy
recency             0.15   
topicOverlap        0.15   OpenAlex concept overlap with the seed
openAccess          0.10   can the user actually read it
venueQuality        0.05   

Each scorer returns 0–100 independently, so weights are tunable without touching the scorers. The open-access term is a deliberate product choice, not an information-retrieval one: a perfect recommendation behind a paywall is a bad recommendation. Users can mark results relevant/not-relevant, which persists but does not yet feed back into ranking — see below.

src/services/openAlexRecommendationService.ts

***
Architecture

React 18 + TypeScript (Vite)  ──  Zustand state, 63 components
        │
        ├── PDF.js text layer ──── TTS manager ──┬── Azure Cognitive Services
        │                                        ├── Google Cloud TTS
        │                                        └── Browser SpeechSynthesis  (fallback chain)
        │
        ├── Vercel serverless (14 functions) ──── Gemini 2.5 Flash → GPT-4o-mini (fallback)
        │
        └── Supabase ──── Postgres + pgvector (RAG), Auth + row-level security, Storage
                          74 migrations

The provider fallback chain is load-bearing rather than decorative: Azure gives the best voices but is the most likely to fail on quota, so ttsManager degrades Azure → Google → native browser TTS without interrupting playback. Same pattern on the LLM side, Gemini → OpenAI.

Scale: ~61k lines of TypeScript, 63 components, 46 services, 14 serverless functions, 74 database migrations.

Testing and CI

37 GitHub Actions workflows, 22 test suites (Vitest unit, Playwright E2E). Beyond the usual lint/test/build, the pipeline runs CodeQL, secret scanning, dependency review, license compliance, bundle-size limits, Lighthouse budgets, circular-dependency detection, and synthetic production smoke tests.

This is more CI than a solo project strictly needs. I built it out deliberately, because the failure mode I cared about was silently shipping a broken PDF viewer to the small number of people actually using the thing, and I had no QA but myself.

***
What I'd do differently

Honest section, because I think it's the most useful thing here.

I built far too much. There are seven feature areas in this app — reader, TTS, AI chat, recommendations, knowledge graph, annotations, and a Pomodoro timer with an achievement system. Roughly three of those earn their keep. The Pomodoro timer exists because it was fun to build on a Sunday, not because a single user asked for it. If I started again I would ship the TTS reader alone and nothing else, and only add the second thing once the first had users who complained about its absence.

I never validated the core assumption. The product asks people to move their PDF library into a new tool. That's an enormous switching cost against Zotero, which is free and twenty years entrenched. I should have tested that migration willingness with ten conversations before writing 61k lines of TypeScript. I didn't, and it's the assumption most likely to be fatal.

The relevance feedback loop is unfinished. Users can mark recommendations relevant or not; that signal is stored and then ignored. Closing the loop — even a naive per-user reweighting of the six coefficients — is the highest-value thing left in the codebase and it's maybe two days of work. It's unfinished because I kept starting new features instead.

Cost per user is unmodelled. TTS synthesis, OCR, vision extraction and LLM calls all carry real marginal cost, and the free tier grants all of them generously. The caching layer above was reactive — I built it after a bill surprised me — rather than something I designed for up front.

***
Running it locally

Requires Node 20+, a Supabase project, and at least one AI key (Gemini has a free tier).

git clone https://github.com/msai-amin/Ryzomatic.git && cd Ryzomatic
npm install
cp .env.example .env.local     # add Supabase URL/key + Gemini or OpenAI key
                               # Azure/Google TTS and AWS S3 are optional
vercel dev --listen 3001       # serverless functions + frontend

Apply migrations from supabase/migrations/ before first run. Full setup notes: docs/deployment/DEPLOYMENT.md.

Documentation

Architecture and database schema
Paper recommendation system
AI features
UI component guide

<details>
<summary>Full feature list</summary>

Multi-format upload (PDF, TXT) with OCR fallback · collections, tags, full-text and semantic search · PDF viewer with text-only / split / reading modes · multi-provider TTS with word highlighting and speed control · context-aware AI chat with structured RAG · clarification and further-reading modes · OpenAlex paper recommendations with filtering and feedback · AI-generated document relationship graph · multi-colour highlights with cross-document linking · contextual notes with markdown · Pomodoro timer with streaks and achievements · typography and theme controls (light/dark/sepia/reading) · focus mode and reading guide · installable PWA with offline caching.

</details>

License

MIT — see LICENSE.

<!-- TODO: there is currently no LICENSE file in the repo despite this claim.
     Run: npx license mit -o "Amin Amou" > LICENSE -->
