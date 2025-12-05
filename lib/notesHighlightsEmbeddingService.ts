import { createClient } from '@supabase/supabase-js';
import { embeddingService } from './embeddingService';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// For server-side embedding generation (bypasses API endpoint)
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

export interface EmbeddingJobItem {
  type: 'note' | 'highlight';
  id: string;
}

export class NotesHighlightsEmbeddingService {
  /**
   * Generate embedding for a note and store it in the database
   */
  async generateEmbeddingForNote(noteId: string, userId: string): Promise<boolean> {
    try {
      // Fetch the note
      const { data: note, error: fetchError } = await supabase
        .from('user_notes')
        .select('id, content, user_id')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !note) {
        console.error('Error fetching note for embedding:', fetchError);
        return false;
      }

      if (!note.content || note.content.trim().length === 0) {
        console.warn('Note has no content, skipping embedding');
        return false;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(note.content);

      if (!embedding || embedding.length === 0) {
        console.error('Failed to generate embedding for note');
        return false;
      }

      // Store embedding in database
      const embeddingVector = embeddingService.formatForPgVector(embedding);
      const { error: updateError } = await supabase
        .from('user_notes')
        .update({
          embedding: embeddingVector,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error storing note embedding:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error generating embedding for note:', error);
      return false;
    }
  }

  /**
   * Generate embedding for a highlight and store it in the database
   */
  async generateEmbeddingForHighlight(highlightId: string, userId: string): Promise<boolean> {
    try {
      // Fetch the highlight
      const { data: highlight, error: fetchError } = await supabase
        .from('user_highlights')
        .select('id, highlighted_text, user_id')
        .eq('id', highlightId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !highlight) {
        console.error('Error fetching highlight for embedding:', fetchError);
        return false;
      }

      if (!highlight.highlighted_text || highlight.highlighted_text.trim().length === 0) {
        console.warn('Highlight has no text, skipping embedding');
        return false;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(highlight.highlighted_text);

      if (!embedding || embedding.length === 0) {
        console.error('Failed to generate embedding for highlight');
        return false;
      }

      // Store embedding in database
      const embeddingVector = embeddingService.formatForPgVector(embedding);
      const { error: updateError } = await supabase
        .from('user_highlights')
        .update({
          embedding: embeddingVector,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('id', highlightId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error storing highlight embedding:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error generating embedding for highlight:', error);
      return false;
    }
  }

  /**
   * Generate embeddings for multiple items in batch
   */
  async generateEmbeddingsBatch(items: EmbeddingJobItem[]): Promise<void> {
    const results = await Promise.allSettled(
      items.map(async (item) => {
        if (item.type === 'note') {
          // Need to get userId for the note
          const { data: note } = await supabase
            .from('user_notes')
            .select('user_id')
            .eq('id', item.id)
            .single();
          
          if (note) {
            return this.generateEmbeddingForNote(item.id, note.user_id);
          }
        } else if (item.type === 'highlight') {
          // Need to get userId for the highlight
          const { data: highlight } = await supabase
            .from('user_highlights')
            .select('user_id')
            .eq('id', item.id)
            .single();
          
          if (highlight) {
            return this.generateEmbeddingForHighlight(item.id, highlight.user_id);
          }
        }
        return false;
      })
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to generate embedding for ${items[index].type} ${items[index].id}:`, result.reason);
      }
    });
  }

  /**
   * Process pending embedding jobs from the queue
   */
  async processPendingEmbeddings(limit: number = 50): Promise<number> {
    try {
      // Get pending jobs from database
      const { data: jobs, error } = await supabase.rpc('get_pending_embedding_jobs', {
        batch_size: limit,
        max_priority: 10,
      });

      if (error) {
        console.error('Error fetching pending embedding jobs:', error);
        return 0;
      }

      if (!jobs || jobs.length === 0) {
        return 0;
      }

      let processed = 0;
      let succeeded = 0;

      // Process each job
      for (const job of jobs) {
        try {
          // Mark job as processing
          await supabase.rpc('start_embedding_job', { job_uuid: job.id });

          let success = false;

          if (job.item_type === 'note') {
            success = await this.generateEmbeddingForNote(job.item_id, job.user_id);
          } else if (job.item_type === 'highlight') {
            success = await this.generateEmbeddingForHighlight(job.item_id, job.user_id);
          }

          if (success) {
            // Mark job as completed
            await supabase.rpc('complete_embedding_job', { job_uuid: job.id });
            succeeded++;
          } else {
            // Mark job as failed
            await supabase.rpc('fail_embedding_job', {
              job_uuid: job.id,
              error_msg: 'Failed to generate embedding',
            });
          }

          processed++;
        } catch (error) {
          console.error(`Error processing embedding job ${job.id}:`, error);
          await supabase.rpc('fail_embedding_job', {
            job_uuid: job.id,
            error_msg: error instanceof Error ? error.message : 'Unknown error',
          });
          processed++;
        }
      }

      console.log(`Processed ${processed} embedding jobs, ${succeeded} succeeded`);
      return succeeded;
    } catch (error) {
      console.error('Error processing pending embeddings:', error);
      return 0;
    }
  }

  /**
   * Generate embedding using server-side Gemini API or fallback to embeddingService
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Try server-side generation first (faster, no API call overhead)
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        // Use same format as api/gemini/embedding.ts
        const result = await model.embedContent({
          content: text,
          outputDimensionality: 768,
        } as any);
        return result.embedding.values;
      } catch (error) {
        console.warn('Server-side embedding failed, falling back to API:', error);
      }
    }

    // Fallback to embeddingService (uses API endpoint)
    try {
      return await embeddingService.embed(text);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Queue an embedding job for a note
   */
  async queueNoteEmbedding(noteId: string, userId: string, priority: number = 5): Promise<void> {
    try {
      await supabase.rpc('queue_embedding_job', {
        p_user_id: userId,
        p_item_type: 'note',
        p_item_id: noteId,
        p_priority: priority,
      });
    } catch (error) {
      console.error('Error queueing note embedding job:', error);
    }
  }

  /**
   * Queue an embedding job for a highlight
   */
  async queueHighlightEmbedding(highlightId: string, userId: string, priority: number = 5): Promise<void> {
    try {
      await supabase.rpc('queue_embedding_job', {
        p_user_id: userId,
        p_item_type: 'highlight',
        p_item_id: highlightId,
        p_priority: priority,
      });
    } catch (error) {
      console.error('Error queueing highlight embedding job:', error);
    }
  }
}

export const notesHighlightsEmbeddingService = new NotesHighlightsEmbeddingService();

