/**
 * Azure TTS Proxy Endpoint
 * 
 * Proxies Azure TTS requests to avoid HTTP/2 protocol errors in browsers.
 * This serverless function calls Azure TTS API and returns the audio data.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

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

    // Call Azure TTS API using Node.js https module to force HTTP/1.1
    // This avoids HTTP/2 protocol errors that occur with fetch/undici
    const audioBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const url = new URL(endpoint);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'Connection': 'close', // Force HTTP/1.1
          'Cache-Control': 'no-cache',
          'Content-Length': Buffer.byteLength(ssmlContent),
        },
        // Force HTTP/1.1 by disabling ALPN (Application-Layer Protocol Negotiation)
        ALPNProtocols: [],
      };

      const req = https.request(options, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          let errorData = '';
          res.on('data', (chunk) => { errorData += chunk.toString(); });
          res.on('end', () => {
            console.error('Azure TTS API Error:', {
              status: res.statusCode,
              statusText: res.statusMessage,
              error: errorData.substring(0, 200)
            });
            reject(new Error(`Azure TTS API error: ${res.statusCode} ${res.statusMessage}`));
          });
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            reject(new Error('Received empty audio buffer from Azure TTS'));
            return;
          }
          resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        });
      });

      req.on('error', (error) => {
        console.error('Azure TTS HTTPS Request Error:', error);
        reject(error);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(ssmlContent);
      req.end();
    });

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return res.status(500).json({ error: 'Received empty audio buffer from Azure TTS' });
    }

    console.log('Azure TTS Proxy Success:', {
      audioSize: audioBuffer.byteLength
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

