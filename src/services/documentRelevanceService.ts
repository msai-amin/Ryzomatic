import { sendMessageToAI } from './aiService';
import { userBooks, documentRelationships } from '../../lib/supabase';

export interface DocumentSimilarityResult {
  relevancePercentage: number;
  aiDescription?: string;
  keywords: string[];
  topics: string[];
}

export interface DocumentAnalysis {
  summary: string;
  keywords: string[];
  topics: string[];
  mainThemes: string[];
}

class DocumentRelevanceService {
  private processingQueue: Set<string> = new Set();
  private isProcessing = false;

  /**
   * Calculate relevance between two documents using AI analysis
   */
  async calculateRelevance(sourceDocId: string, relatedDocId: string): Promise<DocumentSimilarityResult> {
    try {
      console.log(`DocumentRelevanceService: Calculating relevance between ${sourceDocId} and ${relatedDocId}`);

      // Get both documents
      const [sourceDoc, relatedDoc] = await Promise.all([
        userBooks.get(sourceDocId),
        userBooks.get(relatedDocId)
      ]);

      if (!sourceDoc.data || !relatedDoc.data) {
        throw new Error('One or both documents not found');
      }

      // Analyze both documents
      const [sourceAnalysis, relatedAnalysis] = await Promise.all([
        this.analyzeDocument(sourceDoc.data),
        this.analyzeDocument(relatedDoc.data)
      ]);

      // Calculate similarity
      const similarity = this.calculateSimilarity(sourceAnalysis, relatedAnalysis);
      
      // Generate AI description
      const aiDescription = await this.generateRelationshipDescription(
        sourceAnalysis,
        relatedAnalysis,
        similarity
      );

      return {
        relevancePercentage: similarity,
        aiDescription,
        keywords: [...new Set([...sourceAnalysis.keywords, ...relatedAnalysis.keywords])],
        topics: [...new Set([...sourceAnalysis.topics, ...relatedAnalysis.topics])]
      };
    } catch (error) {
      console.error('DocumentRelevanceService: Error calculating relevance:', error);
      throw error;
    }
  }

  /**
   * Analyze a single document to extract key information
   */
  private async analyzeDocument(document: any): Promise<DocumentAnalysis> {
    try {
      const content = this.extractDocumentContent(document);
      
      if (!content || content.length < 50) {
        return {
          summary: 'Document content too short for analysis',
          keywords: [],
          topics: [],
          mainThemes: []
        };
      }

      // Use AI service to analyze the document
      const analysisPrompt = `
        Analyze the following document and provide:
        1. A brief summary (2-3 sentences)
        2. Key keywords (5-10 most important terms)
        3. Main topics/subjects (3-5 topics)
        4. Main themes (2-3 overarching themes)

        Document content:
        ${content.substring(0, 3000)} // Limit content to avoid token limits

        Respond in JSON format:
        {
          "summary": "Brief summary here",
          "keywords": ["keyword1", "keyword2", ...],
          "topics": ["topic1", "topic2", ...],
          "mainThemes": ["theme1", "theme2", ...]
        }
      `;

      const response = await sendMessageToAI(analysisPrompt, content.substring(0, 3000));
      
      try {
        const analysis = JSON.parse(response);
        return {
          summary: analysis.summary || 'Unable to generate summary',
          keywords: analysis.keywords || [],
          topics: analysis.topics || [],
          mainThemes: analysis.mainThemes || []
        };
      } catch (parseError) {
        console.warn('DocumentRelevanceService: Failed to parse AI response, using fallback');
        return {
          summary: 'Document analysis completed',
          keywords: this.extractKeywordsFallback(content),
          topics: ['General'],
          mainThemes: ['Academic Content']
        };
      }
    } catch (error) {
      console.error('DocumentRelevanceService: Error analyzing document:', error);
      return {
        summary: 'Analysis failed',
        keywords: [],
        topics: [],
        mainThemes: []
      };
    }
  }

  /**
   * Extract content from document based on type
   */
  private extractDocumentContent(document: any): string {
    if (document.file_type === 'pdf' && document.page_texts) {
      // For PDFs, use the first few pages of text
      return document.page_texts.slice(0, 3).join(' ');
    } else if (document.file_type === 'text' && document.text_content) {
      // For text files, use the content directly
      return document.text_content;
    }
    return '';
  }

  /**
   * Calculate similarity between two document analyses
   */
  private calculateSimilarity(source: DocumentAnalysis, related: DocumentAnalysis): number {
    let similarityScore = 0;
    let totalChecks = 0;

    // Keyword overlap (40% weight)
    const keywordOverlap = this.calculateOverlap(source.keywords, related.keywords);
    similarityScore += keywordOverlap * 0.4;
    totalChecks += 0.4;

    // Topic overlap (30% weight)
    const topicOverlap = this.calculateOverlap(source.topics, related.topics);
    similarityScore += topicOverlap * 0.3;
    totalChecks += 0.3;

    // Theme overlap (20% weight)
    const themeOverlap = this.calculateOverlap(source.mainThemes, related.mainThemes);
    similarityScore += themeOverlap * 0.2;
    totalChecks += 0.2;

    // Summary similarity (10% weight)
    const summarySimilarity = this.calculateTextSimilarity(source.summary, related.summary);
    similarityScore += summarySimilarity * 0.1;
    totalChecks += 0.1;

    // Normalize to percentage
    const normalizedScore = totalChecks > 0 ? (similarityScore / totalChecks) * 100 : 50;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(normalizedScore)));
  }

  /**
   * Calculate overlap between two arrays of strings
   */
  private calculateOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) return 0.5; // Neutral score for empty arrays
    if (arr1.length === 0 || arr2.length === 0) return 0;

    const set1 = new Set(arr1.map(item => item.toLowerCase()));
    const set2 = new Set(arr2.map(item => item.toLowerCase()));
    
    const intersection = new Set([...set1].filter(item => set2.has(item)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate text similarity using simple word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    return this.calculateOverlap(words1, words2);
  }

  /**
   * Generate AI description of the relationship between documents
   */
  private async generateRelationshipDescription(
    source: DocumentAnalysis,
    related: DocumentAnalysis,
    similarity: number
  ): Promise<string> {
    try {
      const prompt = `
        Based on the analysis of two documents, generate a brief description (1-2 sentences) explaining how they are related.

        Source Document:
        - Summary: ${source.summary}
        - Topics: ${source.topics.join(', ')}
        - Themes: ${source.mainThemes.join(', ')}

        Related Document:
        - Summary: ${related.summary}
        - Topics: ${related.topics.join(', ')}
        - Themes: ${related.mainThemes.join(', ')}

        Similarity Score: ${similarity}%

        Generate a concise description of their relationship:
      `;

      const response = await sendMessageToAI(prompt);
      return response.trim();
    } catch (error) {
      console.error('DocumentRelevanceService: Error generating AI description:', error);
      return `Documents share ${similarity}% similarity based on content analysis.`;
    }
  }

  /**
   * Fallback keyword extraction when AI analysis fails
   */
  private extractKeywordsFallback(content: string): string[] {
    // Simple keyword extraction - remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);

    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));

    // Count word frequency and return top words
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Process the relevance calculation queue
   */
  async processRelevanceQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('DocumentRelevanceService: Already processing queue');
      return;
    }

    this.isProcessing = true;

    try {
      // Get pending calculations
      const { data: pendingRelationships, error } = await documentRelationships.getPendingCalculations();
      
      if (error) {
        console.error('DocumentRelevanceService: Error fetching pending calculations:', error);
        return;
      }

      if (!pendingRelationships || pendingRelationships.length === 0) {
        console.log('DocumentRelevanceService: No pending calculations');
        return;
      }

      console.log(`DocumentRelevanceService: Processing ${pendingRelationships.length} pending relationships`);

      // Process each relationship
      for (const relationship of pendingRelationships) {
        if (this.processingQueue.has(relationship.id)) {
          continue; // Skip if already being processed
        }

        this.processingQueue.add(relationship.id);

        try {
          // Mark as processing
          await documentRelationships.markAsProcessing(relationship.id);

          // Calculate relevance
          const result = await this.calculateRelevance(
            relationship.source_document_id,
            relationship.related_document_id
          );

          // Update with results
          await documentRelationships.markAsCompleted(
            relationship.id,
            result.relevancePercentage,
            result.aiDescription
          );

          console.log(`DocumentRelevanceService: Completed calculation for relationship ${relationship.id}: ${result.relevancePercentage}%`);

        } catch (error) {
          console.error(`DocumentRelevanceService: Error processing relationship ${relationship.id}:`, error);
          
          // Mark as failed
          await documentRelationships.markAsFailed(relationship.id);
        } finally {
          this.processingQueue.delete(relationship.id);
        }

        // Add small delay to avoid overwhelming the AI service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error('DocumentRelevanceService: Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start background processing (call this periodically)
   */
  startBackgroundProcessing(intervalMs: number = 30000): void {
    console.log(`DocumentRelevanceService: Starting background processing every ${intervalMs}ms`);
    
    setInterval(async () => {
      try {
        await this.processRelevanceQueue();
      } catch (error) {
        console.error('DocumentRelevanceService: Background processing error:', error);
      }
    }, intervalMs);
  }

  /**
   * Calculate relevance for a specific relationship and update database
   */
  async calculateAndUpdateRelevance(relationshipId: string): Promise<DocumentSimilarityResult | null> {
    try {
      // Get the relationship
      const { data: relationship, error: getError } = await documentRelationships.list('');
      if (getError || !relationship) {
        throw new Error('Relationship not found');
      }

      const rel = relationship.find(r => r.id === relationshipId);
      if (!rel) {
        throw new Error('Relationship not found');
      }

      // Mark as processing
      await documentRelationships.markAsProcessing(relationshipId);

      // Calculate relevance
      const result = await this.calculateRelevance(rel.source_document_id, rel.related_document_id);

      // Update database
      await documentRelationships.markAsCompleted(
        relationshipId,
        result.relevancePercentage,
        result.aiDescription
      );

      return result;
    } catch (error) {
      console.error('DocumentRelevanceService: Error calculating and updating relevance:', error);
      
      // Mark as failed
      await documentRelationships.markAsFailed(relationshipId);
      return null;
    }
  }
}

export const documentRelevanceService = new DocumentRelevanceService();
