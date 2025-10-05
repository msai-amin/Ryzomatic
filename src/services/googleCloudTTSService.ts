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
}

export interface GoogleCloudTTSSettings {
  voice: GoogleCloudVoice | null;
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  speakingRate: number; // 0.25 to 4.0
  pitch: number; // -20.0 to 20.0
  volumeGainDb: number; // -96.0 to 16.0
  sampleRateHertz: number; // 8000, 16000, 22050, 24000
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

  constructor() {
    // Get API key from environment
    this.apiKey = import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY || null;
    
    // Initialize audio context
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async getVoices(): Promise<GoogleCloudVoice[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Cloud TTS API key not configured');
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching Google Cloud voices:', error);
      throw error;
    }
  }

  async getEnglishVoices(): Promise<GoogleCloudVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => 
      voice.languageCode.startsWith('en-') && 
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
    this.settings.voice = voice;
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

    const requestBody = {
      input: { text },
      voice: {
        languageCode: this.settings.voice.languageCode,
        name: this.settings.voice.name,
        ssmlGender: this.settings.voice.ssmlGender
      },
      audioConfig: {
        audioEncoding: this.settings.audioEncoding,
        speakingRate: this.settings.speakingRate,
        pitch: this.settings.pitch,
        volumeGainDb: this.settings.volumeGainDb,
        sampleRateHertz: this.settings.sampleRateHertz
      }
    };

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`TTS synthesis failed: ${response.statusText}`);
      }

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
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  async speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void): Promise<void> {
    try {
      // Stop any current speech
      this.stop();

      // Synthesize audio
      const audioBuffer = await this.synthesize(text);
      
      // Play audio
      await this.playAudio(audioBuffer, onEnd, onWord);
    } catch (error) {
      console.error('Error speaking text:', error);
      throw error;
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
      
      // Store reference for control
      this.currentAudio = source;
      
      // Set up event handlers
      source.onended = () => {
        this.isPaused = false;
        this.pauseTime = 0;
        this.startTime = 0;
        if (onEnd) onEnd();
      };

      // Start playing
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
      this.pauseTime = this.audioContext.currentTime - this.startTime;
      this.currentAudio.stop();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isPaused && this.audioContext) {
      // Note: Resume is complex with Google Cloud TTS as we need to
      // re-synthesize from the pause point. For now, we'll restart.
      this.isPaused = false;
      this.pauseTime = 0;
      this.startTime = 0;
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.stop();
      this.currentAudio = null;
    }
    this.isPaused = false;
    this.pauseTime = 0;
    this.startTime = 0;
  }

  isSpeaking(): boolean {
    return this.currentAudio !== null && !this.isPaused;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  isSupported(): boolean {
    return this.isConfigured() && 
           typeof window !== 'undefined' && 
           window.AudioContext !== undefined;
  }

  // Clean text for better TTS pronunciation
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Add space after punctuation
      .replace(/\n+/g, '. ') // Replace newlines with periods
      .replace(/\s+([.!?,;:])/g, '$1') // Remove space before punctuation
      .trim();
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
