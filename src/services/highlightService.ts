/**
 * Highlight Service
 * Manages highlight CRUD operations, caching, and syncing with backend
 */

import { authService } from './supabaseAuthService';

export interface HighlightPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  highlighted_text: string;
  color_id: string;
  color_hex: string;
  position_data: HighlightPosition;
  text_start_offset?: number;
  text_end_offset?: number;
  text_context_before?: string;
  text_context_after?: string;
  is_orphaned: boolean;
  orphaned_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateHighlightData {
  bookId: string;
  pageNumber: number;
  highlightedText: string;
  colorId: string;
  colorHex: string;
  positionData: HighlightPosition;
  textStartOffset?: number;
  textEndOffset?: number;
  textContextBefore?: string;
  textContextAfter?: string;
}

export interface UpdateHighlightData {
  colorId?: string;
  colorHex?: string;
  positionData?: HighlightPosition;
  textStartOffset?: number;
  textEndOffset?: number;
  isOrphaned?: boolean;
  orphanedReason?: string;
}

class HighlightService {
  private cache: Map<string, Highlight[]> = new Map();
  private pendingSaves: Map<string, NodeJS.Timeout> = new Map();
  private readonly API_BASE = '/api/highlights';
  private readonly DEBOUNCE_DELAY = 500; // ms

  /**
   * Check if API is available (only in production/deployed environment)
   */
  private isAPIAvailable(): boolean {
    // API endpoints are Vercel serverless functions - only available in production
    return import.meta.env.PROD || window.location.hostname !== 'localhost';
  }

  /**
   * Get authorization header for API requests
   */
  private async getAuthHeader(): Promise<string> {
    const session = await authService.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return `Bearer ${session.access_token}`;
  }

  /**
   * Create a new highlight
   */
  async createHighlight(data: CreateHighlightData): Promise<Highlight> {
    if (!this.isAPIAvailable()) {
      console.warn('Highlight API not available in local development');
      throw new Error('Highlight feature only available in production');
    }
    
    try {
      const authHeader = await this.getAuthHeader();

      const response = await fetch(`${this.API_BASE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          bookId: data.bookId,
          pageNumber: data.pageNumber,
          highlightedText: data.highlightedText,
          colorId: data.colorId,
          colorHex: data.colorHex,
          positionData: data.positionData,
          textStartOffset: data.textStartOffset,
          textEndOffset: data.textEndOffset,
          textContextBefore: data.textContextBefore,
          textContextAfter: data.textContextAfter,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create highlight');
      }

      const result = await response.json();
      
      // Update cache
      this.addToCache(data.bookId, result.highlight);

      return result.highlight;
    } catch (error) {
      console.error('Error creating highlight:', error);
      throw error;
    }
  }

  /**
   * Get highlights for a book
   */
  async getHighlights(
    bookId: string,
    options: { pageNumber?: number; includeOrphaned?: boolean } = {}
  ): Promise<Highlight[]> {
    if (!this.isAPIAvailable()) {
      console.warn('Highlight API not available in local development');
      return []; // Return empty array in development
    }
    
    try {
      const authHeader = await this.getAuthHeader();

      const params = new URLSearchParams({ bookId });
      if (options.pageNumber !== undefined) {
        params.append('pageNumber', options.pageNumber.toString());
      }
      if (options.includeOrphaned !== undefined) {
        params.append('includeOrphaned', options.includeOrphaned.toString());
      }

      const response = await fetch(`${this.API_BASE}?bookId=${bookId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        // If 404, return empty array instead of throwing error
        // This can happen if the book doesn't exist yet (e.g., just uploaded)
        if (response.status === 404) {
          console.warn('Book not found when fetching highlights, returning empty array:', bookId);
          return [];
        }
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch highlights');
      }

      const result = await response.json();
      
      // Update cache if fetching all highlights for a book
      if (options.pageNumber === undefined) {
        this.cache.set(bookId, result.highlights);
      }

      return result.highlights;
    } catch (error) {
      console.error('Error fetching highlights:', error);
      throw error;
    }
  }

  /**
   * Update a highlight
   */
  async updateHighlight(highlightId: string, updates: UpdateHighlightData): Promise<Highlight> {
    try {
      const authHeader = await this.getAuthHeader();

      const response = await fetch(`${this.API_BASE}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          id: highlightId,
          colorId: updates.colorId,
          colorHex: updates.colorHex,
          positionData: updates.positionData,
          textStartOffset: updates.textStartOffset,
          textEndOffset: updates.textEndOffset,
          isOrphaned: updates.isOrphaned,
          orphanedReason: updates.orphanedReason
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update highlight');
      }

      const result = await response.json();
      
      // Update cache
      this.updateInCache(result.highlight);

      return result.highlight;
    } catch (error) {
      console.error('Error updating highlight:', error);
      throw error;
    }
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(highlightId: string): Promise<void> {
    try {
      const authHeader = await this.getAuthHeader();

      const response = await fetch(`${this.API_BASE}?id=${highlightId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete highlight');
      }

      // Remove from cache
      this.removeFromCache(highlightId);
    } catch (error) {
      console.error('Error deleting highlight:', error);
      throw error;
    }
  }

  /**
   * Delete multiple highlights
   */
  async deleteHighlights(highlightIds: string[]): Promise<number> {
    try {
      const authHeader = await this.getAuthHeader();

      const response = await fetch(`${this.API_BASE}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ highlightIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete highlights');
      }

      const result = await response.json();

      // Remove from cache
      highlightIds.forEach(id => this.removeFromCache(id));

      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting highlights:', error);
      throw error;
    }
  }

  /**
   * Calculate text offset in page text
   */
  calculateTextOffset(pageText: string, selectedText: string, selectionStart: number): {
    startOffset: number;
    endOffset: number;
    contextBefore: string;
    contextAfter: string;
  } | null {
    try {
      // Find the selected text in the page text
      const index = pageText.indexOf(selectedText, Math.max(0, selectionStart - 100));
      
      if (index === -1) {
        return null;
      }

      const startOffset = index;
      const endOffset = index + selectedText.length;

      // Get context (50 chars before and after)
      const contextBefore = pageText.substring(Math.max(0, startOffset - 50), startOffset);
      const contextAfter = pageText.substring(endOffset, Math.min(pageText.length, endOffset + 50));

      return {
        startOffset,
        endOffset,
        contextBefore,
        contextAfter,
      };
    } catch (error) {
      console.error('Error calculating text offset:', error);
      return null;
    }
  }

  /**
   * Mark page highlights as orphaned
   */
  async markPageHighlightsOrphaned(bookId: string, pageNumber: number, reason?: string): Promise<void> {
    try {
      // Get all highlights for this page
      const highlights = await this.getHighlights(bookId, { pageNumber, includeOrphaned: false });

      // Update each highlight
      const updatePromises = highlights.map(highlight =>
        this.updateHighlight(highlight.id, {
          isOrphaned: true,
          orphanedReason: reason || `Page text was edited on ${new Date().toLocaleDateString()}`,
        })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking highlights as orphaned:', error);
      throw error;
    }
  }

  /**
   * Attempt to re-match orphaned highlight
   */
  attemptRematch(
    pageText: string,
    highlight: Highlight
  ): { startOffset: number; endOffset: number } | null {
    if (!highlight.text_context_before || !highlight.text_context_after) {
      return null;
    }

    try {
      // Try to find the context in the new text
      const searchText = highlight.text_context_before + highlight.highlighted_text + highlight.text_context_after;
      const index = pageText.indexOf(searchText);

      if (index !== -1) {
        const startOffset = index + highlight.text_context_before.length;
        const endOffset = startOffset + highlight.highlighted_text.length;
        return { startOffset, endOffset };
      }

      // Try without full context - just the highlighted text
      const textIndex = pageText.indexOf(highlight.highlighted_text);
      if (textIndex !== -1) {
        return {
          startOffset: textIndex,
          endOffset: textIndex + highlight.highlighted_text.length,
        };
      }

      return null;
    } catch (error) {
      console.error('Error attempting rematch:', error);
      return null;
    }
  }

  // Cache management methods
  private addToCache(bookId: string, highlight: Highlight): void {
    const cached = this.cache.get(bookId) || [];
    this.cache.set(bookId, [...cached, highlight]);
  }

  private updateInCache(highlight: Highlight): void {
    for (const [bookId, highlights] of this.cache.entries()) {
      const index = highlights.findIndex(h => h.id === highlight.id);
      if (index !== -1) {
        highlights[index] = highlight;
        this.cache.set(bookId, [...highlights]);
        break;
      }
    }
  }

  private removeFromCache(highlightId: string): void {
    for (const [bookId, highlights] of this.cache.entries()) {
      const filtered = highlights.filter(h => h.id !== highlightId);
      if (filtered.length !== highlights.length) {
        this.cache.set(bookId, filtered);
        break;
      }
    }
  }

  /**
   * Clear cache for a book
   */
  clearCache(bookId?: string): void {
    if (bookId) {
      this.cache.delete(bookId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cached highlights for a book
   */
  getCachedHighlights(bookId: string): Highlight[] | null {
    return this.cache.get(bookId) || null;
  }
}

export const highlightService = new HighlightService();

