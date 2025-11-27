/**
 * Azure Text-to-Speech Service
 * Provides high-quality neural voices for PDF documents
 */

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
  if (VOICE_NAME_MAPPING[voiceName]) {
    return VOICE_NAME_MAPPING[voiceName];
  }
  // If it already looks like an official Azure voice name, return as-is
  if (voiceName.match(/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/)) {
    return voiceName;
  }
  // Default fallback to a known working voice
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
  private audioContext: AudioContext | null = null;
  private currentAudio: AudioBufferSourceNode | null = null;
  private isPaused = false;
  private speakingActive = false;
  private pauseTime = 0;
  private startTime = 0;
  private currentAudioBuffer: AudioBuffer | null = null;
  private audioStartTime = 0;
  private audioPauseTime = 0;
  private onEndCallback: (() => void) | null = null;
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;
  private stopRequested: boolean = false;
  private pausedChunkIndex: number = -1;
  private currentChunks: string[] = [];
  private currentOnEnd: (() => void) | undefined = undefined;
  private currentOnWord: ((word: string, charIndex: number) => void) | undefined = undefined;

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
    
    // Initialize audio context
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
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
      console.warn('Failed to set default Azure TTS voice:', error);
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
      const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1/voices/list`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      const allVoices: any[] = data || [];
      
      // Map Azure voice format to our interface
      const voices: AzureVoice[] = allVoices.map((voice: any) => ({
        name: voice.ShortName || voice.Name,
        locale: voice.Locale || voice.locale,
        gender: voice.Gender === 'Male' ? 'Male' : voice.Gender === 'Female' ? 'Female' : 'Neutral',
        voiceType: voice.VoiceType === 'Neural' ? 'Neural' : 'Standard',
      }));
      
      // Filter to only neural voices for better quality
      const neuralVoices = voices.filter(v => v.voiceType === 'Neural');
      
      console.log(`Available voices: ${neuralVoices.length} neural voices`);
      
      return neuralVoices;
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

  setVoice(voice: AzureVoice) {
    this.settings.voice = voice;
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

    const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    console.log('Azure TTS Request Details:', {
      endpoint,
      textLength: text.length,
      voice: officialVoiceName,
      locale: voice.locale
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey!,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': this.settings.audioFormat,
          'User-Agent': 'SmartReader',
        },
        body: ssml,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure TTS API Error:', errorText);
        throw new Error(`TTS synthesis failed: ${response.statusText}`);
      }

      console.log('✅ Azure TTS Request SUCCEEDED!');
      const audioData = await response.arrayBuffer();
      console.log('AzureTTSService.synthesize: Received audio buffer', {
        size: audioData.byteLength,
        contentType: response.headers.get('content-type'),
        status: response.status
      });
      
      if (!audioData || audioData.byteLength === 0) {
        console.error('AzureTTSService.synthesize: Received empty audio buffer from API!');
        throw new Error('Received empty audio buffer from Azure TTS API');
      }
      
      return audioData;
        
    } catch (error) {
      console.error('Azure TTS Error:', error);
      throw error;
    }
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
      
      if (this.currentAudio || this.isPaused) {
        this.stop();
        this.stopRequested = false;
      }
      
      this.speakingActive = true;
      console.log('AzureTTSService.speak: stopRequested =', this.stopRequested, 'ready to start playback');

      if (!this.settings.voice) {
        await this.setDefaultVoice();
      }

      // Azure TTS limit is 10,000 characters per request
      const MAX_TEXT_LENGTH = 9000; // Use 9000 to be safe
      
      if (text.length <= MAX_TEXT_LENGTH) {
        console.log('AzureTTSService.speak: Synthesizing audio for text length:', text.length);
        const audioBuffer = await this.synthesize(text);
        console.log('AzureTTSService.speak: Audio buffer received, size:', audioBuffer.byteLength, 'bytes');
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          console.error('AzureTTSService.speak: Received empty audio buffer!');
          this.speakingActive = false;
          throw new Error('Received empty audio buffer from Azure TTS');
        }
        
        await this.playAudio(audioBuffer, onEnd, onWord);
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
      
      if (this.isPaused) {
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
      
      if (this.isPaused) {
        console.log(`Chunk paused after synthesis ${i + 1}/${chunks.length}`);
        const decodedAudio = await this.audioContext!.decodeAudioData(audioBuffer);
        this.currentAudioBuffer = decodedAudio;
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false;
        return;
      }
      
      const isLastChunk = i === chunks.length - 1;
      await this.playAudio(audioBuffer, isLastChunk ? onEnd : undefined, onWord);
    }
    
    this.speakingActive = false;
  }

  private async playAudio(audioBuffer: ArrayBuffer, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    try {
      if (this.audioContext.state === 'suspended') {
        console.log('AudioContext is suspended, attempting to resume...');
        try {
          await this.audioContext.resume();
          console.log('AudioContext resumed successfully');
        } catch (resumeError) {
          console.error('Failed to resume AudioContext:', resumeError);
          throw new Error('Cannot play audio: AudioContext is suspended and cannot be resumed. Please interact with the page first.');
        }
      }

      if (this.audioContext.state !== 'running') {
        console.warn('AudioContext state is not running:', this.audioContext.state);
        try {
          await this.audioContext.resume();
        } catch (resumeError) {
          console.error('Failed to resume AudioContext before playback:', resumeError);
          throw new Error('Cannot play audio: AudioContext is not running');
        }
      }

      console.log('AzureTTSService.playAudio: Decoding audio buffer, size:', audioBuffer.byteLength);
      const decodedAudio = await this.audioContext.decodeAudioData(audioBuffer);
      console.log('AzureTTSService.playAudio: Audio decoded successfully', {
        duration: decodedAudio.duration,
        sampleRate: decodedAudio.sampleRate,
        numberOfChannels: decodedAudio.numberOfChannels,
        length: decodedAudio.length
      });
      
      // CRITICAL: Check for zero-duration audio before starting playback
      // Zero-duration audio will cause onended to fire immediately
      if (decodedAudio.duration === 0 || decodedAudio.length === 0) {
        console.warn('AzureTTSService.playAudio: Decoded audio has zero duration. Playback will not occur.');
        if (onEnd) {
          // Call onEnd immediately if audio is empty
          onEnd();
        }
        return;
      }
      
      if (this.stopRequested) {
        console.log('AzureTTSService.playAudio: Stop requested before starting playback');
        return;
      }
      
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(this.audioContext.destination);
      
      this.currentAudio = source;
      this.currentAudioBuffer = decodedAudio;
      
      this.onEndCallback = onEnd || null;
      this.onWordCallback = onWord || null;
      
      const audioEndPromise = new Promise<void>((resolve, reject) => {
        source.onended = () => {
          console.log('AzureTTSService.playAudio: Audio ended, duration was:', decodedAudio.duration);
          this.isPaused = false;
          this.pauseTime = 0;
          this.startTime = 0;
          this.audioStartTime = 0;
          this.audioPauseTime = 0;
          this.currentAudioBuffer = null;
          this.currentAudio = null;
          if (onEnd) {
            console.log('AzureTTSService.playAudio: Calling onEnd callback');
            onEnd();
          }
          this.onEndCallback = null;
          this.onWordCallback = null;
          resolve();
        };
        
        source.addEventListener('error', (event) => {
          console.error('Audio source error:', event);
          this.isPaused = false;
          this.pauseTime = 0;
          this.startTime = 0;
          this.audioStartTime = 0;
          this.audioPauseTime = 0;
          this.currentAudioBuffer = null;
          this.currentAudio = null;
          this.onEndCallback = null;
          this.onWordCallback = null;
          reject(new Error('Audio playback error'));
        });
      });

      this.audioStartTime = this.audioContext.currentTime;
      this.startTime = this.audioContext.currentTime;
      
      try {
        source.start();
        console.log('AzureTTSService.playAudio: Audio playback started successfully', {
          audioContextState: this.audioContext.state,
          audioDuration: decodedAudio.duration,
          currentTime: this.audioContext.currentTime
        });
      } catch (startError) {
        console.error('AzureTTSService.playAudio: Failed to start audio playback:', startError);
        throw new Error('Failed to start audio playback: ' + (startError instanceof Error ? startError.message : String(startError)));
      }
      
      console.log('AzureTTSService.playAudio: Waiting for audio to complete...');
      await audioEndPromise;
      console.log('AzureTTSService.playAudio: Audio playback completed');
      
    } catch (error) {
      console.error('Error playing audio:', error);
      this.currentAudio = null;
      this.currentAudioBuffer = null;
      this.onEndCallback = null;
      this.onWordCallback = null;
      throw error;
    }
  }

  pause() {
    if ((this.currentAudio || this.speakingActive) && this.audioContext && !this.isPaused) {
      if (this.currentAudio) {
        this.pauseTime = this.audioContext.currentTime - this.audioStartTime;
        try {
          this.currentAudio.stop();
          this.currentAudio.disconnect();
        } catch (e) {
          // Ignore errors if already stopped
        }
        this.currentAudio = null;
      } else {
        this.pauseTime = this.audioContext.currentTime - this.audioStartTime;
      }
      this.isPaused = true;
      console.log('AzureTTSService: Paused at time:', this.pauseTime, 'speakingActive:', this.speakingActive);
    } else {
      console.log('AzureTTSService: Cannot pause - currentAudio:', !!this.currentAudio, 'speakingActive:', this.speakingActive, 'isPaused:', this.isPaused);
    }
  }

  async resume() {
    if (!this.isPaused) {
      console.log('AzureTTSService: Not paused, cannot resume');
      return;
    }
    
    console.log('AzureTTSService: Resume called, pauseTime:', this.pauseTime, 'pausedChunkIndex:', this.pausedChunkIndex);
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('AudioContext is suspended during resume, attempting to resume...');
      try {
        await this.audioContext.resume();
        console.log('AudioContext resumed successfully during resume');
      } catch (resumeError) {
        console.error('Failed to resume AudioContext during resume:', resumeError);
        throw new Error('Cannot resume audio: AudioContext is suspended');
      }
    }
    
    if (this.audioContext && this.currentAudioBuffer) {
      console.log('AzureTTSService: Resuming from mid-chunk at time:', this.pauseTime);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = this.currentAudioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        console.log('AzureTTSService: Chunk ended, continuing to next chunk if any');
        this.currentAudioBuffer = null;
        this.currentAudio = null;
        
        if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0 && this.pausedChunkIndex < this.currentChunks.length - 1) {
          const nextIndex = this.pausedChunkIndex + 1;
          console.log(`Continuing to chunk ${nextIndex + 1}/${this.currentChunks.length}`);
          this.speakInChunks(
            this.currentChunks.slice(nextIndex).join(' '),
            9000,
            this.currentOnEnd,
            this.currentOnWord
          ).catch(err => {
            console.error('Error continuing chunk playback:', err);
          });
        } else if (this.onEndCallback) {
          this.onEndCallback();
          this.onEndCallback = null;
        }
        
        this.pauseTime = 0;
        this.startTime = 0;
        this.audioStartTime = 0;
        this.audioPauseTime = 0;
        this.pausedChunkIndex = -1;
        this.currentChunks = [];
        this.currentOnEnd = undefined;
        this.currentOnWord = undefined;
      };
      
      this.currentAudio = source;
      this.audioStartTime = this.audioContext.currentTime - this.pauseTime;
      source.start(0, this.pauseTime);
      
      this.isPaused = false;
      console.log('AzureTTSService: Resumed successfully from', this.pauseTime, 'seconds');
    } else if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0) {
      console.log('AzureTTSService: Resuming chunk playback from index:', this.pausedChunkIndex);
      this.speakingActive = true;
      this.isPaused = false;
      
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
      console.warn('AzureTTSService: Resume called but no valid resume state');
      this.isPaused = false;
    }
  }

  stop() {
    console.log('AzureTTSService.stop() called, stopRequested was:', this.stopRequested)
    this.stopRequested = true;
    console.log('AzureTTSService.stop() set stopRequested to:', this.stopRequested)
    
    if (this.currentAudio) {
      console.log('AzureTTSService: Stopping current audio')
      try {
        this.currentAudio.stop();
        this.currentAudio.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentAudio = null;
    }
    this.isPaused = false;
    this.speakingActive = false;
    this.pauseTime = 0;
    this.startTime = 0;
    this.audioStartTime = 0;
    this.audioPauseTime = 0;
    this.currentAudioBuffer = null;
    this.onEndCallback = null;
    this.onWordCallback = null;
    this.pausedChunkIndex = -1;
    this.currentChunks = [];
    this.currentOnEnd = undefined;
    this.currentOnWord = undefined;
    console.log('AzureTTSService: Stop completed, stopRequested =', this.stopRequested)
  }

  isSpeaking(): boolean {
    return (this.currentAudio !== null || this.speakingActive) && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  getProgress(): number {
    if (!this.audioContext || !this.currentAudioBuffer || !this.isSpeaking()) {
      return 0;
    }
    
    const currentTime = this.audioContext.currentTime;
    const elapsedTime = currentTime - this.audioStartTime;
    const duration = this.currentAudioBuffer.duration;
    
    if (duration === 0) {
      return 0;
    }
    
    return Math.min(elapsedTime / duration, 1);
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.currentAudioBuffer || !this.isSpeaking()) {
      return 0;
    }
    
    const currentTime = this.audioContext.currentTime;
    return Math.min(currentTime - this.audioStartTime, this.currentAudioBuffer.duration);
  }

  getDuration(): number {
    if (!this.currentAudioBuffer) {
      return 0;
    }
    
    return this.currentAudioBuffer.duration;
  }

  isSupported(): boolean {
    return this.isConfigured() && 
           typeof window !== 'undefined' && 
           window.AudioContext !== undefined;
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


