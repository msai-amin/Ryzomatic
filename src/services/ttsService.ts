/**
 * Text-to-Speech Service
 * Provides natural human voice reading for PDF documents
 */

export interface Voice {
  name: string;
  lang: string;
  gender: 'male' | 'female';
  voiceURI: string;
}

export interface TTSSettings {
  rate: number; // 0.1 to 10
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
  voice: SpeechSynthesisVoice | null;
}

class TextToSpeechService {
  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private settings: TTSSettings = {
    rate: 1,
    pitch: 1,
    volume: 1,
    voice: null,
  };
  private isPaused = false;
  private currentText = '';
  private onEndCallback: (() => void) | null = null;
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;
  
  // Recording support
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();

    // Load voices when they change (some browsers load them asynchronously)
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    this.voices = this.synth.getVoices();
    
    // Auto-select a high-quality English voice if available
    if (!this.settings.voice && this.voices.length > 0) {
      // Prefer premium/enhanced voices
      const premiumVoice = this.voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Natural'))
      );
      
      // Or use any English voice
      const englishVoice = this.voices.find(v => v.lang.startsWith('en'));
      
      this.settings.voice = premiumVoice || englishVoice || this.voices[0];
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getEnglishVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(v => v.lang.startsWith('en'));
  }

  // Get curated natural voices - 3 female and 3 male
  getNaturalVoices(): { female: SpeechSynthesisVoice[]; male: SpeechSynthesisVoice[] } {
    const englishVoices = this.getEnglishVoices();
    
    // Keywords that indicate natural/premium voices
    const naturalKeywords = [
      'premium', 'enhanced', 'natural', 'neural', 'google', 
      'samantha', 'karen', 'moira', 'tessa', 'fiona', 'alice',
      'daniel', 'oliver', 'tom', 'alex', 'fred', 'james',
      'microsoft', 'siri', 'google us', 'google uk'
    ];

    // Keywords for female voices
    const femaleKeywords = [
      'female', 'woman', 'samantha', 'karen', 'moira', 'tessa', 
      'fiona', 'alice', 'victoria', 'zira', 'susan', 'linda',
      'heather', 'serena', 'aria', 'emma', 'ava', 'ella'
    ];

    // Keywords for male voices
    const maleKeywords = [
      'male', 'man', 'daniel', 'oliver', 'tom', 'alex', 'fred',
      'james', 'david', 'mark', 'george', 'rishi', 'thomas'
    ];

    // Score voices based on quality indicators
    const scoreVoice = (voice: SpeechSynthesisVoice): number => {
      let score = 0;
      const lowerName = voice.name.toLowerCase();
      
      // Premium/Natural voice bonus
      naturalKeywords.forEach(keyword => {
        if (lowerName.includes(keyword.toLowerCase())) {
          score += 10;
        }
      });

      // Local voice bonus (usually higher quality)
      if (voice.localService) {
        score += 5;
      }

      // US/UK English bonus
      if (voice.lang === 'en-US' || voice.lang === 'en-GB') {
        score += 3;
      }

      return score;
    };

    // Classify and score voices
    const classifiedVoices = englishVoices.map(voice => {
      const lowerName = voice.name.toLowerCase();
      let gender: 'male' | 'female' | 'unknown' = 'unknown';

      // Determine gender
      if (femaleKeywords.some(keyword => lowerName.includes(keyword))) {
        gender = 'female';
      } else if (maleKeywords.some(keyword => lowerName.includes(keyword))) {
        gender = 'male';
      }

      return {
        voice,
        gender,
        score: scoreVoice(voice)
      };
    });

    // Sort by score (highest first)
    const sortedByScore = classifiedVoices.sort((a, b) => b.score - a.score);

    // Get top 3 female and 3 male voices
    const femaleVoices = sortedByScore
      .filter(v => v.gender === 'female')
      .slice(0, 3)
      .map(v => v.voice);

    const maleVoices = sortedByScore
      .filter(v => v.gender === 'male')
      .slice(0, 3)
      .map(v => v.voice);

    // If we don't have enough, add some from unknown category
    if (femaleVoices.length < 3) {
      const unknownVoices = sortedByScore
        .filter(v => v.gender === 'unknown')
        .map(v => v.voice);
      
      while (femaleVoices.length < 3 && unknownVoices.length > 0) {
        femaleVoices.push(unknownVoices.shift()!);
      }
    }

    if (maleVoices.length < 3) {
      const unknownVoices = sortedByScore
        .filter(v => v.gender === 'unknown')
        .map(v => v.voice);
      
      while (maleVoices.length < 3 && unknownVoices.length > 0) {
        maleVoices.push(unknownVoices.shift()!);
      }
    }

    return { female: femaleVoices, male: maleVoices };
  }

  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  setVoice(voice: SpeechSynthesisVoice) {
    this.settings.voice = voice;
  }

  setRate(rate: number) {
    this.settings.rate = Math.max(0.1, Math.min(10, rate));
    if (this.utterance && this.synth.speaking) {
      // Apply to current utterance
      this.utterance.rate = this.settings.rate;
    }
  }

  setPitch(pitch: number) {
    this.settings.pitch = Math.max(0, Math.min(2, pitch));
    if (this.utterance && this.synth.speaking) {
      this.utterance.pitch = this.settings.pitch;
    }
  }

  setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    if (this.utterance && this.synth.speaking) {
      this.utterance.volume = this.settings.volume;
    }
  }

  speak(text: string, onEnd?: () => void, onWord?: (word: string, charIndex: number) => void) {
    // Check if TTS is supported
    if (!this.isSupported()) {
      console.error('TTS not supported in this browser');
      if (onEnd) onEnd();
      return;
    }

    // Check if we have text to speak
    if (!text || text.trim().length === 0) {
      console.warn('No text to speak');
      if (onEnd) onEnd();
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    this.currentText = text;
    this.onEndCallback = onEnd || null;
    this.onWordCallback = onWord || null;

    // Ensure voices are loaded
    if (this.voices.length === 0) {
      console.warn('No voices available, loading voices...');
      this.loadVoices();
      
      // If still no voices, wait a bit and try again
      if (this.voices.length === 0) {
        setTimeout(() => {
          this.loadVoices();
          if (this.voices.length === 0) {
            console.error('No voices available after loading');
            if (onEnd) onEnd();
            return;
          }
          this.speak(text, onEnd, onWord);
        }, 1000);
        return;
      }
    }

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.voice = this.settings.voice;
    this.utterance.rate = this.settings.rate;
    this.utterance.pitch = this.settings.pitch;
    this.utterance.volume = this.settings.volume;

    // Event listeners
    this.utterance.onend = () => {
      this.isPaused = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    this.utterance.onerror = (event) => {
      console.error('TTS Error:', event);
      this.isPaused = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    if (this.onWordCallback) {
      this.utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const word = text.slice(event.charIndex, event.charIndex + event.charLength);
          this.onWordCallback!(word, event.charIndex);
        }
      };
    }

    try {
      this.synth.speak(this.utterance);
      this.isPaused = false;
    } catch (error) {
      console.error('Failed to start speech synthesis:', error);
      if (onEnd) onEnd();
    }
  }

  pause() {
    if (this.synth.speaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  stop() {
    this.synth.cancel();
    this.isPaused = false;
    this.utterance = null;
  }

  isSpeaking(): boolean {
    return this.synth.speaking;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
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

  // Recording methods
  async startRecording(): Promise<void> {
    try {
      // Create a destination for capturing audio (using Web Audio API)
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect to the destination for recording
      this.recordingStream = destination.stream;
      
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.recordingStream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording. Please check microphone permissions.');
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.audioChunks = [];
        this.isRecording = false;
        
        // Clean up
        if (this.recordingStream) {
          this.recordingStream.getTracks().forEach(track => track.stop());
          this.recordingStream = null;
        }
        
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Speak and record simultaneously
  async speakAndRecord(
    text: string,
    onEnd?: () => void,
    onWord?: (word: string, charIndex: number) => void
  ): Promise<void> {
    await this.startRecording();
    this.speak(text, () => {
      if (onEnd) onEnd();
    }, onWord);
  }

  async getRecordedAudio(): Promise<Blob> {
    if (this.isRecording) {
      return await this.stopRecording();
    }
    throw new Error('No recording to retrieve');
  }
}

// Export singleton instance
export const ttsService = new TextToSpeechService();
