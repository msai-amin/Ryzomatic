# AI Research Platform (ryzomatic)

An intelligent academic reading platform that transforms how researchers manage, read, and analyze documents. Built with React, TypeScript, and modern web technologies, AI Research Platform combines AI-powered insights, natural text-to-speech, and advanced document management to create a comprehensive research workflow solution.

## 🌟 Key Features

### 📚 Document Management
- **Multi-format Support**: Upload and process PDF and text documents
- **Intelligent Text Extraction**: Automatic content extraction from PDFs using PDF.js with OCR fallback
- **Library Organization**: 
  - Collections and folders for organizing documents
  - Tags and metadata for easy categorization
  - Advanced search with full-text indexing
  - Filter by type, date, tags, and more
- **Cloud Storage**: Secure document storage with Supabase and AWS S3
- **Document Relationships**: AI-powered automatic graph generation showing connections between documents

### 📖 Advanced PDF Viewer
- **Professional Viewing**: Zoom, rotation, page navigation, and text extraction
- **Multiple View Modes**: 
  - Text-only mode for distraction-free reading
  - PDF view with full rendering
  - Split view combining both
  - Reading mode with optimized typography
- **Scroll Modes**: Single page or continuous scroll viewing
- **Page Navigation**: Quick jump to any page, keyboard shortcuts
- **Text Selection**: Select and interact with text for highlighting, notes, and AI queries

### 🎧 Text-to-Speech (TTS)
- **Multiple Providers**: 
  - Azure Cognitive Services (premium voices)
  - Google Cloud TTS
  - Native browser TTS (fallback)
- **Natural Voice Reading**: High-quality voices with word-level highlighting
- **Customizable Settings**:
  - Adjustable speed (0.5x - 2x)
  - Pitch and volume control
  - Voice selection (gender, language, style)
- **Reading Modes**:
  - Read current page
  - Read from current page to end
  - Read selected text
- **Smart Text Cleanup**: Automatic removal of publication metadata for cleaner audio

### 🤖 AI-Powered Features

#### AI Chat Assistant
- **Context-Aware Conversations**: AI understands your current document and reading context
- **Multiple Chat Modes**:
  - **General Chat**: Ask questions about your documents
  - **Clarification Mode**: Get simplified explanations of complex text
  - **Further Reading**: Discover related topics and resources
- **Structured RAG**: Advanced retrieval-augmented generation with semantic search
- **Note Integration**: AI can reference your existing notes for better context
- **Multi-Model Support**: Uses Gemini (primary) and OpenAI GPT-4o-mini (fallback)

#### Paper Recommendations
- **OpenAlex Integration**: Discover relevant academic papers based on your documents
- **Intelligent Recommendations**:
  - **Related Works**: Papers connected in the citation graph
  - **Cited By**: Papers that cite your current document
  - **Content-Based**: For drafts without DOIs, uses Gemini AI to extract search queries
- **Hybrid Ranking**: Multi-factor scoring combining:
  - Citation graph similarity
  - Citation count
  - Recency
  - Topic overlap
  - Open access availability
  - Venue quality
- **Smart Filtering**: Filter by year, citations, open access status
- **User Feedback**: Mark papers as relevant/not relevant to improve recommendations
- **Persistent Caching**: Recommendations saved locally and in database

#### Document Relationship Graph
- **Automatic Mapping**: AI analyzes semantic relationships between documents
- **Visual Graph**: Interactive network visualization of document connections
- **Relationship Explanations**: AI-generated summaries explaining how documents relate
- **Smart Discovery**: Find related documents you might have missed

### ✍️ Annotation & Notes

#### Highlighting System
- **Multi-Color Highlights**: Choose from multiple color options
- **Smart Highlighting**: Highlights that connect related ideas across your library
- **Highlight Management**: 
  - View all highlights in a document
  - Filter by color
  - Search highlights
  - Export highlights
- **Context Preservation**: Highlights include surrounding text context

#### Notes System
- **Contextual Notes**: Create notes linked to specific document sections
- **AI-Enhanced Notes**: Save AI responses as notes with one click
- **Note Organization**: 
  - Notes linked to pages and documents
  - Searchable note content
  - Notes can reference document context
- **Rich Formatting**: Notes support markdown and emoji formatting

### ⏱️ Productivity Tools

#### Pomodoro Timer
- **Focus Sessions**: 25-minute focus blocks with breaks
- **Gamification**: 
  - Achievement system
  - Streaks and milestones
  - Productivity stats
- **Session Tracking**: Monitor your reading and study time
- **Flexible Timer**: Customizable session and break durations

### 🎨 Customization

#### Typography Settings
- **Font Options**: Serif, Sans Serif, and Monospace fonts
- **Size Control**: Adjustable font size (12px - 24px)
- **Line Height**: Customizable line spacing (1.2 - 2.5)
- **Max Width**: Control reading width (400px - 1200px)
- **Themes**: 
  - Light mode
  - Dark mode
  - Sepia mode
  - Reading mode (optimized for focus)
- **Text Alignment**: Left, center, or justified
- **Focus Mode**: Dim surrounding content for better focus
- **Reading Guide**: Visual guide to help track reading position

### 🔍 Search & Discovery
- **Full-Text Search**: Search across all document content
- **Library Search**: Find documents by title, tags, or content
- **Semantic Search**: AI-powered semantic document search
- **Filter Options**: Multiple filter criteria for refined results

### 🔐 Security & Privacy
- **Authentication**: Secure authentication with Supabase Auth
- **Row-Level Security**: Database-level security policies
- **Encrypted Storage**: Secure document storage
- **Privacy-First**: Your documents and data remain private

### 📱 Progressive Web App
- **Installable**: Install as a native app on any device
- **Offline Support**: Access cached documents offline
- **Responsive Design**: Beautiful UI that works on desktop, tablet, and mobile

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Headless UI
- **State Management**: Zustand
- **PDF Processing**: PDF.js + react-pdf

### Backend
- **Database**: Supabase (PostgreSQL with pgvector)
- **Storage**: AWS S3 + Supabase Storage
- **Serverless Functions**: Vercel Serverless Functions
- **Authentication**: Supabase Auth

### AI & Services
- **AI Models**: 
  - Google Gemini 2.5 Flash (primary)
  - OpenAI GPT-4o-mini (fallback)
- **TTS Providers**:
  - Azure Cognitive Services
  - Google Cloud TTS
  - Native Browser TTS
- **External APIs**:
  - OpenAlex (paper recommendations)
  - Google Drive (optional integration)

### Development Tools
- **Testing**: Vitest + Playwright
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **CI/CD**: GitHub Actions

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (for database and auth)
- AWS account (for S3 storage, optional)
- AI API keys (Gemini and/or OpenAI)

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd Ryzomatic
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your configuration:
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services (at least one required)
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_OPENAI_API_KEY=your_openai_api_key

# TTS (optional)
AZURE_TTS_KEY=your_azure_key
AZURE_TTS_REGION=your_azure_region
GOOGLE_CLOUD_TTS_KEY=your_google_key

# AWS S3 (optional, for file storage)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=your_bucket_name
AWS_REGION=us-east-1
```

4. **Set up Supabase**:
   - Create a new Supabase project
   - Run migrations from `supabase/migrations/` directory
   - Configure Row-Level Security policies

5. **Start development server**:
```bash
# For local development with Vercel functions
vercel dev --listen 3001

# Or use Vite dev server (frontend only)
npm run dev
```

6. **Open your browser**:
Navigate to `http://localhost:3001`

### Get API Keys

- **Gemini**: https://makersuite.google.com/app/apikey (Free tier available)
- **OpenAI**: https://platform.openai.com/api-keys
- **Supabase**: https://supabase.com (Free tier available)
- **Azure TTS**: https://azure.microsoft.com/services/cognitive-services/text-to-speech/
- **Google Cloud TTS**: https://cloud.google.com/text-to-speech

## 📖 Usage Guide

### Uploading Documents

1. Click the "Upload" button in the header
2. Drag and drop files or click to browse
3. Supported formats: `.pdf`, `.txt`
4. Documents are automatically processed and indexed

### Using AI Chat

1. Open a document
2. Click the "AI Chat" button to open the chat panel
3. Ask questions about the document
4. Use context menu (right-click on selected text) for:
   - **Ask for Clarification**: Get simplified explanations
   - **Get Further Reading**: Discover related topics
   - **Save as Note**: Save selected text as a note

### Getting Paper Recommendations

1. Open a document (preferably with DOI or OpenAlex ID)
2. Expand "Paper Recommendations" in the sidebar
3. Click "Get Recommendations" to fetch relevant papers
4. Filter by year, citations, or open access status
5. Switch between "Related Works" and "Cited By"
6. Mark papers as relevant to improve future recommendations

### Using Text-to-Speech

1. Open a PDF document
2. Click the speaker icon (🔊) in the toolbar
3. Adjust settings (voice, speed, pitch) via the settings icon
4. Click play to start reading
5. Choose reading mode:
   - Read current page
   - Read from here to end
   - Read selected text

### Creating Highlights

1. Select text in a PDF or text document
2. Choose a highlight color
3. Highlights are automatically saved
4. View all highlights in the Highlights panel
5. Search and filter highlights

### Taking Notes

1. Select text and right-click
2. Choose "Save as Note"
3. Or create notes directly from the Notes panel
4. Notes are linked to document pages
5. AI can reference your notes in conversations

### Using Pomodoro Timer

1. Click the Pomodoro button in the header
2. Set your focus duration (default: 25 minutes)
3. Click "Start" to begin a session
4. Track your productivity and achievements
5. View stats in the Pomodoro dashboard

### Customizing Reading Experience

1. Click the Typography Settings button (⚙️) in the header
2. Adjust:
   - Font family, size, and line height
   - Max reading width
   - Theme (light, dark, sepia, reading)
   - Text alignment
   - Focus mode and reading guide

## 📁 Project Structure

```
AI Research Platform-serverless/
├── src/
│   ├── components/          # React components
│   │   ├── PaperRecommendationsPanel.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── PDFViewerV2.tsx
│   │   ├── AudioWidget.tsx
│   │   ├── PomodoroTimer.tsx
│   │   └── ...
│   ├── services/            # Business logic
│   │   ├── aiService.ts
│   │   ├── openAlexRecommendationService.ts
│   │   ├── highlightService.ts
│   │   ├── ttsManager.ts
│   │   └── ...
│   ├── store/               # State management
│   │   └── appStore.ts
│   └── themes/              # Themed components
│       ├── ThemedApp.tsx
│       ├── ThemedSidebar.tsx
│       └── ...
├── api/                     # Serverless functions
│   ├── recommendations/
│   ├── documents/
│   ├── text/
│   └── ...
├── supabase/
│   └── migrations/          # Database migrations
├── docs/                    # Documentation
│   ├── features/
│   ├── guides/
│   └── architecture/
└── tests/                   # Test files
    └── e2e/
```

## 🔧 Configuration

### AI Integration

The app supports multiple AI providers with automatic fallback:
- **Primary**: Google Gemini (faster, more cost-effective)
- **Fallback**: OpenAI GPT-4o-mini (when Gemini unavailable)

Configure in `.env.local`:
```env
VITE_GEMINI_API_KEY=your_key
VITE_OPENAI_API_KEY=your_key
```

### TTS Configuration

Multiple TTS providers supported:
- **Azure TTS**: Premium voices, best quality
- **Google Cloud TTS**: Good quality, reasonable pricing
- **Native Browser TTS**: Free fallback

### Database Setup

1. Create Supabase project
2. Run migrations in order:
   ```bash
   # Apply all migrations
   supabase db push
   ```
3. Configure RLS policies
4. Set up storage buckets

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

### Test Coverage

```bash
npm run test:coverage
```

## 🚢 Building for Production

```bash
# Build
npm run build

# Preview production build
npm run preview
```

The built files will be in the `dist` directory.

## 📚 Documentation

- [UI Documentation](./docs/guides/UI_DOCUMENTATION.md) - Complete UI component guide
- [Paper Recommendations](./docs/features/paper-recommendations/IMPLEMENTATION.md) - Paper recommendation system
- [AI Features](./docs/features/ai/AI_FEATURES_QUICK_START.md) - AI chat and notes
- [Database Schema](./docs/architecture/DATABASE_SCHEMA.md) - Database structure
- [Deployment Guide](./docs/deployment/DEPLOYMENT.md) - Production deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow the existing code style
- Ensure all tests pass before submitting PR

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

## 🙏 Acknowledgments

- **OpenAlex** for paper recommendation data
- **PDF.js** for PDF rendering
- **Supabase** for backend infrastructure
- **Vercel** for serverless hosting
- **Google Gemini** and **OpenAI** for AI capabilities

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for researchers and academics**
