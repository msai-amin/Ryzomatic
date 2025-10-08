# 🧪 TEST NOW - Interactive Guide

## 🚀 **Your Dev Server is Running**

**URL:** `http://localhost:5173`

---

## 📋 **STEP-BY-STEP TEST GUIDE**

### **TEST 1: Open the App** ✅

1. Open your browser
2. Go to: `http://localhost:5173`
3. You should see the **Immersive Reader landing page**

**Expected:**
- ✅ Landing page displays
- ✅ "Immersive Reader by VStyle" branding
- ✅ Clean academic design

---

### **TEST 2: Sign In** ✅

1. Click **"Sign in"** or **"Start free trial"**
2. Sign in with your Google account or email
3. Should redirect to main app

**Expected:**
- ✅ Auth modal opens
- ✅ Google sign-in works
- ✅ Redirected to app after auth

---

### **TEST 3: Upload a PDF** 🔄

**Preparation:**
- Find a PDF file < 5MB
- Any academic paper or document
- Have it ready to upload

**Steps:**
1. Look for **"Upload"** or **"Add Document"** button
2. Click it
3. Select your PDF file
4. Click upload/submit

**Watch for:**
```
Browser Console (F12):
✅ "Uploading PDF to S3"
✅ "PDF uploaded to S3 successfully"
✅ "Saving book metadata to database"
✅ "Book saved successfully"
```

**Expected Result:**
- ✅ Progress indicator shows
- ✅ Success message appears
- ✅ Book appears in library
- ⏱️ Takes 3-5 seconds

**If it fails:**
- Check browser console for errors
- Check Network tab for failed requests
- Take a screenshot of the error

---

### **TEST 4: Verify in AWS S3** 🔍

1. Open [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Sign in to your AWS account
3. Click on bucket: `smart-reader-documents`
4. Navigate to: `books/` folder
5. Then: `{your-user-id}/` folder (it will be a UUID)
6. **Should see**: Your PDF file! 📄

**File name format:** `{bookId}.pdf` (UUID.pdf)

**Take note of:**
- File size (should match uploaded PDF)
- Last modified time (should be now)
- S3 path (you'll need this)

---

### **TEST 5: Check Database** 🗄️

**Run in Supabase SQL Editor:**

```sql
-- See your uploaded book
SELECT 
  id,
  title,
  file_name,
  file_type,
  file_size / 1024 / 1024 as size_mb,
  s3_key,
  created_at
FROM user_books
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ One row returned
- ✅ `s3_key` column has value like: `books/{userId}/{bookId}.pdf`
- ✅ `file_size` matches your PDF
- ✅ No `pdf_data_base64` column error

---

### **TEST 6: Open the Book** 📖

1. **Click on the book** in your library
2. Wait for it to load (2-4 seconds)

**Watch Console:**
```
✅ "Downloading PDF from S3"
✅ "PDF downloaded from S3 successfully"
✅ "size: X.XXM B"
```

**Expected:**
- ✅ PDF loads and displays
- ✅ Can see page 1
- ✅ Can navigate to other pages
- ✅ Zoom works
- ✅ All PDF features work

**If it fails:**
- Note the error message
- Check if s3_key exists in database
- Check browser console
- Check Network tab for 403/404 errors

---

### **TEST 7: Delete the Book** 🗑️

1. **Click trash icon** next to book
2. **Confirm deletion**

**Expected:**
- ✅ Book removed from library
- ✅ Success message

**Verify S3 Deletion:**
1. Go back to AWS S3 Console
2. Refresh the `books/{userId}/` folder
3. **File should be GONE** ✅

**Verify Database Deletion:**
```sql
SELECT COUNT(*) as remaining_books 
FROM user_books;
-- Should be 0 (or not include deleted book)
```

---

### **TEST 8: Large File Rejection** ⛔

**Find a PDF > 5MB:**
- Or create one: Merge multiple PDFs
- Or download a large academic paper

**Steps:**
1. Try to upload the large PDF
2. Upload should **fail**

**Expected:**
- ❌ Upload rejected immediately
- ✅ Error message:
  ```
  "PDF file is too large (X.XXMB). 
  Maximum size is 5MB. Please use a smaller file."
  ```
- ✅ No file uploaded to S3
- ✅ No database record created

---

### **TEST 9: Multiple Books** 📚

1. **Upload 3 different PDFs** (all < 5MB)
2. Wait for all to complete

**Check Library:**
- [ ] All 3 books show up
- [ ] Library loads **FAST** (< 1 second)
- [ ] Can scroll through books smoothly

**Open Each Book:**
- [ ] Book 1 opens correctly
- [ ] Book 2 opens correctly
- [ ] Book 3 opens correctly

**Check S3:**
- [ ] 3 files in `books/{userId}/` folder
- [ ] All have correct names and sizes

---

### **TEST 10: Library Performance** ⚡

**Measure Load Time:**

1. Close library (if modal)
2. Reopen library
3. Count seconds until books appear

**Expected:**
- ✅ < 0.5 seconds
- ✅ Much faster than before
- ✅ No loading spinner (or very brief)

---

## 📊 **MONITORING DASHBOARD**

### **Supabase Metrics**

**Go to:** [Supabase Dashboard](https://supabase.com) → Your Project → Database → Reports

#### **Disk I/O** (Most Important!)
```
Current Level: [Check graph]
Expected: LOW and STABLE (green zone)
Warning: Should be GONE or disappearing
```

#### **Database Size**
```sql
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(pg_total_relation_size('user_books')) as books_table_size;
```

**Expected:**
- books_table_size: < 10 MB (should be tiny)
- Before: Could be 100s of MB

#### **Query Performance**
```sql
-- This should be FAST (< 100ms)
EXPLAIN ANALYZE
SELECT id, title, file_name, file_size, s3_key 
FROM user_books 
WHERE user_id = auth.uid()
LIMIT 20;
```

---

### **S3 Metrics**

**AWS Console:** S3 → `smart-reader-documents` → Metrics

**Check:**
- Storage bytes: Should increase with uploads
- Number of objects: Should match book count
- GET requests: Should increase when opening books

---

### **Application Performance**

**Browser DevTools (F12) → Performance Tab**

**Record a session:**
1. Open library
2. Click a book
3. Stop recording

**Expected:**
- Library load: < 500ms
- Book open: 2-4 seconds (S3 download)
- Smooth rendering

---

## 🎯 **Success Metrics**

### **Must Pass (Critical)**
- [ ] ✅ Upload works
- [ ] ✅ Books stored in S3
- [ ] ✅ Open works
- [ ] ✅ Delete works
- [ ] ✅ No disk I/O warnings

### **Should Pass (Important)**
- [ ] ✅ Library loads in < 1 second
- [ ] ✅ Large files rejected
- [ ] ✅ Multiple books work
- [ ] ✅ Database stays small

### **Nice to Have**
- [ ] ✅ No console errors
- [ ] ✅ Smooth animations
- [ ] ✅ Good error messages

---

## 🐛 **Issue Tracking**

### **Issues Found:**

#### Issue 1: [If any]
```
Description: 
Error Message: 
Steps to Reproduce:
Expected Behavior:
Actual Behavior:
Browser Console:
Status: [Open/Fixed]
```

---

## 📸 **Screenshots**

Take screenshots of:
1. Successful upload
2. S3 bucket with files
3. Database query results
4. Book opening
5. Disk I/O graph (before/after)

---

## ⏱️ **Timeline**

| Time | Action | Result |
|------|--------|--------|
| 00:00 | Start dev server | ✅ Running |
| 00:01 | Open app | ? |
| 00:02 | Sign in | ? |
| 00:03 | Upload PDF | ? |
| 00:05 | Verify S3 | ? |
| 00:06 | Open book | ? |
| 00:08 | Delete book | ? |
| 00:10 | Large file test | ? |
| 00:15 | Testing complete | ? |

---

## 🎓 **Testing Tips**

1. **Use browser DevTools** (F12)
   - Console tab: Watch for logs
   - Network tab: Monitor requests
   - Performance tab: Check speed

2. **Use small test files first**
   - Start with 1-2 MB PDFs
   - Test larger files later
   - Keep test PDFs handy

3. **Test incrementally**
   - One feature at a time
   - Don't skip steps
   - Document each result

4. **Clear cache between tests**
   - Ctrl+Shift+R (Windows)
   - Cmd+Shift+R (Mac)
   - Or use incognito

5. **Take notes**
   - Screenshot errors
   - Copy error messages
   - Note what worked

---

## 🚀 **Ready to Test!**

**Your app is running at:**
```
http://localhost:5173
```

**Start with TEST 1** and work through each test step by step.

Let me know:
- ✅ What passes
- ❌ What fails
- 🤔 Any questions

I'll help troubleshoot any issues! 🛠️

---

**Good luck!** 🎉
