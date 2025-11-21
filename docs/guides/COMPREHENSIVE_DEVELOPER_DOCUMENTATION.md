

---

## 12. Notes System

### 12.1 Overview

The notes system provides structured note-taking with multiple templates and AI-assisted generation.

### 12.2 Note Types

**Cornell Notes**:
```
┌───────────────────────────────────────┐
│ Cue Column    │ Notes Area            │
├───────────────┼───────────────────────┤
│ Keywords      │ Main ideas            │
│ Questions     │ Details and examples  │
│ Concepts      │                       │
├───────────────┴───────────────────────┤
│ Summary: Key points summary here     │
└───────────────────────────────────────┘
```

**Outline Notes**:
```markdown
I. Main Topic
   A. Subtopic 1
      1. Detail a
      2. Detail b
   B. Subtopic 2
II. Another Topic
```

**Mind Map Notes**:
```markdown
Central Topic
├── Branch 1
│   ├── Sub-branch 1.1
│   └── Sub-branch 1.2
├── Branch 2
└── Branch 3
```

**Chart Notes**:
```
Category 1  | Category 2  | Category 3
────────────┼─────────────┼─────────
Detail 1.1  | Detail 2.1  | Detail 3.1
Detail 1.2  | Detail 2.2  | Detail 3.2
```

**Boxing Notes**:
```markdown
┌─────────────────────┐
│ Concept 1           │
│ - Key point 1       │
│ - Key point 2       │
└─────────────────────┘

┌─────────────────────┐
│ Concept 2           │
│ - Key point 1       │
└─────────────────────┘
```

**Freeform**: Unstructured notes

### 12.3 AI Note Generation

**Process**:
1. User selects note template
2. AI analyzes document using SQ3R framework
3. Generates structured notes in selected format
4. User can edit before saving

**SQ3R Framework Integration**:
- **Survey**: Overview of document structure
- **Question**: Generate key questions
- **Read**: Extract main ideas
- **Recite**: Summarize key points
- **Review**: Verify comprehension

### 12.4 Database Schema

```sql
CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT CHECK (note_type IN ('cornell', 'outline', 'mindmap', 'chart', 'boxing', 'freeform')),
  is_ai_generated BOOLEAN DEFAULT FALSE,
  position JSONB, -- { x, y } for sticky note positioning
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 12.5 Components

**NotesPanel.tsx**: Main notes interface
- Display notes for current document
- Create/edit/delete notes
- Filter by note type
- Search notes

**AIAssistedNotes.tsx**: AI note generation UI
- Template selector
- Goal input
- Generation progress
- Preview and edit

**NoteTemplateSelector.tsx**: Template selection
- Visual template previews
- Template descriptions
- Use cases

### 12.6 RAG Integration

Notes can be indexed as memories (opt-in feature):

```typescript
// When user creates/updates a note
if (includeNotesInRAG) {
  await memoryService.extractAndStoreNotes({
    userId,
    noteId: note.id,
    documentId: bookId,
    pageNumber: note.pageNumber,
    content: note.content,
    noteType: note.note_type
  });
}
```

Benefits:
- AI can reference user's notes in responses
- Cross-document note search
- Better context understanding

---

## 13. Pomodoro Timer & Gamification

### 13.1 Pomodoro Technique

**Standard Intervals**:
- Work: 25 minutes
- Short Break: 5 minutes
- Long Break: 15 minutes (after 4 work sessions)

### 13.2 Session Tracking

```sql
CREATE TABLE pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('work', 'shortBreak', 'longBreak')),
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE
);
```

**Tracking Features**:
- Per-document time tracking
- Total Pomodoro sessions count
- Completion rate
- Longest session streak
- Most active hours

### 13.3 Achievement System

**Achievement Types**:
1. **First Steps**: Complete 1 session
2. **Consistent Reader**: 3+ sessions in one day
3. **Marathon**: 10+ sessions on one document
4. **Streak Master**: 7-day consecutive streak
5. **Early Bird**: Sessions before 8 AM
6. **Night Owl**: Sessions after 10 PM
7. **Focus Champion**: Multiple 4-cycle rounds
8. **Speed Reader**: 50+ total sessions
9. **Century Club**: 100+ total sessions

### 13.4 Streak System

```sql
CREATE TABLE pomodoro_streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_session_date DATE,
  weekly_goal INT DEFAULT 15,
  weekly_progress INT DEFAULT 0
);
```

**Streak Logic**:
- Increments on consecutive days
- Resets if gap of 1+ day
- Tracks both current and longest streak

### 13.5 Gamification Features

**Points System**: (Future implementation)
- 10 points per completed session
- 50 points for achievements
- 25 points for streaks

**Leaderboard**: (Future implementation)
- Weekly/monthly leaderboards
- Community challenges

**Badges**: Visual achievement display
- Toast notifications on unlock
- Achievement panel for viewing all badges

### 13.6 Components

**PomodoroTimer.tsx**: Main timer interface
- Countdown display
- Play/pause/reset controls
- Break timer
- Session tracking

**AchievementPanel.tsx**: Achievement display
- List all achievements
- Progress indicators
- Unlock dates

**AchievementToast.tsx**: Unlock notifications
- Animated toast on achievement unlock
- Achievement icon and name
- Brief description

---

## 14. Library Organization

### 14.1 Collections

**Hierarchical Structure**:
```
Collections
├── Research Papers
│   ├── AI & Machine Learning
│   └── Data Science
├── Textbooks
└── Personal Notes
```

**Features**:
- Nested collections (parent/child)
- Custom colors and icons
- Display order customization
- Book count per collection

### 14.2 Tags

**Features**:
- Tag books with multiple tags
- Tag colors for visual organization
- Tag categories (future)
- Usage tracking (most used tags)

**Database Schema**:
```sql
-- Tags
CREATE TABLE book_tags (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  category TEXT DEFAULT 'general',
  usage_count INTEGER DEFAULT 0,
  UNIQUE(user_id, name)
);

-- Tag assignments
CREATE TABLE book_tag_assignments (
  book_id UUID REFERENCES user_books(id),
  tag_id UUID REFERENCES book_tags(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (book_id, tag_id)
);
```

### 14.3 Advanced Search

**Filter Options**:
- File type (PDF, text, all)
- Collections
- Tags
- Favorites only
- Has notes
- Has highlights
- Has Pomodoro sessions
- Reading progress range
- File size range
- Date range

**Search Features**:
- Full-text search on titles and filenames
- Multi-faceted filtering
- Sort by: name, date, progress, size, reading time
- Pagination support

### 14.4 Caching

Search results cached for performance:
```typescript
// 5-minute cache expiry
const cache = new Map<string, { data: any, timestamp: number }>();

async searchBooks(filters, sort, limit, offset) {
  const cacheKey = JSON.stringify({ filters, sort, limit, offset });
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 300000) { // 5 min
      return cached.data;
    }
  }
  
  // Perform search...
  const results = await performSearch(...);
  cache.set(cacheKey, { data: results, timestamp: Date.now() });
  return results;
}
```

---

## 15. Theme System

### 15.1 Architecture

**CSS Custom Properties** + React Context

### 15.2 Theme Configuration

```typescript
interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
    };
    // ... more colors
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontFamily: {
      sans: string;
      serif: string;
      mono: string;
    };
    fontSize: {
      sm: string;
      base: string;
      lg: string;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}
```

### 15.3 CSS Custom Properties

Theme values applied as CSS variables:

```css
:root {
  --color-primary: #2563eb;
  --color-secondary: #059669;
  --color-background: #f9fafb;
  --color-surface: #ffffff;
  --spacing-md: 1rem;
  --font-size-base: 1rem;
  /* ... more variables */
}
```

Components use variables:
```css
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
}
```

### 15.4 Annotation Colors

8 customizable highlighting colors:

```typescript
const defaultAnnotationColors: AnnotationColor[] = [
  {
    id: 'yellow',
    name: 'Interesting',
    hex: '#FFD700',
    description: 'Points of interest'
  },
  {
    id: 'teal',
    name: 'Key Concepts',
    hex: '#4ECDC4',
    description: 'Important concepts'
  },
  {
    id: 'red',
    name: 'Critique',
    hex: '#FF6B6B',
    description: 'Critical points'
  },
  {
    id: 'blue',
    name: 'Questions',
    hex: '#45B7D1',
    description: 'Questions to explore'
  },
  {
    id: 'green',
    name: 'Evidence',
    hex: '#96CEB4',
    description: 'Supporting evidence'
  },
  // ... 3 more colors
];
```

### 15.5 Dark Mode

Theme supports dark mode variants:

```css
.dark {
  --color-background: #1a1a1a;
  --color-surface: #2d2d2d;
  --color-text-primary: #ffffff;
  /* ... dark mode colors */
}
```

**Auto-detection**:
```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  setIsDarkMode(mediaQuery.matches);
  
  mediaQuery.addEventListener('change', (e) => {
    setIsDarkMode(e.matches);
  });
}, []);
```

### 15.6 Theme Persistence

Saved to localStorage:

```typescript
useEffect(() => {
  const saved = localStorage.getItem('academic-reader-theme');
  if (saved) {
    setCurrentTheme(JSON.parse(saved));
  }
}, []);

useEffect(() => {
  localStorage.setItem('academic-reader-theme', JSON.stringify(currentTheme));
}, [currentTheme]);
```

---

## 16. Storage Architecture

### 16.1 Primary Storage: Supabase Storage

**Advantages**:
- Integrated with Supabase auth
- Built-in access control
- CDN delivery
- Automatic backups

**Storage Structure**:
```
{userId}/
  ├── books/
  │   ├── {bookId}.pdf
  │   ├── {bookId}.txt
  │   └── thumbnails/
  └── avatars/
      └── {userId}.jpg
```

### 16.2 Fallback Storage: AWS S3

**When Used**:
- Supabase Storage unavailable
- Large file handling
- High-traffic scenarios

**Configuration**:
```typescript
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
```

### 16.3 File Access Control

**Presigned URLs**:
```typescript
// Generate presigned URL (expires in 1 hour)
const command = new GetObjectCommand({
  Bucket: bucket,
  Key: key
});

const presignedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 3600
});
```

**RLS on Storage**:
```sql
-- Users can only access their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'books' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 16.4 File Size Limits

| Tier | Max File Size | Max Documents |
|------|---------------|---------------|
| Free | 10 MB | 10 |
| Pro | 50 MB | 100 |
| Premium | 100 MB | 1,000 |
| Enterprise | 500 MB | Unlimited |

---

## 17. API Architecture

### 17.1 Vercel Serverless Functions

**Structure**:
```
api/
├── books/
│   ├── access.ts        # Get book data
│   └── storage.ts       # Upload/delete books
├── chat/
│   └── stream.ts        # Streaming AI responses
├── documents/
│   ├── upload.ts        # Document upload
│   ├── ocr.ts          # OCR processing
│   └── relationships.ts # Document relationships
├── highlights/
│   └── index.ts         # CRUD operations
├── memory/
│   └── index.ts         # Memory extraction/query
└── pomodoro/
    └── index.ts         # Timer & gamification
```

### 17.2 Request Flow

```
Client Request
     ↓
Vercel Function Handler
     ↓
Authentication Check (Bearer token)
     ↓
User Verification (Supabase)
     ↓
Business Logic
     ↓
Database/External API Calls
     ↓
Response to Client
```

### 17.3 Authentication Pattern

Every API endpoint follows this pattern:

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Extract token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Verify user
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 3. Handle request
  try {
    // Business logic here
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

### 17.4 CORS Configuration

```typescript
res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
res.setHeader(
  'Access-Control-Allow-Headers',
  'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
);
```

### 17.5 Error Handling

**Consistent Error Responses**:
```typescript
{
  error: 'Error message',
  details?: 'Additional error details',
  code?: 'ERROR_CODE'
}
```

**HTTP Status Codes**:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## 18. Error Handling & Monitoring

### 18.1 Centralized Error Handler

**File**: `src/services/errorHandler.ts`

```typescript
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const errorHandler = {
  createError: (message: string, type: ErrorType, severity: ErrorSeverity, context: any) => {
    // Log error
    logger.error(message, context, { type, severity });
    
    // Notify user if needed
    if (severity >= ErrorSeverity.HIGH) {
      showNotification(message);
    }
    
    return { message, type, severity, context };
  }
};
```

### 18.2 Logging System

**File**: `src/services/logger.ts`

```typescript
export const logger = {
  info: (message: string, context: any, metadata?: any) => {
    console.log('[INFO]', message, { context, metadata, timestamp: new Date() });
  },
  
  error: (message: string, context: any, error?: Error, metadata?: any) => {
    console.error('[ERROR]', message, { context, error, metadata, timestamp: new Date() });
    // Send to error tracking service (Sentry, etc.)
  },
  
  warn: (message: string, context: any, metadata?: any) => {
    console.warn('[WARN]', message, { context, metadata, timestamp: new Date() });
  }
};
```

### 18.3 Health Monitor

**File**: `src/services/healthMonitor.ts`

Monitors system health:

```typescript
class HealthMonitor {
  private checks: HealthCheck[] = [];
  
  addCheck(check: HealthCheck) {
    this.checks.push(check);
  }
  
  async runChecks() {
    for (const check of this.checks) {
      const result = await check.run();
      if (result.status === 'unhealthy') {
        this.reportAlert(result);
      }
    }
  }
  
  private reportAlert(result: HealthCheckResult) {
    logger.error(`Health check failed: ${result.name}`, result);
    // Notify team if critical
  }
}
```

**Health Checks**:
- Database connectivity
- External API availability
- Storage accessibility
- Memory usage
- Error rate

### 18.4 Performance Tracking

```typescript
export function trackPerformance(name: string, fn: () => Promise<any>) {
  return async () => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      logger.info(`Performance: ${name}`, { duration, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`Performance: ${name}`, { duration, success: false }, error);
      throw error;
    }
  };
}
```

---

## 19. Build & Deployment

### 19.1 Build Configuration

**Vite Config** (`vite.config.ts`):

```typescript
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'] }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'pdf-vendor': ['pdfjs-dist'],
          'ui-vendor': ['lucide-react', 'clsx'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ai-vendor': ['@google/generative-ai', 'openai'],
          'aws-vendor': ['@aws-sdk/client-s3'],
        }
      }
    }
  }
});
```

### 19.2 Bundle Optimization

**Manual Chunking**: Reduces initial bundle size
- React vendor: ~150KB
- PDF vendor: ~200KB
- UI vendor: ~50KB
- Total initial load: ~400KB (vs ~2MB without splitting)

**Code Splitting**: Lazy load heavy components
```typescript
const PDFViewer = lazy(() => import('./components/PDFViewer'));
const ChatModal = lazy(() => import('./components/ChatModal'));
```

### 19.3 Environment Variables

**Required Variables**:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_OPENAI_API_KEY=xxx
VITE_GEMINI_API_KEY=xxx
VITE_GOOGLE_CLIENT_ID=xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
```

### 19.4 Deployment Pipeline

**Vercel Automatic Deployments**:

```
Git Push → GitHub
     ↓
Vercel detects change
     ↓
Build frontend (npm run build)
     ↓
Deploy to edge
     ↓
Run migrations (if needed)
     ↓
Deployment complete
```

**Deployment Commands**:
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build locally
npm run preview
```

### 19.5 Database Migrations

**Run Migrations**:
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard SQL Editor
```

**Migration Order**: Migrations are numbered and must run sequentially:
- 001_initial_schema.sql
- 002_add_profile_insert_policy.sql
- 003_add_user_books_table.sql
- ... (through 021_structured_rag_memory.sql)

---

## 20. Design Patterns

### 20.1 Service Layer Pattern

Business logic separated from UI:

```typescript
// Service handles business logic
class HighlightService {
  async createHighlight(data: CreateHighlightData) {
    // Validation
    // API call
    // Error handling
    // Return result
  }
}

// Component uses service
function HighlightButton() {
  const handleHighlight = async () => {
    await highlightService.createHighlight(data);
  };
}
```

### 20.2 Repository Pattern

Database access abstracted:

```typescript
// Repository abstracts database
class BookRepository {
  async getById(id: string) {
    return supabase.from('user_books').select('*').eq('id', id).single();
  }
}

// Service uses repository
class BookService {
  constructor(private repository: BookRepository) {}
  
  async getBook(id: string) {
    return this.repository.getById(id);
  }
}
```

### 20.3 Factory Pattern

TTS provider factory:

```typescript
class TTSProviderFactory {
  static create(type: 'native' | 'google-cloud') {
    switch (type) {
      case 'native':
        return new NativeTTSProvider();
      case 'google-cloud':
        return new GoogleCloudTTSProvider();
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}
```

### 20.4 Strategy Pattern

PDF extraction fallback strategy:

```typescript
class ExtractionStrategy {
  async extract(pdf: File): Promise<ExtractionResult> {
    // Try strategy 1
    try {
      return await this.tier1Extract(pdf);
    } catch (error) {
      // Fall back to strategy 2
      return await this.tier2Extract(pdf);
    }
  }
}
```

### 20.5 Observer Pattern

Auth state changes:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // Notify all listeners
  authListeners.forEach(listener => listener(event, session));
});
```

### 20.6 Singleton Pattern

Service singletons:

```typescript
// Single instance shared across app
export const ttsManager = new TTSManager();
export const highlightService = new HighlightService();
export const aiService = new AIService();
```

---

## 21. Performance Optimizations

### 21.1 Bundle Size Optimizations

**Tree Shaking**: Remove unused code
```typescript
// Vite automatically tree-shakes
import { specificFunction } from 'large-library';
```

**Dynamic Imports**: Code split by route/feature
```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

**Exclude from Bundle**: Move heavy libraries to exclude list
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: ['pdfjs-dist', 'googleapis']
}
```

### 21.2 Rendering Optimizations

**React.memo**: Prevent unnecessary re-renders
```typescript
export const ExpensiveComponent = React.memo(({ data }) => {
  // Only re-render if data changes
  return <div>{data}</div>;
});
```

**useMemo**: Memoize expensive calculations
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

**useCallback**: Memoize callbacks
```typescript
const handleClick = useCallback(() => {
  doSomething();
}, [dependencies]);
```

### 21.3 Database Optimizations

**Indexes**: Strategic indexes on frequently queried columns
```sql
CREATE INDEX idx_user_books_user_id ON user_books(user_id);
CREATE INDEX idx_user_highlights_book_page ON user_highlights(book_id, page_number);
```

**Denormalization**: Store computed values
```sql
-- Store count instead of calculating
ALTER TABLE user_books ADD COLUMN pomodoro_sessions_count INTEGER DEFAULT 0;

-- Update via trigger
CREATE TRIGGER update_pomodoro_count
AFTER INSERT ON pomodoro_sessions
FOR EACH ROW
EXECUTE FUNCTION increment_pomodoro_count();
```

**Query Optimization**: Use efficient queries
```typescript
// Good: Select only needed columns
await supabase.from('user_books').select('id, title').eq('user_id', userId);

// Avoid: Select all
await supabase.from('user_books').select('*').eq('user_id', userId);
```

### 21.4 Caching Strategies

**In-Memory Caching**:
```typescript
const cache = new Map();

async function getData(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = await fetchData(key);
  cache.set(key, data);
  return data;
}
```

**Browser Caching**: Use Cache-Control headers
```typescript
res.setHeader('Cache-Control', 'public, max-age=3600');
```

**Service Worker**: Cache static assets
```javascript
// Vite PWA plugin handles this automatically
```

### 21.5 Network Optimizations

**Debouncing**: Reduce API calls
```typescript
const debouncedSearch = debounce(async (query) => {
  await searchBooks(query);
}, 300);
```

**Request Batching**: Combine multiple requests
```typescript
// Instead of multiple requests
Promise.all([
  fetchUserData(),
  fetchUserBooks(),
  fetchUserNotes()
]);
```

**Lazy Loading**: Load data on demand
```typescript
// Load highlights only when needed
const loadHighlights = async () => {
  if (!highlightsLoaded) {
    setHighlights(await fetchHighlights(bookId));
  }
};
```

---

## 22. Security Measures

### 22.1 Authentication Security

**JWT Tokens**: Secure session management
- Short expiration times (1 hour)
- Auto-refresh before expiry
- Secure storage (httpOnly cookies if possible)

**OAuth Security**:
- State parameter for CSRF protection
- PKCE for OAuth flows
- Secure redirect URLs

### 22.2 Authorization

**Row Level Security (RLS)**:
```sql
-- Users can only access their own data
CREATE POLICY "Users can read own books" ON user_books
  FOR SELECT USING (auth.uid() = user_id);
```

**Tier-Based Access Control**:
```typescript
if (user.tier === 'free' && documentCount >= 10) {
  throw new Error('Document limit reached');
}
```

### 22.3 Input Validation

**Client-Side Validation**:
```typescript
import { z } from 'zod';

const highlightSchema = z.object({
  bookId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
  highlightedText: z.string().min(1).max(1000)
});

const result = highlightSchema.safeParse(data);
if (!result.success) {
  throw new Error('Invalid input');
}
```

**Server-Side Validation**:
```typescript
// Always validate on server
if (!bookId || !uuidRegex.test(bookId)) {
  return res.status(400).json({ error: 'Invalid book ID' });
}
```

### 22.4 SQL Injection Prevention

**Parameterized Queries**: Always use Supabase query builder
```typescript
// Safe
await supabase.from('books').select('*').eq('id', userId);

// Unsafe (never do this)
await supabase.rpc('get_books', { query: `SELECT * FROM books WHERE id = '${userId}'` });
```

### 22.5 XSS Protection

**React Built-in Sanitization**: React escapes content by default
```typescript
// Safe
<div>{userContent}</div>

// Dangerous (avoid)
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**CSP Headers**:
```json
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
}
```

### 22.6 Rate Limiting

**API Rate Limiting** (Future implementation):
```typescript
const rateLimiter = {
  requests: new Map(),
  
  check(userId: string, limit: number) {
    const count = this.requests.get(userId) || 0;
    if (count >= limit) {
      throw new Error('Rate limit exceeded');
    }
    this.requests.set(userId, count + 1);
  }
};
```

### 22.7 HTTPS & Secure Transport

**Enforce HTTPS**:
```typescript
// Vercel config
{
  "headers": [{
    "source": "/(.*)",
    "headers": [{
      "key": "Strict-Transport-Security",
      "value": "max-age=31536000; includeSubDomains"
    }]
  }]
}
```

### 22.8 Environment Variable Security

**Never Commit Secrets**:
```bash
# .gitignore
.env
.env.local
.env.production
```

**Use Vercel Environment Variables**: Store secrets in Vercel dashboard
- Access via `process.env.VARIABLE_NAME`
- Automatically injected at build time

---

## Appendix A: File Structure Reference

```
ryzomatic/
├── api/                          # Vercel serverless functions
│   ├── books/                    # Book storage APIs
│   ├── chat/                     # AI chat streaming
│   ├── documents/                # Document processing
│   ├── highlights/               # Highlight CRUD
│   ├── memory/                   # RAG memory system
│   └── pomodoro/                 # Timer & gamification
├── lib/                          # Backend services
│   ├── supabase.ts               # Supabase client
│   ├── memoryService.ts          # Memory operations
│   ├── contextBuilder.ts         # Context assembly
│   ├── embeddingService.ts       # Embeddings
│   └── gemini.ts                 # Gemini integration
├── src/
│   ├── components/               # React components
│   │   ├── ai/                   # AI components
│   │   ├── library/              # Library components
│   │   ├── onboarding/           # Onboarding
│   │   ├── ResearchNotes/        # Notes components
│   │   ├── AudioWidget.tsx       # TTS widget
│   │   ├── ChatModal.tsx         # Chat interface
│   │   ├── DocumentViewer.tsx    # Document display
│   │   ├── PDFViewer.tsx         # PDF rendering
│   │   └── ...                   # 40+ more components
│   ├── services/                 # Frontend services
│   │   ├── ai/                   # AI services
│   │   ├── aiService.ts          # Main AI service
│   │   ├── highlightService.ts   # Highlight management
│   │   ├── notesService.ts       # Note operations
│   │   ├── ttsManager.ts         # TTS coordinator
│   │   └── ...                   # 25+ more services
│   ├── store/
│   │   └── appStore.ts           # Zustand store
│   ├── utils/                    # Utilities
│   ├── hooks/                    # Custom hooks
│   ├── config/                   # Configuration
│   ├── themes/                   # Theme system
│   ├── App.tsx                   # Main app
│   └── main.tsx                  # Entry point
├── supabase/
│   └── migrations/               # 21 database migrations
├── themes/                       # Theme configurations
├── public/                       # Static assets
├── system-prompts-gemini25/      # AI prompts
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
├── vercel.json                   # Vercel config
└── tailwind.config.js            # Tailwind config
```

---

## Appendix B: Common Developer Tasks

### Adding a New Feature

1. **Create Database Migration** (if needed)
   ```bash
   # Create new migration file
   touch supabase/migrations/022_feature_name.sql
   ```

2. **Create Service** (if needed)
   ```typescript
   // src/services/myFeatureService.ts
   export class MyFeatureService {
     async doSomething() {
       // Implementation
     }
   }
   ```

3. **Create Component**
   ```typescript
   // src/components/MyFeatureComponent.tsx
   export const MyFeatureComponent = () => {
     // Component implementation
   };
   ```

4. **Add to Store** (if needed)
   ```typescript
   // In src/store/appStore.ts
   interface AppState {
     myFeature: MyFeatureState;
     setMyFeature: (data: MyFeatureData) => void;
   }
   ```

5. **Create API Endpoint** (if needed)
   ```typescript
   // api/myfeature/index.ts
   export default async function handler(req: VercelRequest, res: VercelResponse) {
     // Implementation
   }
   ```

### Debugging Tips

**Check Network Requests**:
1. Open DevTools → Network tab
2. Filter by type (XHR, Fetch)
3. Check request/response headers and body
4. Verify authentication token

**Check Database State**:
1. Open Supabase Dashboard
2. Navigate to Table Editor
3. Query tables directly
4. Check RLS policies

**Check State**:
1. Use Zustand DevTools extension
2. Inspect state in Redux DevTools
3. Add console.logs in store actions

**Check PDF Processing**:
1. Open PDF.js viewer in DevTools
2. Check for console errors
3. Verify worker loading
4. Check extraction results

---

## Appendix C: Troubleshooting

### Common Issues

**Issue**: "PDF not rendering"
- **Solution**: Check PDF.js worker URL, ensure worker file exists in public/

**Issue**: "Highlights not aligned"
- **Solution**: Check scale normalization, verify position calculation

**Issue**: "TTS not working"
- **Solution**: Check voice availability, verify provider initialization

**Issue**: "Memory context not working"
- **Solution**: Check user tier (Pro+ only), verify memory extraction ran

**Issue**: "OAuth redirect failing"
- **Solution**: Check redirect URLs in Supabase and Google Cloud Console

**Issue**: "Build errors"
- **Solution**: Clear node_modules, reinstall dependencies, check TypeScript errors

---

## Appendix D: Useful Resources

**Official Documentation**:
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)
- [Supabase Documentation](https://supabase.com/docs)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)

**AI Documentation**:
- [Google Gemini API](https://ai.google.dev/docs)
- [OpenAI API](https://platform.openai.com/docs)

**Community Resources**:
- [Stack Overflow](https://stackoverflow.com)
- [GitHub Issues](https://github.com)

---

**End of Documentation**
