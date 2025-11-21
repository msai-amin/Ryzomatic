# Manual Deployment Steps Required

## ✅ Completed
- [x] Code committed to Git
- [x] Code pushed to GitHub main branch
- [x] Vercel deployment triggered automatically

## 🔄 In Progress
- [ ] Vercel is building and deploying (check your Vercel dashboard)

## ⚠️ Required Manual Steps

### Step 1: Apply Database Migrations to Production Supabase

**IMPORTANT:** You must apply the database migrations BEFORE the frontend deployment completes, or the new features won't work properly.

#### Quick Method (Copy/Paste in Supabase Dashboard):

1. **Go to:** https://pbfipmvtkbivnwwgukpw.supabase.co
2. **Navigate to:** SQL Editor
3. **Copy and run this combined SQL:**

```sql
-- This applies migrations 012 and 013 (the security fixes)
-- Migrations 007-011 should be applied if not already done

-- Drop old function signatures
DROP FUNCTION IF EXISTS search_annotations(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_annotation_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_usage_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_user_usage_stats(uuid, timestamptz) CASCADE;

-- Recreate with proper security
CREATE OR REPLACE FUNCTION search_annotations(user_uuid uuid, q text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  book_id uuid,
  page_number int,
  content text,
  position_x numeric,
  position_y numeric,
  created_at timestamptz
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT 
    an.id,
    an.book_id,
    an.page_number,
    an.content,
    an.position_x,
    an.position_y,
    an.created_at
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid
    AND (q IS NULL OR an.content ILIKE '%' || q || '%')
  ORDER BY an.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_annotation_stats(user_uuid uuid)
RETURNS TABLE (
  total_annotations bigint,
  books_with_annotations bigint,
  recent_annotations bigint
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    COUNT(*) as total_annotations,
    COUNT(DISTINCT book_id) as books_with_annotations,
    COUNT(*) FILTER (WHERE an.created_at > NOW() - INTERVAL '7 days') as recent_annotations
  FROM public.user_notes an
  JOIN public.user_books ub ON an.book_id = ub.id
  WHERE ub.user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION get_user_usage_stats(user_uuid uuid)
RETURNS TABLE (
  total_actions bigint,
  total_credits_used bigint,
  actions_this_month bigint,
  credits_used_this_month bigint,
  most_used_action text
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    COUNT(*) as total_actions,
    COALESCE(SUM(credits_used), 0) as total_credits_used,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as actions_this_month,
    COALESCE(SUM(credits_used) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())), 0) as credits_used_this_month,
    (SELECT action_type FROM public.usage_records WHERE user_id = user_uuid GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 1) as most_used_action
  FROM public.usage_records
  WHERE user_id = user_uuid;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_annotations(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_annotation_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_stats(uuid) TO authenticated;
```

4. **Verify:** No errors appear after running

#### Alternative: Apply All Migrations (If needed)

If you haven't applied migrations 007-011 yet, you'll need to apply them first. Check the files in `supabase/migrations/` and apply them in order.

### Step 2: Enable Password Protection (Optional but Recommended)

1. **Go to:** Supabase Dashboard → Authentication → Settings
2. **Find:** "Password Strength" section
3. **Enable:** "Check for leaked passwords"
4. **Save** the settings

### Step 3: Verify Deployment

Once Vercel deployment completes:

1. **Check Vercel Dashboard:** Ensure deployment succeeded
2. **Visit your production site**
3. **Test these features:**
   - [ ] Sign in with Google
   - [ ] Open Library modal (no authentication errors)
   - [ ] Search works
   - [ ] Collections load (if you created any)
   - [ ] Upload a book (test if needed)

### Step 4: Check Database Linter

1. **Go to:** Supabase Dashboard → Database → Linter
2. **Verify:** Only "Leaked Password Protection" warning remains (if you didn't enable it)
3. **Expected:** No "Function Search Path Mutable" warnings

## 🎯 Success Criteria

✅ Vercel deployment shows "Ready"
✅ Database migrations applied without errors
✅ Library UI loads without authentication errors
✅ No function search path warnings in Supabase linter
✅ Users can sign in and access features

## 🚨 If Something Goes Wrong

### Frontend Issues:
- Check Vercel logs for build errors
- Check browser console for JavaScript errors
- Verify environment variables are set in Vercel

### Database Issues:
- Check Supabase SQL Editor for migration errors
- Check Database → Linter for warnings
- Verify functions exist: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`

### Authentication Issues:
- Verify Supabase environment variables in Vercel
- Check that services are initializing in browser console
- Clear browser cache and cookies

## 📊 Monitoring

After deployment, monitor:
- **Vercel:** Check for any function errors
- **Supabase:** Monitor database performance
- **Browser Console:** Check for JavaScript errors
- **User Reports:** Watch for any user-reported issues

## 📝 Notes

- Frontend deployment is automatic via Vercel
- Database migrations require manual application
- Changes are backward compatible
- No user data will be lost
- All existing features continue to work

## ⏱️ Timeline

- Vercel Build: ~3-5 minutes
- Database Migrations: ~2-3 minutes
- Verification: ~5-10 minutes
- **Total:** ~10-18 minutes

## 🔗 Quick Links

- **Vercel Dashboard:** Check your Vercel project
- **Supabase Dashboard:** https://pbfipmvtkbivnwwgukpw.supabase.co
- **Production Site:** Your deployed URL
- **GitHub Repo:** https://github.com/msai-amin/smart-reader-serverless

---

**Deployment initiated:** Automated
**Commit:** f7c9852
**Changes:** 24 files, 7098 insertions

