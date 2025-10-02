/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_API_KEY: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PDF_WORKER_URL: string
  readonly VITE_PDF_LOADING_TIMEOUT: string
  readonly VITE_PDF_WARNING_TIMEOUT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
