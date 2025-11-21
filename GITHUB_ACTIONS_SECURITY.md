# GitHub Actions Security Guide ✅

## Security Enhancements Implemented

All GitHub Actions workflows have been secured with industry best practices.

---

## Key Security Features

### 1. **Minimum Required Permissions**

Every workflow now specifies explicit permissions:

```yaml
permissions:
  contents: read  # Only what's needed
  pull-requests: read
```

**Benefits:**
- Prevents unauthorized access
- Follows principle of least privilege
- Reduces attack surface

### 2. **Fork Protection**

Workflows check if running on a fork:

```yaml
if: github.event.pull_request.head.repo.full_name == github.repository || github.event_name == 'push'
```

**Benefits:**
- Protects secrets from fork PRs
- Prevents secret exfiltration
- Allows safe community contributions

### 3. **Credential Protection**

```yaml
- uses: actions/checkout@v4
  with:
    persist-credentials: false  # Don't persist GitHub token
```

**Benefits:**
- Prevents token leakage
- Limits token scope
- Reduces security risks

### 4. **Reproducible Builds**

```yaml
- run: npm ci  # Instead of npm install
```

**Benefits:**
- Uses package-lock.json for exact versions
- Prevents supply chain attacks
- Ensures consistent builds

### 5. **Timeouts**

```yaml
timeout-minutes: 20  # Prevent runaway jobs
```

**Benefits:**
- Prevents resource exhaustion
- Limits cost of attacks
- Faster failure detection

---

## Workflow-Specific Security

### CI Workflow (`ci.yml`)

**Permissions:**
```yaml
permissions:
  contents: read
  pull-requests: read
```

**Security Features:**
- ✅ Fork protection enabled
- ✅ No credential persistence
- ✅ Mock secrets for PR builds
- ✅ Artifact naming with SHA
- ✅ Limited artifact retention (7 days)

**Safe for:**
- Pull requests from forks
- Community contributions
- Public repositories

### CD Workflow (`cd.yml`)

**Permissions:**
```yaml
permissions:
  contents: write  # For tagging
  deployments: write  # For deployment status
```

**Security Features:**
- ✅ Environment protection (Production)
- ✅ Main branch only
- ✅ Health checks after deployment
- ✅ Bot user for git operations
- ✅ Timeout limits

**Protected by:**
- Branch protection rules
- Environment approvals
- Deployment gates

### E2E Tests (`e2e.yml`)

**Permissions:**
```yaml
permissions:
  contents: read
  pull-requests: read
```

**Security Features:**
- ✅ Fork protection
- ✅ Mock authentication (no real credentials)
- ✅ Network-level mocking
- ✅ Isolated test environment

**Safe for:**
- Testing without real data
- Running on PRs
- Community contributions

### Security Scan (`security.yml`)

**Permissions:**
```yaml
permissions:
  contents: read
  security-events: write
  pull-requests: read
```

**Security Features:**
- ✅ TruffleHog secret scanning
- ✅ Gitleaks git history scanning
- ✅ Snyk vulnerability scanning
- ✅ Dependency review
- ✅ Weekly automated scans

**Detects:**
- Hardcoded secrets
- Known vulnerabilities
- Malicious dependencies
- License violations

---

## Secret Management

### GitHub Secrets (Required)

Set these in: `Settings > Secrets and variables > Actions`

#### Deployment:
```
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>
```

#### Supabase:
```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

#### Optional (for security scanning):
```
SNYK_TOKEN=<your-snyk-token>
GITLEAKS_LICENSE=<your-gitleaks-license>
```

### Vercel Environment Variables

Set these in Vercel Dashboard for each environment:

#### Production:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`
- `VITE_OPENAI_API_KEY`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`

#### Preview/Development:
- Use separate keys for non-production
- Never use production keys in preview

---

## Best Practices

### DO ✅

1. **Use GitHub Secrets**
   ```yaml
   env:
     API_KEY: ${{ secrets.API_KEY }}
   ```

2. **Specify Permissions**
   ```yaml
   permissions:
     contents: read
   ```

3. **Protect Forks**
   ```yaml
   if: github.event.pull_request.head.repo.full_name == github.repository
   ```

4. **Use npm ci**
   ```yaml
   - run: npm ci
   ```

5. **Set Timeouts**
   ```yaml
   timeout-minutes: 20
   ```

6. **Don't Persist Credentials**
   ```yaml
   - uses: actions/checkout@v4
     with:
       persist-credentials: false
   ```

7. **Use Environment Protection**
   ```yaml
   environment:
     name: Production
   ```

8. **Name Artifacts with SHA**
   ```yaml
   name: dist-${{ github.sha }}
   ```

### DON'T ❌

1. **Never Hardcode Secrets**
   ```yaml
   # BAD!
   env:
     API_KEY: "sk-1234567890"
   ```

2. **Don't Use Broad Permissions**
   ```yaml
   # BAD!
   permissions: write-all
   ```

3. **Don't Run Forks Without Protection**
   ```yaml
   # BAD! Missing fork check
   on:
     pull_request:
   ```

4. **Don't Use npm install**
   ```yaml
   # BAD! Use npm ci instead
   - run: npm install
   ```

5. **Don't Skip Security Checks**
   ```yaml
   # BAD!
   - run: npm audit
     continue-on-error: true  # Should fail on critical issues
   ```

6. **Don't Expose Secrets in Logs**
   ```yaml
   # BAD!
   - run: echo ${{ secrets.API_KEY }}
   ```

---

## Security Checklist

### Repository Setup:
- [ ] Enable GitHub secret scanning
- [ ] Enable Dependabot alerts
- [ ] Enable Dependabot security updates
- [ ] Configure branch protection rules
- [ ] Require status checks before merge
- [ ] Require review before merge
- [ ] Enable "Restrict who can push to matching branches"

### Secrets Management:
- [ ] All secrets in GitHub Secrets (not in code)
- [ ] Different secrets for dev/staging/prod
- [ ] Rotate secrets quarterly
- [ ] Document secret rotation procedure
- [ ] Use environment-specific secrets

### Workflow Security:
- [ ] Minimum required permissions
- [ ] Fork protection enabled
- [ ] Timeouts configured
- [ ] No credential persistence
- [ ] Artifacts have retention limits
- [ ] Security scanning enabled

### Monitoring:
- [ ] Review security alerts weekly
- [ ] Monitor workflow runs for failures
- [ ] Check for unauthorized access
- [ ] Review audit logs monthly
- [ ] Track secret usage

---

## Incident Response

If secrets are exposed:

1. **Immediately rotate** all affected credentials
2. **Check git history** for committed secrets
3. **Review access logs** for unauthorized usage
4. **Update GitHub Secrets** and Vercel variables
5. **Document the incident**
6. **Review and improve** security measures

See `SECURITY_INCIDENT_RESPONSE.md` for detailed procedures.

---

## Security Scanning

### Automated Scans:

1. **TruffleHog** - Scans for secrets in code
2. **Gitleaks** - Scans git history for secrets
3. **Snyk** - Scans for vulnerabilities
4. **npm audit** - Checks dependencies
5. **Dependency Review** - Reviews PR dependencies

### Manual Checks:

```bash
# Check for secrets locally
npx trufflehog filesystem .

# Check git history
git secrets --scan-history

# Check dependencies
npm audit
```

---

## Resources

- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)
- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops-guideline/)
- [Vercel Security](https://vercel.com/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod#security)

---

## Summary

✅ **Workflows Secured**
- CI, CD, E2E, Security workflows updated
- Minimum permissions applied
- Fork protection enabled
- Secret scanning automated

✅ **Best Practices Implemented**
- No hardcoded secrets
- Proper permission scoping
- Timeout limits
- Reproducible builds

✅ **Monitoring Enabled**
- Weekly security scans
- Dependency reviews
- Secret detection
- Audit logging

**Status**: 🔒 Secure and Production-Ready

