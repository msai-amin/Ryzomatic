# 📚 Book Deletion Guide - Supabase Storage

This guide explains how to delete books from your Supabase database in the Smart Reader application.

## ✅ What Was Updated

The `LibraryModal` component has been updated to properly delete books from Supabase storage instead of just local storage.

### Updated File
- **`src/components/LibraryModal.tsx`** - The `handleDeleteBook` function now deletes from Supabase

## 🎯 How to Delete Books

### **Method 1: Through the UI (Easiest)**

1. **Open the application** in your browser
2. **Sign in** with your credentials
3. **Open the Library** (look for a Library or Books button in your app)
4. Find the book you want to delete
5. **Click the trash icon** (🗑️) next to the book
6. **Confirm the deletion** when prompted

The book will be:
- ✅ Deleted from Supabase database (`user_books` table)
- ✅ All associated notes deleted (cascading delete via foreign key)
- ✅ All associated audio files deleted (cascading delete via foreign key)
- ✅ Also removed from localStorage backup

---

### **Method 2: Using the Service Directly (Programmatic)**

If you need to delete books programmatically in your code:

```typescript
import { supabaseStorageService } from '../services/supabaseStorageService';

// Initialize with user ID first
supabaseStorageService.setCurrentUser(userId);

// Delete a book
await supabaseStorageService.deleteBook(bookId);
```

---

### **Method 3: Direct Database Query (Advanced)**

If you need to delete directly from the database (e.g., in Supabase SQL Editor):

```sql
-- Delete a specific book (and all related data via CASCADE)
DELETE FROM user_books 
WHERE id = 'your-book-uuid-here' 
AND user_id = 'your-user-uuid-here';

-- Delete all books for a user
DELETE FROM user_books 
WHERE user_id = 'your-user-uuid-here';

-- View books before deleting
SELECT id, title, file_name, created_at 
FROM user_books 
WHERE user_id = 'your-user-uuid-here';
```

---

### **Method 4: Using Supabase Dashboard (No Code)**

1. Go to [supabase.com](https://supabase.com) and sign in
2. Open your project
3. Click **"Table Editor"** in the left sidebar
4. Select the **`user_books`** table
5. Find the row you want to delete
6. Click the **three dots** (⋯) menu on the right
7. Select **"Delete row"**
8. Confirm the deletion

⚠️ **Note:** This will automatically delete all related notes and audio files due to the `ON DELETE CASCADE` foreign key constraint.

---

## 🔒 Security Features

Your book deletion is protected by:

1. **Row Level Security (RLS)**: Users can only delete their own books
2. **Authentication Check**: Must be logged in to delete
3. **Cascade Delete**: Related data (notes, audio) automatically deleted
4. **Confirmation Prompt**: UI asks for confirmation before deletion

### RLS Policy
```sql
CREATE POLICY "Users can delete own books" ON user_books
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 🗃️ What Gets Deleted

When you delete a book, the following are automatically removed:

| Item | Location | Details |
|------|----------|---------|
| **Book Record** | `user_books` table | Title, metadata, PDF data, page texts |
| **Notes** | `user_notes` table | All notes associated with the book |
| **Audio Files** | `user_audio` table | All TTS audio for the book |
| **LocalStorage** | Browser | Backup copy removed |

---

## 🔧 Troubleshooting

### "Failed to delete book"
- **Check authentication**: Make sure you're logged in
- **Check permissions**: Ensure you own the book
- **Check console**: Look for error messages in browser console
- **Network issues**: Verify Supabase connection

### "Book deleted but still shows up"
- **Refresh the library**: The UI should auto-refresh after deletion
- **Clear cache**: Try refreshing the page (F5 or Cmd+R)
- **Check database**: Verify deletion in Supabase dashboard

### Finding Your User ID
```typescript
// In your browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user.id);
```

---

## 📝 Code Reference

### Service Method Implementation

Location: `src/services/supabaseStorageService.ts` (lines 405-426)

```typescript
async deleteBook(bookId: string): Promise<void> {
  this.ensureAuthenticated();
  
  try {
    const { error } = await userBooks.delete(bookId);
    
    if (error) {
      throw errorHandler.createError(
        `Failed to delete book from Supabase: ${error.message}`,
        ErrorType.DATABASE,
        ErrorSeverity.HIGH,
        { context: 'deleteBook', bookId, error: error.message }
      );
    }

    logger.info('Book deleted from Supabase', { bookId, userId: this.currentUserId });

  } catch (error) {
    logger.error('Error deleting book from Supabase', { bookId }, error as Error);
    throw error;
  }
}
```

### Database Helper Implementation

Location: `lib/supabase.ts` (lines 389-395)

```typescript
async delete(bookId: string) {
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('id', bookId);
  return { error };
}
```

---

## 🎨 UI Components

The trash icon button in the library:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    handleDeleteBook(book.id);
  }}
  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded"
>
  <Trash2 className="w-4 h-4" />
</button>
```

---

## 🚀 Testing

To test the delete functionality:

1. **Upload a test book**
2. **Check Supabase**: Verify it appears in `user_books` table
3. **Delete the book** via UI
4. **Check again**: Confirm it's gone from database
5. **Check related tables**: Verify notes and audio were also deleted

---

## 📊 Database Schema

The `user_books` table structure:

```sql
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'text')),
  file_size INTEGER NOT NULL,
  total_pages INTEGER,
  pdf_data_base64 TEXT,
  page_texts TEXT[],
  text_content TEXT,
  tts_metadata JSONB DEFAULT '{}',
  last_read_page INTEGER DEFAULT 1,
  reading_progress DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ
);
```

Related tables with cascade delete:
- `user_notes` (book_id → user_books.id ON DELETE CASCADE)
- `user_audio` (book_id → user_books.id ON DELETE CASCADE)

---

## 💡 Best Practices

1. **Always confirm** before deleting (already implemented)
2. **Show success message** after deletion (already implemented)
3. **Handle errors gracefully** (already implemented)
4. **Log deletions** for debugging (already implemented)
5. **Refresh the library** after deletion (already implemented)

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify RLS policies are enabled
4. Test with a different book
5. Check network tab for failed requests

---

**Last Updated:** October 2025
**Version:** 1.0

