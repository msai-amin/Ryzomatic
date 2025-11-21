# 🧪 TESTING INSTRUCTIONS - S3 Storage

## ✅ Dev Server Running

**Your app is at:** `http://localhost:4173`

---

## 🎯 **INTERACTIVE TEST GUIDE**

Follow these steps and report results for each:

---

### **TEST 1: App Loads** ✅ COMPLETE

**Action:** Open `http://localhost:4173` in your browser

**Expected:**
- ✅ Immersive Reader landing page displays
- ✅ See "BY VSTYLE" branding
- ✅ Clean academic design with slate colors

**Status:** Should be working now

---

### **TEST 2: Authentication**

**Action:**
1. Click **"Sign in"** or **"Start free trial"**
2. Sign in with Google or email

**Expected:**
- ✅ Auth modal opens
- ✅ Can sign in
- ✅ Redirected to main app

**Report back:**
- Did sign in work? [YES/NO]
- Any errors? [Error message if any]

---

### **TEST 3: Upload PDF to S3** 🎯 CRITICAL

**Preparation:**
- Get a PDF < 5MB ready
- Any academic paper or document

**Action:**
1. Find "Upload" or "Add Document" button
2. Select your PDF
3. Click upload

**Watch Browser Console (F12 → Console tab):**

Should see:
```
[BookStorageService] Uploading book to S3
[BookStorageService] Book uploaded to S3 successfully
[SupabaseStorageService] Saving book metadata to database
[SupabaseStorageService] Book saved successfully
```

**Expected:**
- ✅ Upload completes (3-5 seconds)
- ✅ Success message
- ✅ Book appears in library

**Report back:**
- Did upload work? [YES/NO]
- Did book appear in library? [YES/NO]
- Console logs look correct? [YES/NO]
- Any errors? [Copy error message]

---

### **TEST 4: Verify in AWS S3** 🔍 CRITICAL

**Action:**
1. Open [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Go to bucket: `smart-reader-documents`
3. Navigate: `books/` → `{your-user-id}/` (UUID folder)

**Expected:**
- ✅ See your PDF file
- ✅ File name: `{bookId}.pdf` (UUID.pdf)
- ✅ File size matches your PDF

**Report back:**
- File exists in S3? [YES/NO]
- S3 path: [Copy the full path]
- File size correct? [YES/NO]
- Screenshot if possible

---

### **TEST 5: Check Supabase Database**

**Action:** Run in Supabase SQL Editor

```sql
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
- ✅ Returns 1 row
- ✅ `s3_key` has value: `books/{userId}/{bookId}.pdf`
- ✅ `file_size` correct

**Report back:**
- Query returned data? [YES/NO]
- s3_key populated? [YES/NO]
- s3_key value: [Copy the value]

---

### **TEST 6: Open Book from S3** 🎯 CRITICAL

**Action:**
1. Click on the uploaded book in library
2. Wait for it to load

**Watch Console:**
```
[BookStorageService] Downloading PDF from S3
[BookStorageService] PDF downloaded from S3 successfully
```

**Expected:**
- ✅ PDF loads (2-4 seconds)
- ✅ Displays correctly
- ✅ Can navigate pages

**Report back:**
- Did book open? [YES/NO]
- PDF displays correctly? [YES/NO]
- Load time: [X seconds]
- Any errors? [Error message]

---

### **TEST 7: Delete Book** 🗑️ CRITICAL

**Action:**
1. Click trash icon on book
2. Confirm deletion

**Expected:**
- ✅ Book removed from library
- ✅ Success message

**Verify in S3:**
- Go to S3 Console
- Check `books/{userId}/` folder
- File should be **GONE**

**Verify in Database:**
```sql
SELECT COUNT(*) FROM user_books;
-- Should not include deleted book
```

**Report back:**
- Deleted from library? [YES/NO]
- Deleted from S3? [YES/NO]
- Deleted from database? [YES/NO]

---

### **TEST 8: Large File Rejection**

**Action:**
1. Try uploading PDF > 5MB

**Expected:**
- ❌ Rejected
- ✅ Clear error: "PDF file is too large..."

**Report back:**
- Was rejected? [YES/NO]
- Error message clear? [YES/NO]

---

### **TEST 9: Monitor Disk I/O** 📊 CRITICAL

**Action:**
1. Go to [Supabase Dashboard](https://supabase.com)
2. Your Project → Database → Reports
3. Check "Disk IO" graph

**Expected:**
- ✅ Disk I/O LOW
- ✅ No warning banner

**Report back:**
- Disk I/O level: [Low/Medium/High]
- Warning present? [YES/NO]
- Screenshot the graph

---

### **TEST 10: Production Deployment**

**Action:**
1. Go to your production URL
2. Clear cache (Cmd+Shift+R)
3. Repeat Tests 2-7

**Report back:**
- Production working? [YES/NO]
- Same as local? [YES/NO]
- Any differences? [Describe]

---

## 📊 **Results Summary**

Fill this out as you test:

```
✅ TEST 1: App Loads - [PASS/FAIL]
⏳ TEST 2: Authentication - [PASS/FAIL]
⏳ TEST 3: Upload PDF - [PASS/FAIL]
⏳ TEST 4: File in S3 - [PASS/FAIL]
⏳ TEST 5: Database Record - [PASS/FAIL]
⏳ TEST 6: Open Book - [PASS/FAIL]
⏳ TEST 7: Delete Book - [PASS/FAIL]
⏳ TEST 8: Large File Reject - [PASS/FAIL]
⏳ TEST 9: Disk I/O Monitoring - [PASS/FAIL]
⏳ TEST 10: Production - [PASS/FAIL]

OVERALL: [ALL PASS / X FAILURES]
```

---

## 🚀 **START HERE**

1. **Open browser** → `http://localhost:4173`
2. **Begin TEST 2** (Authentication)
3. **Work through each test**
4. **Report results** after each test

I'll help troubleshoot any failures! 🛠️

---

**Let's do this!** 💪
