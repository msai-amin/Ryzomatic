# Smart Reader Serverless - Setup Guide

This guide will help you set up the serverless version of Smart Reader with Gemini AI.

## Prerequisites

- Node.js 18+ installed
- Git installed
- Accounts needed (all have free tiers):
  - Google Cloud (for Gemini API)
  - Supabase
  - AWS (for S3)
  - Vercel (for hosting)
  - (Optional) Pinecone for vector search
  - (Optional) Stripe for billing

---

## Step 1: Clone and Install

```bash
# You're already on the refactor branch
git status  # Should show: refactor/claude-native-serverless

# Install dependencies
npm install

# Install additional serverless dependencies
npm install @supabase/supabase-js @google/generative-ai
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install formidable @types/formidable
npm install --save-dev @vercel/node
```

---

## Step 2: Set Up Gemini API

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new project or use existing
4. Copy your API key

**Free Tier:**
- Gemini 1.5 Flash: 15 requests/minute
- Gemini 1.5 Pro: 2 requests/minute
- Great for development and free tier users!

---

## Step 3: Set Up Supabase

1. Go to [Supabase](https://app.supabase.com/)
2. Click "New Project"
3. Fill in:
   - Name: `smart-reader`
   - Database Password: (generate strong password)
   - Region: Choose closest to you
4. Wait for project to be created (~2 minutes)

### Run Database Migrations

1. In Supabase Dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run"
5. Verify tables were created in "Table Editor"

### Get API Keys

1. Go to "Settings" → "API"
2. Copy:
   - `Project URL` (VITE_SUPABASE_URL)
   - `anon public` key (VITE_SUPABASE_ANON_KEY)
   - `service_role` key (SUPABASE_SERVICE_ROLE_KEY) - **Keep this secret!**

### Enable Google OAuth (Optional)

1. Go to "Authentication" → "Providers"
2. Enable "Google"
3. Add your Google OAuth credentials
4. Set redirect URL: `https://your-app.vercel.app/auth/callback`

---

## Step 4: Set Up AWS S3

### Create S3 Bucket

1. Go to [AWS Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Bucket name: `smart-reader-documents-[your-unique-id]`
4. Region: Same as your Vercel deployment region (usually `us-east-1`)
5. **Uncheck** "Block all public access" (we'll use signed URLs)
6. Enable "Bucket Versioning"
7. Click "Create bucket"

### Configure CORS

1. Go to your bucket → "Permissions" → "CORS"
2. Add this configuration:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### Create IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Add users"
3. Username: `smart-reader-app`
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"
6. Click "Attach policies directly"
7. Search and select: `AmazonS3FullAccess` (or create custom policy)
8. Click through to create user
9. **Copy Access Key ID and Secret Access Key** - you won't see the secret again!

### Alternative: Use Bucket Policy (More Secure)

Instead of full S3 access, create a policy for just your bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::smart-reader-documents-your-id/*",
        "arn:aws:s3:::smart-reader-documents-your-id"
      ]
    }
  ]
}
```

---

## Step 5: Configure Environment Variables

1. Copy the serverless environment template:

```bash
cp .env.serverless .env.local
```

2. Edit `.env.local` with your actual values:

```bash
# Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=smart-reader-documents-your-id

# Vercel
VERCEL_URL=localhost:5173
NODE_ENV=development
```

---

## Step 6: Test Locally

```bash
# Start development server
npm run dev
```

The app should now run on `http://localhost:5173`

### Test API Endpoints

```bash
# Health check
curl http://localhost:5173/api/health

# Expected response:
# {
#   "status": "healthy",
#   "checks": {
#     "gemini": true,
#     "supabase": true,
#     "s3": true
#   }
# }
```

---

## Step 7: Deploy to Vercel

### Install Vercel CLI

```bash
npm install -g vercel
```

### Deploy

```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name: smart-reader
# - In which directory is your code located? ./
# - Want to override settings? N
```

### Set Environment Variables in Vercel

```bash
# Add each environment variable
vercel env add GEMINI_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add AWS_S3_BUCKET
vercel env add AWS_REGION

# For each, select:
# - Environment: Production, Preview, Development
# - Paste the value
```

### Deploy to Production

```bash
vercel --prod
```

Your app will be live at: `https://smart-reader-xxxx.vercel.app`

---

## Step 8: Configure Custom Domain (Optional)

1. In Vercel Dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your domain
4. Follow DNS instructions

---

## Step 9: Set Up Billing (Optional - for paid tiers)

### Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Complete account setup
3. Get API keys from "Developers" → "API keys"

### Custom Plans (Contact-Based)

The application uses a 2-tier pricing model:
- **Free Tier**: Generous limits with full feature access (50 docs, 200 AI chats, 50 OCR/month)
- **Custom Tier**: Contact-based enterprise/custom plans with unlimited or custom limits

For custom plans, users contact you directly via email. No Stripe integration is required for basic setup.

**Optional: Future Stripe Integration**
If you want to add automated billing for custom plans:
1. Set up Stripe products for custom pricing
2. Add environment variables for Stripe keys
3. Implement custom checkout flow

---

## Step 10: Testing the Full Flow

### Test Document Upload

```bash
curl -X POST https://your-app.vercel.app/api/documents/upload \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -F "file=@sample-document.txt" \
  -F "title=Test Document"
```

### Test Chat

```bash
curl -X POST https://your-app.vercel.app/api/chat/stream \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this document about?",
    "documentId": "YOUR_DOCUMENT_ID"
  }'
```

---

## Troubleshooting

### Error: "Gemini API key not found"
- Check that `GEMINI_API_KEY` is set in `.env.local`
- Restart your dev server after adding environment variables

### Error: "Supabase connection failed"
- Verify your Supabase URL and keys are correct
- Check that migrations ran successfully
- Verify RLS policies are set up

### Error: "S3 upload failed"
- Check AWS credentials are correct
- Verify bucket name matches
- Check CORS configuration
- Ensure IAM user has necessary permissions

### Error: "Method not allowed" on Vercel
- Check that your API routes are in the `api/` directory
- Verify `vercel.json` configuration
- Try redeploying: `vercel --prod --force`

### Cold Start Issues
- First request might be slow (100-500ms)
- Subsequent requests are fast
- Consider using Vercel Edge Functions for auth/routing

---

## Monitoring and Costs

### Monitor Costs

**Gemini (free tier limits):**
- Flash: 15 RPM (1,500 requests/day)
- Custom plans: Higher limits based on agreement

**Supabase (free tier):**
- 500MB database
- 1GB file storage
- 50,000 monthly active users

**Vercel (free tier):**
- 100GB bandwidth/month
- Unlimited requests

**AWS S3 (pay as you go):**
- First 5GB free
- $0.023/GB thereafter
- $0.005/1000 PUT requests
- $0.0004/1000 GET requests

### Set Up Billing Alerts

**AWS:**
1. Go to AWS Billing Dashboard
2. Set up billing alert for $10, $50, $100

**Vercel:**
1. Go to project settings
2. Set usage notifications

**Monitor via APIs:**
- Gemini: Check quota usage in Google Cloud Console
- Supabase: Dashboard shows usage metrics
- Vercel: Analytics tab shows requests/bandwidth

---

## Next Steps

1. ✅ Basic setup complete
2. ⏭️ Add vector search (Pinecone) for better document queries
3. ⏭️ Implement billing webhooks for subscription management
4. ⏭️ Add email notifications
5. ⏭️ Set up monitoring (Sentry, LogRocket)
6. ⏭️ Optimize performance
7. ⏭️ Add more document types (PDF, DOCX)

---

## Need Help?

- Check the detailed implementation guides in this repo
- Review Vercel documentation: https://vercel.com/docs
- Review Supabase documentation: https://supabase.com/docs
- Review Gemini documentation: https://ai.google.dev/docs

You're now ready to start using the serverless architecture! 🚀

