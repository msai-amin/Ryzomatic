# Dependency Workflows Documentation

**Last Updated:** 2025-01-27  
**Status:** ✅ All workflows implemented

## Overview

This document describes all dependency management workflows implemented for the Smart Reader project. These workflows ensure dependency security, compliance, and maintainability.

---

## High Priority Workflows

### 1. Lockfile Validation

**File:** `.github/workflows/lockfile-validation.yml`

**Purpose:** Ensures `package-lock.json` is committed and synchronized with `package.json`.

**Triggers:**
- Pull requests to `main`
- Pushes to `main`

**Checks:**
- Verifies `package-lock.json` exists
- Validates lockfile is in sync with `package.json`
- Checks lockfile integrity

**Failure Conditions:**
- Missing `package-lock.json`
- Lockfile out of sync (requires running `npm install`)

---

### 2. Dependency Update Impact Analysis

**File:** `.github/workflows/dependency-impact-analysis.yml`

**Purpose:** Analyzes the impact of dependency updates before merging Dependabot PRs.

**Triggers:**
- Pull requests that modify `package.json` or `package-lock.json`

**Analysis:**
- Lists changed packages
- Compares build results (before/after)
- Runs test suite
- Analyzes bundle size impact
- Comments summary on PR

**Benefits:**
- Catch breaking changes early
- Monitor bundle size increases
- Verify tests still pass

---

### 3. License Compliance

**File:** `.github/workflows/license-compliance.yml`

**Purpose:** Ensures all dependencies comply with allowed licenses.

**Triggers:**
- Weekly schedule (Mondays at 10 AM UTC)
- Pull requests modifying dependencies
- Manual dispatch

**Checks:**
- Scans all package licenses
- Denies GPL-2.0 and GPL-3.0 licenses
- Flags unknown/unlicensed packages
- Generates compliance report

**Denied Licenses:**
- `GPL-2.0`
- `GPL-3.0`
- `AGPL-3.0`

**Allowed Licenses:**
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- 0BSD
- Unlicense
- Public Domain
- CC0-1.0
- LGPL-2.1
- LGPL-3.0

---

## Medium Priority Workflows

### 4. Outdated Dependencies Report

**File:** `.github/workflows/outdated-dependencies-report.yml`

**Purpose:** Weekly report of outdated dependencies.

**Triggers:**
- Weekly schedule (Mondays at 8 AM UTC)
- Manual dispatch

**Output:**
- Creates/updates GitHub issue with outdated packages
- Lists current vs. latest versions
- Provides update recommendations

**Benefits:**
- Stay aware of available updates
- Plan dependency updates proactively
- Track major version upgrades needed

---

### 5. Deprecated Dependencies Check

**File:** `.github/workflows/deprecated-dependencies-check.yml`

**Purpose:** Detects deprecated packages that need replacement.

**Triggers:**
- Pull requests modifying dependencies
- Weekly schedule (Mondays at 9 AM UTC)
- Manual dispatch

**Checks:**
- Scans for deprecated npm packages
- Checks direct dependencies for deprecation status
- Comments on PRs with deprecated packages

**Benefits:**
- Early warning of packages to replace
- Avoid security/maintenance issues
- Plan migration timeline

---

### 6. Circular Dependency Detection

**File:** `.github/workflows/circular-dependency-check.yml`

**Purpose:** Detects circular dependencies in source code.

**Triggers:**
- Pull requests modifying TypeScript/TSX files
- Manual dispatch

**Checks:**
- Analyzes `src/`, `lib/`, and `api/` directories
- Detects circular import chains
- Generates dependency graphs

**Tools Used:**
- `madge` for dependency analysis

**Benefits:**
- Prevent module loading issues
- Improve code maintainability
- Identify refactoring opportunities

---

## Nice to Have Workflows

### 7. Dependency Graph Visualization

**File:** `.github/workflows/dependency-graph.yml`

**Purpose:** Generates visual dependency graphs for documentation.

**Triggers:**
- Monthly schedule (1st of each month)
- Manual dispatch

**Output:**
- NPM dependency tree (JSON and text)
- Source code dependency graph (SVG)
- Summary report

**Artifacts:**
- Dependency graphs retained for 90 days
- Available for download from workflow runs

---

### 8. Node.js Version Consistency Check

**File:** `.github/workflows/node-version-consistency.yml`

**Purpose:** Ensures Node.js versions are consistent across workflows.

**Triggers:**
- Pull requests modifying workflows
- Pushes to `main`
- Manual dispatch

**Checks:**
- Extracts Node.js versions from all workflows
- Compares with `package.json` engines field
- Checks `.nvmrc` file (if present)
- Identifies inconsistencies

**Recommendations:**
- Standardize on a single Node.js version
- Use `.nvmrc` for local development
- Update workflows to use consistent version

---

### 9. Migration Dependency Validation

**File:** `.github/workflows/migration-dependency-validation.yml`

**Purpose:** Validates Supabase migration files.

**Triggers:**
- Pull requests modifying migration files
- Pushes to `main` with migration changes

**Validations:**
- File naming convention (`XXX_name.sql`)
- No duplicate migration numbers
- Basic SQL syntax checks
- Migration sequence validation

**Warnings:**
- CASCADE drops
- TRUNCATE statements
- Missing transaction management

---

## Dependabot Configuration

**File:** `.github/dependabot.yml`

**Features:**
- Weekly dependency updates (Mondays at 5 AM UTC)
- Groups patch/minor updates for production and development dependencies
- Major updates created as individual PRs (require manual review)
- Commit message prefix: `chore`

**Grouping:**
- `production-dependencies`: Groups all production patch/minor updates
- `development-dependencies`: Groups all dev patch/minor updates

**Benefits:**
- Reduces PR noise
- Easier review process
- Major updates still get individual attention

---

## Auto-Merge Workflow

**File:** `.github/workflows/dependabot-auto-merge.yml`

**Purpose:** Automatically merges Dependabot PRs that pass all checks.

**Conditions for Auto-Merge:**
- PR is from Dependabot
- Patch or minor update
- All required checks pass:
  - Lockfile validation
  - Dependency review
  - CI builds
- No failed checks

**Features:**
- Only enables auto-merge (doesn't force merge)
- Respects branch protection rules
- Comments on PR when auto-merge is enabled

**Note:** Requires repository settings to allow auto-merge and appropriate branch protection configuration.

---

## Workflow Schedule Summary

| Workflow | Schedule | Time (UTC) |
|----------|----------|------------|
| Dependabot Updates | Weekly | Monday 05:00 |
| NPM Audit | Weekly | Monday 04:00 |
| Outdated Dependencies | Weekly | Monday 08:00 |
| Deprecated Check | Weekly | Monday 09:00 |
| License Compliance | Weekly | Monday 10:00 |
| Dependency Graph | Monthly | 1st of month 00:00 |
| Security Scan | Weekly | Sunday 00:00 |

---

## Integration with Existing Workflows

### CI Workflow
- Runs lockfile validation
- Installs dependencies with `npm ci`
- Runs tests after dependency installation

### Security Workflow
- Runs npm audit
- Performs dependency review
- Checks for license violations

### Dependency Review
- Runs on all PRs
- Checks for vulnerabilities
- Verifies licenses

---

## Best Practices

### 1. Always Commit package-lock.json
The lockfile validation workflow will fail if `package-lock.json` is missing or out of sync.

### 2. Review Dependency Updates
Even with auto-merge, review major version updates carefully for breaking changes.

### 3. Monitor Deprecated Packages
Address deprecated packages in a timely manner to avoid security issues.

### 4. Check License Compliance
New dependencies are automatically checked, but review the license report regularly.

### 5. Test Updates Locally
Before merging dependency updates, test them locally if possible.

---

## Troubleshooting

### Lockfile Validation Fails
```bash
# Fix by running:
npm install
git add package-lock.json
git commit -m "chore: update package-lock.json"
```

### Circular Dependency Detected
1. Review the dependency chain in the workflow artifact
2. Refactor to break the cycle
3. Consider extracting shared code to a separate module

### License Compliance Fails
1. Review the denied license list
2. Find an alternative package with an allowed license
3. Or update the deny list in `license-compliance.yml` if appropriate

### Dependency Impact Analysis Shows Issues
1. Review the PR comment for details
2. Check build/test failures
3. Consider reverting the update or finding an alternative

---

## Workflow Artifacts

Most workflows generate artifacts that are retained for 30-90 days:
- License reports
- Dependency graphs
- Outdated dependencies lists
- Migration validation reports

Access artifacts from the "Actions" tab in GitHub.

---

## Maintenance

### Updating Workflows
- Workflows use pinned action versions where possible
- Review and update action versions periodically
- Test workflow changes in a branch first

### Adding New Checks
When adding new dependency checks:
1. Add to appropriate priority category
2. Update this documentation
3. Ensure proper permissions and security
4. Add appropriate triggers

---

## Support

For issues with dependency workflows:
1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Check workflow artifact outputs
4. Verify repository settings and permissions

---

## Related Documentation

- [CI/CD Guide](../deployment/CI_CD.md)
- [GitHub Actions Security](../security/GITHUB_ACTIONS_SECURITY.md)
- [Migration Guide](../guides/MIGRATION_GUIDE.md)
