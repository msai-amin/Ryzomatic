# 🚀 Quick Start: Local Authentication Setup

## Current Status

✅ `.env.local` file created  
✅ `VITE_SUPABASE_URL` configured  
❌ `VITE_SUPABASE_ANON_KEY` needs to be added  

## Next Steps (5 minutes)

### Step 1: Get Supabase Anon Key

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api
   ```

2. **Copy the "anon public" key:**
   - It starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Click the "Copy" button next to it

### Step 2: Update .env.local

1. **Open `.env.local` file** in the project root

2. **Replace this line:**
   ```bash
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
   
   **With your actual key:**
   ```bash
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (paste your key here)
   ```

3. **Save the file**

### Step 3: Configure OAuth Redirect (for Google Sign-In)

1. **Go to Supabase Auth Settings:**
   ```
   https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/auth/url-configuration
   ```

2. **Add localhost to Redirect URLs:**
   - Find "Redirect URLs" section
   - Click "Add URL"
   - Add: `http://localhost:3001`
   - Add: `http://localhost:3001/*`
   - Add: `http://localhost:3001/auth/callback`
   - Click "Save"

3. **(Optional) Update Site URL for development:**
   - Set "Site URL" to: `http://localhost:3001`
   - ⚠️ Remember to change back to production URL later!

### Step 4: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Verify Setup

```bash
# Run the check script:
node scripts/check-env.js
```

You should see:
```
✅ All required environment variables are set!
🚀 You can now run: npm run dev
```

---

## Test Authentication

1. **Open:** http://localhost:3001
2. **Click "Sign Up"** or "Sign in with Google"
3. **Complete authentication**
4. **You should be redirected back to localhost:3001** ✅

---

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists in project root
- Check that `VITE_SUPABASE_ANON_KEY` is set (not placeholder)
- Restart dev server after updating `.env.local`

### "OAuth redirect goes to production"
- Verify redirect URLs include `http://localhost:3001` in Supabase
- Clear browser cache
- Check browser console for errors

### "Authentication works but features don't load"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set (for server-side operations)
- Check database tables exist and RLS policies are configured

---

## Quick Reference

**Supabase Dashboard:**
- API Keys: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/settings/api
- Auth Config: https://supabase.com/dashboard/project/pbfipmvtkbivnwwgukpw/auth/url-configuration

**Local App:**
- URL: http://localhost:3001
- Env File: `.env.local`

**Check Script:**
```bash
node scripts/check-env.js
```

---

**Status:** Ready to set up! Just need to add the Supabase anon key. 🚀

