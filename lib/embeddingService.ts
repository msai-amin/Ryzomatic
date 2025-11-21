export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
}

export class EmbeddingService {
  private embeddingModel = 'models/text-embedding-004';
  private batchSize = 100; // Gemini's limit

  /**
   * Generate embeddings using Gemini text-embedding-004 via API endpoint
   * Uses server-side API to avoid exposing API keys in client
   * @param text - Text to embed
   * @returns Embedding vector (768 dimensions)
   */
  async embed(text: string): Promise<number[]> {
    try {
      // Get auth token from Supabase session
      const { supabase } = await import('./supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // Use server-side API endpoint instead of calling Gemini directly
      // This keeps API keys secure and avoids 403 errors
      const response = await fetch('/api/gemini/embedding', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        // If API endpoint fails (e.g., no API key configured), return empty array
        // This gracefully disables the feature without breaking the app
        if (response.status === 500 || response.status === 403) {
          console.warn('Embedding API unavailable, note relationship detection disabled');
          throw new Error('Embedding service unavailable');
        }
        throw new Error(`Embedding API error: ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.embedding;
      
      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned');
      }

      return embedding;
    } catch (error) {
      // Gracefully handle errors - don't spam console for expected failures
      if (error instanceof Error && error.message.includes('unavailable')) {
        // Silently fail if service is unavailable (no API key configured)
        throw error;
      }
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   * @param texts - Array of texts to embed
   * @returns Array of embeddings
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      // Process in batches
      const batches: string[][] = [];
      for (let i = 0; i < texts.length; i += this.batchSize) {
        batches.push(texts.slice(i, i + this.batchSize));
      }

      const allEmbeddings: number[][] = [];

      for (const batch of batches) {
        // Process individually (Gemini API doesn't support batch embedding yet)
        for (const text of batch) {
          const embedding = await this.embed(text);
          allEmbeddings.push(embedding);
        }
      }

      return allEmbeddings;
    } catch (error) {
      console.error('Error in batch embedding:', error);
      // Fallback to individual embedding
      const embeddings: number[][] = [];
      for (const text of texts) {
        const embedding = await this.embed(text);
        embeddings.push(embedding);
      }
      return embeddings;
    }
  }

  /**
   * Format embedding as pgvector compatible string
   * @param embedding - Embedding array
   * @returns PostgreSQL vector format string
   */
  formatForPgVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embedding in a collection
   * @param queryEmbedding - Query embedding
   * @param embeddings - Array of embeddings to search
   * @param threshold - Minimum similarity threshold
   * @returns Array of {index, similarity} sorted by similarity
   */
  findSimilar(
    queryEmbedding: number[],
    embeddings: number[][],
    threshold: number = 0.5
  ): Array<{ index: number; similarity: number }> {
    const similarities = embeddings.map((emb, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, emb)
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

    return similarities;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();

