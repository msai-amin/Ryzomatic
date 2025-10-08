# 🚀 Quick Start Testing - S3 Storage

## ⚡ 5-Minute Test

### **1. Start Dev Server**
```bash
npm run dev
```

Opens at: `http://localhost:5173`

---

### **2. Sign In**
- Click "Sign in" or "Start free trial"
- Use your Google account or email

---

### **3. Upload Test PDF**

**Get a test PDF:**
- Use any academic paper < 5MB
- Or download a sample from: [arxiv.org](https://arxiv.org)

**Upload:**
1. Look for "Upload" button in your app
2. Select the PDF
3. Click upload/submit

**Expected:**
- ✅ Success message
- ✅ Book appears in library
- ⏱️ Takes 2-5 seconds

**Check Console:**
```
✅ Uploading PDF to S3
✅ PDF uploaded to S3 successfully
✅ Saving book metadata to database
✅ Book saved successfully
```

---

### **4. Verify in S3**

**AWS Console:**
1. Go to [console.aws.amazon.com/s3](https://console.aws.amazon.com/s3)
2. Click `smart-reader-documents` bucket
3. Navigate to `books/` folder
4. Then `{your-user-id}/` folder
5. **Should see**: Your PDF file ✅

**File format:** `{bookId}.pdf`

---

### **5. Open the Book**

1. Click on the book in library
2. Wait for it to load (2-3 seconds)

**Expected:**
- ✅ PDF loads and displays
- ✅ Can see all pages
- ✅ Can navigate pages

**Check Console:**
```
✅ Downloading PDF from S3
✅ PDF downloaded from S3 successfully
```

---

### **6. Delete the Book**

1. Click trash icon 🗑️
2. Confirm deletion

**Expected:**
- ✅ Removed from library
- ✅ Success message

**Verify S3:**
- File should be **GONE** from S3 bucket

---

## ✅ If All 6 Steps Pass

**Congratulations!** 🎉

Your S3 storage is working perfectly:
- ✅ Upload ✅ Storage ✅ Download ✅ Delete
- ✅ No disk I/O issues
- ✅ Fast performance
- ✅ Ready for production!

---

## ❌ If Any Step Fails

### **Upload Fails**

**Check:**
```bash
# Verify AWS credentials
cat .env.local | grep AWS_

# Should show:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=smart-reader-documents
```

**Also check:**
- Browser console for errors
- Network tab for failed requests
- Vercel function logs

### **Book Doesn't Appear in Library**

**Check:**
1. Browser console for errors
2. Database for new record
3. Refresh page

### **Can't Open Book**

**Check:**
1. s3_key exists in database
2. File exists in S3
3. Signed URL generates correctly

**Debug query:**
```sql
SELECT id, title, s3_key, file_size 
FROM user_books 
ORDER BY created_at DESC 
LIMIT 1;
```

### **Delete Fails**

**Check:**
- Book exists in database
- S3 delete permissions
- Browser console errors

---

## 🎯 Production Test (After Deployment)

Once Vercel deployment completes:

1. Open production URL in **incognito**
2. Repeat steps 2-6 above
3. Same expectations

**Bonus:** Test with 3-5 different PDFs to ensure stability.

---

## 📊 Performance Expectations

| Operation | Time | Acceptable? |
|-----------|------|-------------|
| Library load | < 1 sec | ✅ |
| Upload 2MB PDF | 3-5 sec | ✅ |
| Open 2MB PDF | 2-4 sec | ✅ (downloading) |
| Delete book | 1-2 sec | ✅ |
| Large file reject | Instant | ✅ |

---

## 🎉 Test Summary Template

```
✅ PASS: Upload small PDF
✅ PASS: File in S3
✅ PASS: Open book
✅ PASS: Delete book
✅ PASS: Large file rejected

Result: All tests passed!
S3 storage working perfectly.
Ready for production. 🚀
```

---

**Happy Testing!** 🧪

Time to test: **5 minutes**  
Difficulty: **Easy**  
Expected result: **✅ Success**
