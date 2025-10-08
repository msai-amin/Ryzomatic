# 🧪 S3 Storage Testing Guide

## ✅ Prerequisites

1. ✅ Database migration completed
2. ✅ Code updated and built successfully
3. ✅ AWS credentials configured
4. ✅ Development server ready

---

## 🚀 **STEP 3: Local Testing**

### **Start Development Server**

```bash
cd /Users/aminamouhadi/smart-reader-serverless
npm run dev
```

The app should start at: `http://localhost:5173`

---

## 📋 Test Checklist

### **Test 1: Upload Small PDF (Success Case)**

1. **Open the app** in browser
2. **Sign in** with your account
3. **Upload a PDF** (< 5MB)
   - Click "Upload" or similar
   - Select a test PDF file
   - Click "Submit"

**Expected Result:**
- ✅ Upload progress shown
- ✅ Success message appears
- ✅ Book appears in library
- ✅ Console logs show:
  ```
  Uploading PDF to S3
  PDF uploaded to S3 successfully
  Saving book metadata to database
  Book saved successfully
  ```

**Verify in S3:**
- Go to AWS S3 Console
- Navigate to `smart-reader-documents` bucket
- Check `books/{your-user-id}/` folder
- File should be there: `{bookId}.pdf`

**Verify in Database:**
- Go to Supabase SQL Editor
- Run: 
  ```sql
  SELECT id, title, s3_key, file_size 
  FROM user_books 
  ORDER BY created_at DESC 
  LIMIT 1;
  ```
- Should see `s3_key` populated (not null)

---

### **Test 2: Open Book (Download from S3)**

1. **Click on the uploaded book** in library
2. Wait for it to load

**Expected Result:**
- ✅ PDF opens and displays
- ✅ All pages accessible
- ✅ Console logs show:
  ```
  Downloading PDF from S3
  PDF downloaded from S3 successfully
  ```
- ✅ Book renders correctly

**Troubleshooting:**
- If slow: Normal for first load (downloading from S3)
- If fails: Check browser console for errors
- If "Book file not found": Check s3_key in database

---

### **Test 3: Upload Large PDF (Fail Case)**

1. **Try to upload a PDF > 5MB**

**Expected Result:**
- ❌ Upload rejected
- ✅ Error message shown:
  ```
  "PDF file is too large (X.XXM

B). Maximum size is 5MB."
  ```
- ✅ No file uploaded to S3
- ✅ No database record created

---

### **Test 4: Delete Book (Cleanup S3)**

1. **Delete a book** from library
2. Click trash icon
3. Confirm deletion

**Expected Result:**
- ✅ Book removed from library
- ✅ Console logs show:
  ```
  Book deleted from database
  Book file deleted from S3
  ```

**Verify in S3:**
- Go to S3 Console
- File should be GONE from `books/{userId}/` folder

**Verify in Database:**
```sql
SELECT id, title FROM user_books WHERE id = 'deleted-book-id';
-- Should return 0 rows
```

---

### **Test 5: Multiple Books**

1. Upload 3-5 different PDFs
2. Check library loads fast
3. Open each book

**Expected Result:**
- ✅ Library shows all books instantly (metadata only)
- ✅ Each book opens correctly when clicked
- ✅ No disk I/O warnings in Supabase

---

### **Test 6: Text Files (Non-PDF)**

1. Upload a `.txt` file

**Expected Result:**
- ✅ Text file uploads
- ✅ Stored in database (text_content column)
- ✅ No S3 upload (text files stay in database)
- ✅ Opens and displays correctly

---

## 🔍 Monitoring

### **Watch Browser Console**

Open Developer Tools (F12) and monitor:

```javascript
// Should see logs like:
[BookStorageService] Uploading book to S3
[BookStorageService] Book uploaded to S3 successfully
[SupabaseStorageService] Saving book metadata to database
[SupabaseStorageService] Book saved successfully
```

### **Check Network Tab**

1. Open Network tab in DevTools
2. Upload a book
3. Look for requests to:
   - `/api/books/upload-to-s3` (should succeed)
   - S3 signed URLs (for download)

### **Monitor S3 Storage**

AWS Console → S3 → `smart-reader-documents` → `books/`

Should see structure:
```
books/
  └── {userId}/
      ├── {bookId1}.pdf
      ├── {bookId2}.pdf
      └── {bookId3}.pdf
```

### **Monitor Database Size**

In Supabase SQL Editor:
```sql
-- Should be small now (no PDFs stored)
SELECT pg_size_pretty(pg_total_relation_size('user_books'));

-- Check recent uploads
SELECT 
  id, 
  title, 
  file_size / 1024 / 1024 as size_mb,
  s3_key,
  created_at 
FROM user_books 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🐛 Troubleshooting

### **Error: "Upload failed"**

**Check:**
1. AWS credentials in `.env.local`
2. S3 bucket exists
3. IAM permissions correct
4. CORS configured on S3 bucket

**Fix:**
```bash
# Check environment variables
cat .env.local | grep AWS

# Should see:
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=smart-reader-documents
```

### **Error: "Failed to download book"**

**Check:**
1. s3_key exists in database
2. File exists in S3
3. Signed URL generated correctly

**Debug:**
```sql
-- Check s3_key
SELECT id, title, s3_key FROM user_books WHERE id = 'problematic-book-id';
```

### **Error: "Book file not found"**

**Cause**: Book record exists but no s3_key

**Fix**: Delete and re-upload the book

### **S3 403 Forbidden**

**Check:**
1. IAM user has S3 permissions
2. Bucket policy allows access
3. Credentials are correct

### **Slow Upload/Download**

**Expected**: First time may be slow
- Upload: Depends on file size and internet speed
- Download: ~2-5 seconds for 5MB PDF

**If very slow:**
- Check internet connection
- Check S3 region (should be same as your server)
- Consider CloudFront CDN for faster delivery

---

## 📊 Performance Comparison

### **Before (Database Storage)**
```
Library Load: 2-5 seconds (loading all PDFs)
Book Open: 1 second (already in memory)
Database Size: Large (GBs)
Disk I/O: ⚠️ High
```

### **After (S3 Storage)**
```
Library Load: 0.3 seconds (metadata only)
Book Open: 2-3 seconds (download from S3)
Database Size: Small (MBs)
Disk I/O: ✅ Minimal
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ **Upload PDF** → Appears in library
2. ✅ **Check S3** → File exists in bucket
3. ✅ **Check Database** → s3_key populated
4. ✅ **Open Book** → PDF loads and displays
5. ✅ **Delete Book** → Removed from both S3 and database
6. ✅ **No Disk I/O warnings** in Supabase dashboard

---

## 🎯 Final Verification

Run this complete test sequence:

```bash
# 1. Start dev server
npm run dev

# 2. In browser:
# - Sign in
# - Upload 3 PDFs (< 5MB each)
# - Verify library loads fast
# - Open each PDF
# - Delete one PDF
# - Refresh page
# - Open remaining PDFs

# 3. Check S3:
# AWS Console → S3 → smart-reader-documents/books/{userId}/
# Should see 2 files remaining

# 4. Check Database:
SELECT COUNT(*) FROM user_books;
-- Should return 2

# 5. Check Disk I/O:
# Supabase Dashboard → Database → Reports
# Disk I/O should be low and stable
```

---

## 📝 Testing Log Template

Use this to document your tests:

```
Date: [date]
Tester: [your name]

✅ Test 1: Upload small PDF
   Result: Success
   File: test.pdf (2.3MB)
   S3 Key: books/user-123/book-456.pdf
   
✅ Test 2: Open book
   Result: Success
   Load Time: 2.1 seconds
   
✅ Test 3: Upload large PDF
   Result: Correctly rejected
   File: large.pdf (7.5MB)
   Error: "PDF file is too large..."
   
✅ Test 4: Delete book
   Result: Success
   Verified: File removed from S3 and database
   
✅ Test 5: Multiple books
   Result: Success
   Count: 3 books
   Library Load: 0.4 seconds
   
✅ Test 6: Text file
   Result: Success
   File: notes.txt
   Storage: Database (as expected)

Overall: ✅ All tests passed
```

---

## 🚀 Ready for Production

Once all tests pass:

```bash
# Commit changes
git add .
git commit -m "feat: Implement S3 storage for books - fixes disk I/O issues"

# Push to production
git push origin main

# Monitor deployment
# Check Vercel dashboard for successful deployment
```

---

## 💡 Tips

1. **Use small PDFs** for testing (1-2MB)
2. **Test with real PDFs** you'll actually use
3. **Monitor browser console** for errors
4. **Check S3 costs** in AWS Billing dashboard
5. **Keep test files** for regression testing

---

## 📞 Need Help?

If tests fail:
1. Check browser console for errors
2. Check Vercel function logs
3. Check Supabase database logs
4. Check AWS CloudWatch logs
5. Review `S3_STORAGE_MIGRATION.md` for setup details

---

**Happy Testing! 🎉**

---

**Last Updated:** October 2025  
**Status:** ✅ Ready to test

