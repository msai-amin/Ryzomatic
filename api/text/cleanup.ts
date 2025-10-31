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
  optimizeForTTS?: boolean;
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
      optimizeForTTS: Boolean(preferences.optimizeForTTS),
    };

    // If TTS optimization is enabled, use specialized prompt
    if (cleanupPrefs.optimizeForTTS) {
      const ttsPrompt = `Optimize the following text for Text-to-Speech (TTS) playback. This text will be read aloud, so make it sound natural and clear when spoken:

1. **Expand abbreviations**: Convert common abbreviations to full words:
   - Dr. → Doctor
   - Mr. → Mister
   - Mrs. → Missus
   - etc. → et cetera
   - e.g. → for example
   - i.e. → that is
   - vs. → versus
   - Similar abbreviations should be expanded

2. **Format numbers for speech**:
   - Dates: "2024" → "twenty twenty-four", "1995" → "nineteen ninety-five"
   - Times: "3:00 PM" → "three PM", "9:30" → "nine thirty"
   - Percentages: "50%" → "fifty percent", "75.5%" → "seventy-five point five percent"
   - Large numbers: "1,000" → "one thousand", "1,000,000" → "one million"
   - Decimals: "3.14" → "three point one four"
   - Small numbers (1-20) can stay as digits or be written out based on context

3. **Fix punctuation**:
   - Ensure every sentence ends with proper punctuation (period, question mark, exclamation)
   - Add natural commas where speech would pause
   - Fix spacing around punctuation
   - Remove excessive punctuation

4. **Break long sentences**:
   - Split overly long sentences (30+ words) into shorter, more natural speech units (15-20 words)
   - Maintain meaning while improving flow

5. **Remove/replace non-speech elements**:
   - Replace formulas and equations with spoken descriptions or "[formula]" placeholder
   - Remove footnote references like [1], [2], (see note 1), etc.
   - Remove citations in parentheses: (Smith, 2024) → remove or convert to "as noted by Smith"
   - Replace URLs with "[link]" or readable domain name
   - Replace email addresses with "[email]" or spell out
   - **Remove publication metadata and copyright notices**:
     * Copyright symbols and notices (©, Copyright, All rights reserved, "The Authors", "published by X", etc.)
     * Publication information (journal names, publisher names, "published by Wiley Periodicals LLC", etc.)
     * Editorial metadata ("This article is part of...", "Topic Editors", "Topic Editor", special issue information)
     * References to other articles ("For a full listing, see [URL]", "see [journal] early view", etc.)
     * ISSN numbers, DOI references, and similar publication identifiers
     * Author attributions that are publication metadata (at the end of articles, not citations within content)
     * "This article is part of" statements and related editorial information
     * Any lines or paragraphs that primarily contain publication/editorial metadata rather than article content

6. **Format special content for speech**:
   - Acronyms: Decide whether to spell out (NASA → "N-A-S-A") or keep as word (NATO) based on common usage
   - Lists: Convert bullet points to "First," "Second," "Third," etc.
   - Tables: Convert to descriptive prose like "The table shows..."
   - Equations: Replace with verbal descriptions

7. **Improve flow and readability**:
   - Add natural transition phrases where appropriate ("Furthermore," "However," "Additionally," etc.)
   - Ensure smooth connections between sentences and paragraphs
   - Fix awkward phrasing that would sound unnatural when spoken

8. **Fix capitalization**:
   - Ensure proper sentence capitalization
   - Fix improper capitalization mid-sentence
   - Preserve proper nouns correctly

9. **Normalize quotes**:
   - Convert smart quotes ("") to straight quotes (")
   - Convert smart apostrophes (') to straight apostrophes (')

10. **Preserve paragraph structure**:
    - Maintain paragraph breaks with \\n\\n (double newline)
    - Do NOT remove paragraph breaks - they're essential for TTS pauses
    - Ensure proper spacing between paragraphs

**Important**: 
- Preserve the main content and meaning completely
- Keep paragraph structure with \\n\\n breaks (CRITICAL for TTS pause system)
- Make the text sound natural when read aloud
- Return ONLY the optimized text without any explanatory comments or metadata

Text to optimize:
${text}`;

      // Use Gemini service with free tier (gemini-2.5-flash-lite)
      const response = await geminiService.chat({
        message: ttsPrompt,
        tier: 'free', // Uses gemini-2.5-flash-lite
      });

      if (!response) {
        console.error('Text cleanup (TTS optimization): Empty response from Gemini');
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
      cleanedText = cleanedText.replace(/^(Optimized text|Result|Output|Here is the optimized text):\s*/i, '');
      cleanedText = cleanedText.trim();

      // If cleaned text is empty or too different in length (likely an error), return original
      if (!cleanedText || cleanedText.length < text.length * 0.1) {
        console.warn('Text cleanup (TTS optimization): Response seems invalid, using original text');
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
    }

    // Build prompt based on other preferences (existing cleanup logic)
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

