/**
 * Google Cloud Text-to-Speech Service
 * Provides high-quality neural voices for PDF documents
 */

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
  private audioContext: AudioContext | null = null;
  private currentAudio: AudioBufferSourceNode | null = null;
  private isPaused = false;
  private speakingActive = false; // Track if we're actively in a speak operation (including between chunks)
  private pauseTime = 0;
  private startTime = 0;
  private currentAudioBuffer: AudioBuffer | null = null;
  private audioStartTime = 0;
  private audioPauseTime = 0;
  private onEndCallback: (() => void) | null = null;
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;
  private stopRequested: boolean = false;
  private pausedChunkIndex: number = -1; // Track which chunk was paused for proper resume
  private currentChunks: string[] = []; // Store chunks for resume
  private currentOnEnd: (() => void) | undefined = undefined; // Store onEnd callback
  private currentOnWord: ((word: string, charIndex: number) => void) | undefined = undefined; // Store onWord callback

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
    
    // Initialize audio context
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
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
      voiceWithModel.model = 'gemini-1.0-pro';
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
    try {
      // CRITICAL: Reset stop flag FIRST before any async operations
      // This ensures new playback can proceed even if stop() was called previously
      console.log('GoogleCloudTTSService.speak: Resetting stopRequested from', this.stopRequested, 'to false');
      this.stopRequested = false;
      
      // Stop any current speech (but don't let it block new playback)
      // Only stop if there's actually audio playing
      if (this.currentAudio || this.isPaused) {
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
        const audioBuffer = await this.synthesize(text);
        await this.playAudio(audioBuffer, onEnd, onWord);
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
      if (this.isPaused) {
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
      if (this.isPaused) {
        console.log(`Chunk paused after synthesis ${i + 1}/${chunks.length}`);
        // Store the audio buffer and state for resume
        const decodedAudio = await this.audioContext!.decodeAudioData(audioBuffer);
        this.currentAudioBuffer = decodedAudio;
        this.pausedChunkIndex = i;
        this.currentChunks = chunks;
        this.currentOnEnd = onEnd;
        this.currentOnWord = onWord;
        this.speakingActive = false; // Mark as not actively speaking
        return; // Exit completely - resume() will handle playing this chunk
      }
      
      // Only call onEnd for the last chunk
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
      // CRITICAL FIX: Resume AudioContext if suspended
      // Modern browsers require user interaction to resume suspended AudioContext
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

      // Ensure AudioContext is running before playing
      if (this.audioContext.state !== 'running') {
        console.warn('AudioContext state is not running:', this.audioContext.state);
        // Try to resume again
        try {
          await this.audioContext.resume();
        } catch (resumeError) {
          console.error('Failed to resume AudioContext before playback:', resumeError);
          throw new Error('Cannot play audio: AudioContext is not running');
        }
      }

      // Decode audio data
      const decodedAudio = await this.audioContext.decodeAudioData(audioBuffer);
      
      // Check stop flag before starting
      if (this.stopRequested) {
        return;
      }
      
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(this.audioContext.destination);
      
      // Store reference for control and progress tracking
      this.currentAudio = source;
      this.currentAudioBuffer = decodedAudio;
      
      // Store callbacks for resume functionality
      this.onEndCallback = onEnd || null;
      this.onWordCallback = onWord || null;
      
      // CRITICAL: Create a Promise that resolves when audio ends
      const audioEndPromise = new Promise<void>((resolve, reject) => {
        source.onended = () => {
          this.isPaused = false;
          this.pauseTime = 0;
          this.startTime = 0;
          this.audioStartTime = 0;
          this.audioPauseTime = 0;
          this.currentAudioBuffer = null;
          this.currentAudio = null;
          if (onEnd) onEnd();
          this.onEndCallback = null;
          this.onWordCallback = null;
          resolve(); // Resolve promise when audio ends
        };
        
        // Handle errors during playback (addEventListener is the correct API)
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

      // Start playing and track start time
      this.audioStartTime = this.audioContext.currentTime;
      this.startTime = this.audioContext.currentTime;
      
      try {
        source.start();
        console.log('Audio playback started successfully, AudioContext state:', this.audioContext.state);
      } catch (startError) {
        console.error('Failed to start audio playback:', startError);
        throw new Error('Failed to start audio playback: ' + (startError instanceof Error ? startError.message : String(startError)));
      }
      
      // WAIT for audio to complete before returning
      await audioEndPromise;
      
    } catch (error) {
      console.error('Error playing audio:', error);
      // Clean up on error
      this.currentAudio = null;
      this.currentAudioBuffer = null;
      this.onEndCallback = null;
      this.onWordCallback = null;
      throw error;
    }
  }

  pause() {
    // Allow pause if we have current audio OR if we're actively speaking (even between chunks)
    if ((this.currentAudio || this.speakingActive) && this.audioContext && !this.isPaused) {
      // If we have current audio, pause it and calculate pause time
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
        // We're between chunks - set pause time to indicate we're paused
        // The pauseTime will be used when we resume to continue from the current chunk
        this.pauseTime = this.audioContext.currentTime - this.audioStartTime;
      }
      this.isPaused = true;
      console.log('GoogleCloudTTSService: Paused at time:', this.pauseTime, 'speakingActive:', this.speakingActive);
    } else {
      console.log('GoogleCloudTTSService: Cannot pause - currentAudio:', !!this.currentAudio, 'speakingActive:', this.speakingActive, 'isPaused:', this.isPaused);
    }
  }

  async resume() {
    if (!this.isPaused) {
      console.log('GoogleCloudTTSService: Not paused, cannot resume');
      return;
    }
    
    console.log('GoogleCloudTTSService: Resume called, pauseTime:', this.pauseTime, 'pausedChunkIndex:', this.pausedChunkIndex);
    
    // Resume AudioContext if suspended
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
    
    // Handle resume from mid-chunk pause (we have audio buffer)
    if (this.audioContext && this.currentAudioBuffer) {
      console.log('GoogleCloudTTSService: Resuming from mid-chunk at time:', this.pauseTime);
      
      // Create a new audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.currentAudioBuffer;
      source.connect(this.audioContext.destination);
      
      // Set up end handler
      source.onended = () => {
        console.log('GoogleCloudTTSService: Chunk ended, continuing to next chunk if any');
        this.currentAudioBuffer = null;
        this.currentAudio = null;
        
        // Continue to next chunk if we were in a multi-chunk sequence
        if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0 && this.pausedChunkIndex < this.currentChunks.length - 1) {
          const nextIndex = this.pausedChunkIndex + 1;
          console.log(`Continuing to chunk ${nextIndex + 1}/${this.currentChunks.length}`);
          // Continue playback from next chunk
          this.speakInChunks(
            this.currentChunks.slice(nextIndex).join(' '),
            5000,
            this.currentOnEnd,
            this.currentOnWord
          ).catch(err => {
            console.error('Error continuing chunk playback:', err);
          });
        } else if (this.onEndCallback) {
          // Last chunk finished
          this.onEndCallback();
          this.onEndCallback = null;
        }
        
        // Clear state
        this.pauseTime = 0;
        this.startTime = 0;
        this.audioStartTime = 0;
        this.audioPauseTime = 0;
        this.pausedChunkIndex = -1;
        this.currentChunks = [];
        this.currentOnEnd = undefined;
        this.currentOnWord = undefined;
      };
      
      // Store reference
      this.currentAudio = source;
      
      // Resume from pause position
      this.audioStartTime = this.audioContext.currentTime - this.pauseTime;
      source.start(0, this.pauseTime);
      
      this.isPaused = false;
      console.log('GoogleCloudTTSService: Resumed successfully from', this.pauseTime, 'seconds');
    } else if (this.currentChunks.length > 0 && this.pausedChunkIndex >= 0) {
      // Handle resume when paused between chunks or before starting
      console.log('GoogleCloudTTSService: Resuming chunk playback from index:', this.pausedChunkIndex);
      this.speakingActive = true;
      this.isPaused = false;
      
      // Continue playing remaining chunks
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
      // No valid resume state - just clear pause flag
      console.warn('GoogleCloudTTSService: Resume called but no valid resume state');
      this.isPaused = false;
    }
  }

  stop() {
    console.log('GoogleCloudTTSService.stop() called, stopRequested was:', this.stopRequested)
    this.stopRequested = true; // SET FLAG IMMEDIATELY
    console.log('GoogleCloudTTSService.stop() set stopRequested to:', this.stopRequested)
    
    if (this.currentAudio) {
      console.log('GoogleCloudTTSService: Stopping current audio')
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
    console.log('GoogleCloudTTSService: Stop completed, stopRequested =', this.stopRequested)
  }

  isSpeaking(): boolean {
    return (this.currentAudio !== null || this.speakingActive) && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  // Get current progress (0 to 1)
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

  // Get current time in seconds
  getCurrentTime(): number {
    if (!this.audioContext || !this.currentAudioBuffer || !this.isSpeaking()) {
      return 0;
    }
    
    const currentTime = this.audioContext.currentTime;
    return Math.min(currentTime - this.audioStartTime, this.currentAudioBuffer.duration);
  }

  // Get total duration in seconds
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
