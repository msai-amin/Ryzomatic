// AI Service for handling chat interactions with OpenAI and Gemini support
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger, trackPerformance } from './logger'
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler'
import { validateAIPrompt, validateDocumentContent } from './validation'

// Get API keys from environment
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize logging
logger.info('AI Service Initialization', {
  component: 'AIService',
  action: 'Initialize'
}, {
  openaiConfigured: !!openaiApiKey,
  geminiConfigured: !!geminiApiKey,
  openaiKeyPrefix: openaiApiKey ? openaiApiKey.substring(0, 7) + '...' : 'none',
  geminiKeyPrefix: geminiApiKey ? geminiApiKey.substring(0, 20) + '...' : 'none'
});

// Initialize OpenAI client
const createOpenAIClient = () => {
  if (!openaiApiKey) {
    return null;
  }

  const config = {
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true // Only for client-side usage
  } as const;

  try {
    const OpenAIConstructor = OpenAI as unknown as new (options: typeof config) => OpenAI;
    return new OpenAIConstructor(config);
  } catch (error) {
    if (error instanceof TypeError) {
      const factory = OpenAI as unknown as (options: typeof config) => OpenAI;
      return factory(config);
    }
    throw error;
  }
};

let openaiClient = createOpenAIClient();

// Initialize Gemini client
const createGeminiClient = () => {
  if (!geminiApiKey) {
    return null;
  }

  try {
    const GeminiConstructor = GoogleGenerativeAI as unknown as new (apiKey: string) => GoogleGenerativeAI;
    return new GeminiConstructor(geminiApiKey);
  } catch (error) {
    if (error instanceof TypeError) {
      const factory = GoogleGenerativeAI as unknown as (apiKey: string) => GoogleGenerativeAI;
      return factory(geminiApiKey);
    }
    throw error;
  }
};

let geminiClient = createGeminiClient();

// Test hooks for injecting mock clients
export const __setOpenAIClientForTests = (client: any) => {
  openaiClient = client;
};

export const __setGeminiClientForTests = (client: any) => {
  geminiClient = client;
};

// Helper function to get the appropriate Gemini model based on tier
const getGeminiModel = (tier: 'free' | 'custom' = 'free') => {
  if (!geminiClient) return null;
  
  const modelName = 'gemini-2.5-flash';
  return geminiClient.getGenerativeModel({ model: modelName });
};

// Load the SQ3R system prompt
const loadSystemPrompt = async (): Promise<string | null> => {
  try {
    const response = await fetch('/system-prompts-gemini25/ComprehensiveSummary.md');
    if (response.ok) {
      const content = await response.text();
      return content;
    }
    logger.warn('Could not load SQ3R system prompt', {
      component: 'AIService',
      action: 'loadSystemPrompt'
    });
    return null;
  } catch (error) {
    logger.error('Failed to load SQ3R system prompt', {
      component: 'AIService',
      action: 'loadSystemPrompt'
    }, error as Error);
    return null;
  }
};

export const sendMessageToAI = async (
  message: string, 
  documentContent?: string, 
  tier: 'free' | 'custom' = 'free',
  mode: 'general' | 'study' | 'notes' = 'general'
): Promise<string> => {
  const context = {
    component: 'AIService',
    action: 'sendMessageToAI',
    mode
  };

  // Validate inputs
  const messageValidation = validateAIPrompt(message, context);
  if (!messageValidation.isValid) {
    const error = errorHandler.createError(
      `Invalid AI prompt: ${messageValidation.errors.join(', ')}`,
      ErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      context,
      { validationErrors: messageValidation.errors }
    );
    throw error;
  }

  if (documentContent) {
    const contentValidation = validateDocumentContent(documentContent, context);
    if (!contentValidation.isValid) {
      const error = errorHandler.createError(
        `Invalid document content: ${contentValidation.errors.join(', ')}`,
        ErrorType.VALIDATION,
        ErrorSeverity.MEDIUM,
        context,
        { validationErrors: contentValidation.errors }
      );
      throw error;
    }
  }

  return trackPerformance('sendMessageToAI', async () => {
    // Load SQ3R prompt if in study or notes mode
    let sq3rPrompt = '';
    if (mode === 'study' || mode === 'notes') {
      const systemPrompt = await loadSystemPrompt();
      if (systemPrompt) {
        sq3rPrompt = systemPrompt + '\n\n';
      }
    }
    // Truncate document content to fit within token limits
    const maxContentLength = 12000;
    let truncatedContent = documentContent;
    
    if (documentContent && documentContent.length > maxContentLength) {
      truncatedContent = documentContent.substring(0, maxContentLength);
      logger.warn('Document content truncated', context, undefined, {
        originalLength: documentContent.length,
        truncatedLength: maxContentLength
      });
    }

    // Try Gemini first (better for large contexts and free tier)
    if (geminiClient) {
      try {
        logger.info('Using Gemini API', context, {
          messageLength: message.length,
          hasDocumentContent: !!documentContent,
          documentLength: documentContent?.length || 0,
          tier: tier
        });

        const model = getGeminiModel(tier);
        
        const baseSystemPrompt = mode === 'study' || mode === 'notes' ? sq3rPrompt : '';
        
        const prompt = `${baseSystemPrompt}You are an AI assistant helping users understand and analyze documents.

${truncatedContent ? 
  `The user has uploaded a document. Here is a portion of the content:\n\n${truncatedContent}\n\n` +
  (documentContent && documentContent.length > maxContentLength ? 
    'Note: The document is very long, so only the beginning is shown. If the user asks about later parts, let them know you can only see the beginning of the document.' :
    'Please provide helpful, accurate responses based on the document content.') :
  'The user has not uploaded any document yet. Please ask them to upload a document first.'
}

User Question: ${message}

Please provide a helpful, accurate response:`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        logger.info('Gemini API response received', context, {
          responseLength: text.length
        });
        
        return text;
      } catch (error) {
        logger.error('Gemini API error', context, error as Error);
        // Continue to OpenAI fallback
      }
    }

    // Try GPT-4o-mini next (cost-effective for academic analysis)
    if (openaiClient) {
      try {
        logger.info('Using OpenAI GPT-4o-mini API', context, {
          messageLength: message.length,
          hasDocumentContent: !!documentContent,
          documentLength: documentContent?.length || 0
        });

        const baseSystemPrompt = mode === 'study' || mode === 'notes' ? sq3rPrompt : '';
        
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `${baseSystemPrompt}You are an AI assistant helping users understand and analyze documents, with particular expertise in literary and academic analysis.

${truncatedContent ? 
  `The user has uploaded a document. Here is a portion of the content:\n\n${truncatedContent}\n\n` +
  (documentContent && documentContent.length > maxContentLength ? 
    'Note: The document is very long, so only the beginning is shown. If the user asks about later parts, let them know you can only see the beginning of the document.' :
    'Please provide helpful, accurate responses based on the document content.') :
  'The user has not uploaded any document yet. Please ask them to upload a document first.'
}`
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 4000,
          temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
        
        logger.info('OpenAI API response received', context, {
          responseLength: response.length
        });
        
        return response;
      } catch (error) {
        logger.error('OpenAI API error', context, error as Error);
        // Continue to mock response fallback
      }
    }

    // If both APIs are unavailable or failed, use mock responses
    logger.warn('No AI API keys configured, using mock responses', context, undefined, {
      openaiConfigured: !!openaiClient,
      geminiConfigured: !!geminiClient
    });
    
    return getMockResponse(message, documentContent);
  }, context, {
    messageLength: message.length,
    hasDocumentContent: !!documentContent,
    documentLength: documentContent?.length || 0
  });
}

// Fallback mock responses when OpenAI API is not available
const getMockResponse = (message: string, documentContent?: string): string => {
  // Simulate API delay (commented out to avoid unused variable warning)
  // const delay = 1000 + Math.random() * 2000
  
  // Mock AI responses based on the message content
  // Simple keyword-based responses for demo purposes
  if (message.toLowerCase().includes('summary') || message.toLowerCase().includes('summarize')) {
    return `Here's a summary of the document content:\n\n${documentContent ? 
      `The document contains ${documentContent.length} characters of text. ` +
      `Key topics appear to include various subjects that would be analyzed in a real implementation. ` +
      `This is a demo response - in production, I would provide an actual AI-generated summary.` :
      'I don\'t have access to any document content to summarize. Please upload a document first.'
    }`
  }

  if (message.toLowerCase().includes('explain') || message.toLowerCase().includes('what does')) {
    return `I'd be happy to explain that for you. ${documentContent ? 
      'Based on the document content, I can provide detailed explanations. ' +
      'In a real implementation, I would analyze the specific parts of the text you\'re asking about.' :
      'However, I don\'t have access to any document content to reference. Please upload a document first.'
    }`
  }

  if (message.toLowerCase().includes('question') || message.toLowerCase().includes('?')) {
    return `That's a great question! ${documentContent ? 
      'Let me analyze the document to provide you with a comprehensive answer. ' +
      'In a real implementation, I would search through the content for relevant information.' :
      'I\'d be happy to help, but I need to see the document content first. Please upload a document.'
    }`
  }

  // Default response
  const baseResponse = "I understand you're asking about the document. Let me help you with that."
  return `${baseResponse}\n\n${documentContent ? 
    `I can see you have a document with ${documentContent.length} characters. ` +
    `In a real implementation, I would analyze this content to provide more specific answers.` :
    'To provide more helpful responses, please upload a document first.'
  }`
}

// Specialized GPT-4o-mini function for academic and literary analysis
export const analyzeWithGPT = async (
  text: string, 
  analysisType: 'framework' | 'literary' | 'argument' | 'synthesis' = 'framework'
): Promise<string> => {
  const context = {
    component: 'AIService',
    action: 'analyzeWithGPT',
    analysisType
  };

  // Validate inputs
  const textValidation = validateDocumentContent(text, context);
  if (!textValidation.isValid) {
    const error = errorHandler.createError(
      `Invalid text for analysis: ${textValidation.errors.join(', ')}`,
      ErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      context,
      { validationErrors: textValidation.errors }
    );
    throw error;
  }

  if (!openaiClient) {
    const error = errorHandler.createError(
      'OpenAI API is not configured. Please set VITE_OPENAI_API_KEY in your .env file.',
      ErrorType.AI_SERVICE,
      ErrorSeverity.HIGH,
      context
    );
    throw error;
  }

  return trackPerformance('analyzeWithGPT', async () => {
    const prompts = {
      framework: `Analyze this academic text and identify all theoretical frameworks, methodologies, and key concepts. For each framework:
1. Name and describe the framework
2. Identify the author/originator
3. List key terms and concepts
4. Explain how it's applied in this text
5. Suggest related frameworks

Text: ${text}`,
      
      literary: `Perform a close reading of this literary passage. Analyze:
1. Rhetorical devices and literary techniques
2. Themes and motifs
3. Tone and style
4. Symbolism and metaphor
5. Historical and cultural context

Text: ${text}`,
      
      argument: `Reconstruct the philosophical argument in this text. Provide:
1. Main thesis/conclusion
2. Supporting premises
3. Logical structure
4. Assumptions and presuppositions
5. Potential counterarguments

Text: ${text}`,
      
      synthesis: `Synthesize the key ideas from this text and:
1. Identify main themes and concepts
2. Connect to broader scholarly conversations
3. Suggest research questions and gaps
4. Provide interdisciplinary connections
5. Recommend related readings

Text: ${text}`
    };

    try {
      logger.info('Starting GPT analysis', context, {
        textLength: text.length,
        analysisType
      });

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompts[analysisType]
        }],
        max_tokens: 4000,
        temperature: 0.7
      });

      const result = completion.choices[0]?.message?.content || 'Analysis failed';
      
      logger.info('GPT analysis completed', context, {
        resultLength: result.length
      });

      return result;
    } catch (error) {
      logger.error('GPT analysis failed', context, error as Error);
      throw error;
    }
  }, context, {
    textLength: text.length,
    analysisType
  });
};

/**
 * Ask AI for clarification on selected text with context
 */
export const askForClarification = async (
  selectedText: string,
  context: string,
  documentContent?: string,
  tier: 'free' | 'custom' = 'free'
): Promise<string> => {
  const logContext = {
    component: 'AIService',
    action: 'askForClarification'
  };

  return trackPerformance('askForClarification', async () => {
    const prompt = `Please clarify and explain the following text in simpler, easier-to-understand terms.

Selected text to clarify:
"${selectedText}"

Surrounding context:
${context}

Please provide:
1. A simplified explanation of what this text means
2. Key terms or concepts defined
3. Examples or analogies to help understand it better
4. Why this might be important in the context of the document

Please be clear, concise, and helpful.`;

    if (geminiClient) {
      try {
        logger.info('Using Gemini for clarification', logContext, {
          selectedTextLength: selectedText.length,
          contextLength: context.length,
          tier: tier
        });

        const model = getGeminiModel(tier);
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        logger.info('Gemini clarification response received', logContext, {
          responseLength: response.length
        });
        
        return response;
      } catch (error) {
        logger.error('Gemini clarification error', logContext, error as Error);
      }
    }

    if (openaiClient) {
      try {
        logger.info('Using OpenAI for clarification', logContext, {
          selectedTextLength: selectedText.length,
          contextLength: context.length
        });

        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant that excels at explaining complex concepts in simple, clear language."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a clarification.';
        
        logger.info('OpenAI clarification response received', logContext, {
          responseLength: response.length
        });
        
        return response;
      } catch (error) {
        logger.error('OpenAI clarification error', logContext, error as Error);
      }
    }

    // Fallback response
    return `I'd be happy to clarify this text for you:\n\n"${selectedText}"\n\nIn a real implementation with AI API keys configured, I would provide a detailed, simplified explanation of this concept. Please configure your Gemini or OpenAI API key to enable this feature.`;
  }, logContext, {
    selectedTextLength: selectedText.length,
    contextLength: context.length
  });
};

/**
 * Get further reading suggestions based on selected text
 */
export const getFurtherReading = async (
  selectedText: string,
  context: string,
  documentContent?: string,
  tier: 'free' | 'custom' = 'free'
): Promise<string> => {
  const logContext = {
    component: 'AIService',
    action: 'getFurtherReading'
  };

  return trackPerformance('getFurtherReading', async () => {
    const prompt = `Based on the following text, suggest further reading topics, related concepts, and resources to explore.

Selected text:
"${selectedText}"

Surrounding context:
${context}

Please provide:
1. Key concepts and topics related to this text
2. Suggested areas for deeper exploration
3. Related theoretical frameworks or methodologies
4. Recommended search terms or keywords for further research
5. How this connects to broader themes in the field

Be specific and actionable in your suggestions.`;

    if (geminiClient) {
      try {
        logger.info('Using Gemini for further reading suggestions', logContext, {
          selectedTextLength: selectedText.length,
          contextLength: context.length,
          tier: tier
        });

        const model = getGeminiModel(tier);
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        
        logger.info('Gemini further reading response received', logContext, {
          responseLength: response.length
        });
        
        return response;
      } catch (error) {
        logger.error('Gemini further reading error', logContext, error as Error);
      }
    }

    if (openaiClient) {
      try {
        logger.info('Using OpenAI for further reading suggestions', logContext, {
          selectedTextLength: selectedText.length,
          contextLength: context.length
        });

        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a knowledgeable research assistant that helps people discover related topics and deepen their understanding through further reading."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate suggestions.';
        
        logger.info('OpenAI further reading response received', logContext, {
          responseLength: response.length
        });
        
        return response;
      } catch (error) {
        logger.error('OpenAI further reading error', logContext, error as Error);
      }
    }

    // Fallback response
    return `I'd be happy to suggest further reading based on:\n\n"${selectedText}"\n\nIn a real implementation with AI API keys configured, I would provide detailed suggestions for related topics, concepts, and resources to explore. Please configure your Gemini or OpenAI API key to enable this feature.`;
  }, logContext, {
    selectedTextLength: selectedText.length,
    contextLength: context.length
  });
};

// In a real implementation, you would replace this with actual API calls:
/*
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
})

export const sendMessageToAI = async (message: string, documentContent?: string): Promise<string> => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping users understand and analyze documents. 
                   The user has uploaded a document with the following content: ${documentContent || 'No document content available.'}
                   Please provide helpful, accurate responses based on the document content.`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.'
  } catch (error) {
    console.error('Error calling OpenAI API:', error)
    throw new Error('Failed to get AI response')
  }
}
*/


