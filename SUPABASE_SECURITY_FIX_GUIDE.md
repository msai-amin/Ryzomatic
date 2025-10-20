# Supabase Security Warnings Fix Guide

This guide addresses the security warnings from Supabase linter and provides step-by-step instructions to resolve them.

## Issues Addressed

### 1. Function Search Path Mutable Warnings
**Problem**: Functions without `SET search_path = ''` are vulnerable to search_path injection attacks.

**Solution**: All functions have been updated with proper security settings in migration `012_comprehensive_security_fixes.sql`.

### 2. Leaked Password Protection Disabled
**Problem**: Supabase Auth is not checking passwords against known breached password databases.

**Solution**: Enable leaked password protection in Supabase Dashboard.

## Step-by-Step Fix Instructions

### Step 1: Apply Database Migration

Run the comprehensive security migration:

```bash
# Apply the migration
supabase db push

# Or if using Supabase CLI locally
supabase migration up
```

This migration:
- Drops and recreates all functions with `SET search_path = ''`
- Adds proper `SECURITY DEFINER` settings where needed
- Grants appropriate permissions to authenticated users
- Adds documentation comments

**If warnings persist after migration 012:**
Apply the supplementary migration:

```bash
# Apply supplementary migration
supabase db push

# Or manually apply migration 013
```

The supplementary migration (`013_fix_remaining_search_path.sql`) specifically addresses:
- Function signature conflicts (e.g., `get_user_usage_stats` with different parameter counts)
- Any remaining functions that weren't caught by the main migration
- Ensures all function variations are properly secured

### Step 2: Enable Leaked Password Protection (Detailed)

1. **Access Authentication Settings**
   - Log into your Supabase Dashboard
   - Select your project
   - Navigate to **Authentication** in the left sidebar
   - Click on **Settings** tab

2. **Locate Password Security Section**
   - Scroll down to find the **"Password Strength"** section
   - This section contains password-related security settings

3. **Enable Leaked Password Protection**
   - Find the **"Check for leaked passwords"** toggle
   - Turn this setting **ON** (toggle should be blue/enabled)
   - This feature checks new passwords against the HaveIBeenPwned.org database

4. **Configure Additional Password Settings (Recommended)**
   - **Minimum password length**: Set to 8 or higher
   - **Password strength**: Enable if available
   - **Password complexity**: Configure requirements for uppercase, lowercase, numbers, symbols

5. **Save Settings**
   - Click **Save** or the settings should auto-save
   - Verify the toggle remains enabled

6. **Verify the Setting is Active**
   - The "Check for leaked passwords" toggle should show as enabled
   - You can test by trying to create a user with a known breached password (it should be rejected)

### Step 3: Verify Fixes

After applying the migration and enabling password protection:

1. **Check Database Linter**
   - Go to Database → Linter in Supabase Dashboard
   - Verify that function search path warnings are resolved
   - Check that no new security warnings appear

2. **Test Authentication**
   - Try creating a new user account
   - Test with a known breached password (should be rejected)
   - Verify normal password creation works

## Migration Details

The `012_comprehensive_security_fixes.sql` migration includes:

### Functions Updated:
- `update_reading_progress`
- `reset_monthly_ocr_counters`
- `update_tag_usage_count`
- `get_user_reading_stats`
- `update_book_pomodoro_totals`
- `search_annotations`
- `get_annotation_stats`
- `get_pomodoro_stats_by_book`
- `get_daily_pomodoro_stats`
- `get_time_of_day_patterns`
- `get_active_pomodoro_session`
- `get_weekly_pomodoro_summary`
- `get_collection_hierarchy`
- `get_book_storage_stats`
- `get_library_stats`
- `update_updated_at_column`
- `handle_new_user`
- `clean_expired_cache`
- `get_user_usage_stats`

### Security Features Added:
- `SET search_path = ''` - Prevents search path injection
- `SECURITY DEFINER` - Ensures functions run with definer privileges
- `STABLE` - Marks read-only functions for optimization
- Proper schema qualification (`public.table_name`)
- Appropriate permissions for authenticated users

## Benefits

After applying these fixes:

1. **Enhanced Security**: Functions are protected against search path injection attacks
2. **Password Safety**: User passwords are checked against known breach databases
3. **Compliance**: Meets Supabase security best practices
4. **Performance**: Proper function markings enable query optimization
5. **Maintainability**: Clear documentation and consistent patterns

## Monitoring

After implementation:

1. **Regular Linter Checks**: Run database linter monthly to catch new issues
2. **Password Rejection Monitoring**: Monitor authentication logs for rejected passwords
3. **Function Performance**: Monitor function execution times for any performance impact
4. **User Feedback**: Watch for any authentication issues reported by users

## Troubleshooting

### If Migration Fails:
1. Check for existing function dependencies
2. Verify all referenced tables exist
3. Ensure proper permissions for migration execution

### If Password Protection Causes Issues:
1. Check Supabase Auth logs for rejection reasons
2. Verify HaveIBeenPwned.org API availability
3. Consider adjusting password strength requirements

### If Functions Don't Work After Migration:
1. Check function permissions
2. Verify schema references are correct
3. Test functions individually with sample data

## Additional Security Recommendations

1. **Enable Row Level Security (RLS)** on all tables
2. **Use Service Role Keys** only for server-side operations
3. **Implement Rate Limiting** on authentication endpoints
4. **Regular Security Audits** of database functions and policies
5. **Monitor Authentication Logs** for suspicious activity
