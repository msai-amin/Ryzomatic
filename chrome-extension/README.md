# Ryzomatic Chrome Extension

Save web pages, PDFs, and highlights to your Ryzomatic research library directly from your browser.

## Features

- **Save Web Pages**: Capture articles, blog posts, and any web content to your library
- **Save PDFs**: Automatically detect and save online PDFs
- **Text Highlighting**: Select text and save it as a highlight with customizable colors
- **Quick Notes**: Save selected text as notes
- **Library Access**: Quick access to recent documents and library search
- **Context Menu Integration**: Right-click actions for seamless workflow

## Installation

### Development Mode

1. **Install dependencies**:
   ```bash
   cd chrome-extension
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `chrome-extension/dist` directory

### Development with Hot Reload

```bash
npm run dev
```

This watches for file changes and rebuilds automatically. You'll still need to click "Reload" in `chrome://extensions/` to see changes.

## Configuration

### Environment Variables

Create a `.env` file or set environment variables before building:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=https://ryzomatic.net
```

### Extension Icons

Place icon files in `public/icons/`:
- `icon-16.png` (16x16)
- `icon-48.png` (48x48)
- `icon-128.png` (128x128)

You can use the main Ryzomatic logo as a base.

## Usage

### Saving Pages

1. Click the Ryzomatic extension icon
2. Click "Save to Library"
3. The page will be saved to your Ryzomatic account

Or right-click anywhere on a page and select "Ryzomatic > Save this page"

### Highlighting Text

1. Select text on any webpage
2. A toolbar appears with the Ryzomatic icon and color options
3. Click a color to save as a highlight
4. Click "Save" to save without highlighting

### Quick Access

- Click the extension icon to see recent documents
- Use "Open Library" to access your full Ryzomatic library

## Manual Testing Checklist

### Authentication
- [ ] Sign in with valid credentials shows success
- [ ] Sign in with invalid credentials shows error message
- [ ] Sign out clears session and shows login form
- [ ] Session persists after closing/reopening popup
- [ ] Token refresh works for long sessions

### Save Page
- [ ] Saving a regular webpage works
- [ ] Page title is extracted correctly
- [ ] Page content is extracted (article text)
- [ ] Author and publish date extracted when available
- [ ] Success notification appears
- [ ] Document appears in "Recent" list

### Save PDF
- [ ] Online PDFs are detected automatically
- [ ] PDF indicator shows in popup
- [ ] PDF saves successfully to library
- [ ] Success notification appears

### Highlighting
- [ ] Selection toolbar appears when text is selected
- [ ] All color options are visible
- [ ] Clicking a color saves the highlight
- [ ] Highlight appears visually on page
- [ ] Toast notification confirms save
- [ ] Context menu "Highlight selection" works

### Quick Access
- [ ] Recent documents load correctly
- [ ] Clicking a document opens in new tab
- [ ] "Open Library" button works
- [ ] "Upload Document" link works

### Context Menu
- [ ] "Save this page" saves current page
- [ ] "Save link as document" saves linked content
- [ ] Highlight submenu shows all colors
- [ ] "Save selection as note" works
- [ ] "Open Ryzomatic Library" opens website

### Settings Page
- [ ] Options page loads correctly
- [ ] Account info displays when logged in
- [ ] Default highlight color can be changed
- [ ] Show selection toolbar toggle works
- [ ] Notifications toggle works
- [ ] Reset settings works
- [ ] Clear all data signs out and clears storage

### Edge Cases
- [ ] Works on HTTPS sites
- [ ] Handles pages with no readable content gracefully
- [ ] Handles very long selections
- [ ] Works when offline (shows appropriate error)
- [ ] Doesn't break on CSP-restricted pages

## Architecture

```
chrome-extension/
├── manifest.json           # Chrome extension manifest (V3)
├── src/
│   ├── background/         # Service worker
│   │   └── service-worker.ts
│   ├── content/            # Content scripts
│   │   ├── content-script.ts
│   │   ├── content-script.css
│   │   └── highlight-ui.ts
│   ├── popup/              # Extension popup
│   │   ├── Popup.tsx
│   │   ├── AuthForm.tsx
│   │   ├── SavePage.tsx
│   │   └── QuickAccess.tsx
│   ├── options/            # Settings page
│   │   └── Options.tsx
│   └── shared/             # Shared utilities
│       ├── api.ts          # API client
│       ├── auth.ts         # Supabase auth
│       ├── storage.ts      # Chrome storage
│       └── types.ts        # TypeScript types
└── dist/                   # Build output
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| Supabase Auth | POST | Email/password authentication |
| `/api/documents?action=upload` | POST | Upload web pages |
| `/api/books` | POST | Upload PDFs |
| `/api/highlights` | GET/POST | Manage highlights |

## Troubleshooting

### Extension not working after install
- Make sure you've run `npm run build`
- Check that `dist/` folder exists and has files
- Try reloading the extension in `chrome://extensions/`

### Authentication issues
- Verify your Supabase credentials are correct
- Check browser console for error messages
- Try signing out and back in

### Page saving fails
- Check that you're signed in
- Verify API is reachable (check network tab)
- Some pages with strict CSP may not work

### Content script not loading
- Reload the extension
- Refresh the page
- Check console for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify it compiles
5. Test manually using the checklist above
6. Submit a pull request

## License

MIT License - see main repository LICENSE file

