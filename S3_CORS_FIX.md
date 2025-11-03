# 🔧 S3 CORS Configuration Fix

## Critical Issue

Library downloads failing with CORS error:
```
Access to fetch at 'https://smart-reader-documents.s3.us-east-2.amazonaws.com/...' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

## Root Cause

The S3 bucket `smart-reader-documents` is missing CORS configuration to allow downloads from `https://ryzomatic.net`.

## Solution: Configure S3 CORS

### Step 1: Go to AWS S3 Console

1. **Navigate to**: https://console.aws.amazon.com/s3/
2. **Click**: `smart-reader-documents` bucket
3. **Click**: **Permissions** tab
4. **Scroll down to**: **Cross-origin resource sharing (CORS)** section
5. **Click**: **Edit**

### Step 2: Add CORS Configuration

Copy and paste this JSON configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "https://ryzomatic.net",
      "https://smart-reader-serverless.vercel.app",
      "http://localhost:5173",
      "http://localhost:3001"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Step 3: Save Configuration

1. **Click**: **Save changes**
2. **Wait**: 1-2 minutes for AWS to propagate changes

### Step 4: Test

1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Try downloading a book from library
3. Should work without CORS errors

---

## Alternative: If CORS Editor Doesn't Work

If the CORS editor in AWS Console doesn't work, use AWS CLI:

```bash
# Create CORS config file
cat > cors-config.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": [
        "https://ryzomatic.net",
        "https://smart-reader-serverless.vercel.app",
        "http://localhost:5173",
        "http://localhost:3001"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# Apply CORS config
aws s3api put-bucket-cors \
  --bucket smart-reader-documents \
  --cors-configuration file://cors-config.json \
  --region us-east-2
```

---

## Verification

After applying CORS configuration:

✅ Books download from library without CORS errors  
✅ Signed URLs work correctly  
✅ No more "Access-Control-Allow-Origin" errors  

---

## Why This Was Needed

When downloading from S3 via signed URLs, the browser makes a cross-origin request. AWS S3 requires explicit CORS configuration to allow these requests from your domain.

The signed URL works, but without CORS headers, the browser blocks the response.

---

## Current Status

❌ CORS not configured → Downloads fail  
✅ After CORS fix → Downloads work  

**Action Required**: Apply CORS configuration in AWS S3 Console

