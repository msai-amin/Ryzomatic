/**
 * Azure TTS Proxy Endpoint
 * 
 * Proxies Azure TTS requests to avoid HTTP/2 protocol errors in browsers.
 * This serverless function calls Azure TTS API and returns the audio data.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice, locale, region, ssml } = req.body;

    if (!text && !ssml) {
      return res.status(400).json({ error: 'Text or SSML is required' });
    }

    // Get Azure TTS credentials from environment
    // Try both VITE_ and non-VITE_ versions for compatibility
    const subscriptionKey = process.env.AZURE_TTS_KEY || process.env.VITE_AZURE_TTS_KEY;
    const azureRegion = region || process.env.AZURE_TTS_REGION || process.env.VITE_AZURE_TTS_REGION || 'eastus';

    if (!subscriptionKey) {
      console.error('Azure TTS subscription key not configured');
      return res.status(500).json({ error: 'Azure TTS not configured' });
    }

    // Build the SSML if not provided
    const ssmlContent = ssml || `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale || 'en-US'}">
      <voice name="${voice || 'en-US-AriaNeural'}">
        ${escapeXml(text || '')}
      </voice>
    </speak>`;

    const endpoint = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

    console.log('Azure TTS Proxy Request:', {
      endpoint,
      textLength: text?.length || ssml?.length || 0,
      voice: voice || 'en-US-AriaNeural',
      locale: locale || 'en-US'
    });

    // Call Azure TTS API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssmlContent,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Azure TTS API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 200)
      });
      return res.status(response.status).json({ 
        error: `Azure TTS API error: ${response.statusText}`,
        details: errorText.substring(0, 200)
      });
    }

    // Get the audio data as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return res.status(500).json({ error: 'Received empty audio buffer from Azure TTS' });
    }

    console.log('Azure TTS Proxy Success:', {
      audioSize: audioBuffer.byteLength,
      contentType: response.headers.get('content-type')
    });

    // Return the audio as binary data
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Azure TTS Proxy Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to escape XML
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

