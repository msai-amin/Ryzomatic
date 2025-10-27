# ryzome

An intelligent reading platform for academics with AI chat capabilities, built with React, TypeScript, and modern web technologies.

## Features

- **Advanced PDF Viewer**: Professional PDF viewing with zoom, rotation, page navigation, and text extraction
- **Text-to-Speech (TTS)**: Natural human voice reading with customizable speed, pitch, and voice selection
- **Text Highlighting**: Highlight important text in PDFs with multiple color options
- **Scroll Modes**: Single page or continuous scroll viewing
- **Large Text Viewer**: Customizable typography with multiple font families, sizes, and themes
- **AI Chat Overlay**: Real-time AI interactions with document context
- **Document Upload**: Support for text files and PDFs with automatic content extraction
- **Multiple View Modes**: Text-only, PDF view, or split view for optimal reading experience
- **Progressive Web App**: Installable with offline capabilities
- **Responsive Design**: Beautiful, modern UI that works on all devices

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Headless UI
- **State Management**: Zustand
- **AI Integration**: OpenAI GPT-3.5 & Google Gemini (configurable, with automatic fallback)
- **Document Processing**: PDF.js + react-pdf for advanced PDF viewing
- **PWA**: Vite PWA plugin

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker and Docker Compose (for microservices)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-reader-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your AI API keys (you can use either or both):
```
# Option 1: Use Gemini (recommended - free tier available)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Option 2: Use OpenAI
VITE_OPENAI_API_KEY=your_openai_api_key_here

# The app will try Gemini first, then fall back to OpenAI if needed
```

Get your API keys:
- **Gemini**: https://makersuite.google.com/app/apikey
- **OpenAI**: https://platform.openai.com/api-keys

4. Start the microservices (optional):
```bash
docker-compose up -d
```

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:3001`

### Available Services

- **React App**: http://localhost:3001 (Main application)
- **API Gateway**: http://localhost:3000 (Microservices API)
- **AI Integration**: http://localhost:3004 (AI processing)
- **Vector Database**: http://localhost:3005 (Document embeddings)
- **Document Processing**: http://localhost:3003 (File processing)

## Usage

### Uploading Documents

1. Click the "Upload" button in the header
2. Drag and drop a file or click to browse
3. Supported formats: `.txt`, `.pdf`

### Customizing Reading Experience

1. Click the "Settings" button in the header for typography settings
2. For PDF documents, click the "PDF View" button for PDF-specific settings
3. Adjust:
   - Font family (Serif, Sans Serif, Monospace)
   - Font size (12px - 24px)
   - Line height (1.2 - 2.5)
   - Max width (400px - 1200px)
   - Theme (Light, Dark, Sepia)
   - PDF view mode (Text, PDF, Split)
   - PDF zoom and navigation options

### Text-to-Speech (TTS)

1. Open a PDF document
2. Click the speaker icon (🔊) in the toolbar to enable TTS
3. Click the Settings icon (⚙️) to customize voice, speed, pitch, and volume
4. Use the Play button (▶️) to start reading
5. Options:
   - **Read Current Page**: Read only the current page
   - **Read from Here to End**: Continue from current page to the end
   - **Speed Presets**: 0.75x, 1x, 1.25x, 1.5x for quick speed adjustment

See [TTS_GUIDE.md](TTS_GUIDE.md) for detailed instructions and tips.

### AI Chat

1. Click the "AI Chat" button to open the chat modal
2. Ask questions about your uploaded document
3. The AI will provide contextual responses based on the document content

## Project Structure

```
src/
├── components/          # React components
│   ├── ChatModal.tsx   # AI chat interface
│   ├── ChatMessage.tsx # Individual chat messages
│   ├── DocumentViewer.tsx # Main document display
│   ├── DocumentUpload.tsx # File upload interface
│   ├── EmptyState.tsx  # Welcome screen
│   ├── Header.tsx      # Navigation header
│   ├── PDFViewer.tsx   # Advanced PDF viewer
│   ├── PDFViewerSettings.tsx # PDF viewer controls
│   └── TypographySettings.tsx # Typography controls
├── services/           # External services
│   └── aiService.ts    # AI integration
├── store/              # State management
│   └── appStore.ts     # Zustand store
├── App.tsx            # Main app component
├── main.tsx           # App entry point
└── index.css          # Global styles
```

## Configuration

### AI Integration

The app includes a mock AI service for demonstration. To use real AI capabilities:

1. Get an OpenAI API key
2. Add it to your `.env` file as `VITE_OPENAI_API_KEY=your_api_key_here`
3. The app will automatically use the real OpenAI API when the key is available

### PDF Viewer

The app includes both an advanced PDF viewer (using react-pdf) and a fallback simple viewer:

- **Advanced Viewer**: Full PDF rendering with zoom, rotation, and navigation
- **Simple Viewer**: Text-based view with page navigation and download functionality
- **Error Handling**: Automatic fallback to simple viewer if advanced viewer fails

### Troubleshooting

#### PDF Viewer Issues
If you encounter issues with the advanced PDF viewer:

1. **Automatic Fallback**: The app will automatically fall back to text-only view
2. **Text Mode**: Use the "PDF View" button to switch to text-only mode
3. **Download Option**: PDF download functionality remains available
4. **AI Chat**: Works with any view mode for document analysis
5. **Detailed Guide**: See [PDF_TROUBLESHOOTING.md](./PDF_TROUBLESHOOTING.md) for comprehensive solutions

**Quick Solutions:**
- Switch to text mode for better performance
- Download PDF to view in your browser
- Clear browser cache and refresh
- Try a different browser

#### Development Server Issues
If the development server fails to start:
1. Make sure all dependencies are installed: `npm install`
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check for port conflicts (default port is 3000)

### PWA Configuration

The app is configured as a Progressive Web App. Icons and manifest are defined in `vite.config.ts`.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details