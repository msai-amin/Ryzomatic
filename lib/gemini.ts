import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configuration based on tier
const MODEL_CONFIG = {
  free: {
    model: 'gemini-2.5-flash-lite',
    maxOutputTokens: 2048,
    temperature: 0.7,
  },
  pro: {
    model: 'gemini-2.5-pro',
    maxOutputTokens: 4096,
    temperature: 0.7,
  },
  premium: {
    model: 'gemini-2.5-pro',
    maxOutputTokens: 8192,
    temperature: 0.7,
  },
  enterprise: {
    model: 'gemini-2.5-pro',
    maxOutputTokens: 8192,
    temperature: 0.7,
  },
};

export class GeminiService {
  private getModel(tier: string = 'free') {
    const config = MODEL_CONFIG[tier as keyof typeof MODEL_CONFIG] || MODEL_CONFIG.free;
    return genAI.getGenerativeModel({ model: config.model });
  }

  private getGenerationConfig(tier: string = 'free') {
    const config = MODEL_CONFIG[tier as keyof typeof MODEL_CONFIG] || MODEL_CONFIG.free;
    return {
      temperature: config.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens,
    };
  }

  private formatHistory(
    history?: Array<{ role: string; content: string }>,
    documentContent?: string
  ) {
    const formatted: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];

    // Add document context if provided
    if (documentContent) {
      formatted.push(
        {
          role: 'user',
          parts: [{
            text: `You are a helpful document analysis assistant. I'm going to share a document with you, and then ask questions about it. Please answer based only on the document content.\n\nDocument:\n${documentContent}`,
          }],
        },
        {
          role: 'model',
          parts: [{
            text: "I've read and understood the document. I'll answer your questions based solely on its content. What would you like to know?",
          }],
        }
      );
    }

    // Add conversation history
    if (history && history.length > 0) {
      for (const msg of history) {
        formatted.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    return formatted;
  }

  /**
   * Send a chat message (non-streaming)
   */
  async chat(params: {
    message: string;
    documentContent?: string;
    history?: Array<{ role: string; content: string }>;
    tier?: string;
  }): Promise<string> {
    const model = this.getModel(params.tier);
    const config = this.getGenerationConfig(params.tier);

    const chat = model.startChat({
      history: this.formatHistory(params.history, params.documentContent),
      generationConfig: config,
    });

    const result = await chat.sendMessage(params.message);
    return result.response.text();
  }

  /**
   * Send a chat message with streaming response
   */
  async *chatStream(params: {
    message: string;
    documentContent?: string;
    history?: Array<{ role: string; content: string }>;
    tier?: string;
  }): AsyncGenerator<string, void, unknown> {
    const model = this.getModel(params.tier);
    const config = this.getGenerationConfig(params.tier);

    const chat = model.startChat({
      history: this.formatHistory(params.history, params.documentContent),
      generationConfig: config,
    });

    const result = await chat.sendMessageStream(params.message);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Summarize text
   */
  async summarize(params: {
    text: string;
    type?: 'brief' | 'detailed' | 'bullet_points';
    tier?: string;
  }): Promise<string> {
    const { text, type = 'brief', tier = 'free' } = params;

    let prompt = '';
    switch (type) {
      case 'brief':
        prompt = `Provide a brief summary (2-3 sentences) of the following text:\n\n${text}`;
        break;
      case 'detailed':
        prompt = `Provide a detailed summary of the following text, covering all major points:\n\n${text}`;
        break;
      case 'bullet_points':
        prompt = `Summarize the following text in bullet points:\n\n${text}`;
        break;
      default:
        prompt = `Summarize the following text:\n\n${text}`;
    }

    return this.chat({ message: prompt, tier });
  }

  /**
   * Analyze document and extract metadata
   */
  async extractMetadata(documentContent: string, tier: string = 'free'): Promise<{
    title: string;
    summary: string;
    keyTopics: string[];
    documentType: string;
    estimatedReadingTime: number;
  }> {
    const model = this.getModel(tier);

    const prompt = `Analyze the following document and extract metadata. Respond in JSON format with these fields:
- title: A concise title for the document
- summary: A 2-3 sentence summary
- keyTopics: Array of 3-5 main topics/themes
- documentType: Type of document (e.g., "article", "research paper", "report", "story", etc.)
- estimatedReadingTime: Estimated reading time in minutes

Document:
${documentContent.substring(0, 10000)}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        ...this.getGenerationConfig(tier),
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text();
    
    try {
      return JSON.parse(text);
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        title: 'Untitled Document',
        summary: documentContent.substring(0, 200) + '...',
        keyTopics: [],
        documentType: 'document',
        estimatedReadingTime: Math.ceil(documentContent.split(' ').length / 200),
      };
    }
  }

  /**
   * Generate questions based on document content
   */
  async generateQuestions(params: {
    text: string;
    type?: 'comprehension' | 'critical_thinking' | 'discussion';
    count?: number;
    tier?: string;
  }): Promise<string[]> {
    const { text, type = 'comprehension', count = 5, tier = 'free' } = params;

    let prompt = '';
    switch (type) {
      case 'comprehension':
        prompt = `Generate ${count} comprehension questions about this text:\n\n${text}`;
        break;
      case 'critical_thinking':
        prompt = `Generate ${count} critical thinking questions about this text:\n\n${text}`;
        break;
      case 'discussion':
        prompt = `Generate ${count} discussion questions about this text:\n\n${text}`;
        break;
    }

    const response = await this.chat({ message: prompt, tier });

    // Parse questions from response
    const questions: string[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed[0]?.match(/\d/) || trimmed.startsWith('-') || trimmed.startsWith('•'))) {
        const question = trimmed.replace(/^\d+\.?\s*/, '').replace(/^[-•]\s*/, '').trim();
        if (question && question.length > 10) {
          questions.push(question);
        }
      }
    }

    return questions.slice(0, count);
  }

  /**
   * Extract structured memory entities from conversation
   */
  async extractMemoryEntities(params: {
    conversationMessages: Array<{ role: string; content: string }>;
    documentTitle?: string;
  }): Promise<{
    entities: Array<{
      type: 'concept' | 'question' | 'insight' | 'reference' | 'action' | 'document';
      text: string;
      metadata?: Record<string, any>;
    }>;
    relationships?: Array<{
      from: number;
      to: number;
      type: 'relates_to' | 'contradicts' | 'supports' | 'cites' | 'explains';
      strength?: number;
    }>;
  }> {
    const { conversationMessages, documentTitle } = params;
    const model = this.getModel('free'); // Use cheapest tier for extraction

    const conversationText = conversationMessages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const prompt = `Extract semantic entities from this conversation. Focus on:
- Concepts discussed (academic terms, theories, frameworks, methodologies)
- Questions asked by the user
- Insights or conclusions reached
- Document references (titles, authors, papers)
- Actions taken (notes created, highlights made, sections read)
${documentTitle ? `- Note that this conversation is about the document: "${documentTitle}"` : ''}

Output a JSON object with this structure:
{
  "entities": [
    {
      "type": "concept" | "question" | "insight" | "reference" | "action" | "document",
      "text": "the entity text (be specific and concise)",
      "metadata": {
        // optional metadata like "sourceMessageIndex": 0
      }
    }
  ],
  "relationships": [
    {
      "from": 0, // index in entities array
      "to": 1, // index in entities array  
      "type": "relates_to" | "contradicts" | "supports" | "cites" | "explains",
      "strength": 0.8 // 0.0 to 1.0
    }
  ]
}

Be thorough but concise. Extract 5-15 entities per conversation.

Conversation:
${conversationText}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      // Validate and normalize response
      return {
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
      };
    } catch (error) {
      console.error('Error extracting memory entities:', error);
      
      // Fallback: extract basic entities from message text
      const basicEntities = conversationMessages
        .filter(msg => msg.role === 'user')
        .map((msg, idx) => ({
          type: 'question' as const,
          text: msg.content.substring(0, 200),
          metadata: { sourceMessageIndex: idx }
        }));

      return {
        entities: basicEntities,
        relationships: [],
      };
    }
  }

  /**
   * Check if content is safe/appropriate
   */
  async moderateContent(content: string): Promise<{
    safe: boolean;
    reason?: string;
  }> {
    try {
      const model = this.getModel('free'); // Use free tier for moderation

      const prompt = `Analyze if the following content is safe and appropriate (no hate speech, violence, illegal content, etc.). Respond with JSON: {"safe": true/false, "reason": "explanation if not safe"}

Content:
${content.substring(0, 5000)}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const response = JSON.parse(result.response.text());
      return response;
    } catch (error) {
      // Default to safe if moderation fails
      return { safe: true };
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();

// Export helper functions for backward compatibility
export async function chatWithDocument(
  documentContent: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  tier: string = 'free'
): Promise<string> {
  return geminiService.chat({
    message: userMessage,
    documentContent,
    history: conversationHistory,
    tier,
  });
}

export async function* chatWithDocumentStream(
  documentContent: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  tier: string = 'free'
): AsyncGenerator<string, void, unknown> {
  yield* geminiService.chatStream({
    message: userMessage,
    documentContent,
    history: conversationHistory,
    tier,
  });
}

