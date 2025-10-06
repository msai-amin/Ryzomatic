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
      
      // Prioritize voices that don't require a model first
      const voicesWithoutModel = voices.filter(v => 
        v.name && v.languageCode && v.languageCode.startsWith('en-') && !v.model
      );
      
      // Try to find a good voice without model requirement
      let selectedVoice = voicesWithoutModel.find(v => v.name.includes('Neural2')) ||
                         voicesWithoutModel.find(v => v.name.includes('Studio')) ||
                         voicesWithoutModel.find(v => v.name.includes('Wavenet')) ||
                         voicesWithoutModel[0];
      
      // If no voice without model, use any English voice and set a default model
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          v.name && v.languageCode && v.languageCode.startsWith('en-')
        );
        
        // If the selected voice requires a model, set a default one
        if (selectedVoice && selectedVoice.model === undefined) {
          // For voices that require a model, try to set a reasonable default
          if (selectedVoice.name.includes('Neural2')) {
            selectedVoice.model = 'latest'; // Use latest model for Neural2 voices
          } else if (selectedVoice.name.includes('Studio')) {
            selectedVoice.model = 'latest'; // Use latest model for Studio voices
          } else if (selectedVoice.name.includes('Wavenet')) {
            // Wavenet voices typically don't need a model, but just in case
            selectedVoice.model = 'latest';
          }
        }
      }
      
      if (selectedVoice) {
        this.settings.voice = selectedVoice;
        console.log('Set default Google Cloud TTS voice:', selectedVoice.name, selectedVoice.model ? `(model: ${selectedVoice.model})` : '(no model required)');
        return;
      }
      
      // Fallback to old logic if needed
      const neuralVoice = voices.find(v => 
        v.name && v.name.includes('Neural2') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (neuralVoice) {
        this.settings.voice = neuralVoice;
        console.log('Set default Google Cloud TTS voice:', neuralVoice.name);
        return;
      }
      
      // Fallback to studio voices
      const studioVoice = voices.find(v => 
        v.name && v.name.includes('Studio') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (studioVoice) {
        this.settings.voice = studioVoice;
        console.log('Set default Google Cloud TTS voice:', studioVoice.name);
        return;
      }
      
      // Fallback to wavenet voices
      const wavenetVoice = voices.find(v => 
        v.name && v.name.includes('Wavenet') && v.languageCode && v.languageCode.startsWith('en-')
      );
      
      if (wavenetVoice) {
        this.settings.voice = wavenetVoice;
        console.log('Set default Google Cloud TTS voice:', wavenetVoice.name);
        return;
      }
      
      // Fallback to any English voice
      const englishVoice = voices.find(v => v.languageCode && v.languageCode.startsWith('en-'));
      
      if (englishVoice) {
        this.settings.voice = englishVoice;
        console.log('Set default Google Cloud TTS voice:', englishVoice.name);
        return;
      }
      
      // Last resort - first available voice
      if (voices.length > 0) {
        this.settings.voice = voices[0];
        console.log('Set default Google Cloud TTS voice:', voices[0].name);
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

  // Ensure voice has model field if required
  private ensureVoiceHasModel(voice: GoogleCloudVoice): GoogleCloudVoice {
    if (!voice) return voice;
    
    // If voice already has a model, return as is
    if (voice.model) {
      return voice;
    }
    
    // Create a copy of the voice object
    const voiceWithModel = { ...voice };
    
    // Set model for voices that require it
    // Based on Google Cloud TTS documentation, Neural2 and Studio voices require a model
    if (voice.name.includes('Neural2')) {
      voiceWithModel.model = 'latest';
    } else if (voice.name.includes('Studio')) {
      voiceWithModel.model = 'latest';
    } else if (voice.name.includes('Wavenet')) {
      // Wavenet voices typically don't need a model, but set it just in case
      voiceWithModel.model = 'latest';
    } else if (voice.name.includes('Neural')) {
      // Other neural voices might also need a model
      voiceWithModel.model = 'latest';
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

    // Ensure we have valid voice properties
    const voice = this.settings.voice;
    if (!voice.languageCode) {
      // Try to extract language code from voice name if not present
      const nameMatch = voice.name.match(/([a-z]{2}-[A-Z]{2})/);
      if (nameMatch) {
        voice.languageCode = nameMatch[1];
      } else {
        // Fallback to en-US
        voice.languageCode = 'en-US';
      }
    }

    const voiceConfig: any = {
      languageCode: voice.languageCode,
      name: voice.name,
      ssmlGender: voice.ssmlGender || 'NEUTRAL'
    };

    // Add model if available (required for some voices)
    if (voice.model) {
      voiceConfig.model = voice.model;
    }

    const requestBody = {
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: this.settings.audioEncoding,
        speakingRate: this.settings.speakingRate,
        pitch: this.settings.pitch,
        volumeGainDb: this.settings.volumeGainDb,
        sampleRateHertz: this.settings.sampleRateHertz
      }
    };

    console.log('Google Cloud TTS Request:', {
      voice: this.settings.voice,
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      audioConfig: requestBody.audioConfig
    });

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
        let errorMessage = `TTS synthesis failed: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage += ` - ${errorData.error.message || JSON.stringify(errorData.error)}`;
            
            // Provide specific guidance for model-related errors
            if (errorData.error.message && errorData.error.message.includes('model name')) {
              errorMessage += '\n\nTip: This voice requires a model field. Try selecting a different voice or contact support.';
            }
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        console.error('Google Cloud TTS Error Details:', {
          status: response.status,
          statusText: response.statusText,
          voice: this.settings.voice,
          requestBody: requestBody
        });
        throw new Error(errorMessage);
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

      // Auto-select a voice if none is selected
      if (!this.settings.voice) {
        await this.setDefaultVoice();
      }

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
