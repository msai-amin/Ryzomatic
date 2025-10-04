# AI Engine Phase 1 - Quick Start Guide 🚀

Get your AI Engine up and running in 5 minutes!

---

## ✅ Prerequisites

- Node.js and npm installed
- Dependencies already installed (completed during setup)
- Access to API keys for: Anthropic, Google Gemini (OpenAI optional)
- Supabase project set up

---

## 📦 What's Been Installed

All dependencies are ready:
```bash
✓ @anthropic-ai/sdk
✓ d3, @types/d3
✓ compromise, natural, stopword
✓ vis-timeline, vis-data
✓ marked, @types/marked
✓ mermaid
```

---

## 🔧 Setup Steps

### Step 1: Configure Environment Variables

Create or update `.env.local`:

```bash
# Copy from example if needed
cp .env.example .env.local
```

Add your API keys:
```env
# Required for AI features
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
VITE_GEMINI_API_KEY=AIzaSyxxxxx

# Optional (for fallback)
VITE_OPENAI_API_KEY=sk-xxxxx

# Already configured (verify they exist)
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

### Step 2: Set Up Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Theoretical Frameworks Table
CREATE TABLE IF NOT EXISTS theoretical_frameworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID,
  name TEXT NOT NULL,
  author TEXT,
  year INTEGER,
  description TEXT,
  key_terms TEXT[],
  related_frameworks TEXT[],
  applications TEXT[],
  confidence DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Framework Relationships Table
CREATE TABLE IF NOT EXISTS framework_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_framework_id UUID REFERENCES theoretical_frameworks(id) ON DELETE CASCADE,
  target_framework_id UUID REFERENCES theoretical_frameworks(id) ON DELETE CASCADE,
  relationship_type TEXT,
  strength DECIMAL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Historical Contexts Table
CREATE TABLE IF NOT EXISTS historical_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author TEXT NOT NULL,
  work_title TEXT,
  period TEXT,
  publication_year INTEGER,
  events JSONB,
  cultural_context TEXT,
  intellectual_movement TEXT,
  related_figures TEXT[],
  sources JSONB,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(author, work_title)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_frameworks_document ON theoretical_frameworks(document_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_name ON theoretical_frameworks(name);
CREATE INDEX IF NOT EXISTS idx_context_author ON historical_contexts(author);
CREATE INDEX IF NOT EXISTS idx_context_year ON historical_contexts(publication_year);
```

### Step 3: Test the Setup

```bash
# Start the development server
npm run dev

# Open http://localhost:5173
```

---

## 🎯 Usage Examples

### Example 1: AI Insights Panel (Full Integration)

The easiest way to use all AI features:

```tsx
import { AIInsightsPanel } from './components/ai';

function MyDocumentViewer() {
  const document = {
    content: "Your document text here...",
    id: "doc-123",
    author: "Michel Foucault",
    title: "Discipline and Punish",
    year: 1975
  };

  return (
    <div className="p-4">
      <AIInsightsPanel
        documentText={document.content}
        documentId={document.id}
        author={document.author}
        title={document.title}
        year={document.year}
      />
    </div>
  );
}
```

### Example 2: Individual Components

Use specific features independently:

```tsx
import { FrameworkMapper, HistoricalTimeline } from './components/ai';
import { analyzeFrameworks, generateHistoricalContext } from './services/ai';
import { useState, useEffect } from 'react';

function MyAnalysis() {
  const [frameworkData, setFrameworkData] = useState(null);
  const [contextData, setContextData] = useState(null);

  useEffect(() => {
    // Analyze frameworks
    analyzeFrameworks(documentText)
      .then(setFrameworkData);

    // Generate historical context
    generateHistoricalContext('Foucault', 'Discipline and Punish', 1975)
      .then(setContextData);
  }, [documentText]);

  return (
    <div>
      {frameworkData && (
        <FrameworkMapper
          frameworks={frameworkData.frameworks}
          relationships={frameworkData.relationships}
          visualizationData={frameworkData.visualizationData}
        />
      )}
      
      {contextData && (
        <HistoricalTimeline context={contextData} />
      )}
    </div>
  );
}
```

### Example 3: Using AI Services Directly

Access AI capabilities programmatically:

```tsx
import { analyzeWithClaude } from './services/aiService';
import { analyzeFrameworks } from './services/ai/frameworkMapperService';

async function analyzeDocument(text: string) {
  // Get Claude's academic analysis
  const claudeAnalysis = await analyzeWithClaude(text, 'framework');
  console.log('Claude analysis:', claudeAnalysis);

  // Extract frameworks automatically
  const frameworks = await analyzeFrameworks(text);
  console.log('Found frameworks:', frameworks.frameworks);

  return { claudeAnalysis, frameworks };
}
```

---

## 🧪 Testing Your Setup

### 1. Test AI Service Connection

```tsx
import { analyzeWithClaude } from './services/aiService';

// In a component or console
analyzeWithClaude('Test text', 'framework')
  .then(result => console.log('✅ Claude is working:', result))
  .catch(err => console.error('❌ Claude error:', err));
```

### 2. Test Framework Analysis

```tsx
import { analyzeFrameworks } from './services/ai';

const testText = `
  This paper applies Foucault's theory of power/knowledge 
  to analyze disciplinary mechanisms in modern institutions.
`;

analyzeFrameworks(testText)
  .then(result => {
    console.log('✅ Frameworks found:', result.frameworks.length);
    console.log('Frameworks:', result.frameworks);
  })
  .catch(err => console.error('❌ Framework analysis error:', err));
```

### 3. Test Historical Context

```tsx
import { generateHistoricalContext } from './services/ai';

generateHistoricalContext('Michel Foucault', 'Discipline and Punish', 1975)
  .then(context => {
    console.log('✅ Context generated');
    console.log('Period:', context.period);
    console.log('Events:', context.events.length);
  })
  .catch(err => console.error('❌ Context error:', err));
```

---

## 🎨 UI Integration Examples

### Add to Existing Document Viewer

```tsx
import { useState } from 'react';
import { AIInsightsPanel } from './components/ai';

function DocumentViewer({ document }) {
  const [showAI, setShowAI] = useState(false);

  return (
    <div className="flex">
      {/* Your existing document viewer */}
      <div className="flex-1">
        {/* Document content */}
      </div>

      {/* AI Insights Sidebar */}
      <div className="w-96 border-l">
        <button
          onClick={() => setShowAI(!showAI)}
          className="w-full px-4 py-2 bg-blue-600 text-white"
        >
          {showAI ? 'Hide' : 'Show'} AI Insights
        </button>

        {showAI && (
          <AIInsightsPanel
            documentText={document.content}
            documentId={document.id}
            author={document.author}
            title={document.title}
            year={document.year}
          />
        )}
      </div>
    </div>
  );
}
```

### Add AI Button to Toolbar

```tsx
import { Brain } from 'lucide-react';
import { useState } from 'react';

function Toolbar({ document }) {
  const [showAI, setShowAI] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowAI(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"
      >
        <Brain className="w-4 h-4" />
        AI Analysis
      </button>

      {showAI && (
        <Modal onClose={() => setShowAI(false)}>
          <AIInsightsPanel
            documentText={document.content}
            documentId={document.id}
            author={document.author}
            title={document.title}
            year={document.year}
          />
        </Modal>
      )}
    </>
  );
}
```

---

## 🔍 Troubleshooting

### API Keys Not Working

1. Check `.env.local` exists in project root
2. Verify variable names start with `VITE_`
3. Restart dev server after changing `.env.local`
4. Check browser console for API key errors

```bash
# Restart server
npm run dev
```

### Supabase Errors

1. Verify tables are created (check Supabase dashboard)
2. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Ensure RLS policies allow reads/writes

### Import Errors

If you see import errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Visualization Not Showing

1. Check browser console for D3 errors
2. Ensure container has proper dimensions
3. Verify data is being passed correctly

---

## 📊 Monitoring & Debugging

### Enable Debug Logging

AI services already log to console:

```
=== AI Service Initialization ===
Claude Key configured: true
Gemini Key configured: true
```

### Check API Usage

Monitor your API usage:
- **Anthropic**: https://console.anthropic.com
- **Google AI Studio**: https://makersuite.google.com
- **OpenAI**: https://platform.openai.com/usage

### Performance Monitoring

```tsx
import { analyzeFrameworks } from './services/ai';

const startTime = Date.now();
const result = await analyzeFrameworks(text);
console.log(`Analysis took ${Date.now() - startTime}ms`);
console.log('Metadata:', result.metadata);
```

---

## 💰 Cost Management

### Free Tiers

- **Gemini Pro**: 60 requests/minute FREE ✅
- **Wikipedia API**: Unlimited FREE ✅
- **Anthropic Claude**: $5 free credit for new accounts

### Optimize Costs

1. **Use Caching**: Results are cached in Supabase automatically
2. **Prefer Gemini**: Use Gemini (free) for most tasks
3. **Batch Operations**: Process multiple documents together
4. **Monitor Usage**: Check API dashboards regularly

### Cost per Operation

- Framework analysis: $0.01 - $0.05
- Historical context: $0.00 (Wikipedia + Gemini)
- Full analysis: $0.01 - $0.10

---

## 📚 API Reference

### AI Services

```typescript
// Framework Analysis
analyzeFrameworks(text: string, documentId?: string): Promise<FrameworkMapping>

// Historical Context
generateHistoricalContext(author: string, title?: string, year?: number): Promise<HistoricalContext>

// Claude Analysis
analyzeWithClaude(text: string, type: 'framework' | 'literary' | 'argument' | 'synthesis'): Promise<string>

// Basic AI Chat
sendMessageToAI(message: string, documentContent?: string): Promise<string>
```

### Component Props

```typescript
// AIInsightsPanel
interface AIInsightsPanelProps {
  documentText: string;
  documentId?: string;
  author?: string;
  title?: string;
  year?: number;
  className?: string;
}

// FrameworkMapper
interface FrameworkMapperProps {
  frameworks: TheoreticalFramework[];
  relationships: FrameworkRelationship[];
  visualizationData: GraphData;
  onFrameworkClick?: (framework: TheoreticalFramework) => void;
  className?: string;
}

// HistoricalTimeline
interface HistoricalTimelineProps {
  context: HistoricalContext;
  height?: number;
  className?: string;
  onEventClick?: (event: HistoricalEvent) => void;
}
```

---

## 🎓 Best Practices

### 1. Error Handling

```tsx
import { analyzeFrameworks } from './services/ai';

async function handleAnalysis(text: string) {
  try {
    const result = await analyzeFrameworks(text);
    return result;
  } catch (error) {
    console.error('Analysis failed:', error);
    // Show user-friendly error message
    toast.error('Failed to analyze document. Please try again.');
  }
}
```

### 2. Loading States

```tsx
const [loading, setLoading] = useState(false);

async function analyze() {
  setLoading(true);
  try {
    const result = await analyzeFrameworks(text);
    setResult(result);
  } finally {
    setLoading(false);
  }
}
```

### 3. Caching

```tsx
import { getCachedFrameworks } from './services/ai';

// Check cache first
const cached = await getCachedFrameworks(documentId);
if (cached.length > 0) {
  return cached; // Use cached data
}

// Otherwise, run new analysis
const fresh = await analyzeFrameworks(text, documentId);
```

---

## 🚀 Next Steps

1. ✅ Set up environment variables
2. ✅ Create Supabase tables
3. ✅ Test AI features
4. 📝 Integrate into your app
5. 🧪 Add unit tests
6. 📊 Monitor performance
7. 🎨 Customize UI to match your design

---

## 📞 Need Help?

- **Documentation**: See `AI_ENGINE_PHASE1_COMPLETE.md` for full details
- **Examples**: Check component files for inline examples
- **Architecture**: Review `AI_ENGINE_PHASE1_PLAN.md`

---

## 🎉 You're Ready!

Your AI Engine is set up and ready to analyze academic texts. Start with the `AIInsightsPanel` component for the easiest integration, then explore individual services and components as needed.

**Happy analyzing! 🧠✨**

