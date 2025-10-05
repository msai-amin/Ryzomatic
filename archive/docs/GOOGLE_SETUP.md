# Google API Setup Guide

This guide will help you set up Google authentication and Google Drive integration for the Smart Reader app.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Smart Reader" (or any name you prefer)
4. Click "Create"

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable these APIs:
   - **Google Drive API**
   - **Google+ API** (for user profile information)

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields:
     - App name: "Smart Reader"
     - User support email: your email
     - Developer contact: your email
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add your domain to authorized domains

4. For Application type, choose "Web application"
5. Add authorized JavaScript origins:
   - `http://localhost:3001` (for development)
   - `https://yourdomain.com` (for production)
6. Click "Create"
7. Copy the **Client ID** - you'll need this for `VITE_GOOGLE_CLIENT_ID`

## Step 4: Create API Key

1. In "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key - you'll need this for `VITE_GOOGLE_API_KEY`
4. (Optional) Restrict the API key to only the APIs you're using

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update your `.env` file with the credentials:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_client_id_here
   VITE_GOOGLE_API_KEY=your_api_key_here
   ```

## Step 6: Test the Integration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. Click the "Sign In" button in the header
4. Complete the Google OAuth flow
5. Check that the "Sync" button appears and shows your Google account

## Features Enabled

Once configured, you'll have access to:

- **Google Authentication**: Sign in with your Google account
- **Google Drive Sync**: Upload/download books, notes, and audio files
- **Cross-device Access**: Access your library from any device
- **Automatic Backup**: Your data is safely stored in Google Drive
- **Offline Support**: Local storage still works when offline

## Security Notes

- Your Google credentials are stored securely in environment variables
- The app only requests necessary permissions (Drive file access, basic profile)
- All data is encrypted in transit
- You can revoke access anytime from your Google account settings

## Troubleshooting

### "This app isn't verified" warning
- This is normal for development apps
- Click "Advanced" → "Go to Smart Reader (unsafe)" to proceed
- For production, you'll need to verify your app with Google

### CORS errors
- Make sure your domain is added to authorized JavaScript origins
- Check that you're using the correct client ID

### API quota exceeded
- Check your Google Cloud Console for API usage
- Consider enabling billing if you hit free tier limits

### Files not syncing
- Check browser console for error messages
- Ensure you have the correct API permissions
- Try signing out and back in

## Production Deployment

For production deployment:

1. Add your production domain to authorized JavaScript origins
2. Update the OAuth consent screen with your production domain
3. Consider getting your app verified by Google for better user experience
4. Set up proper error monitoring and logging

## Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your API credentials are correct
3. Ensure all required APIs are enabled
4. Check that your domain is properly configured

For more help, refer to the [Google Drive API documentation](https://developers.google.com/drive/api) or [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2).
