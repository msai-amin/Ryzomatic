import type { VercelRequest, VercelResponse } from '@vercel/node';
import { geminiService } from '../../lib/gemini';

/**
 * Formula Conversion API Endpoint
 * 
 * Converts mathematical expressions to LaTeX using Gemini AI
 * This is an internal endpoint that doesn't require authentication
 * as it's used for formula rendering in reading mode
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    // This bypasses the chat stream endpoint and authentication
    const response = await geminiService.chat({
      message,
      tier: 'free', // Use free tier for formula conversion
    });

    if (!response) {
      console.error('Formula conversion: Empty response from Gemini');
      // Return the original message as fallback
      return res.status(200).json({ 
        response: message,
        success: true,
        fallback: true
      });
    }

    // Clean up the response to extract just the LaTeX
    let latex = response.trim();
    
    // Remove markdown code blocks
    latex = latex.replace(/```latex\n?/g, '').replace(/```\n?/g, '');
    
    // Remove explanatory text (common patterns)
    latex = latex.replace(/^(LaTeX code:|Output:|Result:)\s*/i, '');
    latex = latex.replace(/\n.*explanation.*/gi, '');
    
    // Trim whitespace
    latex = latex.trim();
    
    // If still contains multiple lines, take the first substantial line
    if (latex.includes('\n')) {
      const lines = latex.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        latex = lines[0];
      }
    }

    // If latex is empty after cleaning, return original message
    if (!latex) {
      latex = message;
    }

    return res.status(200).json({ 
      response: latex,
      success: true 
    });

  } catch (error: any) {
    console.error('Formula conversion error:', error);
    
    // Return a fallback response instead of failing completely
    const { message } = req.body;
    return res.status(200).json({ 
      response: message || '',
      success: true,
      fallback: true,
      error: error.message
    });
  }
}
