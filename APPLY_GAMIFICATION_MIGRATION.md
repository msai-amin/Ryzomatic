# Apply Pomodoro Gamification Migration

## Issue
The `get_achievement_progress` RPC function is missing from production, causing 404 errors when loading gamification data.

## Solution
Apply migration `007_add_pomodoro_gamification.sql` to production Supabase.

## Manual Steps

### Step 1: Go to Supabase Dashboard
1. Open: https://pbfipmvtkbivnwwgukpw.supabase.co
2. Navigate to: **SQL Editor**

### Step 2: Apply Migration
Copy and paste the entire contents of `supabase/migrations/007_add_pomodoro_gamification.sql` into the SQL Editor and run it.

### Step 3: Verify
After running the migration, verify that these functions exist:
- `get_achievement_progress(UUID)`
- `get_user_achievements(UUID)`
- `get_user_streak(UUID)`
- `check_pomodoro_achievements(UUID, JSONB)`
- `update_pomodoro_streak(UUID, DATE)`

### Step 4: Test
1. Refresh the application
2. Check browser console for gamification errors
3. Verify that gamification data loads on startup

## Expected Result
- ✅ No more 404 errors for `get_achievement_progress`
- ✅ No more 401 errors for `/api/pomodoro/gamification`
- ✅ Gamification data loads properly on startup
- ✅ Pomodoro achievements and streaks work correctly
