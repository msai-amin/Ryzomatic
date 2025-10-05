# PDF Viewer Troubleshooting Guide

## Common Issues and Solutions

### 1. PDF Loading Timeout

**Symptoms:**
- "PDF loading timeout - falling back to text view" message
- PDF viewer shows loading spinner for extended time
- Automatic fallback to text-only view

**Solutions:**

#### A. Check Network Connection
- Ensure stable internet connection
- Try refreshing the page
- Check if other websites load normally

#### B. Use Text-Only View
- Click the "PDF View" button in the header
- Select "Text" mode for faster loading
- All document content remains accessible

#### C. Download PDF
- Use the download button to save PDF locally
- Open in your preferred PDF viewer
- AI chat still works with extracted text

#### D. Browser-Specific Solutions

**Chrome/Edge:**
- Clear browser cache and cookies
- Disable extensions temporarily
- Try incognito/private mode

**Firefox:**
- Clear cache and cookies
- Disable privacy extensions
- Check if Enhanced Tracking Protection is blocking resources

**Safari:**
- Clear website data
- Disable content blockers temporarily
- Check if Intelligent Tracking Prevention is interfering

### 2. PDF.js Worker Issues

**Symptoms:**
- Console errors about PDF.js worker
- "Setting up fake worker failed" error
- PDF fails to load completely
- Network errors in browser console

**Solutions:**

#### A. Local Worker (Recommended)
The app includes a local PDF.js worker file. If issues persist:

1. **Check local worker**: Visit `http://localhost:3000/pdf.worker.min.js` directly
2. **Clear browser cache**: Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. **Restart development server**: Stop and restart `npm run dev`
4. **Check console**: Look for "PDF.js worker configured to use local file" message

#### B. Automatic Fallback
The app automatically falls back to CDN if local worker fails:
- Local worker: `/pdf.worker.min.js`
- CDN fallback: `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`

#### C. CDN Fallback
The app automatically tries multiple CDN sources:
- unpkg.com (primary fallback)
- cdnjs.cloudflare.com
- jsdelivr.net

#### D. Custom Worker URL
Set a custom worker URL in your `.env` file:
```
VITE_PDF_WORKER_URL=https://your-preferred-cdn.com/pdf.worker.min.js
```

### 3. Large PDF Performance

**Symptoms:**
- Slow loading for large PDFs (>10MB)
- Memory usage spikes
- Browser becomes unresponsive

**Solutions:**

#### A. Use Text Mode
- Switch to text-only view for better performance
- All content remains searchable and accessible
- AI chat works with extracted text

#### B. Optimize PDF
- Compress PDF before uploading
- Remove unnecessary images or graphics
- Split large documents into smaller sections

#### C. Browser Settings
- Close other tabs to free memory
- Restart browser if memory usage is high
- Use a browser with better PDF support

### 4. CORS and Security Issues

**Symptoms:**
- "Cross-Origin" errors in console
- PDF fails to load from external sources
- Security warnings

**Solutions:**

#### A. Local Development
- Use `http://localhost:3000` (not `127.0.0.1`)
- Ensure all services run on same origin
- Check Vite configuration

#### B. Production Deployment
- Configure proper CORS headers
- Use HTTPS for all resources
- Set up proper Content Security Policy

### 5. Mobile and Tablet Issues

**Symptoms:**
- PDF viewer doesn't work on mobile
- Touch gestures not responding
- Layout issues on small screens

**Solutions:**

#### A. Use Text Mode
- Text mode is optimized for mobile devices
- Better readability on small screens
- Touch-friendly navigation

#### B. Download and Use Native App
- Download PDF to device
- Use device's native PDF viewer
- Better performance on mobile devices

### 6. Configuration Options

#### Environment Variables
Add these to your `.env` file for customization:

```env
# PDF loading timeouts (milliseconds)
VITE_PDF_LOADING_TIMEOUT=10000
VITE_PDF_WARNING_TIMEOUT=3000

# Custom PDF.js worker URL
VITE_PDF_WORKER_URL=https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
```

#### Browser Settings
For better PDF performance:

**Chrome:**
- Enable "Use hardware acceleration when available"
- Disable "Use a prediction service to load pages more quickly"

**Firefox:**
- Set `pdfjs.disabled` to `false` in about:config
- Enable hardware acceleration

### 7. Alternative Viewing Options

If the advanced PDF viewer continues to have issues:

1. **Text-Only View**: Always available, fast, and searchable
2. **Download PDF**: Use your preferred PDF viewer
3. **Split View**: Combines text and PDF when available
4. **AI Chat**: Works with any view mode for document analysis

### 8. Getting Help

If issues persist:

1. Check browser console for error messages
2. Try different browsers
3. Test with different PDF files
4. Check network connectivity
5. Review this troubleshooting guide

### 9. Performance Tips

- Use text mode for large documents
- Close other browser tabs
- Ensure stable internet connection
- Keep browser updated
- Clear browser cache regularly

## Technical Details

### PDF.js Configuration
The app uses PDF.js with the following optimizations:
- Multiple worker fallback sources
- Configurable loading timeouts
- Progressive loading with user feedback
- Automatic fallback to text view

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Supported PDF Features
- Text extraction and search
- Page navigation
- Zoom and rotation
- Download functionality
- AI chat integration
