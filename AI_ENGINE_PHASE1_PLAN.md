# AI Engine - Phase 1 Implementation Plan

## 🎯 Overview
First phase implementation focusing on extending AI capabilities with Claude, building the Framework Mapper, adding Historical Context, and creating visualization components.

---

## 📋 Implementation Checklist

### 1. **Extend aiService.ts with Claude** ✓ Starting
- [x] Install @anthropic-ai/sdk
- [ ] Add Claude integration to aiService.ts
- [ ] Update aiEngineCore.ts with real Claude implementation
- [ ] Test Claude integration with sample text
- [ ] Add error handling and fallback logic

### 2. **Build Framework Mapper (Gemini + Supabase + Pinecone)**
- [ ] Create frameworkMapperService.ts
- [ ] Integrate with Gemini for framework extraction
- [ ] Set up Supabase schema for framework storage
- [ ] Connect to Pinecone for semantic framework search
- [ ] Add graph visualization with D3.js
- [ ] Create FrameworkMapper React component

### 3. **Add Historical Context (Wikipedia API + Gemini)**
- [ ] Create historicalContextService.ts
- [ ] Integrate Wikipedia API
- [ ] Use Gemini for context enrichment
- [ ] Cache results in Supabase
- [ ] Create HistoricalTimeline component
- [ ] Add context visualization

### 4. **Create Visualization Components**
- [ ] FrameworkMapper.tsx - Knowledge graph visualization
- [ ] HistoricalTimeline.tsx - Timeline visualization
- [ ] TheoreticalFrameworkPanel.tsx - Framework analysis panel
- [ ] ContextPanel.tsx - Historical context display
- [ ] InsightsVisualization.tsx - General insights visualization

---

## 🏗️ Architecture

### **Service Layer**
```
src/services/ai/
├── aiEngineCore.ts (EXISTING - extend)
├── frameworkMapperService.ts (NEW)
├── historicalContextService.ts (NEW)
└── visualizationService.ts (NEW)
```

### **Component Layer**
```
src/components/ai/
├── FrameworkMapper.tsx (NEW)
├── HistoricalTimeline.tsx (NEW)
├── TheoreticalFrameworkPanel.tsx (NEW)
├── ContextPanel.tsx (NEW)
└── InsightsVisualization.tsx (NEW)
```

---

## 🔧 Dependencies to Install

### **Required Packages**
```bash
# AI Models
npm install @anthropic-ai/sdk

# Visualization
npm install d3 @types/d3
npm install mermaid
npm install vis-timeline vis-data

# NLP Tools
npm install compromise natural stopword

# Graph Database (Optional for Phase 1)
npm install neo4j-driver

# Utilities
npm install marked @types/marked
npm install citation-js
```

---

## 🔑 Environment Variables

### **Add to .env.local**
```env
# AI APIs
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here
VITE_OPENAI_API_KEY=your_openai_key_here
VITE_GEMINI_API_KEY=your_gemini_key_here

# Pinecone (already configured)
VITE_PINECONE_API_KEY=existing_key
VITE_PINECONE_ENVIRONMENT=existing_env
VITE_PINECONE_INDEX_NAME=existing_index

# Neo4j (optional)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# Features
VITE_AI_ENGINE_MODE=development
VITE_AI_CACHE_ENABLED=true
VITE_AI_RATE_LIMIT=100
```

---

## 📦 Implementation Details

### **1. Claude Integration (Week 1)**

#### **aiService.ts Extension**
```typescript
// Add Claude client
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export const sendMessageToClaude = async (
  message: string, 
  documentContent?: string
): Promise<string> => {
  // Implementation with Claude 3.5 Sonnet
};
```

#### **aiEngineCore.ts Update**
```typescript
// Update synapseSynthesis with real Claude implementation
private async synapseSynthesis(request: DocumentAnalysisRequest): Promise<AIAnalysisResult> {
  const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  });
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 5000,
    messages: [{
      role: 'user',
      content: `Analyze this academic text for theoretical frameworks...`
    }]
  });
  
  return processClaudeResponse(response);
}
```

---

### **2. Framework Mapper (Week 2)**

#### **Service Implementation**
```typescript
// src/services/ai/frameworkMapperService.ts

export interface TheoreticalFramework {
  id: string;
  name: string;
  author: string;
  year?: number;
  description: string;
  keyTerms: string[];
  relatedFrameworks: string[];
  applications: string[];
  confidence: number;
}

export interface FrameworkMapping {
  frameworks: TheoreticalFramework[];
  relationships: FrameworkRelationship[];
  suggestions: string[];
  visualizationData: GraphData;
}

export const analyzeFrameworks = async (
  documentText: string
): Promise<FrameworkMapping> => {
  // 1. Use Gemini to extract frameworks
  // 2. Store in Supabase
  // 3. Search similar frameworks in Pinecone
  // 4. Generate relationships
  // 5. Return visualization data
};
```

#### **Supabase Schema**
```sql
-- theoretical_frameworks table
CREATE TABLE theoretical_frameworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  name TEXT NOT NULL,
  author TEXT,
  year INTEGER,
  description TEXT,
  key_terms TEXT[],
  related_frameworks TEXT[],
  applications TEXT[],
  confidence DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- framework_relationships table
CREATE TABLE framework_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_framework_id UUID REFERENCES theoretical_frameworks(id),
  target_framework_id UUID REFERENCES theoretical_frameworks(id),
  relationship_type TEXT,
  strength DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **3. Historical Context (Week 3)**

#### **Service Implementation**
```typescript
// src/services/ai/historicalContextService.ts

export interface HistoricalContext {
  author: string;
  period: string;
  events: HistoricalEvent[];
  culturalContext: string;
  intellectualMovement: string;
  relatedFigures: string[];
  sources: Source[];
}

export const generateHistoricalContext = async (
  authorName: string,
  workTitle: string,
  publicationYear?: number
): Promise<HistoricalContext> => {
  // 1. Fetch from Wikipedia API
  // 2. Check Supabase cache
  // 3. Enrich with Gemini analysis
  // 4. Generate timeline data
  // 5. Store in Supabase
};

// Wikipedia API integration
const fetchWikipediaData = async (query: string) => {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
  );
  return response.json();
};
```

#### **Timeline Data Structure**
```typescript
export interface HistoricalEvent {
  date: string;
  year: number;
  title: string;
  description: string;
  category: 'personal' | 'political' | 'cultural' | 'intellectual';
  importance: number;
}

export interface TimelineData {
  events: HistoricalEvent[];
  ranges: TimeRange[];
  highlights: string[];
}
```

---

### **4. Visualization Components (Week 4)**

#### **FrameworkMapper Component**
```tsx
// src/components/ai/FrameworkMapper.tsx

import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

interface FrameworkMapperProps {
  frameworks: TheoreticalFramework[];
  relationships: FrameworkRelationship[];
  onFrameworkClick?: (framework: TheoreticalFramework) => void;
}

export const FrameworkMapper: React.FC<FrameworkMapperProps> = ({
  frameworks,
  relationships,
  onFrameworkClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    // D3.js force-directed graph
    const width = 800;
    const height = 600;
    
    const simulation = d3.forceSimulation(frameworks)
      .force('link', d3.forceLink(relationships))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Render graph
  }, [frameworks, relationships]);
  
  return (
    <div className="framework-mapper">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};
```

#### **HistoricalTimeline Component**
```tsx
// src/components/ai/HistoricalTimeline.tsx

import { Timeline } from 'vis-timeline';
import { DataSet } from 'vis-data';

interface HistoricalTimelineProps {
  context: HistoricalContext;
  height?: number;
}

export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({
  context,
  height = 400
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!timelineRef.current) return;
    
    const items = new DataSet(
      context.events.map(event => ({
        id: event.date,
        content: event.title,
        start: new Date(event.year, 0, 1),
        className: `event-${event.category}`
      }))
    );
    
    const timeline = new Timeline(timelineRef.current, items, {
      height: `${height}px`,
      zoomable: true,
      moveable: true
    });
    
    return () => timeline.destroy();
  }, [context, height]);
  
  return (
    <div className="historical-timeline">
      <div ref={timelineRef} />
    </div>
  );
};
```

---

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
// tests/ai/frameworkMapper.test.ts
describe('Framework Mapper', () => {
  it('should extract theoretical frameworks from text', async () => {
    const text = 'Sample academic text...';
    const result = await analyzeFrameworks(text);
    expect(result.frameworks).toBeDefined();
    expect(result.frameworks.length).toBeGreaterThan(0);
  });
});

// tests/ai/historicalContext.test.ts
describe('Historical Context', () => {
  it('should fetch and enrich historical context', async () => {
    const context = await generateHistoricalContext('Foucault', 'The Order of Things', 1966);
    expect(context.author).toBe('Foucault');
    expect(context.events).toBeDefined();
  });
});
```

### **Integration Tests**
```typescript
// tests/integration/aiWorkflow.test.ts
describe('AI Workflow Integration', () => {
  it('should complete full analysis pipeline', async () => {
    const document = await uploadDocument('sample.pdf');
    const frameworks = await analyzeFrameworks(document.content);
    const context = await generateHistoricalContext(document.author, document.title);
    
    expect(frameworks).toBeDefined();
    expect(context).toBeDefined();
  });
});
```

---

## 📊 Success Metrics

### **Performance**
- [ ] Framework extraction: < 5 seconds per document
- [ ] Historical context generation: < 3 seconds
- [ ] Visualization rendering: < 1 second
- [ ] Cache hit rate: > 80%

### **Quality**
- [ ] Framework detection accuracy: > 85%
- [ ] Context relevance score: > 90%
- [ ] User satisfaction: > 4/5 stars
- [ ] Error rate: < 2%

### **Cost**
- [ ] Average cost per analysis: < $0.50
- [ ] Monthly API costs: < $100
- [ ] Infrastructure costs: < $50

---

## 🚀 Deployment Timeline

### **Week 1: Claude Integration**
- Day 1-2: Install dependencies, set up Claude
- Day 3-4: Extend aiService.ts
- Day 5-7: Update aiEngineCore.ts, testing

### **Week 2: Framework Mapper**
- Day 8-10: Build frameworkMapperService.ts
- Day 11-12: Set up Supabase schema
- Day 13-14: Create visualization component

### **Week 3: Historical Context**
- Day 15-17: Build historicalContextService.ts
- Day 18-19: Wikipedia API integration
- Day 20-21: Timeline component

### **Week 4: Polish & Integration**
- Day 22-24: Create remaining visualization components
- Day 25-26: Integration testing
- Day 27-28: Performance optimization and documentation

---

## 🎉 Phase 1 Completion Criteria

- ✅ Claude fully integrated with fallback logic
- ✅ Framework Mapper extracting and visualizing frameworks
- ✅ Historical Context service providing enriched timelines
- ✅ All visualization components rendering correctly
- ✅ Comprehensive test coverage (>80%)
- ✅ Documentation complete
- ✅ Performance metrics met
- ✅ Cost targets achieved

---

## 📞 Next Steps

After Phase 1 completion, proceed to:
- **Phase 2**: Close Reading Companion & Argument Reconstruction
- **Phase 3**: Creative Synthesis Generator & Multi-document Analysis
- **Phase 4**: Advanced Features (Real-time collaboration, Custom frameworks, etc.)

