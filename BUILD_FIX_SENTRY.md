# Build Fix: Sentry Dependencies

## Issue
Vercel build was failing with the error:
```
[vite]: Rollup failed to resolve import "@sentry/react" from "/vercel/path0/src/main.tsx"
```

## Root Cause
Sentry packages (`@sentry/react` and `@sentry/node`) were installed as **devDependencies** but were imported in production code (`src/main.tsx`). 

During production builds, Vercel only installs `dependencies`, not `devDependencies`, so the Sentry packages weren't available.

## Solution
Moved Sentry packages from `devDependencies` to `dependencies`:

```bash
npm install --save @sentry/react @sentry/node
```

## Files Changed
- `package.json` - Sentry moved to dependencies
- `package-lock.json` - Updated lock file

## Status
✅ **FIXED** - Build now succeeds

## Prevention
**Rule:** If a package is imported in production code, it must be in `dependencies`, not `devDependencies`.

Only put packages in `devDependencies` if they're:
- Used only for development (e.g., testing tools)
- Used only for building (e.g., Vite plugins)
- Never imported in production code

## Related Files
- `src/main.tsx` - Imports @sentry/react
- `sentry.client.config.ts` - Sentry configuration
- `sentry.server.config.ts` - Server-side Sentry

---

**Commit:** ee625ff  
**Status:** ✅ Deployed

