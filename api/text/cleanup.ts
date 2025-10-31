import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiService } from '../../lib/gemini';

interface CleanupPreferences {
  reorganizeParagraphs: boolean;
  removeFormulae: boolean;
  removeFootnotes: boolean;
  removeSideNotes: boolean;
  removeHeadersFooters?: boolean;
  simplifyFormatting?: boolean;
  reorganizationStyle?: 'logical' | 'chronological' | 'topic-based';
}

/**
 * Text Cleanup API Endpoint
 * 
 * Uses Gemini 2.5 Flash Lite to organize and clean text based on user preferences
 * This endpoint doesn't require authentication as it's used internally in reading mode
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, preferences } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid text string is required' });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    // Limit text length to prevent abuse (max 50000 characters per page)
    if (text.length > 50000) {
      return res.status(400).json({ error: 'Text too long (max 50000 characters per page)' });
    }

    // Validate preferences structure
    const cleanupPrefs: CleanupPreferences = {
      reorganizeParagraphs: Boolean(preferences.reorganizeParagraphs),
      removeFormulae: Boolean(preferences.removeFormulae),
      removeFootnotes: Boolean(preferences.removeFootnotes),
      removeSideNotes: Boolean(preferences.removeSideNotes),
      removeHeadersFooters: Boolean(preferences.removeHeadersFooters),
      simplifyFormatting: Boolean(preferences.simplifyFormatting),
      reorganizationStyle: preferences.reorganizationStyle || 'logical',
    };

    // Build prompt based on preferences
    let prompt = `Clean and organize the following text based on these requirements:\n\n`;

    if (cleanupPrefs.reorganizeParagraphs) {
      const styleInstruction = 
        cleanupPrefs.reorganizationStyle === 'chronological'
          ? 'Reorganize paragraphs in chronological order, maintaining time-based flow.\n'
          : cleanupPrefs.reorganizationStyle === 'topic-based'
          ? 'Reorganize paragraphs by grouping related topics together.\n'
          : 'Reorganize paragraphs for better logical flow and coherence.\n';
      prompt += `- ${styleInstruction}`;
    }

    if (cleanupPrefs.removeFormulae) {
      prompt += `- Remove all mathematical formulae, equations, and mathematical expressions. Replace them with "[formula removed]" or simply remove them if they interrupt the flow.\n`;
    }

    if (cleanupPrefs.removeFootnotes) {
      prompt += `- Remove all footnotes, footnote references (like [1], [2], etc.), and footnote content.\n`;
    }

    if (cleanupPrefs.removeSideNotes) {
      prompt += `- Remove all side notes, margin annotations, and callout boxes.\n`;
    }

    if (cleanupPrefs.removeHeadersFooters) {
      prompt += `- Remove headers and footers (page numbers, document titles repeated on each page, etc.).\n`;
    }

    if (cleanupPrefs.simplifyFormatting) {
      prompt += `- Simplify complex formatting while preserving essential structure and readability.\n`;
    }

    prompt += `\nImportant guidelines:\n`;
    prompt += `- Preserve the main content and meaning of the text\n`;
    prompt += `- Maintain paragraph structure unless reorganizing\n`;
    prompt += `- Keep important information and context\n`;
    prompt += `- Ensure the cleaned text remains readable and coherent\n`;
    prompt += `- Return ONLY the cleaned text without any explanatory comments or metadata\n`;
    
    prompt += `\n\nText to clean:\n${text}`;

    // Use Gemini service with free tier (gemini-2.5-flash-lite)
    const response = await geminiService.chat({
      message: prompt,
      tier: 'free', // Uses gemini-2.5-flash-lite
    });

    if (!response) {
      console.error('Text cleanup: Empty response from Gemini');
      // Return original text as fallback
      return res.status(200).json({ 
        cleanedText: text,
        success: true,
        fallback: true
      });
    }

    // Clean up the response
    let cleanedText = response.trim();
    
    // Remove any markdown code blocks that Gemini might add
    cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '');
    
    // Remove explanatory prefixes if present
    cleanedText = cleanedText.replace(/^(Cleaned text|Result|Output|Here is the cleaned text):\s*/i, '');
    cleanedText = cleanedText.trim();

    // If cleaned text is empty or too different in length (likely an error), return original
    if (!cleanedText || cleanedText.length < text.length * 0.1) {
      console.warn('Text cleanup: Response seems invalid, using original text');
      return res.status(200).json({ 
        cleanedText: text,
        success: true,
        fallback: true
      });
    }

    return res.status(200).json({ 
      cleanedText,
      success: true 
    });

  } catch (error: any) {
    console.error('Text cleanup error:', error);
    
    // Return original text as fallback instead of failing completely
    const { text } = req.body;
    return res.status(200).json({ 
      cleanedText: text || '',
      success: true,
      fallback: true,
      error: error.message
    });
  }
}

