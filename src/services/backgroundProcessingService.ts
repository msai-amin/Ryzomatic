import { documentRelevanceService } from './documentRelevanceService';

class BackgroundProcessingService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds

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
    } catch (error) {
      console.error('BackgroundProcessingService: Error processing queue:', error);
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
