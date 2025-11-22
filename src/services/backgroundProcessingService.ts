import { documentRelevanceService } from './documentRelevanceService';
import { autoRelationshipService } from '../../lib/autoRelationshipService';
import { documentDescriptionService } from '../../lib/documentDescriptionService';
import { supabase } from '../services/supabaseAuthService';

class BackgroundProcessingService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 60000; // 60 seconds - longer interval for AI processing

  start() {
    if (this.isRunning) {
      console.log('BackgroundProcessingService: Already running');
      return;
    }

    console.log('BackgroundProcessingService: Starting background processing');
    this.isRunning = true;

    // Process immediately on start
    this.processQueue();

    // Set up interval for periodic processing
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);
  }

  stop() {
    if (!this.isRunning) {
      console.log('BackgroundProcessingService: Not running');
      return;
    }

    console.log('BackgroundProcessingService: Stopping background processing');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async processQueue() {
    try {
      console.log('BackgroundProcessingService: Processing relevance calculation queue');
      await documentRelevanceService.processRelevanceQueue();

      // Process document description generation for documents without descriptions
      console.log('BackgroundProcessingService: Processing document descriptions');
      await this.processMissingDescriptions();

      // Process note relationship auto-detection
      console.log('BackgroundProcessingService: Processing note relationships');
      await this.processNoteRelationships();
    } catch (error) {
      console.error('BackgroundProcessingService: Error processing queue:', error);
    }
  }

  private async processMissingDescriptions() {
    try {
      // Check for books without embeddings (now stored in user_books.description_embedding)
      const { data: books, error } = await supabase
        .from('user_books')
        .select('id, user_id, text_content')
        .not('text_content', 'is', null)
        .is('description_embedding', null)
        .limit(10);

      if (error || !books) return;

      for (const book of books) {
        await documentDescriptionService.generateDescription(book.id, book.user_id, book.text_content || undefined)
          .catch(err => console.error(`Error generating description for book ${book.id}:`, err));
      }
    } catch (error) {
      console.error('Error processing missing descriptions:', error);
    }
  }

  private async processNoteRelationships() {
    try {
      // First, get all note IDs that already have relationships
      const { data: existingRelationships } = await supabase
        .from('note_relationships')
        .select('note_id');

      const existingNoteIds = existingRelationships?.map(r => r.note_id) || [];

      // Get notes without relationships
      let query = supabase
        .from('user_notes')
        .select('id, user_id')
        .limit(10);

      // Only add the not.in filter if there are existing relationships
      if (existingNoteIds.length > 0) {
        query = query.not('id', 'in', `(${existingNoteIds.join(',')})`);
      }

      const { data: notes, error } = await query;

      if (error || !notes) return;

      for (const note of notes) {
        await autoRelationshipService.detectNoteRelationships(note.id, note.user_id)
          .catch(err => console.error(`Error detecting relationships for note ${note.id}:`, err));
      }
    } catch (error) {
      console.error('Error processing note relationships:', error);
    }
  }

  // Force immediate processing (useful for testing)
  async processNow() {
    console.log('BackgroundProcessingService: Force processing queue');
    await this.processQueue();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.PROCESSING_INTERVAL
    };
  }
}

export const backgroundProcessingService = new BackgroundProcessingService();
