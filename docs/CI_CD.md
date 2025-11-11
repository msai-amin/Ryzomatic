# CI/CD Pipeline Documentation

## Overview

Smart Reader uses GitHub Actions for continuous integration and continuous deployment to Vercel.

## Workflows

### 1. CI (Continuous Integration)

**Trigger:** Every push to any branch, PR to main  
**File:** `.github/workflows/ci.yml`

**Stages:**
1. **Lint & Type Check** - ESLint + TypeScript compilation
2. **Unit & Integration Tests** - Vitest with coverage
3. **Security Scanning** - npm audit + Snyk
4. **Build Verification** - Production build check
5. **E2E Tests** - Playwright tests (on PR only)

### 2. CD (Continuous Deployment)

**Trigger:** Push to main branch  
**File:** `.github/workflows/cd.yml`

**Stages:**
1. **Pre-deployment Checks** - Run all CI checks
2. **Deploy Preview** - Deploy to preview environment (PR)
3. **Deploy Production** - Deploy to Vercel production
4. **Post-deployment** - Tag release, generate changelog, notify team

### 3. Security Scan

**Trigger:** Weekly on Sunday + manual  
**File:** `.github/workflows/security.yml`

**Checks:**
- npm audit
- Snyk security scanning
- Known vulnerability checks

### 4. Performance Audit

**Trigger:** Daily at 2 AM + manual  
**File:** `.github/workflows/performance.yml`

**Checks:**
- Lighthouse CI
- Performance budgets
- Core Web Vitals

### 5. Pre-Production Verification

**Trigger:** Manual (`workflow_dispatch`) or pushes to `main` / `release/**`  
**File:** `.github/workflows/preproduction.yml`

**Stages (strict order):**
1. **Lint & Type Check** – ESLint and TypeScript (fails on warning/error)
2. **Unit & Integration Tests** – `npm run test:ci` with coverage artifact upload
3. **Build Bundle** – `npm run build` and publish the compiled `dist/` artifact
4. **Playwright E2E** – `npm run test:e2e:ci`, uploads Playwright report
5. **Security & Compliance** – `npm audit` + Snyk scan (artifacts archived)

Use this workflow before promoting UI/library changes to ensure full parity with production gating.

## Required Secrets

Configure these in GitHub repository settings:

```
VERCEL_TOKEN          # Vercel deployment token
VERCEL_ORG_ID         # Vercel organization ID
VERCEL_PROJECT_ID     # Vercel project ID
SNYK_TOKEN            # Optional: Snyk API token
LIGHTHOUSE_CI_TOKEN   # Optional: Lighthouse CI token
```

## Deployment Process

1. **Developer pushes code** to branch
2. **CI runs automatically** on push/PR
3. **If CI passes**, merge to main
4. **CD triggers** on merge to main
5. **Vercel deploys** automatically
6. **Health checks** verify deployment
7. **Release tagged** in Git

## Rollback Procedure

### Automatic Rollback
If health checks fail after deployment, automatic rollback is triggered.

### Manual Rollback
```bash
# Via GitHub Actions UI
1. Go to Actions tab
2. Find latest successful deployment
3. Click "Re-run jobs"

# Via Vercel CLI
vercel rollback <deployment-url>
```

## Manual Deployment

```bash
# Build locally
npm run build

# Deploy to Vercel
vercel --prod

# Verify deployment
curl https://your-app.vercel.app/api/health
```

## Troubleshooting

### Build Failures
- Check GitHub Actions logs
- Verify all dependencies installed
- Check for TypeScript errors

### Deployment Failures
- Verify Vercel credentials
- Check environment variables
- Review Vercel build logs

### Test Failures
- Run tests locally: `npm run test:ci`
- Check test coverage report
- Review test logs in CI output

## Best Practices

1. **Never skip tests** - All tests must pass
2. **Keep builds fast** - Target < 5 minutes
3. **Monitor deployments** - Watch for errors
4. **Tag releases** - Every production deployment
5. **Document changes** - Update changelog

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)
- [CI/CD Best Practices](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment)

