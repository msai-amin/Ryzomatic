// AI Service for handling chat interactions with OpenAI and Gemini support
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Get API keys from environment
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Debug logging
console.log('=== AI Service Initialization ===');
console.log('OpenAI Key configured:', !!openaiApiKey);
console.log('Gemini Key configured:', !!geminiApiKey);
if (openaiApiKey) console.log('OpenAI Key starts with:', openaiApiKey.substring(0, 7) + '...');
if (geminiApiKey) console.log('Gemini Key starts with:', geminiApiKey.substring(0, 20) + '...');
console.log('===================================');

// Initialize OpenAI client
const openai = openaiApiKey ? new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Only for client-side usage
}) : null;

// Initialize Gemini client
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export const sendMessageToAI = async (message: string, documentContent?: string): Promise<string> => {
  // Truncate document content to fit within token limits
  const maxContentLength = 12000;
  let truncatedContent = documentContent;
  
  if (documentContent && documentContent.length > maxContentLength) {
    truncatedContent = documentContent.substring(0, maxContentLength);
    console.warn(`⚠️ Document truncated from ${documentContent.length} to ${maxContentLength} characters to fit token limit`);
  }

  // Try Gemini first (better for large contexts and free tier)
  if (genAI) {
    try {
      console.log('✅ Using Gemini API to generate response...');
      console.log('Message:', message.substring(0, 100) + '...');
      console.log('Has document content:', !!documentContent);

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      const prompt = `You are an AI assistant helping users understand and analyze documents.

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
      
      console.log('✅ Gemini API Response received:', text.substring(0, 100) + '...');
      return text;
    } catch (error) {
      console.error('❌ Error calling Gemini API:', error);
      console.log('⚠️ Falling back to OpenAI...');
    }
  }

  // Try GPT-4o-mini next (cost-effective for academic analysis)
  if (openai && openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      console.log('✅ Using GPT-4o-mini API to generate response...');
      console.log('Message:', message.substring(0, 100) + '...');
      console.log('Has document content:', !!documentContent);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping users understand and analyze documents, with particular expertise in literary and academic analysis.

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
      console.log('✅ GPT-4o-mini API Response received:', response.substring(0, 100) + '...');
      return response;
    } catch (error) {
      console.error('❌ Error calling GPT-4o-mini API:', error);
      console.log('⚠️ Falling back to mock responses...');
    }
  }


  // If both APIs are unavailable or failed, use mock responses
  console.warn('❌ No AI API keys configured. Using mock responses.');
  console.warn('Please set VITE_OPENAI_API_KEY or VITE_GEMINI_API_KEY in your .env file');
  return getMockResponse(message, documentContent);
}

// Fallback mock responses when OpenAI API is not available
const getMockResponse = (message: string, documentContent?: string): string => {
  // Simulate API delay (commented out to avoid unused variable warning)
  // const delay = 1000 + Math.random() * 2000
  
  // Mock AI responses based on the message content
  const responses = [
    "I understand you're asking about the document. Let me help you with that.",
    "Based on the content I can see, here's what I found...",
    "That's an interesting question about the text. Let me analyze it for you.",
    "I can help you understand this better. Here's my analysis...",
    "Looking at the document content, I can provide some insights...",
    "Let me break this down for you based on what I can see in the text.",
    "I'd be happy to help you with that. Here's what I think...",
    "That's a great question! Based on the document, here's my response...",
  ]

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
  const randomResponse = responses[Math.floor(Math.random() * responses.length)]
  return `${randomResponse}\n\n${documentContent ? 
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
  if (!openai) {
    throw new Error('OpenAI API is not configured. Please set VITE_OPENAI_API_KEY in your .env file');
  }

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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: prompts[analysisType]
      }],
      max_tokens: 4000,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
  } catch (error) {
    console.error('Error in GPT analysis:', error);
    throw error;
  }
};

// Export the AI clients for advanced usage
export { openai, genAI };

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


