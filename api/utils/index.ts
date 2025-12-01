/**
 * Consolidated Utils API
 * Handles text cleanup and formula conversion in a single endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiService } from '../../lib/gemini.js';

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
 * Preprocess text to remove publication metadata using regex patterns
 * This improves accuracy and reduces token usage before sending to Gemini
 */
function preprocessPublicationMetadata(text: string): string {
  let cleaned = text;

  // Remove lines containing DOI patterns
  cleaned = cleaned.replace(/^.*DOI\s+[\d\.\/]+\s*$/gim, '');
  
  // Remove "In Journal of..." or "In [Journal Name]..." patterns
  cleaned = cleaned.replace(/^In\s+(Journal\s+of\s+)?[A-Z][^\.]+\.?\s*\d{4}\/\d+\s+No\s+\d+.*$/gim, '');
  
  // Remove publisher lines (e.g., "PublisherCollège international de Philosophie")
  cleaned = cleaned.replace(/^Publisher[A-Z][^\n]*$/gim, '');
  
  // Remove "pages X to Y" patterns
  cleaned = cleaned.replace(/^.*pages?\s+\d+\s+to\s+\d+.*$/gim, '');
  
  // Remove full URL lines (http://, https://)
  cleaned = cleaned.replace(/^https?:\/\/[^\s]+\s*$/gim, '');
  
  // Remove "Article available online at" lines
  cleaned = cleaned.replace(/^Article\s+available\s+online\s+at.*$/gim, '');
  
  // Remove "Discover the contents..." lines
  cleaned = cleaned.replace(/^Discover\s+the\s+contents.*$/gim, '');
  
  // Remove "follow the journal by email, subscribe..." lines
  cleaned = cleaned.replace(/^.*follow\s+the\s+journal\s+by\s+email.*subscribe.*$/gim, '');
  
  // Remove QR code instructions
  cleaned = cleaned.replace(/^Scan\s+this\s+QR\s+Code.*$/gim, '');
  cleaned = cleaned.replace(/^.*QR\s+Code.*$/gim, '');
  
  // Remove "Downloaded on..." with IP addresses
  cleaned = cleaned.replace(/^.*Downloaded\s+on\s+\d{1,2}\/\d{1,2}\/\d{4}.*$/gim, '');
  cleaned = cleaned.replace(/^.*\(IP:\s+\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\).*$/gim, '');
  
  // Remove lines with IP addresses in parentheses
  cleaned = cleaned.replace(/^.*\(IP:\s*[\d\.]+\).*$/gim, '');
  
  // Remove "from https://..." download references
  cleaned = cleaned.replace(/^.*from\s+https?:\/\/[^\s]+.*$/gim, '');
  
  // Remove journal/publisher names at start of lines (common pattern)
  cleaned = cleaned.replace(/^[A-Z][a-z]+\s+(international|de|du|des|la|le|les)\s+[A-Z][a-z]+.*$/gim, '');
  
  // Remove ISSN patterns
  cleaned = cleaned.replace(/^.*ISSN\s+[\d\-X]+.*$/gim, '');
  
  // Remove "Cairn.info" references
  cleaned = cleaned.replace(/^.*cairn\.info.*$/gim, '');
  
  // Remove lines that are mostly URLs or email-like patterns
  cleaned = cleaned.replace(/^[^\s]*@[^\s]*\s*$/gim, '');
  
  // Remove standalone copyright symbols and notices
  cleaned = cleaned.replace(/^[©©]\s*.*$/gim, '');
  cleaned = cleaned.replace(/^Copyright\s+©.*$/gim, '');
  cleaned = cleaned.replace(/^©\s+\d{4}.*$/gim, '');
  
  // Remove "All rights reserved" lines
  cleaned = cleaned.replace(/^.*All\s+rights\s+reserved.*$/gim, '');
  
  // Remove "The Authors" attribution lines (at end of articles)
  cleaned = cleaned.replace(/^.*The\s+Authors.*$/gim, '');
  
  // Remove "published by..." lines
  cleaned = cleaned.replace(/^.*published\s+by\s+[A-Z].*$/gim, '');
  
  // Remove lines that are mostly numbers and special chars (likely metadata)
  cleaned = cleaned.replace(/^[\d\s\.\/\-\:]+$/gm, '');
  
  // Remove empty lines that were created by removals (but preserve paragraph structure)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Clean up leading/trailing whitespace on each line
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  // Remove completely empty paragraphs (double newlines with nothing between)
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleaned.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.body?.action || req.query.action) as string;

  // Route based on action
  switch (action) {
    case 'cleanup':
      return handleTextCleanup(req, res);
    case 'convert-formula':
      return handleFormulaConversion(req, res);
    default:
      return res.status(400).json({ 
        error: 'Invalid action', 
        validActions: ['cleanup', 'convert-formula']
      });
  }
}

/**
 * Handle text cleanup
 */
async function handleTextCleanup(req: VercelRequest, res: VercelResponse) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse body if needed
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return res.status(400).json({ 
          cleanedText: '',
          success: false,
          fallback: true,
          error: 'Invalid JSON in request body' 
        });
      }
    }

    const { text, preferences } = body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid text string is required' });
    }

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    // Limit text length to prevent abuse
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

    // Preprocess text to remove publication metadata before sending to Gemini
    // This improves accuracy and reduces token usage
    let processedText = text;
    if (cleanupPrefs.optimizeForTTS || cleanupPrefs.removeHeadersFooters) {
      processedText = preprocessPublicationMetadata(text);
      
      // If preprocessing removed too much (more than 50%), use original text
      // This prevents over-aggressive removal of actual content
      if (processedText.length < text.length * 0.5) {
        console.warn('Preprocessing removed too much text, using original');
        processedText = text;
      }
    }

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
   - **Remove any remaining publication metadata and copyright notices**:
     * Any remaining copyright symbols, publication information, or editorial metadata
     * Any remaining URLs, DOI references, or publication identifiers

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
${processedText}`;

      // Check if Gemini API key is configured
      if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not configured');
        return res.status(200).json({ 
          cleanedText: processedText,
          success: true,
          fallback: true,
          error: 'GEMINI_API_KEY not configured'
        });
      }

      // Use Gemini service with free tier
      let response: string;
      try {
        response = await geminiService.chat({
          message: ttsPrompt,
          tier: 'free',
        });
      } catch (geminiError: any) {
        console.error('Gemini API error in TTS optimization:', geminiError);
        return res.status(200).json({ 
          cleanedText: processedText,
          success: true,
          fallback: true,
          error: geminiError?.message || 'Gemini API call failed'
        });
      }

      if (!response) {
        console.error('Text cleanup (TTS optimization): Empty response from Gemini');
        return res.status(200).json({ 
          cleanedText: processedText,
          success: true,
          fallback: true
        });
      }

      // Clean up the response
      let cleanedText = response.trim();
      cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '');
      cleanedText = cleanedText.replace(/^(Optimized text|Result|Output|Here is the optimized text):\s*/i, '');
      cleanedText = cleanedText.trim();

      if (!cleanedText || cleanedText.length < processedText.length * 0.1) {
        console.warn('Text cleanup (TTS optimization): Response seems invalid, using preprocessed text');
        return res.status(200).json({ 
          cleanedText: processedText,
          success: true,
          fallback: true
        });
      }

      return res.status(200).json({ 
        cleanedText,
        success: true 
      });
    }

    // Build prompt based on other preferences
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
    
    prompt += `\n\nText to clean:\n${processedText}`;

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(200).json({ 
        cleanedText: processedText,
        success: true,
        fallback: true,
        error: 'GEMINI_API_KEY not configured'
      });
    }

    // Use Gemini service with free tier
    let response: string;
    try {
      response = await geminiService.chat({
        message: prompt,
        tier: 'free',
      });
    } catch (geminiError: any) {
      console.error('Gemini API error:', geminiError);
      return res.status(200).json({ 
        cleanedText: processedText,
        success: true,
        fallback: true,
        error: geminiError?.message || 'Gemini API call failed'
      });
    }

    if (!response) {
      console.error('Text cleanup: Empty response from Gemini');
      return res.status(200).json({ 
        cleanedText: processedText,
        success: true,
        fallback: true
      });
    }

    // Clean up the response
    let cleanedText = response.trim();
    cleanedText = cleanedText.replace(/```[\s\S]*?```/g, '');
    cleanedText = cleanedText.replace(/^(Cleaned text|Result|Output|Here is the cleaned text):\s*/i, '');
    cleanedText = cleanedText.trim();

    if (!cleanedText || cleanedText.length < processedText.length * 0.1) {
      console.warn('Text cleanup: Response seems invalid, using preprocessed text');
      return res.status(200).json({ 
        cleanedText: processedText,
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
    
    let fallbackText = '';
    try {
      const body = req.body || {};
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          fallbackText = parsed?.text || '';
        } catch {
          // Ignore parse errors
        }
      } else if (body && typeof body.text === 'string') {
        fallbackText = body.text;
      }
    } catch {
      // Ignore errors in fallback extraction
    }
    
    return res.status(200).json({ 
      cleanedText: fallbackText,
      success: true,
      fallback: true,
      error: error?.message || 'Unknown error occurred'
    });
  }
}

/**
 * Handle formula conversion
 */
async function handleFormulaConversion(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message string is required' });
    }

    // Limit message length to prevent abuse
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    // Use Gemini service directly for formula conversion
    const response = await geminiService.chat({
      message,
      tier: 'free',
    });

    if (!response) {
      console.error('Formula conversion: Empty response from Gemini');
      return res.status(200).json({ 
        response: message,
        success: true,
        fallback: true
      });
    }

    // Clean up the response to extract just the LaTeX
    let latex = response.trim();
    latex = latex.replace(/```latex\n?/g, '').replace(/```\n?/g, '');
    latex = latex.replace(/^(LaTeX code:|Output:|Result:)\s*/i, '');
    latex = latex.replace(/\n.*explanation.*/gi, '');
    latex = latex.trim();
    
    if (latex.includes('\n')) {
      const lines = latex.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        latex = lines[0];
      }
    }

    if (!latex) {
      latex = message;
    }

    return res.status(200).json({ 
      response: latex,
      success: true 
    });

  } catch (error: any) {
    console.error('Formula conversion error:', error);
    
    const { message } = req.body;
    return res.status(200).json({ 
      response: message || '',
      success: true,
      fallback: true,
      error: error.message
    });
  }
}
