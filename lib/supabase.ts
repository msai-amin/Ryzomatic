import { supabase } from '../src/services/supabaseAuthService';

// Re-export the single Supabase client instance
export { supabase };

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  tier: 'free' | 'custom';
  credits: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  created_at: string;
  updated_at: string;
}

// DEPRECATED: Use UserBook interface instead
// This interface is kept for backward compatibility but should not be used in new code
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

// User Books interface (consolidated from Document + UserBook)
export interface UserBook {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'text' | 'epub';
  file_size: number;  // DEPRECATED: Use file_size_bytes instead
  file_size_bytes?: number;  // Canonical size field
  total_pages?: number;
  s3_key?: string;
  text_content?: string;
  page_texts?: string[];
  page_texts_cleaned?: string[];
  
  // AI/RAG fields (consolidated from documents table)
  content?: string;
  embedding_status?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // OCR fields (from documents table)
  needs_ocr?: boolean;
  ocr_status?: 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed' | 'user_declined';
  ocr_metadata?: Record<string, any>;
  
  // TTS fields
  tts_metadata: Record<string, any>;
  tts_last_position?: Record<string, any>;
  
  // Reading progress
  last_read_page: number;
  reading_progress: number;
  last_read_at?: string;
  
  // Library organization
  is_favorite?: boolean;
  custom_metadata?: Record<string, any>;
  notes_count?: number;
  
  // Series grouping
  series_id?: string;
  series_order?: number;
  
  // Pomodoro tracking
  pomodoro_sessions_count?: number;
  total_pomodoro_time_seconds?: number;
  total_pomodoro_sessions?: number;
  last_pomodoro_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface UserNote {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  content: string;
  position_x?: number;
  position_y?: number;
  note_type?: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | 'freeform';
  note_metadata?: Record<string, any>; // JSONB field for template-specific data
  is_ai_generated?: boolean;
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

export interface ReadingGoal {
  id: string;
  user_id: string;
  goal_type: 'books_read' | 'pages_read' | 'minutes_studied' | 'notes_created' | 'sessions_completed';
  target_value: number;
  current_value: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  streak_days: number;
  last_activity_date: string | null;
  start_date: string;
  end_date: string | null;
  completed: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BookSeries {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  author?: string;
  cover_image_url?: string;
  display_order: number;
  is_favorite: boolean;
  custom_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  filter_config: Record<string, any>;
  icon: string;
  color: string;
  is_favorite: boolean;
  display_order: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description?: string;
  icon: string;
  color: string;
  structure: any[];
  is_public: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
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

// DEPRECATED: Document helpers - Use userBooks instead
// These helpers are kept for backward compatibility but will be removed in a future version
export const documents = {
  async list(userId: string, limit = 50) {
    console.warn('documents.list is deprecated. Use userBooks.list instead.');
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async get(documentId: string) {
    console.warn('documents.get is deprecated. Use userBooks.get instead.');
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('id', documentId)
      .single();
    return { data, error };
  },

  async create(document: Omit<Document, 'id' | 'created_at' | 'updated_at'>) {
    console.warn('documents.create is deprecated. Use userBooks.create instead.');
    const { data, error } = await supabase
      .from('user_books')
      .insert(document)
      .select()
      .single();
    return { data, error };
  },

  async update(documentId: string, updates: Partial<Document>) {
    console.warn('documents.update is deprecated. Use userBooks.update instead.');
    const { data, error } = await supabase
      .from('user_books')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();
    return { data, error };
  },

  async delete(documentId: string) {
    console.warn('documents.delete is deprecated. Use userBooks.delete instead.');
    const { error } = await supabase
      .from('user_books')
      .delete()
      .eq('id', documentId);
    return { error };
  },
};

// Conversation helpers (using chat schema after migration 031)
export const conversations = {
  async list(userId: string, documentId?: string) {
    let query = supabase
      .from('chat.conversations')
      .select('*, chat.messages(count)')
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
      .from('chat.conversations')
      .select('*, chat.messages(*)')
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
      .from('chat.conversations')
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
      .from('chat.conversations')
      .delete()
      .eq('id', conversationId);
    return { error };
  },
};

// Message helpers (using chat schema after migration 031)
export const messages = {
  async list(conversationId: string) {
    const { data, error } = await supabase
      .from('chat.messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  async create(message: Omit<Message, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('chat.messages')
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
      .select('id, user_id, title, file_name, file_type, file_size_bytes, total_pages, last_read_page, reading_progress, created_at, updated_at, last_read_at, tts_metadata, is_favorite')  // Exclude large columns
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
    const { data, error } = await supabase
      .from('user_books')
      .delete()
      .eq('id', bookId)
      .select();
    return { data, error };
  },

  async updateReadingProgress(bookId: string, pageNumber: number, totalPages: number) {
    const { data, error } = await supabase.rpc('update_reading_progress', {
      book_uuid: bookId,
      page_num: pageNumber,
      total_pages_param: totalPages
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
    // First, close ANY active sessions in a single batch update (no loop!)
    // This prevents "orphaned" sessions if the browser crashed
    await supabase
      .from('pomodoro_sessions')
      .update({
        ended_at: new Date().toISOString(),
        // Calculate duration based on the difference between now and start time
        // Using raw SQL to handle the timestamp math
        // duration_seconds: supabase.raw("EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER"),
        completed: false
      })
      .eq('user_id', userId)
      .is('ended_at', null);

    // Note: Since we can't easily do raw SQL updates with the JS client for the calculated duration
    // without a custom RPC or specific permissions, we rely on the fact that most sessions 
    // should be closed properly. For cleaned up sessions, we might just accept that duration 
    // might be null or calculated later by a scheduled job if needed. 
    // Alternatively, we could fetch then update, but that reintroduces the race condition/loop.
    // Best approach for robustness without custom SQL: just close them.
    // The update_book_pomodoro_totals trigger handles the calculation if ended_at is set.

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

// Document Relationships interfaces
export interface DocumentRelationship {
  id: string;
  user_id: string;
  source_document_id: string;
  related_document_id: string;
  relationship_description?: string;
  relevance_percentage?: number;
  ai_generated_description?: string;
  relevance_calculation_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface DocumentRelationshipWithDetails {
  relationship_id: string;
  related_document_id: string;
  related_title: string;
  related_file_name: string;
  related_file_type: string;
  related_total_pages?: number;
  relationship_description?: string;
  relevance_percentage?: number;
  ai_generated_description?: string;
  relevance_calculation_status: string;
  created_at: string;
}

export interface CreateRelationshipData {
  source_document_id: string;
  related_document_id: string;
  relationship_description?: string;
}

export interface UpdateRelationshipData {
  relationship_description?: string;
  relevance_percentage?: number;
  ai_generated_description?: string;
  relevance_calculation_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

// Document Relationships helper functions
export const documentRelationships = {
  async list(sourceDocumentId: string) {
    const { data, error } = await supabase
      .from('document_relationships')
      .select('*')
      .eq('source_document_id', sourceDocumentId)
      .order('relevance_percentage', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async get(relationshipId: string) {
    const { data, error } = await supabase
      .from('document_relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();
    return { data, error };
  },

  async getWithDetails(sourceDocumentId: string) {
    const { data, error } = await supabase.rpc('get_related_documents_with_details', {
      source_document_id: sourceDocumentId
    });
    return { data, error };
  },

  async create(data: CreateRelationshipData) {
    const { data: result, error } = await supabase
      .from('document_relationships')
      .insert({
        source_document_id: data.source_document_id,
        related_document_id: data.related_document_id,
        relationship_description: data.relationship_description,
        relevance_calculation_status: 'pending'
      })
      .select()
      .single();
    return { data: result, error };
  },

  async update(relationshipId: string, data: UpdateRelationshipData) {
    const { data: result, error } = await supabase
      .from('document_relationships')
      .update(data)
      .eq('id', relationshipId)
      .select()
      .single();
    return { data: result, error };
  },

  async delete(relationshipId: string) {
    const { error } = await supabase
      .from('document_relationships')
      .delete()
      .eq('id', relationshipId);
    return { error };
  },

  async getStats(userId: string) {
    const { data, error } = await supabase.rpc('get_document_relationship_stats', {
      user_uuid: userId
    });
    return { data, error };
  },

  async getPendingCalculations() {
    const { data, error } = await supabase
      .from('document_relationships')
      .select('*')
      .eq('relevance_calculation_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);
    return { data, error };
  },

  async markAsProcessing(relationshipId: string) {
    const { error } = await supabase
      .from('document_relationships')
      .update({ relevance_calculation_status: 'processing' })
      .eq('id', relationshipId);
    return { error };
  },

  async markAsCompleted(relationshipId: string, relevancePercentage: number, aiDescription?: string) {
    const { error } = await supabase
      .from('document_relationships')
      .update({ 
        relevance_calculation_status: 'completed',
        relevance_percentage: relevancePercentage,
        ai_generated_description: aiDescription
      })
      .eq('id', relationshipId);
    return { error };
  },

  async markAsFailed(relationshipId: string) {
    const { error } = await supabase
      .from('document_relationships')
      .update({ relevance_calculation_status: 'failed' })
      .eq('id', relationshipId);
    return { error };
  }
};

