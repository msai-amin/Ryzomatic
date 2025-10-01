# Gemini Implementation Strategy

## Why Gemini is Perfect for Smart Reader

### Cost Advantages 💰

**Gemini Pricing (as of Oct 2024):**
- **Gemini 1.5 Flash:** $0.075/$0.30 per 1M tokens (input/output) - FREE tier: 15 RPM
- **Gemini 1.5 Pro:** $1.25/$5.00 per 1M tokens (input/output) - FREE tier: 2 RPM
- **Gemini 2.0 Flash:** Latest model, similar pricing

**vs Claude:**
- Claude Haiku: $0.25/$1.25 per 1M tokens
- Claude Sonnet: $3/$15 per 1M tokens

**Gemini is 3-10x cheaper!** 🎉

### Context Caching Advantages

**Gemini Context Caching:**
- Cache up to 32K tokens
- Cached tokens cost: **$0.01875/$0.075 per 1M** (75% discount!)
- Cache duration: 5-60 minutes (configurable)
- Perfect for document Q&A

**Example Cost Comparison (10 questions on same document):**

Without caching:
- 10 queries × 50K tokens × $1.25/1M = $0.625

With caching:
- First query: 50K tokens × $1.25/1M = $0.0625
- Next 9 queries: 50K cached × $0.01875/1M + 1K new × $1.25/1M = $0.0123
- **Total: $0.073 vs $0.625 (88% savings!)**

### Technical Advantages

1. **1M Token Context Window** (both Flash and Pro)
   - Can handle entire books
   - Multiple documents in single conversation
   - Better than GPT-4 (128K) and competitive with Claude (200K)

2. **Multimodal Support**
   - Text, images, PDFs, audio, video
   - Future-proof for features

3. **Function Calling**
   - Can integrate with tools
   - Better structured outputs

4. **Fast Response Times**
   - Flash: 300-500ms
   - Pro: 1-2s

5. **Generous Free Tier**
   - 1,500 requests/day for Flash
   - 50 requests/day for Pro
   - Perfect for prototyping and free tier users

---

## Tier-Based Gemini Strategy

### Free Tier
- **Model:** Gemini 1.5 Flash (free quota)
- **Limits:** 100 queries/month
- **Features:** Basic Q&A, summaries
- **Cost to you:** $0/month (within free tier)

### Pro Tier ($9.99/month)
- **Model:** Gemini 1.5 Pro
- **Limits:** 1,000 queries/month
- **Features:** Advanced analysis, better quality
- **Cost to you:** ~$5-10/month (with caching)
- **Margin:** ~$0-5/user

### Premium Tier ($29.99/month)
- **Model:** Gemini 1.5 Pro + Gemini 2.0 Flash
- **Limits:** 5,000 queries/month
- **Features:** All models, batch processing
- **Cost to you:** ~$20-25/month (with caching)
- **Margin:** ~$5-10/user

---

## Implementation: Gemini with Context Caching

### 1. Gemini Service Setup

```typescript
// lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model selection based on tier
export const getModel = (tier: string) => {
  const modelMap = {
    free: 'gemini-1.5-flash',
    pro: 'gemini-1.5-pro',
    premium: 'gemini-1.5-pro',
    enterprise: 'gemini-1.5-pro',
  };
  return genAI.getGenerativeModel({ model: modelMap[tier] });
};

// Chat with context caching
export async function chatWithDocument(
  documentContent: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; parts: string }> = [],
  tier: string = 'free'
) {
  const model = getModel(tier);

  // Create chat with cached document context
  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [
          {
            text: `I'm going to ask you questions about the following document. Please answer based only on the document content.\n\nDocument:\n${documentContent}`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: "I understand. I'll answer your questions based solely on the document content you've provided. What would you like to know?",
          },
        ],
      },
      ...conversationHistory,
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

// Streaming response
export async function* chatWithDocumentStream(
  documentContent: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; parts: string }> = [],
  tier: string = 'free'
) {
  const model = getModel(tier);

  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [
          {
            text: `I'm going to ask you questions about the following document. Please answer based only on the document content.\n\nDocument:\n${documentContent}`,
          },
        ],
      },
      {
        role: 'model',
        parts: [
          {
            text: "I understand. I'll answer your questions based solely on the document content you've provided. What would you like to know?",
          },
        ],
      },
      ...conversationHistory,
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });

  const result = await chat.sendMessageStream(userMessage);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    yield chunkText;
  }
}
```

### 2. Advanced: Explicit Context Caching

```typescript
// lib/gemini-cached.ts
import { GoogleGenerativeAI, CachedContent } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Create a cached context for a document
export async function createDocumentCache(
  documentId: string,
  documentContent: string,
  ttl: number = 3600 // 1 hour in seconds
): Promise<string> {
  const cache = await CachedContent.create({
    model: 'gemini-1.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Document content for analysis:\n\n${documentContent}`,
          },
        ],
      },
    ],
    ttl,
    displayName: `doc-${documentId}`,
  });

  return cache.name;
}

// Use cached context for queries
export async function chatWithCachedDocument(
  cacheName: string,
  userMessage: string,
  tier: string = 'pro'
) {
  const model = genAI.getGenerativeModel({
    model: tier === 'free' ? 'gemini-1.5-flash' : 'gemini-1.5-pro',
    cachedContent: cacheName,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

// Manage cache lifecycle
export async function updateDocumentCache(
  cacheName: string,
  newTtl: number
): Promise<void> {
  await CachedContent.update({
    name: cacheName,
    ttl: newTtl,
  });
}

export async function deleteDocumentCache(cacheName: string): Promise<void> {
  await CachedContent.delete(cacheName);
}
```

### 3. Serverless Function: Chat with Gemini

```typescript
// api/chat/gemini.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { chatWithDocumentStream } from '@/lib/gemini';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationId, documentId } = req.body;

    // Auth
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    if (!profile || profile.credits < 1) {
      return res.status(403).json({ error: 'Insufficient credits' });
    }

    // Get document
    const { data: document } = await supabase
      .from('documents')
      .select('content, metadata')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get conversation history
    let history = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);

      history = messages?.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })) || [];
    }

    // Set up streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    const startTime = Date.now();

    // Stream response
    for await (const chunk of chatWithDocumentStream(
      document.content,
      message,
      history,
      profile.tier
    )) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    const responseTime = Date.now() - startTime;

    // Save to database
    const { data: conversation } = conversationId
      ? await supabase.from('conversations').select('id').eq('id', conversationId).single()
      : await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            document_id: documentId,
            title: message.substring(0, 50),
          })
          .select('id')
          .single();

    if (conversation) {
      await supabase.from('messages').insert([
        { conversation_id: conversation.id, role: 'user', content: message },
        {
          conversation_id: conversation.id,
          role: 'assistant',
          content: fullResponse,
          model: profile.tier === 'free' ? 'gemini-1.5-flash' : 'gemini-1.5-pro',
          metadata: { responseTime },
        },
      ]);
    }

    // Update credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', user.id);

    await supabase.from('usage_records').insert({
      user_id: user.id,
      action_type: 'ai_query',
      credits_used: 1,
      metadata: {
        model: profile.tier === 'free' ? 'gemini-1.5-flash' : 'gemini-1.5-pro',
        responseTime,
      },
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Cost Analysis with Gemini

### Scenario: 1,000 Active Users

**Assumptions:**
- 70% free tier (700 users × 50 queries/mo avg = 35K queries)
- 25% pro tier (250 users × 200 queries/mo = 50K queries)
- 5% premium (50 users × 500 queries/mo = 25K queries)
- Total: 110K queries/month
- Avg tokens per query: 30K (with caching: 5K new)

**AI Costs:**

Free tier users (Gemini Flash):
- 35K queries × 5K tokens × $0.075/1M = $13.13

Pro tier users (Gemini Pro with caching):
- First queries: 50K × 30K × $1.25/1M = $1,875
- With 80% cache hit rate:
  - 10K full queries: 10K × 30K × $1.25/1M = $375
  - 40K cached queries: 40K × 5K × $0.30/1M = $60
  - **Subtotal: $435**

Premium tier users (Gemini Pro with caching):
- Similar pattern: ~$200/month

**Total AI Costs: ~$650/month**

**Total Infrastructure:**
- Vercel Pro: $20
- Supabase Pro: $25
- Pinecone: $70
- S3 + CloudFront: $30
- Monitoring: $30
- **Infrastructure: $175**

**TOTAL COSTS: $825/month**

**Revenue:**
- Free: $0
- Pro (250 × $9.99): $2,497.50
- Premium (50 × $29.99): $1,499.50
- **Total: $3,997/month**

**Profit: $3,172/month (79% margin)** 🎉

---

## Gemini-Specific Features to Implement

### 1. Multimodal Document Analysis

```typescript
// Future feature: Analyze PDFs with images
export async function analyzeMultimodalDocument(
  documentBuffer: Buffer,
  mimeType: string,
  question: string
) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const result = await model.generateContent([
    {
      inlineData: {
        data: documentBuffer.toString('base64'),
        mimeType,
      },
    },
    { text: question },
  ]);

  return result.response.text();
}
```

### 2. Structured Output with Function Calling

```typescript
// Extract structured information from documents
export async function extractDocumentMetadata(documentContent: string) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          keyTopics: { type: 'array', items: { type: 'string' } },
          documentType: { type: 'string' },
          estimatedReadingTime: { type: 'number' },
        },
      },
    },
  });

  const result = await model.generateContent(
    `Analyze this document and extract metadata:\n\n${documentContent}`
  );

  return JSON.parse(result.response.text());
}
```

### 3. Smart Document Chunking

```typescript
// For very large documents, use Gemini to create smart summaries
export async function createSmartChunks(
  documentContent: string,
  chunkSize: number = 10000
): Promise<Array<{ content: string; summary: string }>> {
  const chunks = [];
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  for (let i = 0; i < documentContent.length; i += chunkSize) {
    const chunk = documentContent.slice(i, i + chunkSize);
    
    const result = await model.generateContent(
      `Provide a 2-sentence summary of this text:\n\n${chunk}`
    );

    chunks.push({
      content: chunk,
      summary: result.response.text(),
    });
  }

  return chunks;
}
```

---

## Rate Limiting Strategy with Gemini Free Tier

```typescript
// lib/rate-limiter.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function checkRateLimit(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);

  // Get recent requests
  const { data: recentRequests } = await supabase
    .from('usage_records')
    .select('created_at')
    .eq('user_id', userId)
    .eq('action_type', 'ai_query')
    .gte('created_at', hourAgo.toISOString());

  const requestCount = recentRequests?.length || 0;

  // Limits per hour by tier
  const limits = {
    free: 10, // Stay well under Gemini's 15 RPM for Flash
    pro: 100,
    premium: 500,
    enterprise: 1000,
  };

  const limit = limits[tier] || 10;
  const allowed = requestCount < limit;
  const remaining = Math.max(0, limit - requestCount);

  // Reset time is 1 hour from oldest request
  const oldestRequest = recentRequests?.[0]?.created_at || now.toISOString();
  const resetAt = new Date(new Date(oldestRequest).getTime() + 3600000);

  return { allowed, remaining, resetAt };
}
```

---

## Migration from Current OpenAI/Gemini Service

Your current code already uses Gemini! Let's optimize it:

### Current Implementation Review

```typescript
// You already have in src/services/aiService.ts
// We'll enhance this for the serverless version
```

### Enhanced Version for Serverless

```typescript
// lib/gemini-service.ts (serverless version)
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  
  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(params: {
    message: string;
    documentContent?: string;
    history?: Array<{ role: string; content: string }>;
    tier?: string;
    stream?: boolean;
  }) {
    const model = this.getModel(params.tier || 'free');
    
    const chat = model.startChat({
      history: this.formatHistory(params.history, params.documentContent),
      generationConfig: this.getConfig(params.tier),
    });

    if (params.stream) {
      return chat.sendMessageStream(params.message);
    } else {
      const result = await chat.sendMessage(params.message);
      return result.response.text();
    }
  }

  private getModel(tier: string) {
    const modelName = tier === 'free' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
    return this.genAI.getGenerativeModel({ model: modelName });
  }

  private formatHistory(
    history?: Array<{ role: string; content: string }>,
    documentContent?: string
  ) {
    const formatted = [];

    if (documentContent) {
      formatted.push(
        {
          role: 'user',
          parts: [{ text: `Document:\n${documentContent}` }],
        },
        {
          role: 'model',
          parts: [{ text: "I've read the document. How can I help you?" }],
        }
      );
    }

    if (history) {
      formatted.push(
        ...history.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }))
      );
    }

    return formatted;
  }

  private getConfig(tier?: string) {
    const baseConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    };

    if (tier === 'premium') {
      return { ...baseConfig, maxOutputTokens: 4096 };
    }

    return baseConfig;
  }
}
```

---

## Updated Cost Projections

### Per-User Costs (Monthly Average)

| Tier | AI Cost/User | Infrastructure | Total Cost | Revenue | Margin |
|------|-------------|----------------|------------|---------|--------|
| **Free** | $0.02 | $0.01 | $0.03 | $0 | -$0.03 |
| **Pro** | $1.74 | $0.20 | $1.94 | $9.99 | $8.05 (81%) |
| **Premium** | $4.00 | $0.50 | $4.50 | $29.99 | $25.49 (85%) |

**Key Insight:** With Gemini's pricing + caching, you have excellent margins even at low scale!

---

## Next Steps for Implementation

1. ✅ Strategy document created
2. ⏭️ Set up Vercel project
3. ⏭️ Configure Gemini API keys
4. ⏭️ Create Supabase database
5. ⏭️ Implement serverless functions
6. ⏭️ Add context caching
7. ⏭️ Test and optimize

Ready to start building! 🚀

