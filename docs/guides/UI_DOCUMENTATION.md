# ryzomatic UI Documentation

## Table of Contents
1. [Application Overview](#application-overview)
2. [User Flow](#user-flow)
3. [UI Components Hierarchy](#ui-components-hierarchy)
4. [Detailed Component Descriptions](#detailed-component-descriptions)
5. [Navigation Patterns](#navigation-patterns)
6. [State Management & Data Flow](#state-management--data-flow)

---

## Application Overview

**ryzomatic** is an intelligent academic reading platform that helps researchers manage, read, and analyze documents. It features AI-assisted reading, text-to-speech, highlighting, notes, pomodoro tracking, and document relationships.

### Key Features
- **Document Management**: Upload PDF and text documents
- **AI Chat**: Contextual assistance for document understanding
- **TTS (Text-to-Speech)**: Natural voice reading with word-level highlighting
- **Highlighting & Annotation**: Multi-color highlighting with management tools
- **Pomodoro Tracking**: Focus sessions with gamification
- **Library Organization**: Collections, tags, search, and filtering
- **Related Documents**: AI-powered document relationship mapping
- **Notes Integration**: Contextual notes linked to document sections

---

## User Flow

### 1. Initial Entry Flow

```
┌─────────────────────────────────────────────────┐
│           Landing Page (Public)                  │
│  - Hero section with video                       │
│  - Features showcase                             │
│  - Use cases                                     │
│  - Pricing tiers                                 │
│  - "Get Started" / "Sign In" buttons            │
└────────────┬────────────────────────────────────┘
             │
             ├── [Not Authenticated] ──┐
             │                         │
             └── [Authenticated]       │
                                      │
        ┌─────────────────────────────┼─────────────┐
        │                             │             │
        ▼                             ▼             ▼
┌───────────────┐           ┌──────────────┐   ┌──────────┐
│  Auth Modal   │           │  Main App    │   │ NeoReader │
│  (Email/      │           │  (ThemedApp)│   │ Terminal  │
│   Google)     │           │              │   │ (hidden)  │
└───────────────┘           └──────────────┘   └──────────┘
```

### 2. Authentication Flow

**AuthModal** handles user authentication:
- **Email/Password**: Sign up with email confirmation, or sign in
- **Google OAuth**: Social authentication via Google
- **Password Strength**: Visual indicators for account creation
- **Error Handling**: User-friendly error messages

**Flow:**
1. User clicks "GET STARTED" or "Sign In" from landing page
2. URL parameter `?auth=true` triggers auth modal
3. User chooses authentication method
4. On success: modal closes, user redirected to main app
5. On OAuth callback: Supabase processes callback, user auto-logged in

### 3. Main Application Flow

```
┌──────────────────────────────────────────────────────┐
│                    ThemedApp                          │
│  ┌────────────────────────────────────────────────┐  │
│  │              ThemedHeader                       │  │
│  │  - Logo & Navigation                           │  │
│  │  - Upload Button                                │  │
│  │  - Library Button                               │  │
│  │  - AI Chat Button                               │  │
│  │  - Pomodoro Timer                               │  │
│  │  - User Profile & Logout                        │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │  ThemedSidebar│  │    ThemedMainContent          │ │
│  │               │  │                               │ │
│  │ - Recently    │  │   Document Viewer OR           │ │
│  │   Viewed      │  │   PDF Viewer                   │ │
│  │               │  │                               │ │
│  │ - Related     │  │   Or Empty State               │ │
│  │   Documents   │  │   (Upload prompt)              │ │
│  │               │  │                               │ │
│  │ - Productivity│  │                               │ │
│  │   Stats       │  │                               │ │
│  │               │  │                               │ │
│  │ - Recent      │  │                               │ │
│  │   Activity    │  │                               │ │
│  │               │  │                               │ │
│  │ - Achievements│  │                               │ │
│  └──────────────┘  └──────────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │     PomodoroBottomBar (when active)              │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

```

---

## UI Components Hierarchy

### Level 1: Root Container
```
App.tsx
├── Landing Page (if not authenticated & no OAuth callback)
├── Auth Modal (if not authenticated & auth=true param)
├── NeoReader Terminal (if neo=true param)
└── ThemedApp (main authenticated experience)
```

### Level 2: ThemedApp Structure
```
ThemedApp
├── ThemedHeader
│   ├── Logo & Title
│   ├── Document Upload Button
│   ├── Library Button
│   ├── AI Chat Button
│   ├── Pomodoro Timer
│   ├── User Profile
│   ├── Logout
│   └── Theme Switcher (dev mode)
├── ThemedSidebar (collapsible)
│   ├── Recently Viewed Section
│   ├── Related Documents Section
│   ├── Productivity Stats Section
│   ├── Recent Activity Section
│   └── Achievement Panel
└── ThemedMainContent
    └── DocumentViewer
```

### Level 3: Overlays & Modals (Conditional)
```
Various Modals & Panels:
├── LibraryModal
├── DocumentUpload
├── ChatPanel
├── NotesPanel
├── PomodoroTimer
├── TypographySettings
├── AIInsightsPanel
├── HighlightManagementPanel
├── AchievementToastContainer
├── OnboardingOverlay
└── ContextMenu (contextual)
```

---

## Detailed Component Descriptions

### 1. LandingPage
**Location:** `/src/components/LandingPage.tsx`

**Purpose:** Marketing/presentation page for public visitors

**Features:**
- Hero section with product video
- Feature cards (7 key features)
- Use cases (6 academic scenarios)
- Pricing tiers (Explorer, Scholar, Academic)
- Navigation bar with CTA buttons
- Footer with contact info

**User Interactions:**
- Click "Get Started" → Opens auth modal (`?auth=true`)
- Click "Sign In" → Opens auth modal
- If authenticated → Redirects to main app

**State:** Controlled by `showLandingPage` in App.tsx

---

### 2. AuthModal
**Location:** `/src/components/AuthModal.tsx`

**Purpose:** User authentication (sign up/sign in)

**Two Modes:**
- **Sign Up:** Email, password, full name, Google OAuth
- **Sign In:** Email, password, Google OAuth

**Features:**
- Form validation (password strength, email format)
- Visual password strength indicator
- Password visibility toggle
- Google OAuth button
- Error message display
- Success callbacks

**User Flow:**
1. Enter credentials
2. Submit → Auth attempt
3. On success → `onAuthSuccess()` → Redirect to app
4. On failure → Display error message

**Triggers:** 
- URL param `?auth=true`
- Header "Sign In" button
- Landing page "Get Started"

---

### 3. ThemedApp (Main Application)
**Location:** `/themes/ThemedApp.tsx`

**Purpose:** Main authenticated user experience

**Layout:**
```
┌─────────────────────────────────────────────┐
│          ThemedHeader (fixed top)           │
├──────────────┬──────────────────────────────┤
│ ThemedSidebar│ ThemedMainContent            │
│              │                               │
│              │                               │
└──────────────┴──────────────────────────────┘
```

**Key Features:**
- Theme-based styling (CSS variables)
- Onboarding system integration
- Background processing service
- Achievement toast system
- Keyboard shortcuts enabled

**Child Components:**
- `ThemedHeader`
- `ThemedSidebar`
- `ThemedMainContent`
- `ChatPanel` (conditional)
- `DocumentUpload` (conditional)
- `PomodoroBottomBar` (conditional)
- `AchievementToastContainer`
- `OnboardingOverlay`

---

### 4. ThemedHeader
**Location:** `/themes/ThemedHeader.tsx`

**Purpose:** Top navigation bar with primary actions

**Components:**
- Logo & branding
- Toggle sidebar button
- Document upload button
- Library button
- AI Chat button
- Pomodoro timer display/button
- User profile info
- Logout button

**Actions:**
- Click "Upload" → Opens `DocumentUpload` modal
- Click "Library" → Opens `LibraryModal`
- Click "AI Chat" → Toggles `ChatPanel`
- Click "Pomodoro" → Opens pomodoro controls
- Click user profile → Shows user info

**State:** Uses `useAppStore` for global state

---

### 5. ThemedSidebar
**Location:** `/themes/ThemedSidebar.tsx`

**Purpose:** Left-side navigation showing document context and stats

**Sections (all collapsible):**

#### a) Recently Viewed Section
- Shows last 8 viewed documents
- Each item displays:
  - Document name
  - Reading progress (%)
  - Estimated reading time
  - Pomodoro time spent (if applicable)
  - Active indicator if currently viewing
- Click document → Loads it in main content

#### b) Related Documents Section
- Shows AI-mapped related documents
- "Add Related" button
- Each relationship displays:
  - Source document name
  - Relationship type (summary, citation, etc.)
  - Relevance score (if calculated)
- Click relationship → Preview modal

#### c) Productivity Stats Section
- Streak display (current, best, weekly)
- Achievement count
- Document count
- Annotation count
- Link to full dashboard

#### d) Recent Activity Section
- Recent highlight creations
- Note additions
- Document completions
- Timestamp for each activity

#### e) Achievement Panel
- List of unlocked achievements
- Progress indicators
- Trophy display

**Interactions:**
- Click chevron → Expand/collapse section
- Click document → Load document
- Click stats → Open dashboard
- Toggle button → Hide/show sidebar

**State Management:**
- Recent documents from `recentlyViewedDocuments` store
- Related documents from `relatedDocuments` store
- Stats fetched from Supabase

---

### 6. ThemedMainContent
**Location:** `/themes/ThemedMainContent.tsx`

**Purpose:** Main content area displaying documents

**Child Components:**
- `DocumentViewer` (renders PDF or text documents)
- `EmptyState` (when no document loaded)

**Layout:** Flexible width with centering

---

### 7. DocumentViewer
**Location:** `/src/components/DocumentViewer.tsx`

**Purpose:** Document rendering with text selection and context menu

**Features:**
- Text or PDF rendering
- Typography customization (font, size, line-height, max-width, theme)
- Right-click context menu
- Text selection for AI chat
- Formula rendering support

**View Modes:**
- **Text View:** For `.txt` files
- **PDF View:** For PDF files (uses PDFViewer component)
- **Split View:** Text and PDF side-by-side

**Context Menu Actions:**
- "Ask for Clarification" → Opens AI chat in clarification mode
- "Suggest Further Reading" → Opens AI chat in further-reading mode
- "Save as Note" → Creates note from selection

**Text Selection Flow:**
1. User selects text
2. Context menu appears on right-click
3. User selects action
4. AI chat opens with context
5. Response tailored to selected mode

---

### 8. PDFViewer
**Location:** `/src/components/PDFViewer.tsx`

**Purpose:** Advanced PDF rendering with interactive features

**Key Features:**
- Page navigation (forward/back, jump to page)
- Zoom controls (+ / - / fit to width / actual size)
- Rotation
- Download PDF
- Scroll modes (single page / continuous)
- Reading mode (text-only with structured paragraphs)
- Text-to-speech integration
- Highlighting system
- Formula rendering
- OCR status badge
- Search functionality

**Toolbar Icons (Left to Right):**
- Previous page
- Next page
- Page indicator
- Zoom in
- Zoom out
- Rotate
- Settings menu (more options)
- Highlight tool
- Color palette
- Download
- Fullscreen toggle

**Settings Menu Includes:**
- View mode: Text / PDF / Split
- Scroll mode: Single / Continuous
- Show page numbers toggle
- Show progress toggle
- Reading mode toggle
- Highlight management
- Font settings
- TTS settings
- OCR consent

**Highlighting Features:**
- Click & drag to create highlight
- Color picker popover
- Save highlight to database
- Visual highlighting on pages
- Highlight management panel
- Jump to highlight location

**TTS Integration:**
- Play button starts reading
- Word-level highlighting as reading progresses
- Paragraph-level navigation
- Speed, pitch, volume controls
- Progress tracking

**Responsive Design:**
- Adapts to viewport size
- Touch gestures for mobile
- Zoom constraints for usability

---

### 9. ChatPanel
**Location:** `/src/components/ChatPanel.tsx`

**Purpose:** AI assistant for document queries

**Features:**
- Sliding panel from right side
- Three chat modes:
  - **General:** Standard Q&A
  - **Clarification:** Explain selected text
  - **Further Reading:** Suggest related materials
- Include notes toggle
- Expand/collapse width
- Minimize to sidebar icon
- Message history
- Auto-scroll to latest message
- Save AI responses as notes
- Thinking indicators

**Header:**
- Mode indicator icon
- Document name context
- Include notes toggle button
- Expand/minimize buttons
- Close button

**Messages:**
- User messages (right-aligned, blue)
- AI messages (left-aligned, grey)
- Typing indicator
- Message timestamps
- Save as note button (on hover)

**Input:**
- Text input field
- Send button
- Enter key support
- Placeholder context-aware

**User Interactions:**
- Type question → Send → Receive AI response
- Select text → Right-click → "Clarify" → AI explains
- Select text → Right-click → "Further Reading" → AI suggests papers
- Hover message → "Save Note" → Saves to document notes

**State:** Uses `chatMessages`, `isTyping`, `currentDocument` from store

---

### 10. LibraryModal
**Location:** `/src/components/ModernLibraryModal.tsx`

**Purpose:** Document library management with advanced filtering

**Features:**
- Full-screen modal overlay
- Search bar
- Collection tree (left sidebar)
- Tag filters
- View modes: Grid / List / Comfortable
- Sort options: Title, Date, Progress, Size, etc.
- Bulk selection mode
- Document preview on hover
- Reading progress indicators

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Search Bar + Filter Toggles                     │
├──────────┬──────────────────────────────────────┤
│          │                                       │
│Collection│    Document Grid/List                 │
│ Tree     │    - Book cards with metadata         │
│          │    - Progress bars                    │
│          │    - Quick actions                    │
│          │                                       │
│          │    [Load More] or Pagination          │
│          │                                       │
└──────────┴──────────────────────────────────────┘
```

**Search & Filters:**
- Full-text search
- File type filter (PDF, TXT, All)
- Collection filter
- Tag filter
- Date range filter
- Progress range filter
- Reading status filters

**Document Actions:**
- Click → Open document
- Hover → Show preview
- Bulk select → Delete, Move, Tag, etc.
- Long-press (mobile) → Context menu

**Collections & Tags:**
- Create/delete collections
- Add/remove tags
- Drag-and-drop organization
- Nested collections

**State:** Uses `libraryView` settings from store

---

### 11. DocumentUpload
**Location:** `/src/components/DocumentUpload.tsx`

**Purpose:** Upload and process new documents

**Features:**
- Drag-and-drop interface
- Click to browse files
- File type validation (.pdf, .txt)
- Progress indicator
- Multiple file upload
- Auto-extract text from PDFs
- OCR for scanned PDFs (optional)
- Upload to Supabase Storage

**Flow:**
1. User selects file(s)
2. System validates file type
3. Shows upload progress
4. Extracts text content
5. Saves to Supabase (database + storage)
6. Adds to library
7. Opens document in viewer

**OCR Integration:**
- Detects if PDF is scanned
- Prompts user for OCR consent
- Uses Vision API for text extraction
- Shows processing status
- Updates document with extracted text

---

### 12. NotesPanel
**Location:** `/src/components/NotesPanel.tsx`

**Purpose:** Manage notes linked to documents

**Features:**
- Slide-out panel from right
- Notes list with timestamps
- Create/edit/delete notes
- Filter notes by page
- Search notes
- Auto-save functionality
- Unsaved changes indicator
- Export notes (Markdown, HTML, JSON, TXT)
- Google Drive sync (optional)

**Layout:**
```
┌────────────────────────────────────┐
│ Notes for: DocumentName            │
├────────────────────────────────────┤
│ [Filter: All] [Search] [+ New]     │
├────────────────────────────────────┤
│ Note 1                              │
│  - Page 5                          │
│  - Created: 2h ago                 │
│  - [Edit] [Delete]                  │
├────────────────────────────────────┤
│ Note 2                              │
│  ...                                │
└────────────────────────────────────┘
```

**Auto-save:**
- Saves after 2 seconds of inactivity
- Shows "Saving..." indicator
- Blocks closing if unsaved

**Keyboard Shortcuts:**
- `Ctrl/Cmd+N`: New note
- `Esc`: Close panel

**Integration:**
- AI chat can save responses as notes
- Links to text selections
- Page-specific notes

---

### 13. PomodoroTimer
**Location:** `/src/components/PomodoroTimer.tsx`

**Purpose:** Focus timer with gamification

**Features:**
- Work/Break cycles (25/5/15 min)
- Start/pause/reset controls
- Timer modes: Work, Short Break, Long Break
- Auto-start toggle
- Notifications (sound + browser)
- Stats tracking (sessions, total time)
- Streak display
- Achievement unlocks
- Bottom bar when running

**Bottom Bar:**
- Shown when Pomodoro is active
- Displays time remaining
- Current mode indicator
- Click to expand to full timer

**User Flow:**
1. Click Pomodoro button in header
2. Timer opens in floating widget or header
3. Click "Start" → Countdown begins
4. When timer reaches zero → Break mode starts
5. After break → Work mode resumes
6. Statistics updated automatically

**Gamification:**
- Streak tracking (consecutive days)
- Achievement system (9 achievements)
- Weekly goals
- Session counters

**Integrations:**
- Tracks time per document
- Links sessions to books
- Syncs with Supabase

---

### 14. TypographySettings
**Location:** `/src/components/TypographySettings.tsx`

**Purpose:** Customize reading experience

**Settings:**
- **Font Family:** Serif, Sans-serif, Monospace
- **Font Size:** 12px - 24px
- **Line Height:** 1.2 - 2.5
- **Max Width:** 400px - 1200px
- **Theme:** Light, Dark, Sepia
- **Text Align:** Left, Justify, Center
- **Spacing Multiplier:** 0.5 - 2.0
- **Focus Mode:** Hide distractions toggle
- **Reading Guide:** Show guide line toggle
- **Render Formulas:** Toggle LaTeX rendering

**Live Preview:**
- Changes apply immediately
- Preview pane shows sample text
- Settings persist to localStorage

**Export Settings:**
- Save as preset
- Share with others
- Reset to defaults

---

### 15. PomodoroBottomBar
**Location:** `/src/components/PomodoroBottomBar.tsx`

**Purpose:** Compact timer display when Pomodoro is running

**Displays:**
- Time remaining (countdown)
- Current mode (Work/Break)
- Expand button (→ full timer)

**Behavior:**
- Only visible when timer is active
- Fixed at bottom of viewport
- Click to expand to full Pomodoro widget
- Auto-hides when timer stops

---

### 16. AchievementPanel
**Location:** `/src/components/AchievementPanel.tsx`

**Purpose:** Display user achievements

**Features:**
- Grid layout of achievement cards
- Progress bars for incomplete achievements
- Locked/unlocked states
- Achievement descriptions
- Trophy counter
- Weekly progress indicators

**Achievements (9 total):**
- First Upload
- First Highlight
- First Note
- First Pomodoro Session
- 7-Day Streak
- etc.

---

### 17. AIInsightsPanel
**Location:** `/src/components/ai/AIInsightsPanel.tsx`

**Purpose:** Advanced AI analysis of documents

**Features:**
- Tabbed interface:
  - **Frameworks Tab:** Identify theoretical frameworks
  - **Historical Context Tab:** Timeline of related research
  - **Insights Tab:** Key concepts and themes

**Framework Mapper:**
- Detects frameworks used in document
- Creates concept map
- Highlights relationships

**Historical Timeline:**
- Plots document in academic timeline
- Identifies predecessors
- Shows influence map

**Note:** This panel is part of the AI suite but may be hidden/disabled based on tier

---

### 18. HighlightManagementPanel
**Location:** `/src/components/HighlightManagementPanel.tsx`

**Purpose:** Manage all highlights across a document

**Features:**
- List of all highlights
- Grouped by page
- Filter by status (all, orphaned, active)
- Jump to highlight location
- Delete single or multiple highlights
- Color coding
- Search highlights

**Layout:**
```
┌──────────────────────────────────┐
│ Highlight Management              │
├──────────────────────────────────┤
│ [All] [Orphaned] [Active] [+ New] │
├──────────────────────────────────┤
│ Page 1:                           │
│  🟡 Yellow highlight              │
│  🔵 Blue highlight                │
├──────────────────────────────────┤
│ Page 2:                           │
│  🟢 Green highlight               │
└──────────────────────────────────┘
```

**Orphaned Highlights:**
- Highlights where text was removed
- Can be cleaned up
- Preserve for later reference

---

### 19. ContextMenu
**Location:** `/src/components/ContextMenu.tsx`

**Purpose:** Right-click menu for text selection

**Actions:**
- Ask for Clarification (opens AI chat)
- Suggest Further Reading (opens AI chat)
- Save as Note
- Copy
- Highlight (in PDF)

**Trigger:** Right-click on selected text

---

### 20. EmptyState
**Location:** `/src/components/EmptyState.tsx`

**Purpose:** Welcome screen when no document loaded

**Features:**
- Welcome message
- Upload prompt
- Feature highlights (3 cards)
- "Upload Documents" CTA
- "AI Chat" preview
- "Customizable Reading" preview

**Displayed:** When `currentDocument === null`

---

### 21. OnboardingSystem
**Location:** `/src/components/onboarding/`

**Purpose:** Interactive tutorial and help system with spotlight tours

**Components:**
- `OnboardingProvider`: Context provider managing tour state
- `SpotlightTour`: Visual tour component with spotlight highlighting
- `PeerReviewPreview`: Preview component for peer review features

**Tour Types:**
- **TTS Tour**: Text-to-Speech audio widget features (5 steps)
- **Related Documents Tour**: Document relationships and graph visualization (5 steps)
- **Peer Review Tour**: Editorial mode and review features (7 steps)

**Features:**
- Auto-starts welcome screen for new users
- Returns to main menu after each tour completion
- Uses numbered screenshots for visual guidance
- Mock document loading for demonstration
- Keyboard navigation support

---

### 22. RelatedDocumentsPanel
**Location:** `/src/components/RelatedDocumentsPanel.tsx`

**Purpose:** Show AI-identified related documents

**Displays:**
- Related document cards
- Relationship type (summary, citation, etc.)
- Relevance score
- Processing status
- Actions: Preview, Delete relationship

**AI Processing:**
- Analyzes document content
- Finds semantic relationships
- Calculates relevance scores
- Updates in real-time

---

### 23. AddRelatedDocumentModal
**Location:** `/src/components/AddRelatedDocumentModal.tsx`

**Purpose:** Manually create document relationships

**Features:**
- Select related document from library
- Choose relationship type
- Add description
- AI can auto-suggest relationships
- Save to database

**Relationship Types:**
- Summary
- Citation
- Related Work
- Extension
- Contradicts

---

### 24. DocumentPreviewModal
**Location:** `/src/components/DocumentPreviewModal.tsx`

**Purpose:** Preview related document without opening

**Features:**
- Document metadata
- First page preview
- Relationship details
- Actions: Open, Edit, Delete relationship

---

### 25. OCRStatusBadge & OCRBanner
**Location:** `/src/components/OCRStatusBadge.tsx`

**Purpose:** Display OCR processing status

**States:**
- Not needed (text-based PDF)
- Pending (user consent needed)
- Processing (AI analyzing)
- Completed (extracted text available)
- Failed (error occurred)
- User declined

**User Actions:**
- Give consent for OCR
- Decline OCR
- View processing status
- Access extracted text

---

### 26. TTSControls
**Location:** `/src/components/TTSControls.tsx`

**Purpose:** Text-to-speech playback controls

**Features:**
- Play/pause button
- Speed control (0.75x - 2.0x)
- Voice selector dropdown
- Volume control
- Reading mode selector:
  - Current page only
  - From here to end
  - Continue from last position

**Integrations:**
- Word-level highlighting
- Progress tracking
- Auto-pause on page change

---

### 27. VoiceSelector
**Location:** `/src/components/VoiceSelector.tsx`

**Purpose:** Choose TTS voice

**Features:**
- List of available voices
- Language filters
- Gender filters
- Preview voice
- Model selection (neural vs standard)

**Provider:** Google Cloud TTS

---

### 28. AudioWidget
**Location:** `/src/components/AudioWidget.tsx`

**Purpose:** Floating audio player for TTS

**Features:**
- Mini player widget
- Current word highlight
- Progress bar
- Play/pause
- Settings access

---

### 29. AudioSettingsPanel
**Location:** `/src/components/AudioSettingsPanel.tsx`

**Purpose:** Advanced TTS settings

**Settings:**
- Voice selection
- Speaking rate (0.25x - 4.0x)
- Pitch (-20.0 to +20.0)
- Volume gain (up to 16dB)
- Effect profiles

---

### 30. HealthStatus
**Location:** `/src/components/HealthStatus.tsx`

**Purpose:** System health monitoring

**Displays:**
- API health status
- Storage quota usage
- Sync status
- Error alerts

**Note:** May be hidden in production

---

### 31. Tooltip
**Location:** `/src/components/Tooltip.tsx`

**Purpose:** Hover tooltips throughout app

**Features:**
- 12 positions (top, bottom, left, right, etc.)
- Auto-positioning
- Delay before showing
- Rich content support

---

### 32. FormulaRenderer
**Location:** `/src/components/FormulaRenderer.tsx`

**Purpose:** Render LaTeX/Math formulas

**Features:**
- Parse LaTeX notation
- Render with KaTeX
- Placeholder during loading
- Responsive sizing
- Copy formula button

---

### 33. CollectionTree
**Location:** `/src/components/library/CollectionTree.tsx`

**Purpose:** Hierarchy of document collections

**Features:**
- Expandable tree structure
- Nested collections
- Drag-and-drop organization
- Create/delete folders
- Visual hierarchy

---

### 34. BookCard
**Location:** `/src/components/library/BookCard.tsx`

**Purpose:** Document card in library grid

**Displays:**
- Thumbnail/preview
- Title
- File type icon
- Reading progress
- Last read date
- Tags
- Quick actions (open, delete, share)

---

### 35. TagChip
**Location:** `/src/components/library/TagChip.tsx`

**Purpose:** Tag display and filtering

**Features:**
- Color-coded tags
- Click to filter
- Multi-select
- Create new tag
- Tag management modal

---

### 36. LibrarySearchBar
**Location:** `/src/components/library/LibrarySearchBar.tsx`

**Purpose:** Advanced library search

**Features:**
- Full-text search
- Real-time filtering
- Search suggestions
- Recent searches
- Save search queries

---

### 37. NeoReaderTerminal
**Location:** `/src/components/NeoReaderTerminal.tsx`

**Purpose:** Alternative minimal reading interface

**Features:**
- Clean, distraction-free UI
- Terminal-style interface
- Minimal controls
- Focus on text

**Access:** Hidden mode via `?neo=true` parameter

---

### 38. StudyGuidePanel
**Location:** `/src/components/ResearchNotes/StudyGuidePanel.tsx`

**Purpose:** AI-generated study guide

**Features:**
- Key concepts
- Summary points
- Practice questions
- Further reading suggestions

---

### 39. AITextAssistedNotes
**Location:** `/src/components/ResearchNotes/AIAssistedNotes.tsx`

**Purpose:** AI-augmented note-taking

**Features:**
- Auto-suggest notes while reading
- Template-based notes
- AI summarization
- Citation extraction

---

### 40. ThemeSwitcher
**Location:** `/src/components/ThemeSwitcher.tsx`

**Purpose:** Toggle between themes

**Themes:**
- Default
- Academic
- Dark
- Custom

**Note:** Shown in development mode only

---

## Navigation Patterns

### Primary Navigation
**Mode:** Horizontal menu bar (ThemedHeader)

**Items:**
- Logo (home/refresh)
- Upload
- Library
- AI Chat (toggle)
- Pomodoro
- User Profile
- Logout

**Behavior:**
- Fixed at top
- Always visible (except in NeoReader mode)
- Responsive on mobile (hamburger menu)

---

### Secondary Navigation
**Mode:** Sidebar (ThemedSidebar)

**Sections:**
1. Recently Viewed
2. Related Documents
3. Productivity Stats
4. Recent Activity

**Behavior:**
- Collapsible sections
- Can hide entire sidebar
- Vertical scrolling
- Responsive (off-canvas on mobile)

---

### Modal/Panel Navigation
**Mode:** Floating overlays

**Types:**
- **Modals:** Full-screen overlays with backdrop
  - Library Modal
  - Document Upload
  - Auth Modal
- **Panels:** Slide-out panels from edges
  - Chat Panel (right)
  - Notes Panel (right)
- **Popovers:** Small overlays
  - Context Menu
  - Color Picker
  - Settings Popover

**Behavior:**
- Backdrop click closes modals
- ESC key closes active modal/panel
- Can open multiple panels (stacked)
- Z-index management

---

### Document Navigation
**Mode:** Toolbar within PDF Viewer

**Controls:**
- Previous/Next page
- Jump to page (input field)
- Page indicator (current/total)
- Scroll to page
- Zoom in/out
- Rotate
- Download
- Fullscreen

**Keyboard Shortcuts:**
- Arrow keys: Navigate pages
- Ctrl/Cmd+F: Search
- Ctrl/Cmd+S: Save
- Ctrl/Cmd+D: Download

---

### Library Navigation
**Mode:** Hierarchical within Library Modal

**Structure:**
```
Collections (Tree)
  └─ Collection 1
     └─ Document A
     └─ Document B
  └─ Collection 2
     └─ Document C
```

**Behavior:**
- Click collection → Filter by collection
- Click document → Open in viewer
- Drag document → Move between collections
- Right-click → Context menu

---

## State Management & Data Flow

### Zustand Store Structure
**Location:** `/src/store/appStore.ts`

**State Categories:**

1. **Authentication State**
   - `isAuthenticated: boolean`
   - `user: AuthUser | null`

2. **Document State**
   - `currentDocument: Document | null`
   - `documents: Document[]`
   - `recentlyViewedDocuments: Document[]`

3. **UI State**
   - `isChatOpen: boolean`
   - `isLoading: boolean`
   - `isSidebarOpen: boolean`

4. **Chat State**
   - `chatMessages: ChatMessage[]`
   - `isTyping: boolean`
   - `selectedTextContext: TextSelectionContext | null`
   - `chatMode: 'general' | 'clarification' | 'further-reading'`

5. **Typography Settings**
   - `typography: TypographySettings`

6. **PDF Viewer Settings**
   - `pdfViewer: PDFViewerSettings`

7. **TTS Settings**
   - `tts: TTSSettings`

8. **Library Settings**
   - `libraryView: LibraryViewSettings`

9. **Pomodoro State**
   - `activePomodoroSessionId: string | null`
   - `pomodoroIsRunning: boolean`
   - `pomodoroMode: 'work' | 'shortBreak' | 'longBreak'`

10. **Related Documents**
    - `relatedDocuments: DocumentRelationshipWithDetails[]`

**Actions:**
- All state mutations go through store actions
- Async actions (e.g., auth) update state on completion
- React components subscribe to relevant state slices

---

### Data Flow Patterns

#### Document Upload Flow
```
User uploads file
  ↓
DocumentUpload component
  ↓
supabaseStorageService.uploadFile()
  ↓
Extract text (PDF.js or OCR)
  ↓
userBooks.create() (Supabase)
  ↓
store.addDocument()
  ↓
Document appears in library
  ↓
Open in viewer
```

#### AI Chat Flow
```
User types message in ChatPanel
  ↓
store.addChatMessage() (user message)
  ↓
sendMessageToAI() (aiService)
  ↓
Build context from current document
  ↓
Add relevant notes (if enabled)
  ↓
Call AI API (Gemini or OpenAI)
  ↓
store.addChatMessage() (AI response)
  ↓
Display in chat
  ↓
Optional: Save as note
```

#### Highlight Flow
```
User selects text in PDF
  ↓
User applies highlight color
  ↓
highlightService.createHighlight()
  ↓
Save to Supabase (highlights table)
  ↓
store.updateDocument() (add highlight)
  ↓
Visual highlight rendered on PDF
```

#### Pomodoro Flow
```
User clicks Pomodoro button
  ↓
Open timer widget
  ↓
User clicks "Start"
  ↓
timerService.start()
  ↓
Timer counts down
  ↓
On completion → pomodoroService.saveSession()
  ↓
Update gamification data
  ↓
Show achievement notification
  ↓
Cycle to break mode
```

---

## Key UI Relationships

### Parent-Child Relationships
```
App
└── ThemedApp
    ├── ThemedHeader
    │   └── Modals:
    │       ├── LibraryModal
    │       ├── DocumentUpload
    │       ├── AuthModal
    │       └── TypographySettings
    ├── ThemedSidebar
    │   ├── RecentlyViewed (list)
    │   ├── RelatedDocumentsPanel
    │   ├── ProductivityStats
    │   ├── RecentActivity
    │   └── AchievementPanel
    └── ThemedMainContent
        └── DocumentViewer
            ├── PDFViewer
            │   ├── FormulaRenderer
            │   ├── HighlightColorPicker
            │   ├── TTSControls
            │   ├── NotesPanel
            │   └── ContextMenu
            └── EmptyState
```

### Modal Trigger Relationships
```
Header "Upload" → DocumentUpload
Header "Library" → LibraryModal
Header "Chat" → ChatPanel (toggle)
Header "Pomodoro" → PomodoroTimer
Header "Settings" → TypographySettings
Right-click text → ContextMenu
ContextMenu "Clarify" → ChatPanel (clarification mode)
ContextMenu "Further Reading" → ChatPanel (further-reading mode)
PDF "Highlight" → HighlightColorPicker
PDF "Manage Highlights" → HighlightManagementPanel
Sidebar "View Dashboard" → PomodoroDashboard
Sidebar "Add Related" → AddRelatedDocumentModal
```

### Communication Patterns

#### Event-Driven
- Click events bubble from child to parent
- Store updates trigger re-renders
- Service callbacks update UI state

#### Pub-Sub
- Timer service publishes state changes
- Components subscribe to timer events
- Achievement system notifies on unlock

#### Context API
- Theme context provides styling variables
- Onboarding context manages tour state
- Keyboard shortcuts context handles global shortcuts

#### State Reducers (Zustand)
- Actions update state immutably
- Selectors extract specific slices
- Middleware handles side effects (logging, persistence)

---

## Responsive Design

### Desktop (> 1024px)
- Full sidebar visible
- Header with all buttons
- Multi-column layouts
- Hover states on buttons
- Context menus

### Tablet (768px - 1024px)
- Collapsible sidebar (icon-only default)
- Reduced header button labels
- Adaptive grid layouts
- Touch-friendly targets (44x44px minimum)

### Mobile (< 768px)
- Off-canvas sidebar
- Hamburger menu in header
- Single-column layouts
- Bottom navigation for primary actions
- Swipe gestures for navigation

---

## Accessibility

### Keyboard Navigation
- TAB: Navigate interactive elements
- ENTER: Activate focused element
- ESC: Close modals/panels
- Arrow keys: Navigate lists/grids
- Space: Toggle checkboxes

### Screen Readers
- ARIA labels on all interactive elements
- Role attributes for custom components
- Alt text for images and icons
- Semantic HTML structure

### Focus Management
- Focus trap in modals
- Visible focus indicators (outline)
- Skip links for screen reader navigation
- Logical tab order

### Color Contrast
- WCAG AA minimum for all text
- Color-blind friendly color schemes
- Icons supplement color-only indicators

---

## Performance Optimizations

### Code Splitting
- PDF viewer lazy-loaded
- Charts/Timeline dynamic imports
- AI components loaded on-demand

### Virtual Scrolling
- Library modal uses virtual lists
- Chat messages virtualized
- Document text chunked

### Memoization
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers

### Image Optimization
- Lazy loading for document thumbnails
- Responsive images
- WebP format for modern browsers

---

## Summary

The ryzomatic application follows a modular, component-based architecture with clear separation of concerns. The UI is organized into distinct screens and overlays, connected through a central state management system (Zustand) and service layer (Supabase).

**Key UI Patterns:**
- **Landing → Auth → Main App** user flow
- **Header-Sidebar-Content** main layout
- **Modal/Panel** overlay system for secondary actions
- **Context-aware** interactions (text selection, document state)
- **Theme-based** styling with CSS variables
- **Responsive** design for all screen sizes
- **Accessible** with keyboard navigation and ARIA labels

**Primary User Interactions:**
1. Upload documents → Library
2. Open document → Viewer
3. Select text → Context menu → AI Chat
4. Create highlights → Manage in panel
5. Start Pomodoro → Track session
6. Take notes → Link to document sections
7. Explore related documents → AI-mapped relationships

The application successfully provides an integrated reading and research experience with AI assistance, productivity tools, and comprehensive document management.
