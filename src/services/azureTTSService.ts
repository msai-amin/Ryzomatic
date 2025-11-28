/**
 * Azure Text-to-Speech Service
 * Provides high-quality neural voices for PDF documents
 */

import { HowlerAudioPlayer } from './howlerAudioPlayer'

export interface AzureVoice {
  name: string;
  locale: string;
  gender: 'Male' | 'Female' | 'Neutral';
  voiceType: 'Neural' | 'Standard';
}

export interface AzureTTSSettings {
  voice: AzureVoice | null;
  audioFormat: 'audio-24khz-48kbitrate-mono-mp3' | 'audio-16khz-32kbitrate-mono-mp3' | 'audio-16khz-128kbitrate-mono-mp3' | 'audio-16khz-64kbitrate-mono-mp3' | 'raw-16khz-16bit-mono-pcm';
  rate: string; // Azure uses percentage: "+20%", "-20%", "0%"
  pitch: string; // Azure uses percentage: "+20%", "-20%", "0%"
  volume: string; // Azure uses percentage: "+20%", "-20%", "0%"
}

// Voice name mapping: Display names to official Azure voice names
const VOICE_NAME_MAPPING: Record<string, string> = {
  'Aria': 'en-US-AriaNeural',
  'Jenny': 'en-US-JennyNeural',
  'Guy': 'en-US-GuyNeural',
  'Sara': 'en-US-SaraNeural',
  'Tony': 'en-US-TonyNeural',
  'Nancy': 'en-US-NancyNeural',
  'Davis': 'en-US-DavisNeural',
  'Amber': 'en-US-AmberNeural',
  'Ana': 'en-US-AnaNeural',
  'Brandon': 'en-US-BrandonNeural',
  'Christopher': 'en-US-ChristopherNeural',
  'Cora': 'en-US-CoraNeural',
  'Elizabeth': 'en-US-ElizabethNeural',
  'Eric': 'en-US-EricNeural',
  'Jacob': 'en-US-JacobNeural',
  'Jane': 'en-US-JaneNeural',
  'Jason': 'en-US-JasonNeural',
  'Michelle': 'en-US-MichelleNeural',
  'Monica': 'en-US-MonicaNeural',
  'Roger': 'en-US-RogerNeural',
  'Steffan': 'en-US-SteffanNeural',
};

// Helper function to get the official API name for a voice
function getOfficialVoiceName(voiceName: string): string {
  if (!voiceName) {
    return 'en-US-AriaNeural';
  }
  
  if (VOICE_NAME_MAPPING[voiceName]) {
    return VOICE_NAME_MAPPING[voiceName];
  }
  
  // Handle voices with colons (e.g., "en-US-Brian:DragonHDLatestNeural")
  // Azure TTS accepts the full name with colon
  if (voiceName.includes(':')) {
    return voiceName;
  }
  
  // If it already looks like an official Azure voice name, return as-is
  // Pattern: en-US-VoiceName or en-US-VoiceNameNeural or en-US-VoiceNameMultilingualNeural
  if (voiceName.match(/^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+(Neural|MultilingualNeural)?$/)) {
    return voiceName;
  }
  
  // Default fallback to a known working voice
  console.warn('Azure TTS: Unknown voice name format, using fallback:', voiceName);
  return 'en-US-AriaNeural';
}

// Convert numeric rate (0.25-4.0) to Azure percentage format
function rateToAzurePercentage(rate: number): string {
  // Azure rate: -50% to +100% (0.5x to 2x speed)
  // Map 0.25-4.0 to -50% to +100%
  if (rate <= 0.5) {
    return `${Math.round((rate - 0.5) * 200)}%`;
  } else if (rate <= 1.0) {
    return `${Math.round((rate - 1.0) * 100)}%`;
  } else {
    // For rates > 1.0, cap at +100%
    return '+100%';
  }
}

// Convert numeric pitch (-20.0 to 20.0) to Azure percentage format
function pitchToAzurePercentage(pitch: number): string {
  // Azure pitch: -50% to +50% (1 semitone = ~6%)
  // Map -20.0 to 20.0 to -50% to +50%
  const percentage = Math.round((pitch / 20.0) * 50);
  return `${percentage >= 0 ? '+' : ''}${percentage}%`;
}

// Convert numeric volume (-96.0 to 16.0 dB) to Azure percentage format
function volumeToAzurePercentage(volume: number): string {
  // Azure volume: -50% to +100%
  // Map -96.0 to 16.0 dB to -50% to +100%
  // Approximate: 0 dB = 0%, -96 dB = -50%, +16 dB = +100%
  if (volume <= 0) {
    const percentage = Math.round((volume / 96.0) * 50);
    return `${percentage}%`;
  } else {
    const percentage = Math.round((volume / 16.0) * 100);
    return `+${percentage}%`;
  }
}

class AzureTTSService {
  private subscriptionKey: string | null = null;
  private region: string | null = null;
  private settings: AzureTTSSettings = {
    voice: null,
    audioFormat: 'audio-24khz-48kbitrate-mono-mp3',
    rate: '0%',
    pitch: '0%',
    volume: '0%',
  };
  private audioPlayer: HowlerAudioPlayer = new HowlerAudioPlayer();
  private speakingActive = false;
  private stopRequested: boolean = false;
  private pausedChunkIndex: number = -1;
  private currentChunks: string[] = [];
  private currentOnEnd: (() => void) | undefined = undefined;
  private currentOnWord: ((word: string, charIndex: number) => void) | undefined = undefined;
  private currentText: string = ''; // Store current text for word tracking

  constructor() {
    // Get subscription key and region from environment
    const rawKey = import.meta.env.VITE_AZURE_TTS_KEY || null;
    const rawRegion = import.meta.env.VITE_AZURE_TTS_REGION || null;
    
    // Check if key is a placeholder
    const isPlaceholderKey = rawKey && (
      rawKey.includes('your_') || 
      rawKey.includes('_here') || 
      rawKey.includes('_key_here') ||
      rawKey.length < 20
    );
    
    this.subscriptionKey = (rawKey && !isPlaceholderKey) ? rawKey : null;
    this.region = rawRegion || 'eastus'; // Default to eastus
    
    if (isPlaceholderKey && rawKey) {
      console.warn('⚠️  Azure TTS subscription key appears to be a placeholder');
      console.warn('   TTS will fall back to native browser TTS');
      console.warn('   To enable Azure TTS, update VITE_AZURE_TTS_KEY and VITE_AZURE_TTS_REGION in .env.local');
    }
    
    // Set default voice only if properly configured
    if (this.isConfigured()) {
      this.setDefaultVoice().catch(error => {
        console.warn('Failed to initialize Azure TTS voices:', error);
        this.subscriptionKey = null;
      });
    }
  }

  isConfigured(): boolean {
    return this.subscriptionKey !== null && 
           this.subscriptionKey.length > 0 && 
           !this.subscriptionKey.includes('your_') && 
           !this.subscriptionKey.includes('_here') &&
           this.subscriptionKey.length >= 20 &&
           this.region !== null;
  }

  private async setDefaultVoice(): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const voices = await this.getVoices();
      console.log('Available Azure TTS voices:', voices.slice(0, 5).map(v => ({
        name: v.name,
        locale: v.locale,
        gender: v.gender
      })));
      
      // Prioritize English neural voices
      const englishVoices = voices.filter(v => 
        v.locale && v.locale.startsWith('en-') && v.voiceType === 'Neural'
      );
      
      // Prefer female voices (Aria is popular)
      let selectedVoice = englishVoices.find(v => v.name.includes('Aria')) ||
                         englishVoices.find(v => v.gender === 'Female') ||
                         englishVoices[0];
      
      if (selectedVoice) {
        this.settings.voice = selectedVoice;
        console.log('Set default Azure TTS voice:', selectedVoice.name, `(${selectedVoice.locale})`);
        return;
      }
      
      // Fallback to any English voice
      const anyEnglishVoice = voices.find(v => v.locale && v.locale.startsWith('en-'));
      if (anyEnglishVoice) {
        this.settings.voice = anyEnglishVoice;
        console.log('Set default Azure TTS voice:', anyEnglishVoice.name);
        return;
      }
      
      // Last resort - first available voice
      if (voices.length > 0) {
        this.settings.voice = voices[0];
        console.log('Set default Azure TTS voice:', voices[0].name);
      }
    } catch (error) {
      console.warn('Failed to set default Azure TTS voice from API, using hardcoded fallback:', error);
      
      // Provide helpful diagnostic information
      if (error instanceof Error && error.message.includes('not configured')) {
        console.warn('💡 Hint: Azure TTS requires AZURE_TTS_KEY environment variable in Vercel (serverless functions need it without VITE_ prefix)');
        console.warn('   - Client-side uses: VITE_AZURE_TTS_KEY');
        console.warn('   - Server-side API uses: AZURE_TTS_KEY');
        console.warn('   - Set both in Vercel Dashboard → Settings → Environment Variables');
      }
      // Fallback to a known working voice when API call fails
      this.settings.voice = {
        name: 'en-US-AriaNeural',
        locale: 'en-US',
        gender: 'Female',
        voiceType: 'Neural'
      };
      console.log('Using fallback Azure TTS voice: en-US-AriaNeural');
    }
  }

  async getVoices(): Promise<AzureVoice[]> {
    if (!this.isConfigured()) {
      throw new Error('Azure TTS subscription key not configured or is invalid');
    }
    
    if (!this.subscriptionKey || !this.region) {
      throw new Error('Azure TTS subscription key or region is invalid');
    }

    try {
      // CRITICAL FIX: Use server-side proxy endpoint to avoid CORS and authentication issues
      // The proxy endpoint handles authentication and CORS headers properly
      // IMPORTANT: If you see errors about direct Azure endpoint calls, clear your browser cache!
      const proxyEndpoint = '/api/azure-tts';
      
      // Safety check: Ensure we're not accidentally calling Azure directly
      if (typeof window === 'undefined' || !window.location) {
        throw new Error('Cannot fetch voices: window.location is not available');
      }
      
      const url = new URL(proxyEndpoint, window.location.origin);
      url.searchParams.set('region', this.region);

      console.log('AzureTTSService.getVoices: Fetching voices via proxy', {
        endpoint: url.toString(),
        proxyEndpoint,
        region: this.region,
        fullUrl: url.toString()
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText, hint: 'Unable to parse error response' };
        }
        
        console.error('AzureTTSService.getVoices: Proxy error', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || errorData.message,
          hint: errorData.hint,
          fullError: errorText.substring(0, 500)
        });
        
        // Provide helpful error messages based on status
        if (response.status === 500) {
          if (errorData.error && errorData.error.includes('not configured')) {
            throw new Error(`Azure TTS not configured: ${errorData.hint || 'Set AZURE_TTS_KEY in Vercel environment variables (without VITE_ prefix)'}`);
          }
          throw new Error(`Azure TTS proxy error: ${errorData.error || errorData.message || response.statusText}`);
        }
        
        throw new Error(`Failed to fetch voices: ${errorData.error || errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const allVoices: any[] = Array.isArray(data) ? data : [];
      
      // Map Azure voice format to our interface
      const voices: AzureVoice[] = allVoices.map((voice: any) => ({
        name: voice.ShortName || voice.Name,
        locale: voice.Locale || voice.locale,
        gender: voice.Gender === 'Male' ? 'Male' : voice.Gender === 'Female' ? 'Female' : 'Neutral',
        voiceType: voice.VoiceType === 'Neural' ? 'Neural' : 'Standard',
      }));
      
      // Filter to only premium voices specified by user
      // These are the only voices that should appear in the audio settings
      const premiumVoiceNames = [
        'en-US-AriaNeural',
        'en-US-GuyNeural',
        'en-US-Ava',
        'en-US-Andrew',
        'en-GB-RyanNeural',
        'en-GB-SoniaNeural',
        'en-US-Brian', // Base name - matches "en-US-Brian" or "en-US-Brian:DragonHDLatestNeural"
        'en-US-Emma',  // Base name - matches "en-US-Emma" or "en-US-Emma:DragonHDLatestNeural"
        'en-US-AvaMultilingualNeural',
        'en-US-BrianMultilingualNeural'
      ];
      
      // Filter to only show premium voices
      // Note: For voices with colons (e.g., "en-US-Brian:DragonHDLatestNeural"),
      // we match by the base name (e.g., "en-US-Brian")
      const premiumVoices = voices.filter(v => {
        const baseName = v.name.split(':')[0]; // Extract base name before colon
        // Check exact match or base name match
        return premiumVoiceNames.includes(v.name) || premiumVoiceNames.includes(baseName);
      });
      
      console.log(`AzureTTSService.getVoices: Filtered to ${premiumVoices.length} premium voices`);
      
      return premiumVoices;
    } catch (error) {
      console.error('Error fetching Azure voices:', error);
      throw error;
    }
  }

  async getEnglishVoices(): Promise<AzureVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => 
      voice.locale && voice.locale.startsWith('en-') && 
      (voice.gender === 'Female' || voice.gender === 'Male')
    );
  }

  getSettings(): AzureTTSSettings {
    return { ...this.settings };
  }

  setVoice(voice: AzureVoice | any) {
    // Convert voice from store format to AzureVoice format if needed
    if (voice && typeof voice === 'object') {
      // Extract locale from voice name if not provided
      let locale = voice.locale;
      if (!locale && voice.name) {
        // Extract locale from voice name (e.g., "en-US-AriaNeural" -> "en-US")
        const match = voice.name.match(/^([a-z]{2}-[A-Z]{2})/);
        if (match) {
          locale = match[1];
        } else {
          locale = 'en-US'; // Default fallback
        }
      }
      if (!locale) {
        locale = 'en-US'; // Final fallback
      }
      
      // Convert to AzureVoice format
      this.settings.voice = {
        name: voice.name || 'en-US-AriaNeural',
        locale: locale,
        gender: voice.gender === 'Male' || voice.gender === 'MALE' ? 'Male' : 
                voice.gender === 'Female' || voice.gender === 'FEMALE' ? 'Female' : 'Neutral',
        voiceType: voice.voiceType || (voice.name && voice.name.includes('Neural') ? 'Neural' : 'Standard')
      };
      
      console.log('AzureTTSService.setVoice: Voice set', {
        name: this.settings.voice.name,
        locale: this.settings.voice.locale,
        gender: this.settings.voice.gender,
        voiceType: this.settings.voice.voiceType
      });
    } else {
      console.warn('AzureTTSService.setVoice: Invalid voice object', voice);
    }
  }

  setSpeakingRate(rate: number) {
    // Convert numeric rate to Azure percentage format
    this.settings.rate = rateToAzurePercentage(Math.max(0.25, Math.min(4.0, rate)));
  }

  setPitch(pitch: number) {
    // Convert numeric pitch to Azure percentage format
    this.settings.pitch = pitchToAzurePercentage(Math.max(-20.0, Math.min(20.0, pitch)));
  }

  setVolumeGain(volume: number) {
    // Convert numeric volume to Azure percentage format
    this.settings.volume = volumeToAzurePercentage(Math.max(-96.0, Math.min(16.0, volume)));
  }

  setVolume(volume: number) {
    // Convert 0-1 volume to Howler volume (0-1)
    this.audioPlayer.setVolume(Math.max(0, Math.min(1, volume)));
  }

  setAudioFormat(format: 'audio-24khz-48kbitrate-mono-mp3' | 'audio-16khz-32kbitrate-mono-mp3' | 'audio-16khz-128kbitrate-mono-mp3' | 'audio-16khz-64kbitrate-mono-mp3' | 'raw-16khz-16bit-mono-pcm') {
    this.settings.audioFormat = format;
  }

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!this.isConfigured()) {
      throw new Error('Azure TTS subscription key not configured');
    }

    if (!this.settings.voice) {
      throw new Error('No voice selected');
    }

    const voice = this.settings.voice;
    const officialVoiceName = getOfficialVoiceName(voice.name);
    
    // Build SSML for Azure TTS
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.locale}">
      <voice name="${officialVoiceName}">
        <prosody rate="${this.settings.rate}" pitch="${this.settings.pitch}" volume="${this.settings.volume}">
          ${this.escapeXml(text)}
        </prosody>
      </voice>
    </speak>`;

    // Use server-side proxy endpoint to avoid HTTP/2 protocol errors
    const proxyEndpoint = '/api/azure-tts';

    console.log('Azure TTS Request Details (via proxy):', {
      endpoint: proxyEndpoint,
      textLength: text.length,
      voice: officialVoiceName,
      locale: voice.locale
    });

    // Retry logic for network errors
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Azure TTS Request via proxy (attempt ${attempt}/${maxRetries})...`);
        
        // Create abort controller for timeout
        // Increased to 60 seconds for longer TTS synthesis requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`Azure TTS Proxy Request timeout after 60s (attempt ${attempt})`);
          controller.abort();
        }, 60000); // 60 second timeout
        
        try {
          // Call our server-side proxy endpoint
          const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ssml: ssml,
              voice: officialVoiceName,
              locale: voice.locale,
              region: this.region,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`Azure TTS Proxy Error (attempt ${attempt}):`, {
              status: response.status,
              statusText: response.statusText,
              error: errorData.error || errorData.message
            });
            
            // Don't retry on client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
              throw new Error(`TTS synthesis failed: ${errorData.error || response.statusText}`);
            }
            
            // Retry on server errors (5xx)
            if (response.status >= 500 && attempt < maxRetries) {
              lastError = new Error(`TTS synthesis failed: ${errorData.error || response.statusText}`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
              continue;
            }
            
            throw new Error(`TTS synthesis failed: ${errorData.error || response.statusText}`);
          }

          console.log(`✅ Azure TTS Proxy Request SUCCEEDED! (attempt ${attempt})`);
          
          // Read the audio data from the proxy response
          const audioData = await response.arrayBuffer();
          
          console.log('AzureTTSService.synthesize: Received audio buffer from proxy', {
            size: audioData.byteLength,
            contentType: response.headers.get('content-type'),
            status: response.status
          });
          
          if (!audioData || audioData.byteLength === 0) {
            console.error('AzureTTSService.synthesize: Received empty audio buffer from proxy!');
            throw new Error('Received empty audio buffer from Azure TTS proxy');
          }
          
          return audioData;
        } finally {
          // Always clear timeout, even if there's an error
          clearTimeout(timeoutId);
        }
          
      } catch (error) {
        lastError = error as Error;
        console.error(`Azure TTS Proxy Error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Don't retry on certain errors
        if (error instanceof Error) {
          // Don't retry on abort/timeout errors
          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            throw new Error(`Request timeout: ${error.message}`);
          }
          
          // Don't retry on authentication errors
          if (error.message.includes('401') || error.message.includes('403')) {
            throw error;
          }
        }
        
        // Retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = 1000 * attempt; // 1s, 2s, 3s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Azure TTS synthesis failed after all retries');
  }

  /**
   * Fallback method using XMLHttpRequest instead of fetch
   * This may work around HTTP/2 protocol errors in some browsers
   */
  private async synthesizeWithXHR(endpoint: string, ssml: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Ocp-Apim-Subscription-Key', this.subscriptionKey!);
      xhr.setRequestHeader('Content-Type', 'application/ssml+xml');
      xhr.setRequestHeader('X-Microsoft-OutputFormat', this.settings.audioFormat);
      // Note: User-Agent cannot be set in XMLHttpRequest (unsafe header)
      
      xhr.responseType = 'arraybuffer';
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const audioData = xhr.response as ArrayBuffer;
          if (!audioData || audioData.byteLength === 0) {
            reject(new Error('Received empty audio buffer from Azure TTS API (XHR)'));
          } else {
            resolve(audioData);
          }
        } else {
          reject(new Error(`TTS synthesis failed: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error(`XHR request failed: ${xhr.statusText || 'Network error'}`));
      };
      
      xhr.ontimeout = () => {
        reject(new Error('XHR request timeout'));
      };
      
      xhr.timeout = 30000; // 30 second timeout
      xhr.send(ssml);
    });
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    try {
      this.stopRequested = false;
      
      if (this.audioPlayer.isSpeaking() || this.audioPlayer.isPausedState()) {
        this.stop();
        this.stopRequested = false;
      }
      
      this.speakingActive = true;
      console.log('AzureTTSService.speak: stopRequested =', this.stopRequested, 'ready to start playback');

      if (!this.settings.voice) {
        await this.setDefaultVoice();
        // If still no voice after setDefaultVoice, use hardcoded fallback
        if (!this.settings.voice) {
          console.warn('AzureTTSService: No voice available, using hardcoded fallback');
          this.settings.voice = {
            name: 'en-US-AriaNeural',
            locale: 'en-US',
            gender: 'Female',
            voiceType: 'Neural'
          };
        }
      }

      // Azure TTS limit is 10,000 characters per request
      const MAX_TEXT_LENGTH = 9000; // Use 9000 to be safe
      
      if (text.length <= MAX_TEXT_LENGTH) {
        console.log('AzureTTSService.speak: Synthesizing audio for text length:', text.length);
        this.currentText = text; // Store text for word tracking
        const audioBuffer = await this.synthesize(text);
        console.log('AzureTTSService.speak: Audio buffer received, size:', audioBuffer.byteLength, 'bytes');
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          console.error('AzureTTSService.speak: Received empty audio buffer!');
          this.speakingActive = false;
          throw new Error('Received empty audio buffer from Azure TTS');
        }
        
        await this.playAudio(audioBuffer, onEnd, onWord, text);
      } else {
        console.log(`Text too long (${text.length} chars), splitting into chunks...`);
        await this.speakInChunks(text, MAX_TEXT_LENGTH, onEnd, onWord);
      }
      
      this.speakingActive = false;
    } catch (error) {
      console.error('Error speaking text:', error);
      this.speakingActive = false;
      throw error;
    }
  }

  private async speakInChunks(text: string, maxLength: number, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    const sentences = this.splitIntoSentences(text);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    console.log(`Split text into ${chunks.length} chunks`);
    console.log(`AzureTTSService.speakInChunks: stopRequested = ${this.stopRequested} at start`);

    for (let i = 0; i < chunks.length; i++) {
      if (this.stopRequested) {
        console.log(`Chunk playback cancelled at ${i + 1}/${chunks.length}`);
        this.speakingActive = false;
        return;
      }
      
      if (this.audioPlayer.isPausedState()) {
        console.log(`Chunk playback paused at ${i + 1}/${chunks.length}`);
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false;
        return;
      }
      
      const chunk = chunks[i];
      console.log(`Playing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      const audioBuffer = await this.synthesize(chunk);
      
      if (this.stopRequested) {
        console.log(`Chunk playback cancelled after synthesis ${i + 1}/${chunks.length}`);
        this.speakingActive = false;
        return;
      }
      
      if (this.audioPlayer.isPausedState()) {
        console.log(`Chunk paused after synthesis ${i + 1}/${chunks.length}`);
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false;
        return;
      }
      
      const isLastChunk = i === chunks.length - 1;
      await this.playAudio(audioBuffer, isLastChunk ? onEnd : undefined, onWord, chunk);
    }
    
    this.speakingActive = false;
  }

  private async playAudio(audioBuffer: ArrayBuffer, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void, text?: string): Promise<void> {
    if (this.stopRequested) {
      console.log('AzureTTSService.playAudio: Stop requested before starting playback');
      return;
    }

    try {
      console.log('AzureTTSService.playAudio: Starting playback with Howler, buffer size:', audioBuffer.byteLength);
      await this.audioPlayer.playAudio(audioBuffer, onEnd, onWord, text);
      console.log('AzureTTSService.playAudio: Audio playback completed');
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  pause() {
    if (this.audioPlayer.isSpeaking() || this.speakingActive) {
      this.audioPlayer.pause();
      console.log('AzureTTSService: Paused, speakingActive:', this.speakingActive);
    } else {
      console.log('AzureTTSService: Cannot pause - not speaking, speakingActive:', this.speakingActive);
    }
  }

  async resume() {
    if (!this.audioPlayer.isPausedState()) {
      console.log('AzureTTSService: Not paused, cannot resume');
      return;
    }
    
    console.log('AzureTTSService: Resume called, pausedChunkIndex:', this.pausedChunkIndex);
    
    // If we have chunks to resume, continue from where we left off
    if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0) {
      console.log('AzureTTSService: Resuming chunk playback from index:', this.pausedChunkIndex);
      this.speakingActive = true;
      
      this.speakInChunks(
        this.currentChunks.slice(this.pausedChunkIndex).join(' '),
        9000,
        this.currentOnEnd,
        this.currentOnWord
      ).catch(err => {
        console.error('Error resuming chunk playback:', err);
        this.speakingActive = false;
      });
    } else {
      // Resume current playback
      this.audioPlayer.resume();
      console.log('AzureTTSService: Resumed current playback');
    }
  }

  stop() {
    console.log('AzureTTSService.stop() called, stopRequested was:', this.stopRequested)
    this.stopRequested = true;
    console.log('AzureTTSService.stop() set stopRequested to:', this.stopRequested)
    
    this.audioPlayer.stop();
    this.speakingActive = false;
    this.pausedChunkIndex = -1;
    this.currentChunks = [];
    this.currentOnEnd = undefined;
    this.currentOnWord = undefined;
    this.currentText = '';
    console.log('AzureTTSService: Stop completed, stopRequested =', this.stopRequested)
  }

  isSpeaking(): boolean {
    return this.audioPlayer.isSpeaking() || this.speakingActive;
  }

  isPausedState(): boolean {
    return this.audioPlayer.isPausedState();
  }

  getProgress(): number {
    return this.audioPlayer.getProgress();
  }

  getCurrentTime(): number {
    return this.audioPlayer.getCurrentTime();
  }

  getDuration(): number {
    return this.audioPlayer.getDuration();
  }

  isSupported(): boolean {
    return this.isConfigured() && 
           typeof window !== 'undefined';
  }

  cleanText(text: string): string {
    let cleaned = text
    
    cleaned = cleaned.replace(/\n\n\n/g, '... ')
    cleaned = cleaned.replace(/\n\n/g, '. ')
    cleaned = cleaned.replace(/\n/g, ', ')
    
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
      .replace(/\s+([.!?,;:])/g, '$1')
      .trim()
    
    return cleaned
  }

  splitIntoSentences(text: string): string[] {
    const cleaned = this.cleanText(text);
    return cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  }

  getEstimatedCost(text: string): number {
    // Azure TTS pricing: $15.00 per 1M characters (Neural voices)
    const characterCount = text.length;
    return (characterCount / 1000000) * 15.00;
  }
}

// Export singleton instance
export const azureTTSService = new AzureTTSService();


