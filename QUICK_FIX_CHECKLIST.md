# 🚀 Quick Fix Checklist - OAuth Login Issue

## Issue: Google sign-in works but shows "Sign In" instead of "Sign Out"

---

## ✅ Step-by-Step Fix (5 minutes)

### **1️⃣ Fix Database (Run in Supabase SQL Editor)**

Go to: [Supabase Dashboard](https://app.supabase.com/) → Your Project → SQL Editor

**Copy and paste this SQL:**

```sql
-- Add missing RLS policy
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix existing users without profiles
INSERT INTO public.profiles (id, email, full_name, tier, credits)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'User') as full_name,
  'free' as tier,
  100 as credits
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
```

Click **Run** ✓

---

### **2️⃣ Deploy Code Changes**

```bash
# Commit and push
git add .
git commit -m "Fix: OAuth profile creation and persistence"
git push origin main

# This will auto-deploy on Vercel
# Or manually deploy:
vercel --prod
```

---

### **3️⃣ Test**

1. Open your site in **incognito/private window**
2. Click "Get Started" → "Continue with Google"
3. After redirect, you should see **"Sign Out"** ✅

---

## 🎯 What We Fixed

| Component | Change |
|-----------|--------|
| **Database** | Added RLS policy to allow profile creation |
| **Database** | Created missing profiles for existing users |
| **Code** | Auto-creates profile if trigger fails |
| **Code** | Added auth state listener for OAuth callback |
| **Code** | Better error handling and logging |

---

## 🐛 If Still Not Working

Check browser console (F12) for logs:
- Should see: `User authenticated: your-email@gmail.com`
- Should see: `Auth state changed: signed in`

If you see errors, check:
- [ ] Migration was run successfully
- [ ] Vercel deployment completed
- [ ] Browser cache cleared
- [ ] Using the latest deployed URL

---

## 📞 Need Help?

Full detailed guide: `OAUTH_POST_LOGIN_FIX.md`

