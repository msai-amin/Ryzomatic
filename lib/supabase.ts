import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client (uses anon key)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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

