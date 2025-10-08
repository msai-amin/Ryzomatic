# 🗄️ Run Database Migration - Step by Step

## Option 1: Supabase Dashboard (Easiest)

### **Steps:**
1. Go to [supabase.com](https://supabase.com) and sign in
2. Select your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New query"**
5. Copy and paste the entire contents of `supabase/migrations/004_move_books_to_s3.sql`
6. Click **"Run"** button
7. You should see "Success. No rows returned"

### **Verify Migration:**
Run this query to verify:
```sql
-- Check if s3_key column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_books' 
AND column_name = 's3_key';

-- Check if old columns are removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_books' 
AND column_name IN ('pdf_data_base64', 'page_texts');
-- Should return 0 rows

-- Check table size (should be small now)
SELECT pg_size_pretty(pg_total_relation_size('user_books')) as table_size;
```

---

## Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Push migration
npx supabase db push
```

---

## What the Migration Does

1. ✅ Adds `s3_key` column (stores S3 path)
2. ✅ Drops `pdf_data_base64` column (removes large data)
3. ✅ Drops `page_texts` column (can regenerate)
4. ✅ Adds index on `s3_key` for performance
5. ✅ Adds constraint to ensure proper storage
6. ✅ Vacuums table to reclaim space

---

## Expected Results

**Before:**
```
user_books table: ~500MB
Columns: id, title, pdf_data_base64 (LARGE), page_texts (LARGE), ...
```

**After:**
```
user_books table: ~5MB
Columns: id, title, s3_key (small), ...
Disk I/O: Reduced by 90%
```

---

## If Migration Fails

### Error: "column does not exist"
- This is fine if the column was already removed
- The migration uses `IF EXISTS` to handle this

### Error: "constraint violation"
- This means there are existing books without s3_key
- Since you deleted all books, this shouldn't happen
- If it does: `DELETE FROM user_books;` first

### Error: "permission denied"
- Make sure you're using the Supabase dashboard with admin access
- Or use service_role key

---

## Next Steps After Migration

Once migration succeeds:
1. ✅ Verify s3_key column exists
2. ✅ Verify old columns removed
3. ✅ Proceed to Step 2 (Update Code)

