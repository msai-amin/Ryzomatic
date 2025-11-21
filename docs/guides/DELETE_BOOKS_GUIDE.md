# 🗑️ Delete Books from Supabase - Complete Guide

## ⚠️ WARNING

**DESTRUCTIVE OPERATION**: Deleting books will permanently remove:
- Book records from `user_books` table
- All associated notes (via CASCADE DELETE)
- All associated audio files (via CASCADE DELETE)

**This action CANNOT be undone!**

---

## 🎯 Choose Your Approach

### **Option A: Delete ALL Books (All Users)**
Use this to completely clear the table.

### **Option B: Delete Only Your Books**
Use this to delete only books you own.

### **Option C: Delete Specific Books**
Use this to delete individual books by ID.

---

## 📊 Method 1: Supabase SQL Editor (Recommended)

### **Step 1: Access SQL Editor**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project: **smart-reader-serverless**
4. Click **"SQL Editor"** in the left sidebar

### **Step 2: Preview Before Delete (IMPORTANT)**
Always check what you're about to delete:

```sql
-- See all books in the table
SELECT 
  id,
  user_id,
  title,
  file_name,
  file_type,
  file_size,
  total_pages,
  created_at
FROM user_books
ORDER BY created_at DESC;
```

### **Step 3A: Delete ALL Books (All Users)**

```sql
-- ⚠️ DANGER: Deletes ALL books for ALL users
DELETE FROM user_books;

-- Verify deletion
SELECT COUNT(*) as remaining_books FROM user_books;
-- Should return: 0
```

### **Step 3B: Delete Only YOUR Books**

First, find your user ID:

```sql
-- Find your user ID
SELECT id, email FROM auth.users 
WHERE email = 'your-email@example.com';
```

Then delete your books:

```sql
-- Replace 'your-user-id-here' with actual ID
DELETE FROM user_books 
WHERE user_id = 'your-user-id-here';

-- Verify your books are deleted
SELECT COUNT(*) as your_books 
FROM user_books 
WHERE user_id = 'your-user-id-here';
-- Should return: 0
```

### **Step 3C: Delete Specific Books**

```sql
-- Delete by book title
DELETE FROM user_books 
WHERE title = 'Book Title Here';

-- Delete by book ID
DELETE FROM user_books 
WHERE id = 'book-uuid-here';

-- Delete multiple specific books
DELETE FROM user_books 
WHERE id IN (
  'book-id-1',
  'book-id-2',
  'book-id-3'
);
```

---

## 🖥️ Method 2: Supabase Table Editor

### **Steps:**
1. Go to **Supabase Dashboard**
2. Click **"Table Editor"** in left sidebar
3. Select **`user_books`** table
4. For each book:
   - Click the **three dots** (⋯) menu on the right
   - Select **"Delete row"**
   - Confirm deletion

**Note**: This is manual and slow for many books. Use SQL Editor for bulk deletion.

---

## 💻 Method 3: Via Your App (Programmatic)

### **Using Browser Console**

1. Open your app in browser
2. Sign in
3. Open browser console (F12 or Cmd+Option+I)
4. Run this code:

```javascript
// Import Supabase client
const { supabase } = await import('./src/services/supabaseAuthService');

// Get current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user.id);

// Delete all YOUR books
const { data, error } = await supabase
  .from('user_books')
  .delete()
  .eq('user_id', user.id);

if (error) {
  console.error('Error:', error);
} else {
  console.log('All your books deleted successfully');
}

// Verify deletion
const { data: remaining } = await supabase
  .from('user_books')
  .select('*')
  .eq('user_id', user.id);
  
console.log('Remaining books:', remaining.length);
```

### **Using Your Service**

```typescript
import { supabaseStorageService } from './services/supabaseStorageService';

// Get all your books
const books = await supabaseStorageService.getAllBooks();

// Delete each book
for (const book of books) {
  await supabaseStorageService.deleteBook(book.id);
  console.log(`Deleted: ${book.title}`);
}

console.log('All books deleted!');
```

---

## 🔐 Method 4: Admin Delete (All Users)

If you have admin/service role access:

```sql
-- Connect with service_role key (admin access)
-- Then run:

-- Delete ALL books for ALL users (ADMIN ONLY)
DELETE FROM user_books;

-- Or with confirmation counts:
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Count before
  SELECT COUNT(*) INTO deleted_count FROM user_books;
  RAISE NOTICE 'Books to delete: %', deleted_count;
  
  -- Delete all
  DELETE FROM user_books;
  
  -- Confirm
  SELECT COUNT(*) INTO deleted_count FROM user_books;
  RAISE NOTICE 'Remaining books: %', deleted_count;
END $$;
```

---

## 🧹 What Gets Deleted

Due to **CASCADE DELETE** foreign key constraints:

### **When you delete from `user_books`:**

1. **Book Record** (`user_books`)
   - Title, file data, page texts, etc.

2. **All Notes** (`user_notes`)
   - All annotations for that book
   - Related via `book_id` foreign key

3. **All Audio** (`user_audio`)
   - All TTS audio for that book
   - Related via `book_id` foreign key

### **Visual:**
```
user_books (DELETED)
  ├── user_notes (DELETED - CASCADE)
  └── user_audio (DELETED - CASCADE)
```

---

## ✅ Verification Queries

After deletion, verify the results:

```sql
-- Count remaining books
SELECT COUNT(*) as total_books FROM user_books;

-- Count remaining notes
SELECT COUNT(*) as total_notes FROM user_notes;

-- Count remaining audio
SELECT COUNT(*) as total_audio FROM user_audio;

-- See books by user (if any remain)
SELECT 
  user_id,
  COUNT(*) as book_count,
  SUM(file_size) as total_size_bytes
FROM user_books
GROUP BY user_id;

-- Most recent books (if any)
SELECT title, created_at 
FROM user_books 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🔄 Backup Before Delete

### **Option 1: Export to CSV**
In Supabase Table Editor:
1. Select `user_books` table
2. Click **"Export"** button
3. Download as CSV
4. Save the file as backup

### **Option 2: Export via SQL**
```sql
-- Export to JSON format (copy result)
SELECT json_agg(row_to_json(user_books.*)) 
FROM user_books;
```

### **Option 3: Create Backup Table**
```sql
-- Create backup table
CREATE TABLE user_books_backup AS 
SELECT * FROM user_books;

-- Then delete from original
DELETE FROM user_books;

-- Later, restore if needed:
INSERT INTO user_books 
SELECT * FROM user_books_backup;
```

---

## 🚨 Common Issues

### **Issue 1: Permission Denied**
```
Error: permission denied for table user_books
```

**Solution**: Use service_role key or ensure RLS policies allow deletion.

### **Issue 2: Foreign Key Constraint**
```
Error: violates foreign key constraint
```

**Solution**: This shouldn't happen due to CASCADE DELETE, but if it does:
```sql
-- Manually delete notes first
DELETE FROM user_notes WHERE book_id IN (
  SELECT id FROM user_books
);

-- Then delete audio
DELETE FROM user_audio WHERE book_id IN (
  SELECT id FROM user_books
);

-- Then delete books
DELETE FROM user_books;
```

### **Issue 3: Row Level Security**
```
Error: new row violates row-level security policy
```

**Solution**: 
- Use SQL Editor with service_role
- Or delete via authenticated API
- Check RLS policies are correct

---

## 🎯 Quick Commands

### **Delete Everything (Fastest)**
```sql
DELETE FROM user_books;
```

### **Delete Your Books Only**
```sql
DELETE FROM user_books 
WHERE user_id = (SELECT auth.uid());
```

### **Delete Old Books (Keep Recent)**
```sql
-- Delete books older than 30 days
DELETE FROM user_books 
WHERE created_at < NOW() - INTERVAL '30 days';
```

### **Delete Large Books Only**
```sql
-- Delete books larger than 10MB
DELETE FROM user_books 
WHERE file_size > 10485760;
```

### **Delete by File Type**
```sql
-- Delete all PDF books
DELETE FROM user_books 
WHERE file_type = 'pdf';

-- Delete all text books
DELETE FROM user_books 
WHERE file_type = 'text';
```

---

## 📊 Statistics Before/After

Run before and after deletion:

```sql
-- Full statistics
SELECT 
  'Books' as table_name,
  COUNT(*) as total_records,
  pg_size_pretty(pg_total_relation_size('user_books')) as table_size
FROM user_books
UNION ALL
SELECT 
  'Notes',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('user_notes'))
FROM user_notes
UNION ALL
SELECT 
  'Audio',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('user_audio'))
FROM user_audio;
```

---

## 🔒 Safety Checklist

Before deleting:

- [ ] Have you backed up important data?
- [ ] Do you know which books will be deleted?
- [ ] Have you run preview queries?
- [ ] Are you sure you want to proceed?
- [ ] Have you informed other users (if multi-user)?
- [ ] Do you have a restoration plan if needed?

After deleting:

- [ ] Run verification queries
- [ ] Check related tables (notes, audio)
- [ ] Test app functionality
- [ ] Verify UI updates correctly
- [ ] Clear any cached data

---

## 🆘 Emergency Restore

If you accidentally deleted and have no backup:

### **Option 1: Point-in-Time Recovery (if enabled)**
Contact Supabase support for database restoration.

### **Option 2: From Backup Table**
```sql
-- If you created user_books_backup
INSERT INTO user_books 
SELECT * FROM user_books_backup;
```

### **Option 3: Re-upload**
Users need to re-upload their documents through the app.

---

## 📝 Example: Safe Deletion Workflow

```sql
-- STEP 1: Count what will be deleted
SELECT 
  COUNT(*) as books_to_delete,
  COUNT(DISTINCT user_id) as affected_users,
  SUM(file_size) as total_bytes
FROM user_books;

-- STEP 2: Preview specific records
SELECT id, title, user_id, created_at 
FROM user_books 
LIMIT 10;

-- STEP 3: Create backup (optional)
CREATE TABLE user_books_backup_20251008 AS 
SELECT * FROM user_books;

-- STEP 4: Delete (CAREFUL!)
DELETE FROM user_books;

-- STEP 5: Verify deletion
SELECT COUNT(*) FROM user_books; -- Should be 0

-- STEP 6: Check cascade deletions
SELECT COUNT(*) FROM user_notes;  -- Should be 0 or only orphaned
SELECT COUNT(*) FROM user_audio;  -- Should be 0 or only orphaned
```

---

## 💡 Alternatives to Deletion

Instead of deleting, consider:

### **1. Soft Delete (Add deleted_at column)**
```sql
-- Add column if doesn't exist
ALTER TABLE user_books 
ADD COLUMN deleted_at TIMESTAMPTZ;

-- "Delete" by marking
UPDATE user_books 
SET deleted_at = NOW() 
WHERE id = 'book-id';

-- Query only active books
SELECT * FROM user_books 
WHERE deleted_at IS NULL;
```

### **2. Archive to Another Table**
```sql
-- Create archive table
CREATE TABLE user_books_archive AS 
SELECT * FROM user_books WHERE false;

-- Move old books to archive
INSERT INTO user_books_archive 
SELECT * FROM user_books 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete from main table
DELETE FROM user_books 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 📞 Support

If something goes wrong:
- Check Supabase dashboard logs
- Review RLS policies
- Contact: support@vstyle.co
- Supabase support: [supabase.com/support](https://supabase.com/support)

---

**Remember: Always backup before deleting!** 🛡️

**Last Updated**: October 2025  
**Status**: Production Ready

