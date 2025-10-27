/**
 * TTS Cache Service
 * Two-tier caching system: In-memory (fast) → Database (persistent)
 */

import { supabase } from '../../lib/supabase';

export interface TTSCacheEntry {
  id: string;
  content_hash: string;
  text_content: string;
  scope_type: 'paragraph' | 'page' | 'document' | 'selection';
  page_number?: number;
  paragraph_index?: number;
  audio_data_base64?: string;
  audio_storage_url?: string;
  audio_format: string;
  duration_seconds: number;
  voice_name: string;
  speaking_rate: number;
  pitch: number;
  volume_gain: number;
  provider: 'native' | 'google-cloud';
}

export interface TTSCacheQuery {
  bookId: string;
  text: string;
  scopeType: 'paragraph' | 'page' | 'document';
  pageNumber?: number;
  paragraphIndex?: number;
  voiceSettings: {
    voiceName: string;
    speakingRate: number;
    pitch: number;
    provider: 'native' | 'google-cloud';
  };
}

class TTSCacheService {
  // In-memory cache for instant access (LRU with max 50 entries)
  private memoryCache = new Map<string, { audio: ArrayBuffer; timestamp: number }>();
  private readonly MAX_MEMORY_CACHE = 50;

  /**
   * Generate content hash for cache key
   * Simple SHA-256 implementation without external dependencies
   */
  private async generateContentHash(text: string, voiceSettings: any): Promise<string> {
    const cacheKey = `${text}|${voiceSettings.voiceName}|${voiceSettings.speakingRate}|${voiceSettings.pitch}`;
    
    // Use Web Crypto API for SHA-256
    const msgBuffer = new TextEncoder().encode(cacheKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate memory cache key
   */
  private async getMemoryCacheKey(query: TTSCacheQuery): Promise<string> {
    const hash = await this.generateContentHash(query.text, query.voiceSettings);
    return `${query.bookId}_${hash}`;
  }

  /**
   * Check in-memory cache first (instant)
   */
  async getFromMemoryCache(query: TTSCacheQuery): Promise<ArrayBuffer | null> {
    const key = await this.getMemoryCacheKey(query);
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      // Update timestamp for LRU
      this.memoryCache.delete(key);
      this.memoryCache.set(key, { ...cached, timestamp: Date.now() });
      return cached.audio;
    }
    
    return null;
  }

  /**
   * Add to in-memory cache (with LRU eviction)
   */
  private async addToMemoryCache(query: TTSCacheQuery, audio: ArrayBuffer): Promise<void> {
    const key = await this.getMemoryCacheKey(query);
    
    // Evict oldest if at capacity
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, { audio, timestamp: Date.now() });
  }

  /**
   * Fetch from database cache
   */
  async getFromDatabase(query: TTSCacheQuery): Promise<TTSCacheEntry | null> {
    try {
      const contentHash = await this.generateContentHash(query.text, query.voiceSettings);
      
      const { data, error } = await supabase
        .from('tts_audio_cache')
        .select('*')
        .eq('book_id', query.bookId)
        .eq('content_hash', contentHash)
        .eq('voice_name', query.voiceSettings.voiceName)
        .eq('speaking_rate', query.voiceSettings.speakingRate)
        .eq('pitch', query.voiceSettings.pitch)
        .eq('scope_type', query.scopeType)
        .maybeSingle();

      if (error) {
        console.error('TTSCacheService: Database fetch error:', error);
        return null;
      }

      if (data) {
        // Update access count and timestamp
        await this.updateAccessMetrics(data.id);
        
        return data as TTSCacheEntry;
      }

      return null;
    } catch (error) {
      console.error('TTSCacheService: Error fetching from database:', error);
      return null;
    }
  }

  /**
   * Save generated audio to cache
   */
  async saveToCache(
    query: TTSCacheQuery,
    audioData: ArrayBuffer,
    duration: number
  ): Promise<void> {
    try {
      const contentHash = await this.generateContentHash(query.text, query.voiceSettings);
      const audioBase64 = this.arrayBufferToBase64(audioData);
      
      // Add to memory cache first (instant access)
      await this.addToMemoryCache(query, audioData);

      // Save to database (persistent) - insert with on conflict update
      const { error } = await supabase
        .from('tts_audio_cache')
        .upsert({
          book_id: query.bookId,
          content_hash: contentHash,
          text_content: query.text,
          scope_type: query.scopeType,
          page_number: query.pageNumber,
          paragraph_index: query.paragraphIndex,
          audio_data_base64: audioBase64,
          audio_format: 'mp3',
          duration_seconds: duration,
          file_size_bytes: audioData.byteLength,
          voice_name: query.voiceSettings.voiceName,
          speaking_rate: query.voiceSettings.speakingRate,
          pitch: query.voiceSettings.pitch,
          volume_gain: 0,
          provider: query.voiceSettings.provider,
        }, {
          onConflict: 'user_id, book_id, content_hash, voice_name, speaking_rate, pitch'
        });

      if (error) {
        console.error('TTSCacheService: Error saving to database:', error);
      }
    } catch (error) {
      console.error('TTSCacheService: Error in saveToCache:', error);
    }
  }

  /**
   * Get cached audio (memory first, then database)
   */
  async getCachedAudio(query: TTSCacheQuery): Promise<ArrayBuffer | null> {
    // 1. Check memory cache first (instant)
    const memCached = await this.getFromMemoryCache(query);
    if (memCached) {
      console.log('TTSCacheService: Cache HIT (memory)');
      return memCached;
    }

    // 2. Check database cache (fast)
    const dbCached = await this.getFromDatabase(query);
    if (dbCached && dbCached.audio_data_base64) {
      console.log('TTSCacheService: Cache HIT (database)');
      const audioData = this.base64ToArrayBuffer(dbCached.audio_data_base64);
      
      // Add to memory cache for next time
      await this.addToMemoryCache(query, audioData);
      
      return audioData;
    }

    console.log('TTSCacheService: Cache MISS');
    return null;
  }

  /**
   * Update access metrics
   */
  private async updateAccessMetrics(cacheId: string): Promise<void> {
    try {
      // Use direct SQL update since RPC might not be available yet
      await supabase
        .from('tts_audio_cache')
        .update({
          access_count: supabase.rpc('increment_counter', { count: 1 }) as any,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', cacheId);
    } catch (error) {
      // Fallback to simple increment
      const { data } = await supabase
        .from('tts_audio_cache')
        .select('access_count')
        .eq('id', cacheId)
        .single();
      
      if (data) {
        await supabase
          .from('tts_audio_cache')
          .update({
            access_count: (data.access_count || 0) + 1,
            last_accessed_at: new Date().toISOString()
          })
          .eq('id', cacheId);
      }
    }
  }

  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Clear memory cache (for testing or memory management)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { memorySize: number; memoryLimit: number } {
    return {
      memorySize: this.memoryCache.size,
      memoryLimit: this.MAX_MEMORY_CACHE
    };
  }
}

export const ttsCacheService = new TTSCacheService();
