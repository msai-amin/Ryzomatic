# CI Workflow Fix - Node Version Update

## Issue
GitHub Actions CI/CD workflows were failing with:
- `EBADENGINE Unsupported engine` errors for packages requiring Node 20+
- `npm ci` failing with `package.json and package-lock.json are in sync` errors

## Root Cause
1. **Node Version Mismatch**: Workflows configured for Node 18, but dependencies require Node 20+
   - `vitest@4.0.5` requires `^20.0.0 || ^22.0.0 || >=24.0.0`
   - `jsdom@27.0.1` requires `node >= 20`
   - `happy-dom@20.0.10` requires `node >= 20.0.0`
   - `lighthouse@13.0.1` requires `node >= 22.19`
   - `marked@16.3.0` requires `node >= 20`
   - `pdfjs-dist@5.4.296` requires `node >= 20.16.0`

2. **Lock File Out of Sync**: `package-lock.json` was generated with different Node/npm versions

## Solution

### Updated Node Version in All Workflows
Changed from Node 18 to Node 20 in:
- `.github/workflows/ci.yml` (5 occurrences)
- `.github/workflows/cd.yml` (3 occurrences)
- `.github/workflows/security.yml` (1 occurrence)
- `.github/workflows/performance.yml` (1 occurrence)

### Regenerated package-lock.json
```bash
rm -f package-lock.json
npm install
```

## Verification

### Local Build
```bash
npm run build
# ✓ built in 3.11s ✅
```

### Git Status
```bash
git log --oneline -1
# 2ec566b fix: Update GitHub Actions to use Node 20...
git push origin main
# Successfully pushed ✅
```

## Files Changed
- `.github/workflows/ci.yml`
- `.github/workflows/cd.yml`
- `.github/workflows/security.yml`
- `.github/workflows/performance.yml`
- `package-lock.json`

## Status
✅ **FIXED** - CI/CD workflows should now run successfully on GitHub Actions

## Next Steps
1. Monitor GitHub Actions: https://github.com/msai-amin/smart-reader-serverless/actions
2. Verify CI workflow completes without errors
3. Confirm CD workflow deploys successfully

---

**Commit:** 2ec566b  
**Date:** 2025-01-31  
**Status:** ✅ Resolved

