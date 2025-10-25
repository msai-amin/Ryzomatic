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
  private pauseTime = 0;
  private startTime = 0;
  private currentAudioBuffer: AudioBuffer | null = null;
  private audioStartTime = 0;
  private audioPauseTime = 0;
  private onEndCallback: (() => void) | null = null;
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;

  constructor() {
    // Get API key from environment
    this.apiKey = import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY || null;
    
    // Initialize audio context
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
    
    // Set default voice if configured
    this.setDefaultVoice();
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
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
      throw new Error('Google Cloud TTS API key not configured');
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
      // Stop any current speech
      this.stop();

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
    } catch (error) {
      console.error('Error speaking text:', error);
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

    // Play each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Playing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      const audioBuffer = await this.synthesize(chunk);
      
      // Only call onEnd for the last chunk
      const isLastChunk = i === chunks.length - 1;
      await this.playAudio(audioBuffer, isLastChunk ? onEnd : undefined, onWord);
    }
  }

  private async playAudio(audioBuffer: ArrayBuffer, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    try {
      // Decode audio data
      const decodedAudio = await this.audioContext.decodeAudioData(audioBuffer);
      
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
      
      // Set up event handlers
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
      };

      // Start playing and track start time
      this.audioStartTime = this.audioContext.currentTime;
      this.startTime = this.audioContext.currentTime;
      source.start();
      
      // Note: Word-by-word highlighting is not available with Google Cloud TTS
      // as it returns pre-rendered audio. For word highlighting, we'd need
      // to use SSML with word timestamps, which is more complex.
      
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  pause() {
    if (this.currentAudio && this.audioContext && !this.isPaused) {
      // Calculate how far into the audio we are
      this.pauseTime = this.audioContext.currentTime - this.audioStartTime;
      this.currentAudio.stop();
      this.currentAudio.disconnect();
      this.currentAudio = null;
      this.isPaused = true;
      console.log('GoogleCloudTTSService: Paused at time:', this.pauseTime);
    }
  }

  resume() {
    if (this.isPaused && this.audioContext && this.currentAudioBuffer) {
      console.log('GoogleCloudTTSService: Resuming from time:', this.pauseTime);
      
      // Create a new audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.currentAudioBuffer;
      source.connect(this.audioContext.destination);
      
      // Set up end handler
      source.onended = () => {
        this.isPaused = false;
        this.pauseTime = 0;
        this.startTime = 0;
        this.audioStartTime = 0;
        this.audioPauseTime = 0;
        this.currentAudioBuffer = null;
        this.currentAudio = null;
        if (this.onEndCallback) {
          this.onEndCallback();
          this.onEndCallback = null;
        }
      };
      
      // Store reference
      this.currentAudio = source;
      
      // Resume from pause position
      this.audioStartTime = this.audioContext.currentTime - this.pauseTime;
      source.start(0, this.pauseTime);
      
      this.isPaused = false;
      console.log('GoogleCloudTTSService: Resumed successfully from', this.pauseTime, 'seconds');
    }
  }

  stop() {
    console.log('GoogleCloudTTSService.stop() called')
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
    this.pauseTime = 0;
    this.startTime = 0;
    this.audioStartTime = 0;
    this.audioPauseTime = 0;
    this.currentAudioBuffer = null;
    this.onEndCallback = null;
    this.onWordCallback = null;
    console.log('GoogleCloudTTSService: Stop completed')
  }

  isSpeaking(): boolean {
    return this.currentAudio !== null && !this.isPaused;
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
