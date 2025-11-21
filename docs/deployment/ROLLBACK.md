# Rollback Procedures

## Overview

Guidelines for rolling back problematic deployments to Smart Reader.

## When to Rollback

Rollback if:
- Application is completely down
- Critical bugs introduced
- Performance degradation > 50%
- Data corruption detected
- Security vulnerability exposed

**DO NOT** rollback for:
- Minor UI issues
- Non-critical bugs
- Performance issues < 10%
- Cosmetic problems

## Rollback Methods

### Method 1: Vercel Dashboard (Recommended)

**Speed:** Fastest (2-3 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Deployments** tab
4. Find last known good deployment
5. Click **•••** menu
6. Select **Promote to Production**
7. Confirm promotion

### Method 2: Vercel CLI

**Speed:** Fast (3-5 minutes)

```bash
# Login to Vercel
vercel login

# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>

# Or promote specific deployment
vercel --prod --force <deployment-url>
```

### Method 3: Git Revert

**Speed:** Moderate (5-10 minutes)

**Use this when:**
- Need to fix code before redeploy
- Multiple commits to revert
- Want to preserve history

```bash
# Identify bad commit
git log --oneline

# Revert the commit
git revert <commit-hash>

# Push to main (triggers auto-deploy)
git push origin main
```

### Method 4: Emergency Hotfix

**Speed:** Moderate (10-15 minutes)

**Use this when:**
- Need to add fix with rollback
- Rollback alone isn't enough

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/emergency-fix

# Cherry-pick last good commit
git cherry-pick <good-commit-hash>

# Add emergency fix (if needed)
# Make minimal fix
git add .
git commit -m "hotfix: emergency fix"

# Push to main
git checkout main
git merge hotfix/emergency-fix
git push origin main
```

## Database Rollback

### Supabase Migrations

**Warning:** Database rollback can cause data loss. Use with extreme caution.

```sql
-- Example: Rollback a specific migration
-- Replace 'migration_name' with actual migration

-- Method 1: Manual SQL (quick fix)
BEGIN;
-- Your rollback SQL here
COMMIT;

-- Method 2: Create new migration
-- Create down migration that undoes changes
```

### Best Practices

1. **Test rollback** in staging first
2. **Backup database** before rolling back
3. **Document changes** being rolled back
4. **Verify data integrity** after rollback

## Rollback Checklist

### Before Rollback
- [ ] Confirm issue severity
- [ ] Identify bad deployment
- [ ] Find last known good deployment
- [ ] Notify team of rollback
- [ ] Backup database (if needed)

### During Rollback
- [ ] Execute rollback procedure
- [ ] Monitor deployment process
- [ ] Verify rollback completion
- [ ] Check application health

### After Rollback
- [ ] Verify application functionality
- [ ] Check all critical features
- [ ] Monitor for errors
- [ ] Document the incident
- [ ] Plan forward fix

## Post-Rollback Actions

### 1. Verify System Health

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Check Sentry for errors
# Open Sentry dashboard

# Check Vercel Analytics
# Open Vercel dashboard
```

### 2. Investigate Issue

1. Review Sentry errors
2. Check deployment logs
3. Analyze what changed
4. Identify root cause
5. Document findings

### 3. Communicate

- **Internal:** Notify team of rollback
- **External:** Update status page if public
- **Users:** If significant, announce fix

### 4. Plan Fix

1. Create issue in GitHub
2. Assign responsible developer
3. Plan proper fix
4. Schedule deployment
5. Add monitoring for issue

## Testing Rollback Process

Practice rollback quarterly:

1. Deploy test change
2. Execute rollback
3. Time the process
4. Document issues
5. Update procedures

## Automated Rollback

**Future Enhancement:** Automated rollback if health checks fail

```yaml
# In CD workflow
- name: Run health check
  run: |
    curl https://app.vercel.app/api/health
    # If fails, trigger rollback

- name: Auto-rollback on failure
  if: failure()
  run: |
    vercel rollback <previous-deployment>
```

## Rollback Windows

Establish rollback windows:
- **Business hours:** Rollback approved
- **After hours:** Emergency only
- **Weekend:** Requires escalation

## Communication Templates

### Internal Notification

```
🚨 PRODUCTION ROLLBACK

Application: Smart Reader
Issue: [Brief description]
Severity: [Critical/High]
Action Taken: Rolled back to [version]
Status: [In progress/Complete]
```

### External Status Update

```
We're experiencing technical difficulties and have temporarily rolled back to the previous version. We're working to resolve the issue and will update you shortly.
```

## Resources

- [Vercel Deployment Management](https://vercel.com/docs/deployments/deployment-management)
- [Incident Response Playbook](https://www.atlassian.com/incident-management/handbook)
- [Rollback Best Practices](https://cloud.google.com/architecture/devops/devops-tech-continuous-deployment)

