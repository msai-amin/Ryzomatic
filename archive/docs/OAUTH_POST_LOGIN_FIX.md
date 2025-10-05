# Fix: Google OAuth Login Not Persisting

## 🎯 Problem
Google OAuth redirect works, but the app shows "Sign In" instead of "Sign Out" after authentication.

## 🔍 Root Cause
The user profile isn't being created or fetched properly after OAuth login.

## ✅ Solution (Apply These Steps)

### **Step 1: Run Database Migration**

You need to apply the missing RLS policy that allows users to create their own profiles.

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **SQL Editor**
4. Run this SQL:

```sql
-- Add RLS policy to allow users to create their own profile
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

5. Click **Run** (or press Cmd/Ctrl + Enter)

**Option B: Via Supabase CLI**

```bash
# If you have Supabase CLI installed
supabase db push

# Or apply migration manually
supabase db execute -f supabase/migrations/002_add_profile_insert_policy.sql
```

---

### **Step 2: Verify the Trigger Exists**

Check if the auto-create profile trigger is active:

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query to check:

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
```

If nothing is returned, **run the full migration**:

```sql
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### **Step 3: Check Existing Users**

If you've already signed in with Google before, you need to create the profile manually:

```sql
-- Check if you have an auth user without a profile
SELECT au.id, au.email, p.id as profile_id
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- If you see your user, create the profile manually:
INSERT INTO public.profiles (id, email, full_name, tier, credits)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'full_name' as full_name,
  'free' as tier,
  100 as credits
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```

---

### **Step 4: Deploy Updated Code**

The code changes I made will:
- Automatically create a profile if it doesn't exist
- Gracefully handle missing profiles
- Add better logging for debugging

Deploy to Vercel:

```bash
# Commit the changes
git add .
git commit -m "Fix: Add profile auto-creation and RLS policy"

# Push to trigger Vercel deployment
git push origin main

# Or deploy directly with Vercel CLI
vercel --prod
```

---

### **Step 5: Test the Fix**

1. **Clear your browser cache** or use **incognito mode**
2. Go to your production site: `https://your-app.vercel.app`
3. Click **"Get Started"**
4. Click **"Continue with Google"**
5. Complete Google OAuth
6. You should now see **"Sign Out"** in the header! ✅

---

## 🐛 Debugging

If it's still not working, check the browser console:

```javascript
// Open browser console (F12) and check for logs:
// Expected output after successful login:
User authenticated: your-email@gmail.com
Profile not found, creating one...  // (only first time)
Profile created successfully
Auth state changed: signed in
```

### **Check Auth Status Manually**

In browser console:

```javascript
// Check if user is authenticated
const { data: { user } } = await supabase.auth.getUser()
console.log('Auth user:', user)

// Check if profile exists
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()
console.log('User profile:', profile)
```

### **Common Issues**

| Issue | Cause | Fix |
|-------|-------|-----|
| "Profile not found, creating one..." but still no sign out | RLS policy not applied | Apply migration from Step 1 |
| No console logs at all | Auth state listener not firing | Clear cache, hard refresh |
| "Error fetching user profile" | Database query failing | Check RLS policies in Supabase |
| "Error creating user profile" | INSERT policy missing | Run the SQL from Step 1 |

---

## 📊 Check Your Database

In Supabase Dashboard → **Table Editor**:

1. Check **auth.users** table - Should have your Google account
2. Check **profiles** table - Should have a matching profile with same `id`

If profile is missing:
- The trigger didn't fire (older user)
- RLS policy prevented INSERT

Both are now fixed by the code and migration!

---

## 🎉 Success Criteria

After applying these fixes, you should see:

✅ Google OAuth redirect works  
✅ User is redirected back to your app  
✅ Header shows "Sign Out" button  
✅ User can access the app features  
✅ Profile appears in `profiles` table  

---

## 🆘 Still Having Issues?

1. **Check Supabase logs**: Dashboard → Logs → Auth Logs
2. **Check browser network tab**: Look for failed API requests
3. **Check Vercel logs**: Dashboard → Your Project → Deployments → Logs
4. **Enable verbose logging**: Add `?debug=true` to your URL

---

## 📝 Summary of Changes Made

1. ✅ Updated `appStore.ts` - Added profile auto-creation logic
2. ✅ Updated `supabaseAuthService.ts` - Added `createUserProfile` method
3. ✅ Updated `App.tsx` - Added auth state change listener
4. ✅ Created migration `002_add_profile_insert_policy.sql`
5. ✅ Added better error handling and logging

---

**Next Step**: Apply the database migration (Step 1) and redeploy!

