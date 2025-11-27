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
    // Note: VITE_ prefixed vars are NOT available in serverless functions
    // They need to be set without VITE_ prefix for serverless functions
    const subscriptionKey = process.env.AZURE_TTS_KEY || process.env.VITE_AZURE_TTS_KEY;
    const azureRegion = region || process.env.AZURE_TTS_REGION || process.env.VITE_AZURE_TTS_REGION || 'eastus';

    console.log('Azure TTS Proxy: Environment check', {
      hasAZURE_TTS_KEY: !!process.env.AZURE_TTS_KEY,
      hasVITE_AZURE_TTS_KEY: !!process.env.VITE_AZURE_TTS_KEY,
      subscriptionKeyLength: subscriptionKey?.length || 0,
      azureRegion
    });

    if (!subscriptionKey) {
      console.error('Azure TTS subscription key not configured');
      console.error('Available env vars with AZURE or TTS:', 
        Object.keys(process.env).filter(k => k.includes('AZURE') || k.includes('TTS')));
      return res.status(500).json({ 
        error: 'Azure TTS not configured',
        hint: 'Set AZURE_TTS_KEY (without VITE_ prefix) in environment variables'
      });
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

    // Call Azure TTS API using Node.js fetch (built-in, available in Node 18+)
    // Using fetch with AbortController for better timeout handling
    const startTime = Date.now();
    console.log('Azure TTS Proxy: Starting Azure TTS API request with fetch...');
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('Azure TTS Proxy: Request timeout after 50 seconds', {
        elapsed: Date.now() - startTime
      });
      controller.abort();
    }, 50000); // 50 second timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'SmartReader/1.0', // Required by Azure TTS
          'Connection': 'close', // Try to force HTTP/1.1
          'Cache-Control': 'no-cache',
        },
        body: ssmlContent,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Azure TTS Proxy: Received response from Azure TTS API', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        elapsed: Date.now() - startTime
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Azure TTS API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
          elapsed: Date.now() - startTime
        });
        throw new Error(`Azure TTS API error: ${response.status} ${response.statusText}`);
      }

      // Read the audio data
      const audioBuffer = await response.arrayBuffer();
      
      console.log('Azure TTS Proxy: Response complete', {
        bufferSize: audioBuffer.byteLength,
        elapsed: Date.now() - startTime
      });

      if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error('Received empty audio buffer from Azure TTS');
      }

      // Return the audio as binary data
      console.log('Azure TTS Proxy Success:', {
        audioSize: audioBuffer.byteLength,
        elapsed: Date.now() - startTime
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength.toString());
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      return res.send(Buffer.from(audioBuffer));
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Azure TTS Proxy: Request aborted (timeout)', {
          elapsed: Date.now() - startTime
        });
        return res.status(504).json({ 
          error: 'Gateway Timeout',
          message: 'Azure TTS API request timeout after 50 seconds'
        });
      }
      
      console.error('Azure TTS Proxy: Fetch error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        elapsed: Date.now() - startTime
      });
      throw error; // Re-throw to be caught by outer catch
    }


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

