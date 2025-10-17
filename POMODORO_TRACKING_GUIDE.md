# Pomodoro Time Tracking System

## Overview

A comprehensive Pomodoro time tracking system that monitors user productivity per document, providing detailed analytics and insights into reading/study habits.

## Architecture

### Database Schema

**pomodoro_sessions table:**
- Tracks individual timer sessions
- Records start/end times, duration, mode, completion status
- Links to user_books via book_id foreign key
- Enables detailed analytics and historical tracking

**user_books enhancements:**
- `total_pomodoro_time_seconds` - Aggregate work time
- `total_pomodoro_sessions` - Count of completed sessions
- `last_pomodoro_at` - Most recent session timestamp

### Key Features

1. **Session Tracking**
   - Automatic session creation on timer start
   - Duration calculated and saved on completion
   - Distinguishes completed vs paused/abandoned sessions
   - Only work sessions count toward totals (breaks excluded)

2. **Smart Auto-Save**
   - Pausing timer saves current progress
   - Switching documents auto-pauses and saves
   - Browser close saves via localStorage backup
   - Component unmount triggers save

3. **Document Context**
   - Each session linked to specific document (book_id)
   - Timer displays which document is being tracked
   - Stats shown per document in sidebar
   - Time totals visible in document library

4. **Comprehensive Analytics**
   - **Per-Book Stats**: Total time, sessions, averages
   - **Daily Stats**: Sessions and time per day (last 7-30 days)
   - **Weekly Summary**: Productive days/hours, unique books
   - **Time Patterns**: Hour-of-day productivity heatmap

## API Endpoints

### POST /api/pomodoro/start
Starts a new Pomodoro session.

**Request:**
```json
{
  "bookId": "uuid",
  "mode": "work" | "shortBreak" | "longBreak"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "bookId": "uuid",
    "mode": "work",
    "startedAt": "2025-10-17T..."
  }
}
```

**Behavior:**
- Auto-closes any existing active session (marked incomplete)
- Creates new session with started_at timestamp
- Returns session ID for tracking

### POST /api/pomodoro/stop
Ends the current Pomodoro session.

**Request:**
```json
{
  "sessionId": "uuid",
  "durationSeconds": 1500,
  "completed": true
}
```

**Response:**
```json
{
  "success": true,
  "session": { ... },
  "bookStats": {
    "total_sessions": 5,
    "total_time_minutes": 125,
    "average_session_minutes": 25
  }
}
```

**Behavior:**
- Sets ended_at timestamp
- Calculates duration if not provided
- Updates book aggregate totals (via trigger)
- Returns updated session and book stats

### GET /api/pomodoro/stats
Fetches comprehensive Pomodoro statistics.

**Query Parameters:**
- `bookId` (optional) - Get stats for specific book
- `type` - 'all', 'daily', 'weekly', 'patterns'
- `days` (optional) - How many days back (default: 7)

**Response:**
```json
{
  "success": true,
  "stats": {
    "bookStats": { ... },
    "dailyStats": [ ... ],
    "weeklyStats": [ ... ],
    "timePatterns": [ ... ],
    "activeSession": { ... }
  }
}
```

### GET /api/pomodoro/sessions
Lists Pomodoro sessions with optional filtering.

**Query Parameters:**
- `bookId` (optional) - Filter by book
- `mode` (optional) - Filter by session type
- `limit` (optional) - Max results (default: 50)

**Response:**
```json
{
  "success": true,
  "sessions": [ ... ],
  "count": 42
}
```

## Frontend Integration

### Service Layer (`src/services/pomodoroService.ts`)

**Core Methods:**
```typescript
// Start tracking
pomodoroService.startSession(userId, bookId, mode)

// Stop tracking
pomodoroService.stopCurrentSession(completed)

// Get stats
pomodoroService.getBookStats(bookId)
pomodoroService.getDailyStats(userId, days)
pomodoroService.getTimePatterns(userId, days)
pomodoroService.getWeeklySummary(userId)

// Session state
pomodoroService.getActiveSessionInfo()
pomodoroService.hasActiveSession()
pomodoroService.isActiveForBook(bookId)
```

### State Management

**App Store State:**
```typescript
activePomodoroSessionId: string | null
activePomodoroBookId: string | null
pomodoroStartTime: number | null
```

**Actions:**
```typescript
setPomodoroSession(sessionId, bookId, startTime)
```

### Component Integration

**PomodoroTimer Component:**
- Accepts `documentId` and `documentName` props
- Automatically creates session on timer start
- Saves session on pause, complete, reset
- Displays current document being tracked
- Shows "Tracking: [Document Name]" indicator

**ThemedHeader:**
- Passes `currentDocument.id` to timer
- Passes `currentDocument.name` to timer
- Enables document-aware tracking

**ThemedSidebar:**
- Fetches Pomodoro stats for all documents
- Displays time spent per document
- Shows session count with tomato icon
- Updates when new sessions complete

## User Flow

1. **User opens document** → Document loaded, ID available
2. **User clicks tomato icon** → Timer opens
3. **User starts timer** → Session created in database
4. **Timer runs** → Local countdown, no DB calls
5. **Timer completes** → Session saved as completed
6. **User pauses** → Session saved as incomplete
7. **User switches document** → Auto-pause and save
8. **Stats update** → Sidebar shows accumulated time

## Data Flow

```
Timer Start
  ↓
pomodoroService.startSession()
  ↓
API /api/pomodoro/start
  ↓
Database INSERT pomodoro_sessions
  ↓
Return session ID
  ↓
Store in appStore (activePomodoroSessionId)
  ↓
Save to localStorage (recovery backup)

Timer Complete/Pause
  ↓
pomodoroService.stopCurrentSession()
  ↓
API /api/pomodoro/stop
  ↓
Database UPDATE pomodoro_sessions (ended_at, duration)
  ↓
Trigger: update_book_pomodoro_totals()
  ↓
user_books.total_pomodoro_time_seconds += duration
  ↓
Return updated stats
  ↓
Clear appStore session state
  ↓
Refresh UI stats
```

## Database Functions

### get_pomodoro_stats_by_book(book_uuid)
Returns comprehensive stats for a single book.

**Returns:**
- Total sessions, time (seconds/minutes/hours)
- Average session length
- Completed vs total sessions
- Work vs break sessions breakdown
- Last session timestamp

### get_daily_pomodoro_stats(user_uuid, days_back)
Returns daily aggregates for the user.

**Returns per day:**
- Total sessions and minutes
- Work sessions and work minutes
- Number of unique books studied

### get_time_of_day_patterns(user_uuid, days_back)
Analyzes productivity by hour of day.

**Returns per hour (0-23):**
- Total sessions
- Total minutes
- Average session length

### get_weekly_pomodoro_summary(user_uuid)
Provides weekly overview of productivity.

**Returns per week:**
- Total work minutes
- Total sessions
- Unique books studied
- Most productive day
- Most productive hour

### get_active_pomodoro_session(user_uuid)
Finds any currently running session.

**Returns:**
- Session ID, book ID
- Started timestamp
- Mode, elapsed seconds

## Edge Cases Handled

1. **Multiple Active Sessions**
   - Auto-closes previous session when starting new one
   - Prevents orphaned active sessions

2. **Browser Close**
   - Session saved to localStorage
   - Restored on return if still active in DB
   - Cleanup happens on next session start

3. **Document Switch**
   - Auto-pauses current timer
   - Saves elapsed time
   - Prevents mixed-document sessions

4. **Network Failures**
   - Service methods have error handling
   - Failed saves logged but don't crash UI
   - Can retry manually

5. **Component Unmount**
   - Cleanup effect saves active session
   - Prevents data loss

6. **Mode Switches**
   - Saves current session before switching
   - Prevents incorrect mode recording

## Statistics Display

### Sidebar Document Cards
- Shows total Pomodoro time per document
- Displays session count
- Tomato icon (Timer) indicator
- Format: "X min (Y sessions)"

### Future Enhancements
- Daily/weekly charts in dashboard
- Time-of-day heatmap visualization
- Productivity streaks and goals
- Export session history
- Leaderboards/achievements

## Migration Instructions

### 1. Run Migration
```bash
# Apply migration to Supabase
psql -h [host] -U postgres -d postgres -f supabase/migrations/006_add_pomodoro_tracking.sql
```

Or use Supabase CLI:
```bash
supabase db push
```

### 2. Deploy API Endpoints
Vercel will automatically deploy the new API routes in `/api/pomodoro/`

### 3. Deploy Frontend
```bash
git push origin feature/pomodoro-timer
# Or merge to main
git checkout main
git merge feature/pomodoro-timer
git push origin main
```

## Testing Checklist

- [ ] Timer starts and creates session in database
- [ ] Session ID stored in appStore
- [ ] Timer completion saves session as completed
- [ ] Pause saves session as incomplete
- [ ] Document switch auto-pauses and saves
- [ ] Browser refresh recovers active session
- [ ] Stats display in sidebar shows correct time
- [ ] Multiple documents tracked independently
- [ ] Daily/weekly stats endpoints return data
- [ ] Time patterns show correct hours
- [ ] RLS policies prevent unauthorized access

## Performance Considerations

- Sessions table will grow over time - consider archiving old data
- Aggregate fields in user_books prevent expensive JOINs
- Indexes on user_id, book_id, started_at for fast queries
- Stats functions use efficient aggregations
- Frontend caches stats, only refetches on changes

## Security

- All endpoints require authentication
- RLS policies enforce user isolation
- Service role key only used server-side
- Client can only access own sessions
- Book ownership verified via user_books foreign key

## Monitoring

Key metrics to track:
- Average session duration
- Session completion rate (completed / total)
- Daily active users using Pomodoro
- Most popular study times
- Documents with most Pomodoro sessions

