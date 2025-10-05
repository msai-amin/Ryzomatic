# Google OAuth Setup for Localhost Development

## 🚨 **Important: OAuth Localhost Configuration**

Google OAuth has restrictions with `localhost` that can cause authentication failures. Follow these steps to fix it:

## **Step 1: Update Google Cloud Console**

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Navigate to**: APIs & Services → Credentials
3. **Click on your OAuth 2.0 Client ID**: `960231324043-57pkecbb4ud6vq9knaceenj5gnloe4mc.apps.googleusercontent.com`

### **Add These Authorized JavaScript Origins:**
```
http://localhost:3001
http://127.0.0.1:3001
http://localhost:3000
http://127.0.0.1:3000
```

### **Add These Authorized Redirect URIs:**
```
http://localhost:3001
http://127.0.0.1:3001
http://localhost:3001/
http://127.0.0.1:3001/
http://localhost:3000
http://127.0.0.1:3000
```

## **Step 2: Alternative Solutions**

### **Option A: Use 127.0.0.1 Instead of localhost**
- The app now runs on `http://127.0.0.1:3001` instead of `http://localhost:3001`
- This often resolves OAuth issues

### **Option B: Use ngrok for HTTPS (Recommended for Production Testing)**
```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3001

# Use the HTTPS URL provided by ngrok in Google Cloud Console
# Example: https://abc123.ngrok.io
```

### **Option C: Use a Custom Domain (Advanced)**
- Add `127.0.0.1 smart-reader.local` to your `/etc/hosts` file
- Use `http://smart-reader.local:3001` in OAuth settings

## **Step 3: Test the Configuration**

1. **Restart the development server**:
   ```bash
   npm run dev
   ```

2. **Access the app at**: `http://127.0.0.1:3001`

3. **Try signing in** - should now work without OAuth errors

## **Common OAuth Errors and Solutions**

### **Error: "redirect_uri_mismatch"**
- **Solution**: Add the exact URL to Authorized redirect URIs in Google Cloud Console

### **Error: "invalid_client"**
- **Solution**: Check that your Client ID is correct in `.env` file

### **Error: "access_denied"**
- **Solution**: User cancelled the OAuth flow (normal behavior)

### **Error: "popup_blocked"**
- **Solution**: Allow popups for the site in your browser

## **Production Deployment**

For production, you'll need to:
1. Add your production domain to OAuth settings
2. Update the redirect URIs
3. Ensure HTTPS is enabled

## **Troubleshooting**

If you're still having issues:

1. **Check browser console** for specific error messages
2. **Verify Client ID** in `.env` file matches Google Cloud Console
3. **Clear browser cache** and try again
4. **Try incognito mode** to rule out extension conflicts

## **Need Help?**

- Check the browser console for detailed error messages
- Verify all URIs are added to Google Cloud Console
- Make sure the Client ID is correct
- Try the 127.0.0.1 URL instead of localhost
