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
    rate: 0.9, // Slightly slower for more natural speech
    pitch: 1.1, // Slightly higher pitch for more natural sound
    volume: 0.8, // Slightly lower volume for comfort
    voice: null,
  };
  private isPaused = false;
  private currentText = '';
  private onEndCallback: (() => void) | null = null;
  private onWordCallback: ((word: string, charIndex: number) => void) | null = null;
  
  // Progress tracking
  private startTime: number = 0;
  private currentCharIndex: number = 0;
  private totalTextLength: number = 0;
  private estimatedDuration: number = 0;
  private playbackStartTime: number = 0; // Actual wall-clock start time
  private pausedTime: number = 0; // Time when paused (to calculate elapsed time on resume)
  private totalPauseDuration: number = 0; // Total time spent paused
  private lastValidCharIndex: number = 0; // Track if word boundaries are working
  
  // Time-based word tracking (for when browser word boundaries are broken)
  private words: string[] = [];
  private wordUpdateInterval: number | null = null;
  private millisecondsPerWord: number = 0;
  
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
        v.lang && v.lang.startsWith('en') && 
        (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Natural'))
      );
      
      // Or use any English voice
      const englishVoice = this.voices.find(v => v.lang && v.lang.startsWith('en'));
      
      this.settings.voice = premiumVoice || englishVoice || this.voices[0];
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  getEnglishVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(v => v.lang && v.lang.startsWith('en'));
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
    console.log('TTSService.speak called:', {
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      hasOnEnd: !!onEnd,
      hasOnWord: !!onWord,
      isSupported: this.isSupported(),
      voicesCount: this.voices.length,
      currentVoice: this.settings.voice ? {
        name: this.settings.voice.name,
        lang: this.settings.voice.lang,
        localService: this.settings.voice.localService
      } : null,
      settings: this.settings
    });

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
    
    // Initialize progress tracking
    this.totalTextLength = text.length;
    this.currentCharIndex = 0;
    this.lastValidCharIndex = 0;
    this.startTime = Date.now();
    this.playbackStartTime = 0; // Will be set when audio actually starts
    this.pausedTime = 0;
    this.totalPauseDuration = 0;
    
    // Split text into words for time-based highlighting
    this.words = text.split(/\s+/).filter(word => word.trim().length > 0);
    
    // Estimate duration: average speaking rate is ~150 words per minute
    // Adjust based on the configured rate setting
    const wordCount = this.words.length;
    const baseWordsPerMinute = 150;
    const adjustedWordsPerMinute = baseWordsPerMinute * this.settings.rate;
    this.estimatedDuration = (wordCount / adjustedWordsPerMinute) * 60 * 1000; // in milliseconds
    
    // Calculate milliseconds per word for time-based word tracking
    this.millisecondsPerWord = this.estimatedDuration / wordCount;
    
    console.log(`TTS Progress initialized: ${wordCount} words, ${(this.estimatedDuration / 1000).toFixed(1)}s duration, ${this.millisecondsPerWord.toFixed(0)}ms per word`);

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
    
    // Validate utterance creation
    if (!this.utterance) {
      console.error('Failed to create SpeechSynthesisUtterance');
      if (onEnd) onEnd();
      return;
    }
    
    console.log('SpeechSynthesisUtterance created successfully:', {
      textLength: this.utterance.text.length,
      hasVoice: !!this.settings.voice,
      voiceName: this.settings.voice?.name || 'default'
    });
    
    this.utterance.voice = this.settings.voice;
    this.utterance.rate = this.settings.rate;
    this.utterance.pitch = this.settings.pitch;
    this.utterance.volume = this.settings.volume;
    
    console.log('Utterance configured:', {
      voice: this.utterance.voice?.name || 'default',
      rate: this.utterance.rate,
      pitch: this.utterance.pitch,
      volume: this.utterance.volume
    });

    // Event listeners
    this.utterance.onstart = () => {
      this.playbackStartTime = Date.now();
      console.log('TTS playback started at:', this.playbackStartTime);
      
      // Start time-based word tracking interval
      this.startWordTracking();
    };
    
    this.utterance.onend = () => {
      this.isPaused = false;
      this.playbackStartTime = 0;
      this.stopWordTracking();
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    this.utterance.onerror = (event) => {
      // Only log real errors, not interruptions from user actions
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error('TTS Error Details:', {
          error: event.error,
          type: event.type,
          charIndex: event.charIndex,
          charLength: event.charLength,
          name: event.name,
          utterance: {
            text: this.utterance?.text?.substring(0, 100) + '...',
            voice: this.utterance?.voice?.name,
            rate: this.utterance?.rate,
            pitch: this.utterance?.pitch,
            volume: this.utterance?.volume
          },
          synthStatus: {
            speaking: this.synth.speaking,
            pending: this.synth.pending,
            paused: this.synth.paused
          },
          voicesAvailable: this.voices.length,
          currentVoice: this.settings.voice ? {
            name: this.settings.voice.name,
            lang: this.settings.voice.lang,
            localService: this.settings.voice.localService
          } : null
        });
        
        // Log the full event object for debugging
        console.error('Full TTS Error Event:', event);
      } else {
        console.log('TTS interrupted/canceled (this is normal when user stops playback)');
      }
      
      this.isPaused = false;
      this.currentCharIndex = 0;
      this.playbackStartTime = 0;
      this.stopWordTracking();
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    // Always track progress via word boundaries
    this.utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const word = text.slice(event.charIndex, event.charIndex + (event.charLength || 0));
        
        // Detect if word boundaries are working properly
        // If charIndex is advancing, use it. If it's stuck at 0 or returning the full text, ignore it.
        const isValidBoundary = event.charIndex > this.lastValidCharIndex || 
                                (event.charIndex > 0 && event.charLength && event.charLength < 100);
        
        if (isValidBoundary) {
          this.currentCharIndex = event.charIndex;
          this.lastValidCharIndex = event.charIndex;
          
          // Debug: Log first few VALID word boundaries
          if (this.currentCharIndex < 200) {
            console.log('Valid word boundary:', { 
              word: word.substring(0, 50), 
              charIndex: event.charIndex, 
              charLength: event.charLength
            });
          }
          
          // Call word callback if provided
          if (this.onWordCallback) {
            this.onWordCallback(word, event.charIndex);
          }
        } else {
          // Word boundaries are broken - we'll use time-based fallback
          if (event.charIndex === 0 && event.charLength === this.totalTextLength) {
            console.warn('Word boundaries broken: browser returned entire text as one word. Using time-based progress fallback.');
          }
        }
      }
    };

    try {
      console.log('TTSService.speak: Calling synth.speak with utterance:', {
        text: this.utterance.text.substring(0, 50) + '...',
        voice: this.utterance.voice?.name || 'default',
        rate: this.utterance.rate,
        pitch: this.utterance.pitch,
        volume: this.utterance.volume,
        synthSpeaking: this.synth.speaking,
        synthPending: this.synth.pending,
        synthPaused: this.synth.paused
      });
      
      // Some browsers require a small delay before speaking
      if (this.synth.speaking) {
        console.log('TTS already speaking, stopping first...');
        this.synth.cancel();
        // Small delay to ensure cancellation is processed
        setTimeout(() => {
          this.synth.speak(this.utterance);
          this.isPaused = false;
        }, 100);
      } else {
        this.synth.speak(this.utterance);
        this.isPaused = false;
      }
      
      console.log('TTSService.speak: synth.speak called successfully, checking status:', {
        speaking: this.synth.speaking,
        pending: this.synth.pending,
        paused: this.synth.paused
      });
      
      // Check if speech actually started after a short delay
      setTimeout(() => {
        if (!this.synth.speaking && !this.synth.pending) {
          console.warn('TTS may not have started properly - no speaking or pending state detected');
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to start speech synthesis:', error);
      if (onEnd) onEnd();
    }
  }

  pause() {
    if (this.synth.speaking && !this.isPaused) {
      console.log('TTSService: Pausing playback');
      this.pausedTime = Date.now(); // Record when we paused
      this.synth.pause();
      this.isPaused = true;
      this.stopWordTracking(); // Pause word tracking
    }
  }

  resume() {
    if (this.isPaused) {
      console.log('TTSService: Resuming playback');
      
      // Calculate how long we were paused and adjust start time
      if (this.pausedTime > 0) {
        const pauseDuration = Date.now() - this.pausedTime;
        this.totalPauseDuration += pauseDuration;
        console.log(`TTSService: Was paused for ${(pauseDuration / 1000).toFixed(1)}s, total pause time: ${(this.totalPauseDuration / 1000).toFixed(1)}s`);
      }
      
      this.synth.resume();
      this.isPaused = false;
      this.pausedTime = 0;
      this.startWordTracking(); // Resume word tracking
    }
  }

  stop() {
    this.synth.cancel();
    this.isPaused = false;
    this.utterance = null;
    this.currentCharIndex = 0;
    this.lastValidCharIndex = 0;
    this.startTime = 0;
    this.playbackStartTime = 0;
    this.pausedTime = 0;
    this.totalPauseDuration = 0;
    this.stopWordTracking();
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

  // Get current progress (0 to 1)
  getProgress(): number {
    if (!this.isSpeaking() && !this.isPaused) {
      return 0;
    }
    
    if (this.totalTextLength === 0 || this.estimatedDuration === 0) {
      return 0;
    }
    
    // If word boundaries are working (charIndex is advancing), use them
    if (this.lastValidCharIndex > 0) {
      const progress = Math.min(this.currentCharIndex / this.totalTextLength, 1);
      return progress;
    }
    
    // Fallback: Use time-based estimation if word boundaries are broken
    if (this.playbackStartTime > 0) {
      let elapsedTime: number;
      
      if (this.isPaused && this.pausedTime > 0) {
        // If paused, calculate elapsed time up to pause point
        elapsedTime = this.pausedTime - this.playbackStartTime - this.totalPauseDuration;
      } else {
        // If playing, calculate current elapsed time minus any pause duration
        elapsedTime = Date.now() - this.playbackStartTime - this.totalPauseDuration;
      }
      
      const progress = Math.min(Math.max(elapsedTime / this.estimatedDuration, 0), 1);
      
      // Debug: Log occasionally
      if (Math.random() < 0.02) { // 2% chance
        console.log(`📈 getProgress (time-based): elapsed=${(elapsedTime / 1000).toFixed(1)}s, paused=${(this.totalPauseDuration / 1000).toFixed(1)}s, estimated=${(this.estimatedDuration / 1000).toFixed(1)}s, progress=${(progress * 100).toFixed(1)}%`);
      }
      
      return progress;
    }
    
    return 0;
  }

  // Get current time in seconds
  getCurrentTime(): number {
    if (!this.isSpeaking() && !this.isPaused) {
      return 0;
    }
    
    const progress = this.getProgress();
    const currentTime = (progress * this.estimatedDuration) / 1000;
    
    // Debug: Log occasionally to see actual values
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(`⏱️ getCurrentTime: progress=${(progress * 100).toFixed(1)}%, time=${currentTime.toFixed(1)}s, duration=${this.getDuration().toFixed(1)}s`);
    }
    
    return currentTime;
  }

  // Get total duration in seconds
  getDuration(): number {
    return this.estimatedDuration / 1000;
  }

  // Start time-based word tracking for highlighting
  private startWordTracking(): void {
    // Clear any existing interval
    this.stopWordTracking();
    
    // Only start if we have words and a callback
    if (this.words.length === 0 || !this.onWordCallback) {
      return;
    }
    
    console.log(`🎯 Starting time-based word tracking: ${this.words.length} words @ ${this.millisecondsPerWord.toFixed(0)}ms per word`);
    
    // Update word index based on elapsed time
    let intervalCount = 0;
    this.wordUpdateInterval = window.setInterval(() => {
      if (!this.playbackStartTime || !this.isSpeaking()) {
        if (intervalCount < 3) {
          console.log(`⚠️ Word tracking interval skipped: playbackStartTime=${this.playbackStartTime}, isSpeaking=${this.isSpeaking()}`);
          intervalCount++;
        }
        return;
      }
      
      // Calculate elapsed time accounting for pauses
      const elapsedTime = Date.now() - this.playbackStartTime - this.totalPauseDuration;
      const currentWordIndex = Math.floor(elapsedTime / this.millisecondsPerWord);
      
      // Make sure we don't exceed the array bounds
      if (currentWordIndex >= 0 && currentWordIndex < this.words.length) {
        const word = this.words[currentWordIndex];
        
        // Calculate approximate character index for this word
        // Sum up the lengths of all previous words plus spaces
        let charIndex = 0;
        for (let i = 0; i < currentWordIndex; i++) {
          charIndex += this.words[i].length + 1; // +1 for space
        }
        
        // Debug: Log first few words with explicit values
        if (currentWordIndex < 10) {
          console.log(`Time-based word #${currentWordIndex}: "${word.substring(0, 20)}" at ${(elapsedTime / 1000).toFixed(1)}s (charIndex: ${charIndex})`);
        }
        
        // Call the word callback to update the UI
        this.onWordCallback(word, charIndex);
      }
    }, 100); // Update every 100ms for smooth highlighting
  }

  // Stop time-based word tracking
  private stopWordTracking(): void {
    if (this.wordUpdateInterval !== null) {
      clearInterval(this.wordUpdateInterval);
      this.wordUpdateInterval = null;
      console.log('Stopped time-based word tracking');
    }
  }

  // Insert natural pauses at paragraph breaks for better speech flow
  insertPausesForBreaks(text: string): string {
    // For browsers that don't support SSML, we'll use punctuation to create pauses
    // Replace different break levels with appropriate pauses
    
    // Section breaks (\n\n\n) -> long pause (period + comma)
    let processedText = text.replace(/\n\n\n/g, '... ')
    
    // Paragraph breaks (\n\n) -> medium pause (period)
    processedText = processedText.replace(/\n\n/g, '. ')
    
    // Line breaks (\n) -> short pause (comma)
    processedText = processedText.replace(/\n/g, ', ')
    
    return processedText
  }

  // Clean text for better TTS pronunciation
  cleanText(text: string): string {
    // First insert pauses for breaks
    let cleaned = this.insertPausesForBreaks(text)
    
    // Then normalize
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
