# 🚨 SECURITY INCIDENT: Exposed Credentials

## Critical Issue Detected

**Date**: November 21, 2025  
**Severity**: CRITICAL  
**Status**: IMMEDIATE ACTION REQUIRED

---

## What Happened

The file `.env.local` was found to contain **real API keys and secrets** that may have been committed to git history. This is a critical security vulnerability.

### Exposed Credentials:

1. **Supabase**
   - Project URL: `pbfipmvtkbivnwwgukpw.supabase.co`
   - Anon Key: `eyJhbGci...` (exposed)
   - Service Role Key: `eyJhbGci...` (exposed)

2. **Google Gemini AI**
   - API Key: `AIzaSy*********************` (exposed - REDACTED)

3. **OpenAI**
   - API Key: `sk-proj-*********************` (exposed - REDACTED)

4. **AWS S3**
   - Access Key ID: `AKIA***************` (exposed - REDACTED)
   - Secret Access Key: `*********************` (exposed - REDACTED)
   - Bucket: `smart-reader-documents`

---

## Immediate Actions Required

### 1. Rotate ALL Credentials (DO THIS NOW!)

#### Supabase:
```bash
# 1. Go to: https://app.supabase.com/project/pbfipmvtkbivnwwgukpw/settings/api
# 2. Click "Reset" on both Anon Key and Service Role Key
# 3. Update your local .env.local with new keys
# 4. Update GitHub Secrets
# 5. Update Vercel Environment Variables
```

#### Google Gemini:
```bash
# 1. Go to: https://makersuite.google.com/app/apikey
# 2. Delete the exposed key (starts with AIzaSy...)
# 3. Generate a new API key
# 4. Update .env.local, GitHub Secrets, and Vercel
```

#### OpenAI:
```bash
# 1. Go to: https://platform.openai.com/api-keys
# 2. Revoke the exposed key (starts with sk-proj-...)
# 3. Generate a new API key
# 4. Update .env.local, GitHub Secrets, and Vercel
```

#### AWS:
```bash
# 1. Go to: https://console.aws.amazon.com/iam/
# 2. Delete the exposed access key (starts with AKIA...)
# 3. Create new access key
# 4. Update .env.local, GitHub Secrets, and Vercel
# 5. Check S3 bucket access logs for unauthorized access
```

### 2. Check Git History

```bash
# Check if .env.local was ever committed
git log --all --full-history -- .env.local
git log --all --full-history -- .env.*

# If found in history, you MUST:
# 1. Use BFG Repo-Cleaner or git-filter-repo to remove it
# 2. Force push to rewrite history (coordinate with team!)
# 3. Rotate ALL credentials immediately
```

### 3. Remove from Repository

```bash
# Ensure .env.local is not tracked
git rm --cached .env.local 2>/dev/null || true
git rm --cached .env.* 2>/dev/null || true

# Verify .gitignore is working
git check-ignore .env.local
# Should output: .env.local
```

### 4. Update GitHub Secrets

```bash
# Go to: https://github.com/YOUR_USERNAME/smart-reader-serverless/settings/secrets/actions

# Add/Update these secrets:
VITE_SUPABASE_URL=<new-value>
VITE_SUPABASE_ANON_KEY=<new-value>
SUPABASE_SERVICE_ROLE_KEY=<new-value>
VITE_GEMINI_API_KEY=<new-value>
GEMINI_API_KEY=<new-value>
VITE_OPENAI_API_KEY=<new-value>
OPENAI_API_KEY=<new-value>
AWS_ACCESS_KEY_ID=<new-value>
AWS_SECRET_ACCESS_KEY=<new-value>
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>
```

### 5. Update Vercel Environment Variables

```bash
# Go to: https://vercel.com/YOUR_USERNAME/smart-reader-serverless/settings/environment-variables

# Update all environment variables with new values
# Make sure to update for all environments: Production, Preview, Development
```

---

## Preventive Measures Implemented

### 1. Enhanced .gitignore
- ✅ Added comprehensive patterns for secrets
- ✅ Explicitly ignores all .env.* files except .env.example
- ✅ Added patterns for common secret file types

### 2. Secured GitHub Actions
- ✅ Added minimum required permissions
- ✅ Prevented fork execution (protects secrets)
- ✅ Added `persist-credentials: false` to checkouts
- ✅ Use `npm ci` instead of `npm install`
- ✅ Added timeout limits

### 3. Secret Scanning
- ✅ Added TruffleHog for secret detection
- ✅ Added Gitleaks for git history scanning
- ✅ Runs on every PR and weekly schedule

### 4. Created .env.example
- ✅ Template file with no real values
- ✅ Clear instructions for developers
- ✅ Safe to commit to repository

---

## Security Checklist

### Immediate (Do Now):
- [ ] Rotate Supabase keys
- [ ] Rotate Gemini API key
- [ ] Rotate OpenAI API key
- [ ] Rotate AWS credentials
- [ ] Check git history for .env.local
- [ ] Update GitHub Secrets
- [ ] Update Vercel Environment Variables
- [ ] Verify .env.local is not tracked

### Short-term (This Week):
- [ ] Review AWS S3 access logs
- [ ] Review Supabase auth logs
- [ ] Check for unauthorized API usage
- [ ] Review billing for unexpected charges
- [ ] Enable AWS CloudTrail if not already enabled
- [ ] Enable Supabase audit logs

### Long-term (Ongoing):
- [ ] Implement secret rotation schedule (quarterly)
- [ ] Set up AWS IAM roles instead of access keys
- [ ] Use Vercel's secret management
- [ ] Enable 2FA on all accounts
- [ ] Regular security audits
- [ ] Monitor for leaked secrets (GitHub secret scanning)

---

## How to Prevent This

### For Developers:

1. **NEVER commit .env files**
   ```bash
   # Always check before committing
   git status
   git diff --cached
   ```

2. **Use .env.example**
   ```bash
   # Copy template for local development
   cp .env.example .env.local
   # Fill in your values
   ```

3. **Verify .gitignore**
   ```bash
   # Test if file is ignored
   git check-ignore .env.local
   ```

4. **Use pre-commit hooks**
   ```bash
   # Install pre-commit
   npm install --save-dev husky
   npx husky install
   
   # Add pre-commit hook
   npx husky add .husky/pre-commit "git secrets --scan"
   ```

### For CI/CD:

1. **Use GitHub Secrets** - Never hardcode in workflows
2. **Use Vercel Environment Variables** - Set in dashboard
3. **Minimum Permissions** - Only grant what's needed
4. **Prevent Fork Execution** - Protect secrets from PRs
5. **Regular Audits** - Review secrets quarterly

---

## Monitoring

### Check for Unauthorized Access:

#### Supabase:
```bash
# Go to: https://app.supabase.com/project/pbfipmvtkbivnwwgukpw/logs
# Check auth logs for suspicious activity
```

#### AWS:
```bash
# Check CloudTrail for API calls with your access key ID
aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=YOUR_ACCESS_KEY_ID

# Check S3 access logs
aws s3 ls s3://smart-reader-documents --recursive
```

#### OpenAI:
```bash
# Go to: https://platform.openai.com/usage
# Check for unexpected API usage
```

#### Gemini:
```bash
# Go to: https://console.cloud.google.com/apis/dashboard
# Check API usage metrics
```

---

## Contact

If you discover any unauthorized access or suspicious activity:

1. **Immediately** rotate all credentials
2. **Document** what you found
3. **Report** to security team
4. **Review** access logs
5. **Update** incident response plan

---

## Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod#security)

---

**Status**: ⚠️ CRITICAL - IMMEDIATE ACTION REQUIRED  
**Next Review**: After all credentials are rotated  
**Responsible**: Repository owner/admin

