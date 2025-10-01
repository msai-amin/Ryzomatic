# Serverless Implementation Guide

## Quick Reference: Migrating to Serverless Architecture

This guide provides practical implementation steps for migrating Smart Reader from microservices to serverless.

---

## Infrastructure Setup Checklist

### 1. Frontend Hosting (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd /path/to/smart-reader
vercel

# Configure environment variables
vercel env add VITE_CLAUDE_API_KEY
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

### 2. Database Setup (Supabase)

1. **Create Supabase Project:** https://app.supabase.com/
2. **Create Tables:**

```sql
-- Users table (extends Supabase auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium', 'enterprise')),
  credits INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  credits_used INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_document_id ON conversations(document_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_created_at ON usage_records(created_at);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own usage" ON usage_records
  FOR SELECT USING (auth.uid() = user_id);
```

3. **Enable Supabase Auth:**
```bash
# In Supabase Dashboard:
# Authentication > Providers > Enable Email
# Authentication > Providers > Enable Google OAuth
```

### 3. Vector Database (Pinecone)

```bash
# Install Pinecone
npm install @pinecone-database/pinecone

# Initialize Pinecone (serverless)
```

```typescript
// lib/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export const vectorIndex = pinecone.index('smart-reader-docs');

// Create index (run once):
// Spec: serverless, cloud: aws, region: us-east-1
// Dimension: 1536 (for text-embedding-3-small) or 768 (for other models)
```

### 4. File Storage (AWS S3)

```bash
# Install AWS SDK
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```typescript
// lib/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = 'smart-reader-documents';

export async function uploadDocument(key: string, body: Buffer, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  return s3Client.send(command);
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  return getSignedUrl(s3Client, command, { expiresIn });
}
```

**S3 Bucket Configuration:**
```json
{
  "CORS": [
    {
      "AllowedOrigins": ["https://your-domain.com"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ],
  "LifecycleConfiguration": {
    "Rules": [
      {
        "Id": "DeleteOldVersions",
        "Status": "Enabled",
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 30
        }
      },
      {
        "Id": "TransitionToIA",
        "Status": "Enabled",
        "Transitions": [
          {
            "Days": 90,
            "StorageClass": "STANDARD_IA"
          }
        ]
      }
    ]
  }
}
```

---

## Serverless Functions Implementation

### Vercel Serverless Functions Structure

```
api/
├── auth/
│   ├── login.ts
│   ├── signup.ts
│   └── refresh.ts
├── documents/
│   ├── upload.ts
│   ├── process.ts
│   └── [id].ts
├── chat/
│   ├── message.ts
│   └── stream.ts
├── usage/
│   └── track.ts
└── webhooks/
    └── stripe.ts
```

### Example: Document Upload Function

```typescript
// api/documents/upload.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { s3Client, uploadDocument } from '@/lib/s3';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify auth
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check user tier and limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check document count limit
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const limits = {
      free: 10,
      pro: 100,
      premium: 1000,
      enterprise: Infinity,
    };

    if (count >= limits[profile.tier]) {
      return res.status(403).json({ 
        error: 'Document limit reached',
        limit: limits[profile.tier],
        current: count 
      });
    }

    // Parse form data
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to S3
    const fileKey = `documents/${user.id}/${uuidv4()}-${file.originalFilename}`;
    const fileBuffer = await fs.readFile(file.filepath);
    
    await uploadDocument(fileKey, fileBuffer, file.mimetype);

    // Extract text content (you'll implement this)
    const content = await extractTextContent(fileBuffer, file.mimetype);

    // Create document record
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title: fields.title?.[0] || file.originalFilename,
        file_name: file.originalFilename,
        file_size: file.size,
        file_type: file.mimetype,
        s3_key: fileKey,
        content,
        metadata: {
          originalName: file.originalFilename,
          uploadedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError) {
      return res.status(500).json({ error: 'Database error', details: dbError });
    }

    // Trigger async vector embedding (background job)
    // We'll use Vercel's background functions or a queue
    await fetch(`${process.env.VERCEL_URL}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: document.id }),
    });

    return res.status(201).json({ 
      success: true, 
      document: {
        id: document.id,
        title: document.title,
        fileName: document.file_name,
        fileSize: document.file_size,
        createdAt: document.created_at,
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Example: Claude Chat Function with Streaming

```typescript
// api/chat/stream.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

    // Auth check
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user tier for model selection
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    // Check credits
    if (profile.credits < 1) {
      return res.status(403).json({ error: 'Insufficient credits' });
    }

    // Select model based on tier
    const modelMap = {
      free: 'claude-3-haiku-20240307',
      pro: 'claude-3-sonnet-20240229',
      premium: 'claude-3-opus-20240229',
      enterprise: 'claude-3-opus-20240229',
    };
    const model = modelMap[profile.tier];

    // Get document context
    let documentContext = '';
    if (documentId) {
      const { data: doc } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();
      
      if (doc) {
        documentContext = doc.content;
      }
    }

    // Get conversation history
    let conversationHistory = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);
      
      conversationHistory = messages || [];
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    let tokensUsed = 0;

    // Create streaming chat
    const stream = await anthropic.messages.create({
      model,
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: 'You are a helpful document analysis assistant. Answer questions based on the provided document context.',
        },
        ...(documentContext ? [{
          type: 'text' as const,
          text: `Document content:\n\n${documentContext}`,
          cache_control: { type: 'ephemeral' as const },
        }] : []),
      ],
      messages: [
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user',
          content: message,
        },
      ],
      stream: true,
    });

    // Stream response to client
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      
      if (event.type === 'message_stop') {
        tokensUsed = event.message?.usage?.output_tokens || 0;
      }
    }

    // Save message to database
    const { data: conversation } = conversationId ? 
      await supabase.from('conversations').select('id').eq('id', conversationId).single() :
      await supabase.from('conversations').insert({
        user_id: user.id,
        document_id: documentId,
        title: message.substring(0, 50),
      }).select('id').single();

    if (conversation) {
      await supabase.from('messages').insert([
        {
          conversation_id: conversation.id,
          role: 'user',
          content: message,
        },
        {
          conversation_id: conversation.id,
          role: 'assistant',
          content: fullResponse,
          tokens_used: tokensUsed,
          model,
        },
      ]);
    }

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', user.id);

    await supabase.from('usage_records').insert({
      user_id: user.id,
      action_type: 'ai_query',
      credits_used: 1,
      metadata: { model, tokensUsed },
    });

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Example: Usage Tracking Function

```typescript
// api/usage/track.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usage } = await supabase
      .from('usage_records')
      .select('action_type, credits_used, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    // Get user profile for limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', user.id)
      .single();

    // Calculate usage by type
    const usageSummary = {
      aiQueries: usage?.filter(u => u.action_type === 'ai_query').length || 0,
      documentsUploaded: usage?.filter(u => u.action_type === 'document_upload').length || 0,
      totalCreditsUsed: usage?.reduce((sum, u) => sum + u.credits_used, 0) || 0,
    };

    // Get limits based on tier
    const limits = {
      free: { aiQueries: 100, documents: 10, credits: 100 },
      pro: { aiQueries: 1000, documents: 100, credits: 1000 },
      premium: { aiQueries: 5000, documents: 1000, credits: 5000 },
      enterprise: { aiQueries: Infinity, documents: Infinity, credits: Infinity },
    };

    return res.status(200).json({
      usage: usageSummary,
      limits: limits[profile.tier],
      currentCredits: profile.credits,
      tier: profile.tier,
    });

  } catch (error) {
    console.error('Usage tracking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Frontend Integration

### Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Auth helpers
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};
```

### API Service Layer

```typescript
// services/api.ts
import { supabase } from '@/lib/supabase';

const API_BASE = '/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export const api = {
  documents: {
    async upload(file: File, title?: string) {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);

      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      return response.json();
    },

    async list() {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      return { data, error };
    },

    async get(id: string) {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    },

    async delete(id: string) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      return { error };
    },
  },

  chat: {
    async send(message: string, conversationId?: string, documentId?: string) {
      const response = await fetchWithAuth('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ message, conversationId, documentId }),
      });

      return response.json();
    },

    async* stream(message: string, conversationId?: string, documentId?: string) {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, conversationId, documentId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              yield parsed.text;
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    },
  },

  usage: {
    async get() {
      const response = await fetchWithAuth('/usage/track');
      return response.json();
    },
  },
};
```

### Example React Component

```typescript
// components/ChatInterface.tsx
import { useState } from 'react';
import { api } from '@/services/api';

export function ChatInterface({ documentId }: { documentId?: string }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    try {
      let assistantMessage = '';
      
      // Stream response
      for await (const chunk of api.chat.stream(message, undefined, documentId)) {
        assistantMessage += chunk;
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantMessage },
        ]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="input">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
          placeholder="Ask a question..."
        />
        <button onClick={handleSend} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## Environment Variables

Create `.env.local` for development:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-key

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=us-east-1-aws

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App Config
VERCEL_URL=your-app.vercel.app
```

---

## Cost Optimization Patterns

### 1. Implement Prompt Caching

```typescript
// lib/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function chatWithCaching(
  documentContent: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
) {
  return await client.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: 'You are a helpful document analysis assistant.',
      },
      {
        type: 'text',
        text: `Document:\n\n${documentContent}`,
        cache_control: { type: 'ephemeral' }, // This gets cached!
      },
    ],
    messages: [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });
}
```

**Savings:** 90% cost reduction for repeated queries on same document!

### 2. Implement Response Caching

```typescript
// lib/cache.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getCachedResponse(
  documentId: string,
  query: string
): Promise<string | null> {
  const cacheKey = `${documentId}:${hashQuery(query)}`;
  
  const { data } = await supabase
    .from('response_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .gte('expires_at', new Date().toISOString())
    .single();

  return data?.response || null;
}

export async function setCachedResponse(
  documentId: string,
  query: string,
  response: string,
  ttl = 3600
) {
  const cacheKey = `${documentId}:${hashQuery(query)}`;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await supabase
    .from('response_cache')
    .upsert({
      cache_key: cacheKey,
      document_id: documentId,
      query,
      response,
      expires_at: expiresAt.toISOString(),
    });
}

function hashQuery(query: string): string {
  // Simple hash for demo - use crypto in production
  return Buffer.from(query.toLowerCase().trim()).toString('base64');
}
```

---

## Monitoring & Observability

### 1. Set up Vercel Analytics

```bash
npm install @vercel/analytics
```

```typescript
// App.tsx
import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
```

### 2. Add Error Tracking (Sentry)

```bash
npm install @sentry/react @sentry/tracing
```

```typescript
// main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 3. Custom Usage Metrics

```typescript
// lib/metrics.ts
export async function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  // Track to your analytics service
  await fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({
      event: eventName,
      properties,
      timestamp: new Date().toISOString(),
    }),
  });
}

// Usage:
trackEvent('document_uploaded', { fileType: 'pdf', fileSize: 1024000 });
trackEvent('ai_query_sent', { model: 'claude-3-sonnet', tier: 'pro' });
```

---

## Testing Strategy

### Unit Tests for Serverless Functions

```typescript
// api/chat/__tests__/message.test.ts
import { describe, it, expect, vi } from 'vitest';
import handler from '../message';

describe('/api/chat/message', () => {
  it('should return error for unauthorized requests', async () => {
    const req = {
      method: 'POST',
      headers: {},
      body: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  // More tests...
});
```

### Integration Tests

```typescript
// tests/integration/document-upload.test.ts
import { describe, it, expect } from 'vitest';
import { api } from '@/services/api';

describe('Document Upload Flow', () => {
  it('should upload, process, and query document', async () => {
    // 1. Upload document
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const { document } = await api.documents.upload(file, 'Test Document');
    expect(document.id).toBeDefined();

    // 2. Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Query document
    const response = await api.chat.send(
      'What is this document about?',
      undefined,
      document.id
    );
    expect(response.response).toBeDefined();
  });
});
```

---

## Deployment Checklist

- [ ] Set up Vercel project
- [ ] Configure environment variables
- [ ] Set up Supabase project and run migrations
- [ ] Create Pinecone serverless index
- [ ] Set up S3 bucket with CORS
- [ ] Configure CloudFront distribution
- [ ] Set up Stripe account and products
- [ ] Configure domain and SSL
- [ ] Set up monitoring (Sentry, Analytics)
- [ ] Test all flows end-to-end
- [ ] Set up CI/CD pipeline
- [ ] Configure billing alerts
- [ ] Create backup strategy
- [ ] Document API endpoints
- [ ] Create user migration plan

---

## Next Steps

1. **Review this guide** with your team
2. **Set up development environment** following steps above
3. **Migrate one service at a time** (start with document upload)
4. **Test thoroughly** before shutting down microservices
5. **Monitor costs** closely in first month
6. **Iterate** based on real usage patterns

Need help with any specific section? I can provide more detailed implementation for:
- Stripe integration for billing
- Document processing pipeline
- Vector search implementation
- Migration scripts from current DB
- Edge function optimization
- Anything else!

