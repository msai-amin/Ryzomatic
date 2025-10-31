# Deployment Guide

## Overview

Smart Reader is deployed to Vercel with automatic CI/CD from GitHub.

## Environments

### Production
- **URL:** https://smart-reader-serverless.vercel.app
- **Branch:** main
- **Deployment:** Automatic on merge

### Preview
- **URL:** Auto-generated per PR
- **Branch:** Any branch with PR
- **Deployment:** Automatic on PR

## Deployment Process

### Automatic Deployment

1. **Push code** to main branch
2. **CI runs** automatically (lint, test, build)
3. **CD triggers** if CI passes
4. **Vercel deploys** to production
5. **Health checks** verify deployment
6. **Release tagged** in Git

### Manual Deployment

```bash
# Login to Vercel
vercel login

# Link project (first time only)
vercel link

# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Lint checks passing
- [ ] TypeScript compilation successful
- [ ] Build completes without warnings
- [ ] Environment variables configured
- [ ] Database migrations applied (if any)
- [ ] Changelog updated

## Environment Variables

Configure in Vercel dashboard:

**Required:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET
AWS_REGION
```

**Optional:**
```
VITE_SENTRY_DSN
VITE_GOOGLE_CLIENT_ID
VITE_GOOGLE_CLOUD_TTS_API_KEY
```

## Database Migrations

### Supabase Migrations

```bash
# Check status
supabase status

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Create new migration
supabase migration new migration_name
```

### Migration Best Practices

1. **Test locally** first
2. **Review carefully** before production
3. **Back up database** before major changes
4. **Apply during** low-traffic hours
5. **Verify** after deployment

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "environment": "healthy"
  }
}
```

### 2. Smoke Tests

Manual verification:
- [ ] Landing page loads
- [ ] Sign in works
- [ ] Library opens
- [ ] Document upload works
- [ ] PDF viewing works
- [ ] AI chat works

### 3. Monitoring

Check:
- Vercel deployment logs
- Sentry for errors
- Vercel Analytics
- Database performance

## Rollback Procedure

See [ROLLBACK.md](./ROLLBACK.md) for detailed rollback procedures.

## Troubleshooting

### Build Failures
```bash
# Check Vercel logs
vercel logs

# Build locally to replicate
npm run build
```

### Runtime Errors
1. Check Sentry dashboard
2. Review Vercel function logs
3. Verify environment variables
4. Check database connectivity

### Performance Issues
1. Check Vercel Analytics
2. Review bundle size
3. Check database query logs
4. Verify CDN caching

## Release Management

### Versioning
- Semantic versioning (major.minor.patch)
- Auto-tagged by CD workflow
- Format: `vYYYYMMDD-HHMMSS`

### Changelog
- Update before each release
- Document breaking changes
- List new features
- Note bug fixes

## Emergency Deployments

For urgent fixes:

1. **Create hotfix branch** from main
2. **Make minimal change**
3. **Test thoroughly**
4. **Merge to main** (triggers deployment)
5. **Monitor closely**

## Resources

- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)
- [Supabase Migrations](https://supabase.com/docs/guides/database/migrations)
- [Deployment Best Practices](https://www.atlassian.com/continuous-delivery/software-testing/deployment-best-practices)

