# Deprecation Warnings Analysis

## Direct Dependencies We Can Update

### High Priority (Deprecated)
1. **eslint@8.57.1** → **eslint@9.39.1** (Major version upgrade - requires migration)
   - Current: v8.57.1 (deprecated)
   - Latest: v9.39.1
   - **Note**: Requires ESLint v9 migration guide

2. **@typescript-eslint/eslint-plugin@6.14.0** → **@typescript-eslint/eslint-plugin@8.46.3**
3. **@typescript-eslint/parser@6.14.0** → **@typescript-eslint/parser@8.46.3**
   - Both need to be upgraded together
   - Major version upgrade (v6 → v8)

### Medium Priority (Safe Updates)
- `@supabase/supabase-js`: 2.58.0 → 2.79.0 (minor)
- `@google-cloud/storage`: 7.17.1 → 7.17.3 (patch)
- `@vercel/node`: 5.3.24 → 5.5.4 (minor)
- `@vitest/coverage-v8`: 4.0.5 → 4.0.7 (patch)
- `@vitest/ui`: 4.0.5 → 4.0.7 (patch)
- `vitest`: 4.0.5 → 4.0.7 (patch)

## Transitive Dependencies (Cannot Directly Fix)

These warnings come from dependencies of your dependencies:

1. **inflight@1.0.6** - From `glob@7.2.3` (used by eslint and other tools)
2. **intl-messageformat-parser@1.8.1** - From react-intl or similar
3. **lodash.get@4.4.2** - From various packages
4. **lodash.isequal@4.5.0** - From various packages
5. **raven@2.6.4** - Old Sentry package (already using @sentry/node)
6. **rollup-plugin-inject@3.0.2** - From Vite/rollup toolchain
7. **sourcemap-codec@1.4.8** - From build tools
8. **node-domexception@1.0.0** - From polyfills
9. **rimraf@3.0.2** - From various build tools
10. **@humanwhocodes/object-schema@2.0.3** - From ESLint
11. **@humanwhocodes/config-array@0.13.0** - From ESLint
12. **glob@7.2.3** - From ESLint and other tools
13. **uuid@3.3.2** - From old packages
14. **source-map@0.8.0-beta.0** - From build tools

## Recommendation

### Immediate Actions:
1. **Update ESLint to v9** (with migration guide)
2. **Update TypeScript ESLint plugins to v8**
3. **Update safe minor/patch versions**

### Future Actions:
- Wait for upstream packages to update their dependencies
- These transitive warnings are common and typically don't cause issues
- Monitor for security vulnerabilities via `npm audit`

## Notes

- Most transitive dependency warnings are harmless and will be resolved when upstream packages update
- The ESLint v9 upgrade is the most important as it's directly deprecated
- TypeScript ESLint v8 upgrade should be done alongside ESLint v9

## ✅ Updates Applied

The following have been updated:
- ✅ `eslint`: 8.55.0 → 9.39.1
- ✅ `@typescript-eslint/eslint-plugin`: 6.14.0 → 8.46.3
- ✅ `@typescript-eslint/parser`: 6.14.0 → 8.46.3
- ✅ `eslint-plugin-react-hooks`: 4.6.0 → 7.0.1
- ✅ `@supabase/supabase-js`: 2.58.0 → 2.79.0
- ✅ `@google-cloud/storage`: 7.17.1 → 7.17.3
- ✅ `@vercel/node`: 5.3.24 → 5.5.4
- ✅ `@vitest/coverage-v8`: 4.0.5 → 4.0.7
- ✅ `@vitest/ui`: 4.0.5 → 4.0.7
- ✅ `vitest`: 4.0.5 → 4.0.7

**Status**: All updates installed successfully. ESLint v9 is working with the existing flat config format.

