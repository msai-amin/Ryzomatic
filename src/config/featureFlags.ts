/**
 * Lightweight feature-flag registry.
 *
 * Pilot-grade: each flag resolves from (in priority order)
 *   1. a localStorage override  — `localStorage.setItem('ff_askLibrary','true'|'false')`
 *      (lets us toggle per-browser during the pilot without a redeploy)
 *   2. a Vite build-time env var — e.g. VITE_FF_ASK_LIBRARY=false
 *   3. the hardcoded default below
 *
 * Keep this tiny. If flags multiply, graduate to a real provider.
 */

type FlagKey = 'askLibrary'

const DEFAULTS: Record<FlagKey, boolean> = {
  // Ask Your Library — RAG chat grounded in the user's highlights. On for the
  // pilot; flip the env var or localStorage to kill it without a redeploy.
  askLibrary: true,
}

const ENV_KEYS: Record<FlagKey, string> = {
  askLibrary: 'VITE_FF_ASK_LIBRARY',
}

function readEnv(key: string): boolean | null {
  try {
    const raw = (import.meta as any)?.env?.[key]
    if (raw === undefined || raw === null || raw === '') return null
    return String(raw).toLowerCase() === 'true'
  } catch {
    return null
  }
}

function readLocalStorage(flag: FlagKey): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(`ff_${flag}`)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

export function isFeatureEnabled(flag: FlagKey): boolean {
  const ls = readLocalStorage(flag)
  if (ls !== null) return ls
  const env = readEnv(ENV_KEYS[flag])
  if (env !== null) return env
  return DEFAULTS[flag]
}

export const FEATURES = {
  get askLibrary() {
    return isFeatureEnabled('askLibrary')
  },
}
