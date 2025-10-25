import { supabase } from '../src/services/supabaseAuthService';

// Re-export the single Supabase client instance
export { supabase };

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  tier: 'free' | 'pro' | 'premium' | 'enterprise';
  credits: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_size: number;
  file_type: string;
  s3_key: string;
  content?: string;
  embedding_status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  document_id?: string;
  title?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  model?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  action_type: string;
  credits_used: number;
  metadata: Record<string, any>;
  created_at: string;
}

// User Books interfaces
export interface UserBook {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text';
  file_size: number;
  total_pages?: number;
  s3_key?: string;  // NEW: S3 storage path instead of base64 data
  text_content?: string;  // Only for text files
  tts_metadata: Record<string, any>;
  last_read_page: number;
  reading_progress: number;
  created_at: string;
  updated_at: string;
  last_read_at?: string;
}

export interface UserNote {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  content: string;
  position_x?: number;
  position_y?: number;
  created_at: string;
  updated_at: string;
}

export interface UserAudio {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  audio_data_base64: string;
  duration_seconds?: number;
  voice_settings: Record<string, any>;
  created_at: string;
}

// Auth helpers
export const auth = {
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Profile helpers
export const profiles = {
  async get(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async update(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  async getUsageStats(userId: string) {
    const { data, error } = await supabase.rpc('get_user_usage_stats', {
      user_uuid: userId,
    });
    return { data, error };
  },
};

// Document helpers
export const documents = {
  async list(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async get(documentId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    return { data, error };
  },

  async create(document: Omit<Document, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('documents')
      .insert(document)
      .select()
      .single();
    return { data, error };
  },

  async update(documentId: string, updates: Partial<Document>) {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();
    return { data, error };
  },

  async delete(documentId: string) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
    return { error };
  },
};

// Conversation helpers
export const conversations = {
  async list(userId: string, documentId?: string) {
    let query = supabase
      .from('conversations')
      .select('*, messages(count)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async get(conversationId: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, messages(*)')
      .eq('id', conversationId)
      .single();
    return { data, error };
  },

  async create(
    userId: string,
    documentId?: string,
    title?: string
  ) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        document_id: documentId,
        title,
      })
      .select()
      .single();
    return { data, error };
  },

  async delete(conversationId: string) {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    return { error };
  },
};

// Message helpers
export const messages = {
  async list(conversationId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  async create(message: Omit<Message, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select()
      .single();
    return { data, error };
  },
};

// Usage tracking helpers
export const usage = {
  async track(
    userId: string,
    actionType: string,
    creditsUsed = 1,
    metadata: Record<string, any> = {}
  ) {
    const { data, error } = await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        action_type: actionType,
        credits_used: creditsUsed,
        metadata,
      })
      .select()
      .single();
    return { data, error };
  },

  async getMonthly(userId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    return { data, error };
  },
};

// User Books helpers
export const userBooks = {
  async list(userId: string, limit = 20) {  // Reduced from 50 to 20
    const { data, error } = await supabase
      .from('user_books')
      .select('id, user_id, title, file_name, file_type, file_size, total_pages, last_read_page, reading_progress, created_at, updated_at, last_read_at, tts_metadata')  // Exclude large columns
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async get(bookId: string) {
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('id', bookId)
      .single();
    return { data, error };
  },

  async create(book: Omit<UserBook, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('user_books')
      .insert(book)
      .select()
      .single();
    return { data, error };
  },

  async update(bookId: string, updates: Partial<UserBook>) {
    const { data, error } = await supabase
      .from('user_books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();
    return { data, error };
  },

  async delete(bookId: string) {
    const { error } = await supabase
      .from('user_books')
      .delete()
      .eq('id', bookId);
    return { error };
  },

  async updateReadingProgress(bookId: string, pageNumber: number, totalPages: number) {
    const { data, error } = await supabase.rpc('update_reading_progress', {
      book_uuid: bookId,
      page_num: pageNumber,
      total_pages: totalPages
    });
    return { data, error };
  },

  async getReadingStats(userId: string) {
    const { data, error } = await supabase.rpc('get_user_reading_stats', {
      user_uuid: userId
    });
    return { data, error };
  }
};

// User Notes helpers
export const userNotes = {
  async list(userId: string, bookId?: string) {
    let query = supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bookId) {
      query = query.eq('book_id', bookId);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async get(noteId: string) {
    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('id', noteId)
      .single();
    return { data, error };
  },

  async create(note: Omit<UserNote, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('user_notes')
      .insert(note)
      .select()
      .single();
    return { data, error };
  },

  async update(noteId: string, updates: Partial<UserNote>) {
    const { data, error } = await supabase
      .from('user_notes')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();
    return { data, error };
  },

  async delete(noteId: string) {
    const { error } = await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId);
    return { error };
  }
};

// User Audio helpers
export const userAudio = {
  async list(userId: string, bookId?: string) {
    let query = supabase
      .from('user_audio')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bookId) {
      query = query.eq('book_id', bookId);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async get(audioId: string) {
    const { data, error } = await supabase
      .from('user_audio')
      .select('*')
      .eq('id', audioId)
      .single();
    return { data, error };
  },

  async create(audio: Omit<UserAudio, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('user_audio')
      .insert(audio)
      .select()
      .single();
    return { data, error };
  },

  async delete(audioId: string) {
    const { error } = await supabase
      .from('user_audio')
      .delete()
      .eq('id', audioId);
    return { error };
  }
};

// Pomodoro Sessions helpers
export interface PomodoroSession {
  id: string
  user_id: string
  book_id: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  mode: 'work' | 'shortBreak' | 'longBreak'
  completed: boolean
  created_at: string
  updated_at: string
}

export interface PomodoroBookStats {
  total_sessions: number
  total_time_seconds: number
  total_time_minutes: number
  total_time_hours: number
  average_session_minutes: number
  completed_sessions: number
  work_sessions: number
  break_sessions: number
  last_session_at: string
}

export const pomodoroSessions = {
  async startSession(userId: string, bookId: string, mode: 'work' | 'shortBreak' | 'longBreak') {
    // First, check for and close any active sessions
    const { data: activeSessions } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null);

    // Auto-complete any active sessions
    if (activeSessions && activeSessions.length > 0) {
      for (const session of activeSessions) {
        const duration = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
        await supabase
          .from('pomodoro_sessions')
          .update({
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
            completed: false
          })
          .eq('id', session.id);
      }
    }

    // Create new session
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert({
        user_id: userId,
        book_id: bookId,
        mode,
        started_at: new Date().toISOString(),
        completed: false
      })
      .select()
      .single();
    
    return { data, error };
  },

  async stopSession(sessionId: string, durationSeconds: number, completed: boolean = true) {
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        completed
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    return { data, error };
  },

  async getActiveSession(userId: string) {
    const { data, error } = await supabase.rpc('get_active_pomodoro_session', {
      user_uuid: userId
    });
    
    return { data: data?.[0] || null, error };
  },

  async getBookStats(bookId: string) {
    const { data, error } = await supabase.rpc('get_pomodoro_stats_by_book', {
      book_uuid: bookId
    });
    
    return { data: data?.[0] || null, error };
  },

  async getDailyStats(userId: string, daysBack: number = 7) {
    const { data, error } = await supabase.rpc('get_daily_pomodoro_stats', {
      user_uuid: userId,
      days_back: daysBack
    });
    
    return { data, error };
  },

  async getTimePatterns(userId: string, daysBack: number = 30) {
    const { data, error } = await supabase.rpc('get_time_of_day_patterns', {
      user_uuid: userId,
      days_back: daysBack
    });
    
    return { data, error };
  },

  async getWeeklySummary(userId: string) {
    const { data, error } = await supabase.rpc('get_weekly_pomodoro_summary', {
      user_uuid: userId
    });
    
    return { data, error };
  },

  async list(userId: string, bookId?: string, limit: number = 50) {
    let query = supabase
      .from('pomodoro_sessions')
      .select(`
        *,
        user_books (
          title,
          file_name
        )
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (bookId) {
      query = query.eq('book_id', bookId);
    }

    const { data, error } = await query;
    return { data, error };
  }
};

