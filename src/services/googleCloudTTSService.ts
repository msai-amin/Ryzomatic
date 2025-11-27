/**
 * Google Cloud Text-to-Speech Service
 * Provides high-quality neural voices for PDF documents
 */

import { HowlerAudioPlayer } from './howlerAudioPlayer'

export interface GoogleCloudVoice {
  name: string;
  languageCode: string;
  gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
  model?: string; // Required for some voices
}

export interface GoogleCloudTTSSettings {
  voice: GoogleCloudVoice | null;
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  speakingRate: number; // 0.25 to 4.0
  pitch: number; // -20.0 to 20.0
  volumeGainDb: number; // -96.0 to 16.0
  sampleRateHertz: number; // 8000, 16000, 22050, 24000
}

// Voice name mapping: Display names to official Google API names
// This allows us to show friendly names to users while sending correct names to API
const VOICE_NAME_MAPPING: Record<string, string> = {
  // If a voice name is custom (like "Achird"), map it to an official Google voice
  'Achird': 'en-US-Wavenet-F',
  'Achernar': 'en-US-Wavenet-D',
  'Algenib': 'en-US-Wavenet-C',
  'Fenrir': 'en-US-Wavenet-A',
  // Add more custom mappings as needed
};

// Helper function to get the official API name for a voice
function getOfficialVoiceName(voiceName: string): string {
  // If it's a custom name, return the mapped official name
  if (VOICE_NAME_MAPPING[voiceName]) {
    return VOICE_NAME_MAPPING[voiceName];
  }
  // If it already looks like an official Google voice name, return as-is
  if (voiceName.match(/^[a-z]{2}-[A-Z]{2}-(Standard|Wavenet|Neural2|Studio|Journey|Polyglot)-[A-Z]$/)) {
    return voiceName;
  }
  // Default fallback to a known working voice
  return 'en-US-Standard-A';
}

class GoogleCloudTTSService {
  private apiKey: string | null = null;
  private settings: GoogleCloudTTSSettings = {
    voice: null,
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.0,
    volumeGainDb: 0.0,
    sampleRateHertz: 24000
  };
  private audioPlayer: HowlerAudioPlayer = new HowlerAudioPlayer();
  private speakingActive = false; // Track if we're actively in a speak operation (including between chunks)
  private stopRequested: boolean = false;
  private pausedChunkIndex: number = -1; // Track which chunk was paused for proper resume
  private currentChunks: string[] = []; // Store chunks for resume
  private currentOnEnd: (() => void) | undefined = undefined; // Store onEnd callback
  private currentOnWord: ((word: string, charIndex: number) => void) | undefined = undefined; // Store onWord callback
  private currentText: string = ''; // Store current text for word tracking

  constructor() {
    // Get API key from environment
    const rawApiKey = import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY || null;
    
    // Check if API key is a placeholder (not a real key)
    const isPlaceholderKey = rawApiKey && (
      rawApiKey.includes('your_') || 
      rawApiKey.includes('_here') || 
      rawApiKey.includes('_key_here') ||
      rawApiKey.length < 20 // Real API keys are longer
    );
    
    // Only set API key if it's not a placeholder
    this.apiKey = (rawApiKey && !isPlaceholderKey) ? rawApiKey : null;
    
    if (isPlaceholderKey && rawApiKey) {
      console.warn('⚠️  Google Cloud TTS API key appears to be a placeholder');
      console.warn('   TTS will fall back to native browser TTS');
      console.warn('   To enable Google Cloud TTS, update VITE_GOOGLE_CLOUD_TTS_API_KEY in .env.local');
    }
    
    // Set default voice only if properly configured
    if (this.isConfigured()) {
      this.setDefaultVoice().catch(error => {
        console.warn('Failed to initialize Google Cloud TTS voices:', error);
        // If initialization fails, clear the API key to force fallback
        this.apiKey = null;
      });
    }
  }

  isConfigured(): boolean {
    // Check if API key exists and is not a placeholder
    return this.apiKey !== null && 
           this.apiKey.length > 0 && 
           !this.apiKey.includes('your_') && 
           !this.apiKey.includes('_here') &&
           this.apiKey.length >= 20; // Real API keys are longer
  }

  private isOnLandingPage(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check if we're on the landing page
    // Landing page is shown when user is not authenticated
    const urlParams = new URLSearchParams(window.location.search);
    const wantsAuth = urlParams.get('auth') === 'true';
    const isNeoReader = urlParams.get('neo') === 'true';
    
    // If auth modal or NeoReader is requested, we're not on landing page
    if (wantsAuth || isNeoReader) return false;
    
    // Check if there's a Supabase session in localStorage
    // If session exists, user is likely authenticated and not on landing page
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
        if (projectRef) {
          const sessionKey = `sb-${projectRef}-auth-token`;
          const session = localStorage.getItem(sessionKey);
          if (session) {
            try {
              const sessionData = JSON.parse(session);
              if (sessionData?.access_token) {
                return false; // Has session, not on landing page
              }
            } catch (e) {
              // Invalid session data
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    // No session found, likely on landing page
    return true;
  }

  // Set a default natural voice
  private async setDefaultVoice(): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      const voices = await this.getVoices();
      console.log('Available Google Cloud TTS voices:', voices.slice(0, 5).map(v => ({
        name: v.name,
        languageCode: v.languageCode,
        gender: v.gender,
        model: v.model
      })));
      
      // Since we've already filtered out Studio voices, just prioritize by quality
      const englishVoices = voices.filter(v => 
        v.name && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      // Prioritize Wavenet voices (high quality, reliable)
      let selectedVoice = englishVoices.find(v => v.name.includes('Wavenet')) ||
                         englishVoices.find(v => v.name.includes('Standard')) ||
                         englishVoices.find(v => v.name.includes('Neural2')) ||
                         englishVoices.find(v => v.name.includes('Neural')) ||
                         englishVoices[0];
      
      if (selectedVoice) {
        // Ensure the selected voice has a model field if required
        const voiceWithModel = this.ensureVoiceHasModel(selectedVoice);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', selectedVoice.name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model)');
        console.log('Voice details:', {
          name: voiceWithModel.name,
          languageCode: voiceWithModel.languageCode,
          gender: voiceWithModel.gender,
          hasModel: !!voiceWithModel.model,
          model: voiceWithModel.model
        });
        return;
      }
      
      // Fallback to old logic if needed
      const neuralVoice = voices.find(v => 
        v.name && v.name.includes('Neural2') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (neuralVoice) {
        const voiceWithModel = this.ensureVoiceHasModel(neuralVoice);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', neuralVoice.name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model required)');
        return;
      }
      
      // Fallback to studio voices
      const studioVoice = voices.find(v => 
        v.name && v.name.includes('Studio') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (studioVoice) {
        const voiceWithModel = this.ensureVoiceHasModel(studioVoice);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', studioVoice.name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model required)');
        return;
      }
      
      // Fallback to wavenet voices
      const wavenetVoice = voices.find(v => 
        v.name && v.name.includes('Wavenet') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (wavenetVoice) {
        const voiceWithModel = this.ensureVoiceHasModel(wavenetVoice);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', wavenetVoice.name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model required)');
        return;
      }
      
      // Fallback to any English voice
      const englishVoice = voices.find(v => v.languageCode && v.languageCode.startsWith('en-'));
      
      if (englishVoice) {
        const voiceWithModel = this.ensureVoiceHasModel(englishVoice);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', englishVoice.name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model required)');
        return;
      }
      
      // Last resort - first available voice
      if (voices.length > 0) {
        const voiceWithModel = this.ensureVoiceHasModel(voices[0]);
        this.settings.voice = voiceWithModel;
        console.log('Set default Google Cloud TTS voice:', voices[0].name, voiceWithModel.model ? `(model: ${voiceWithModel.model})` : '(no model required)');
      }
    } catch (error) {
      console.warn('Failed to set default Google Cloud TTS voice:', error);
    }
  }

  async getVoices(): Promise<GoogleCloudVoice[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Cloud TTS API key not configured or is invalid');
    }
    
    // Double-check API key is valid before making request
    if (!this.apiKey || this.apiKey.includes('your_') || this.apiKey.includes('_here')) {
      throw new Error('Google Cloud TTS API key is invalid or placeholder');
    }

    try {
      // Use v1beta1 endpoint to get complete voice information including model requirements
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1beta1/voices?key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      const allVoices: GoogleCloudVoice[] = data.voices || [];
      
      // Filter out Studio voices - only keep voices that don't require model field
      const filteredVoices = this.filterNonStudioVoices(allVoices);
      
      console.log(`Filtered voices: ${filteredVoices.length} non-Studio voices available`);
      
      return filteredVoices;
    } catch (error) {
      console.error('Error fetching Google Cloud voices:', error);
      throw error;
    }
  }

  async getEnglishVoices(): Promise<GoogleCloudVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => 
      voice.languageCode && voice.languageCode.startsWith('en-') && 
      (voice.gender === 'FEMALE' || voice.gender === 'MALE')
    );
  }

  async getNaturalVoices(): Promise<{ female: GoogleCloudVoice[]; male: GoogleCloudVoice[] }> {
    const englishVoices = await this.getEnglishVoices();
    
    // Filter for neural voices (higher quality)
    const neuralVoices = englishVoices.filter(voice => 
      voice.name.includes('Neural') || 
      voice.name.includes('Wavenet') ||
      voice.name.includes('Studio')
    );

    const femaleVoices = neuralVoices
      .filter(voice => voice.gender === 'FEMALE')
      .slice(0, 5);

    const maleVoices = neuralVoices
      .filter(voice => voice.gender === 'MALE')
      .slice(0, 5);

    return { female: femaleVoices, male: maleVoices };
  }

  getSettings(): GoogleCloudTTSSettings {
    return { ...this.settings };
  }

  setVoice(voice: GoogleCloudVoice) {
    // Ensure the voice has a model field if it requires one
    const voiceWithModel = this.ensureVoiceHasModel(voice);
    this.settings.voice = voiceWithModel;
  }

  // Filter out Studio voices - we only want voices that don't require model field
  private filterNonStudioVoices(voices: GoogleCloudVoice[]): GoogleCloudVoice[] {
    return voices.filter(voice => {
      // Exclude Studio voices and other voices that require model field
      return !voice.name.includes('Studio') && 
             !voice.name.includes('Journey') && 
             !voice.name.includes('Polyglot') &&
             voice.name !== 'Achernar' && 
             voice.name !== 'Algenib' && 
             voice.name !== 'Fenrir';
    });
  }

  // Ensure voice has model field - assign default model for all voices
  private ensureVoiceHasModel(voice: GoogleCloudVoice): GoogleCloudVoice {
    if (!voice) return voice;
    
    // Create a copy of the voice object
    const voiceWithModel = { ...voice };
    
    // Always assign a model field - the API will tell us if it's not needed
    // This ensures voices like "Achird" that the API treats as Studio voices work
    if (!voiceWithModel.model) {
      voiceWithModel.model = 'gemini-2.5-flash';
    }
    
    return voiceWithModel;
  }

  setSpeakingRate(rate: number) {
    this.settings.speakingRate = Math.max(0.25, Math.min(4.0, rate));
  }

  setPitch(pitch: number) {
    this.settings.pitch = Math.max(-20.0, Math.min(20.0, pitch));
  }

  setVolumeGain(volume: number) {
    this.settings.volumeGainDb = Math.max(-96.0, Math.min(16.0, volume));
  }

  setVolume(volume: number) {
    // Convert 0-1 volume to Howler volume (0-1)
    this.audioPlayer.setVolume(Math.max(0, Math.min(1, volume)));
  }

  setAudioEncoding(encoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS') {
    this.settings.audioEncoding = encoding;
  }

  async synthesize(text: string): Promise<ArrayBuffer> {
    if (!this.isConfigured()) {
      throw new Error('Google Cloud TTS API key not configured');
    }

    if (!this.settings.voice) {
      throw new Error('No voice selected');
    }

    const voice = this.settings.voice;
    
    // Get the official API name for the voice
    const officialVoiceName = getOfficialVoiceName(voice.name);
    
    // Extract language code from voice name if not available
    // Voice names follow pattern: {languageCode}-{voiceType}-{voiceId}
    // Example: en-AU-Neural2-A has language code en-AU
    let languageCode = voice.languageCode;
    if (!languageCode) {
      // Extract from voice name (e.g., "en-AU-Neural2-A" -> "en-AU")
      const match = officialVoiceName.match(/^([a-z]{2}-[A-Z]{2})/);
      if (match) {
        languageCode = match[1];
      } else {
        languageCode = "en-US"; // Fallback
      }
    }
    
    console.log('Voice Name Mapping:', {
      displayName: voice.name,
      officialApiName: officialVoiceName,
      languageCode: languageCode
    });

    // Try to use SSML for better pause control if text contains breaks
    const useSSML = text.includes('\n')
    const inputText = useSSML ? this.insertSSMLPauses(text) : text
    
    const requestBody = {
      "input": useSSML ? {
        "ssml": inputText
      } : {
        "text": text
      },
      "voice": {
        "languageCode": languageCode,
        "name": officialVoiceName  // Use the official API name
      },
      "audioConfig": {
        "audioEncoding": this.settings.audioEncoding,
        "speakingRate": this.settings.speakingRate,
        "pitch": this.settings.pitch,
        "volumeGainDb": this.settings.volumeGainDb,
        "sampleRateHertz": this.settings.sampleRateHertz
      }
    };

    const API_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

    console.log('TTS Request Details:', {
      endpoint: API_ENDPOINT,
      textLength: text.length,
      voiceConfig: requestBody.voice
    });

    try {
        const response = await fetch(`${API_ENDPOINT}?key=${this.apiKey}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('TTS API Error:', JSON.stringify(errorData, null, 2));
            throw new Error(`TTS synthesis failed: ${response.statusText}`);
        }

        console.log('✅ TTS Request SUCCEEDED!');
        const data = await response.json();
        const audioData = data.audioContent;
        
        // Decode base64 audio
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes.buffer;
        
    } catch (error) {
        console.error('TTS Error:', error);
        throw error;
    }
  }

  async speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    // Skip TTS if on landing page (to avoid unnecessary API calls)
    if (this.isOnLandingPage()) {
      console.log('Google Cloud TTS skipped: on landing page');
      if (onEnd) onEnd();
      return;
    }

    try {
      // CRITICAL: Reset stop flag FIRST before any async operations
      // This ensures new playback can proceed even if stop() was called previously
      console.log('GoogleCloudTTSService.speak: Resetting stopRequested from', this.stopRequested, 'to false');
      this.stopRequested = false;
      
      // Stop any current speech (but don't let it block new playback)
      // Only stop if there's actually audio playing
      if (this.audioPlayer.isSpeaking() || this.audioPlayer.isPausedState()) {
        this.stop();
        // Reset flag again after stop() (since stop() sets it to true)
        this.stopRequested = false;
      }
      
      // Mark that we're starting a speak operation
      this.speakingActive = true;
      console.log('GoogleCloudTTSService.speak: stopRequested =', this.stopRequested, 'after stop(), ready to start playback');

      // Auto-select a voice if none is selected
      if (!this.settings.voice) {
        await this.setDefaultVoice();
      }

      // Check if text exceeds Google Cloud TTS limit (5000 characters)
      const MAX_TEXT_LENGTH = 4500; // Use 4500 to be safe (5000 is the limit)
      
      if (text.length <= MAX_TEXT_LENGTH) {
        // Text is short enough, synthesize directly
        this.currentText = text; // Store text for word tracking
        const audioBuffer = await this.synthesize(text);
        await this.playAudio(audioBuffer, onEnd, onWord, text);
      } else {
        // Text is too long, split into chunks and play sequentially
        console.log(`Text too long (${text.length} chars), splitting into chunks...`);
        await this.speakInChunks(text, MAX_TEXT_LENGTH, onEnd, onWord);
      }
      
      // Clear speaking flag when done
      this.speakingActive = false;
    } catch (error) {
      console.error('Error speaking text:', error);
      this.speakingActive = false;
      throw error;
    }
  }

  private async speakInChunks(text: string, maxLength: number, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    // Split text into sentences first
    const sentences = this.splitIntoSentences(text);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      // If adding this sentence would exceed the limit, start a new chunk
      if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    console.log(`Split text into ${chunks.length} chunks`);
    console.log(`GoogleCloudTTSService.speakInChunks: stopRequested = ${this.stopRequested} at start`);

    // Play each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      // CHECK FOR STOP REQUEST BEFORE EACH CHUNK
      if (this.stopRequested) {
        console.log(`Chunk playback cancelled at ${i + 1}/${chunks.length}, stopRequested = ${this.stopRequested}`);
        this.speakingActive = false;
        return; // Exit loop immediately
      }
      
      // CHECK FOR PAUSE REQUEST - if paused, exit completely and wait for explicit resume
      if (this.audioPlayer.isPausedState()) {
        console.log(`Chunk playback paused at ${i + 1}/${chunks.length}, storing state for resume...`);
        // Store current state for resume
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false; // Mark as not actively speaking
        return; // Exit completely - resume() will handle continuation
      }
      
      const chunk = chunks[i];
      console.log(`Playing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      const audioBuffer = await this.synthesize(chunk);
      
      // CHECK AGAIN AFTER ASYNC SYNTHESIZE
      if (this.stopRequested) {
        console.log(`Chunk playback cancelled after synthesis ${i + 1}/${chunks.length}`);
        this.speakingActive = false;
        return;
      }
      
      // CHECK FOR PAUSE REQUEST AFTER SYNTHESIS
      if (this.audioPlayer.isPausedState()) {
        console.log(`Chunk paused after synthesis ${i + 1}/${chunks.length}`);
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false; // Mark as not actively speaking
        return; // Exit completely - resume() will handle playing this chunk
      }
      
      // Only call onEnd for the last chunk
      const isLastChunk = i === chunks.length - 1;
      await this.playAudio(audioBuffer, isLastChunk ? onEnd : undefined, onWord, chunk);
    }
    
    this.speakingActive = false;
  }

  private async playAudio(audioBuffer: ArrayBuffer, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void, text?: string): Promise<void> {
    if (this.stopRequested) {
      console.log('GoogleCloudTTSService.playAudio: Stop requested before starting playback');
      return;
    }

    try {
      console.log('GoogleCloudTTSService.playAudio: Starting playback with Howler, buffer size:', audioBuffer.byteLength);
      await this.audioPlayer.playAudio(audioBuffer, onEnd, onWord, text);
      console.log('GoogleCloudTTSService.playAudio: Audio playback completed');
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  pause() {
    if (this.audioPlayer.isSpeaking() || this.speakingActive) {
      this.audioPlayer.pause();
      console.log('GoogleCloudTTSService: Paused, speakingActive:', this.speakingActive);
    } else {
      console.log('GoogleCloudTTSService: Cannot pause - not speaking, speakingActive:', this.speakingActive);
    }
  }

  async resume() {
    if (!this.audioPlayer.isPausedState()) {
      console.log('GoogleCloudTTSService: Not paused, cannot resume');
      return;
    }
    
    console.log('GoogleCloudTTSService: Resume called, pausedChunkIndex:', this.pausedChunkIndex);
    
    // If we have chunks to resume, continue from where we left off
    if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0) {
      console.log('GoogleCloudTTSService: Resuming chunk playback from index:', this.pausedChunkIndex);
      this.speakingActive = true;
      
      this.speakInChunks(
        this.currentChunks.slice(this.pausedChunkIndex).join(' '),
        5000,
        this.currentOnEnd,
        this.currentOnWord
      ).catch(err => {
        console.error('Error resuming chunk playback:', err);
        this.speakingActive = false;
      });
    } else {
      // Resume current playback
      this.audioPlayer.resume();
      console.log('GoogleCloudTTSService: Resumed current playback');
    }
  }

  stop() {
    console.log('GoogleCloudTTSService.stop() called, stopRequested was:', this.stopRequested)
    this.stopRequested = true; // SET FLAG IMMEDIATELY
    console.log('GoogleCloudTTSService.stop() set stopRequested to:', this.stopRequested)
    
    this.audioPlayer.stop();
    this.speakingActive = false;
    this.pausedChunkIndex = -1;
    this.currentChunks = [];
    this.currentOnEnd = undefined;
    this.currentOnWord = undefined;
    this.currentText = '';
    console.log('GoogleCloudTTSService: Stop completed, stopRequested =', this.stopRequested)
  }

  isSpeaking(): boolean {
    return this.audioPlayer.isSpeaking() || this.speakingActive;
  }

  isPausedState(): boolean {
    return this.audioPlayer.isPausedState();
  }

  // Get current progress (0 to 1)
  getProgress(): number {
    return this.audioPlayer.getProgress();
  }

  // Get current time in seconds
  getCurrentTime(): number {
    return this.audioPlayer.getCurrentTime();
  }

  // Get total duration in seconds
  getDuration(): number {
    return this.audioPlayer.getDuration();
  }

  isSupported(): boolean {
    return this.isConfigured() && 
           typeof window !== 'undefined';
  }

  // Insert SSML pauses at paragraph breaks for natural speech flow
  insertSSMLPauses(text: string): string {
    // Google Cloud TTS supports SSML, so we can use proper pause tags
    
    // Section breaks (\n\n\n) -> 800ms pause
    let processedText = text.replace(/\n\n\n/g, '<break time="800ms"/> ')
    
    // Paragraph breaks (\n\n) -> 500ms pause
    processedText = processedText.replace(/\n\n/g, '<break time="500ms"/> ')
    
    // Line breaks (\n) -> 200ms pause
    processedText = processedText.replace(/\n/g, '<break time="200ms"/> ')
    
    // Wrap in SSML speak tags if pauses were added
    if (processedText.includes('<break')) {
      processedText = `<speak>${processedText}</speak>`
    }
    
    return processedText
  }

  // Clean text for better TTS pronunciation
  cleanText(text: string): string {
    // First insert pauses for breaks (without SSML for compatibility)
    let cleaned = text
    
    // Section breaks (\n\n\n) -> long pause
    cleaned = cleaned.replace(/\n\n\n/g, '... ')
    
    // Paragraph breaks (\n\n) -> medium pause
    cleaned = cleaned.replace(/\n\n/g, '. ')
    
    // Line breaks (\n) -> short pause
    cleaned = cleaned.replace(/\n/g, ', ')
    
    // Normalize
    cleaned = cleaned
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Add space after punctuation
      .replace(/\s+([.!?,;:])/g, '$1') // Remove space before punctuation
      .trim()
    
    return cleaned
  }

  // Split long text into sentences for better control
  splitIntoSentences(text: string): string[] {
    const cleaned = this.cleanText(text);
    return cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  }

  // Get estimated cost for text (approximate)
  getEstimatedCost(text: string): number {
    // Google Cloud TTS pricing: $4.00 per 1M characters
    const characterCount = text.length;
    return (characterCount / 1000000) * 4.00;
  }
}

// Export singleton instance
export const googleCloudTTSService = new GoogleCloudTTSService();
