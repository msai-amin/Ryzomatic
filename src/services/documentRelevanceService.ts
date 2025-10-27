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
   * Calculate relevance with retry logic and timeout handling
   */
  async calculateRelevanceWithRetry(
    sourceDocId: string, 
    relatedDocId: string, 
    relationshipId: string,
    maxRetries: number = 3
  ): Promise<DocumentSimilarityResult | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`DocumentRelevanceService: Attempt ${attempt}/${maxRetries} for relationship ${relationshipId}`);
        
        // Set a timeout for the entire calculation process
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Calculation timeout after 2 minutes')), 120000); // 2 minutes
        });

        const calculationPromise = this.calculateRelevance(sourceDocId, relatedDocId);
        
        const result = await Promise.race([calculationPromise, timeoutPromise]);
        
        console.log(`DocumentRelevanceService: Success on attempt ${attempt} for relationship ${relationshipId}`);
        return result;
        
      } catch (error) {
        console.warn(`DocumentRelevanceService: Attempt ${attempt}/${maxRetries} failed for relationship ${relationshipId}:`, error);
        
        if (attempt === maxRetries) {
          console.error(`DocumentRelevanceService: All ${maxRetries} attempts failed for relationship ${relationshipId}`);
          return null;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.log(`DocumentRelevanceService: Waiting ${delay}ms before retry for relationship ${relationshipId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  }

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
      
      // Extract content for relationship description
      const sourceContent = this.extractDocumentContent(sourceDoc.data);
      const relatedContent = this.extractDocumentContent(relatedDoc.data);
      
      // Generate AI description with content
      const aiDescription = await this.generateRelationshipDescription(
        sourceAnalysis,
        relatedAnalysis,
        similarity,
        sourceContent,
        relatedContent
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
      const analysisPrompt = `You are an expert academic document analyzer. The FULL document content is provided below - analyze it directly.

=== DOCUMENT CONTENT (5000 characters) ===
${content.substring(0, 5000)}
=== END DOCUMENT CONTENT ===

Based on the content above, extract:

1. SUMMARY: 2-3 sentences capturing the main argument/purpose
2. KEYWORDS: 5-10 specific technical terms from the document
3. TOPICS: 3-5 subject areas (e.g., "machine learning", "causal inference")
4. THEMES: 2-3 overarching themes/questions

Return ONLY this JSON (no other text):
{
  "summary": "...",
  "keywords": ["...", "..."],
  "topics": ["...", "..."],
  "mainThemes": ["...", "..."]
}`;

      const response = await sendMessageToAI(analysisPrompt, content.substring(0, 5000));
      
      console.log('DocumentRelevanceService: AI response received:', response.substring(0, 200));
      
      try {
        // Try to extract JSON from the response (in case AI adds extra text)
        let jsonText = response.trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        const analysis = JSON.parse(jsonText);
        
        console.log('DocumentRelevanceService: Successfully parsed AI analysis:', {
          hasSummary: !!analysis.summary,
          keywordsCount: analysis.keywords?.length || 0,
          topicsCount: analysis.topics?.length || 0
        });
        
        return {
          summary: analysis.summary || 'Unable to generate summary',
          keywords: analysis.keywords || [],
          topics: analysis.topics || [],
          mainThemes: analysis.mainThemes || []
        };
      } catch (parseError) {
        console.error('DocumentRelevanceService: Failed to parse AI response:', parseError);
        console.error('DocumentRelevanceService: Response was:', response);
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
    similarity: number,
    sourceContent: string = '',
    relatedContent: string = ''
  ): Promise<string> {
    try {
      const prompt = `You are an expert at analyzing relationships between academic documents. Both documents' content is provided below - analyze them directly.

=== SOURCE DOCUMENT ===
Summary: ${source.summary}
Topics: ${source.topics.join(', ')}
Keywords: ${source.keywords.slice(0, 5).join(', ')}

Content (1500 chars):
${sourceContent.substring(0, 1500)}
=== END SOURCE ===

=== RELATED DOCUMENT ===
Summary: ${related.summary}
Topics: ${related.topics.join(', ')}
Keywords: ${related.keywords.slice(0, 5).join(', ')}

Content (1500 chars):
${relatedContent.substring(0, 1500)}
=== END RELATED ===

Computed Similarity: ${similarity}%

TASK: Write 1-2 sentences explaining how these documents relate. Consider:

- Complementary (different aspects of same topic)
- Sequential (one builds on the other)
- Comparative (alternative approaches)
- Applied (theory vs practice)
- Foundational (prerequisites)
- Contradictory (conflicting views)

Be specific - mention actual topics/concepts they share. If similarity is low (<30%), note they cover different areas but may still provide useful context.

YOUR DESCRIPTION (1-2 sentences only):`;

      console.log('DocumentRelevanceService: Sending prompt (preview):', prompt.substring(0, 500));
      const response = await sendMessageToAI(prompt);
      console.log('DocumentRelevanceService: Full AI response:', response);
      
      const trimmedResponse = response.trim();

      // Enhanced fallback detection
      const fallbackIndicators = [
        'Please upload',
        'would like me to analyze',
        'I need access',
        'provide the documents',
        'cannot analyze without',
        'need the content'
      ];

      const hasFallback = fallbackIndicators.some(indicator => 
        trimmedResponse.toLowerCase().includes(indicator.toLowerCase())
      );

      if (hasFallback) {
        console.warn('DocumentRelevanceService: AI returned fallback message');
        // Provide better default based on similarity
        if (similarity >= 70) {
          return `These documents are highly related (${similarity}% similarity), covering similar topics in ${source.topics[0] || 'this field'}. Reading both provides comprehensive coverage.`;
        } else if (similarity >= 40) {
          return `These documents share moderate overlap (${similarity}% similarity) in topics like ${source.topics[0] || 'the subject area'}. They complement each other's perspectives.`;
        } else {
          return `These documents cover different but potentially complementary areas (${similarity}% similarity). They may provide useful context for each other.`;
        }
      }
      
      return trimmedResponse;
    } catch (error) {
      console.error('DocumentRelevanceService: Error generating AI description:', error);
      return `Documents share ${similarity}% similarity based on content analysis. Both documents cover related topics and themes.`;
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

          // Calculate relevance with timeout and retry logic
          console.log(`DocumentRelevanceService: Starting calculation for relationship ${relationship.id}`);
          const result = await this.calculateRelevanceWithRetry(
            relationship.source_document_id,
            relationship.related_document_id,
            relationship.id
          );

          if (result) {
            console.log(`DocumentRelevanceService: Got result for relationship ${relationship.id}:`, {
              relevancePercentage: result.relevancePercentage,
              hasDescription: !!result.aiDescription,
              descriptionPreview: result.aiDescription?.substring(0, 100)
            });
            
            // Update with results
            await documentRelationships.markAsCompleted(
              relationship.id,
              result.relevancePercentage,
              result.aiDescription
            );

            console.log(`DocumentRelevanceService: Completed calculation for relationship ${relationship.id}: ${result.relevancePercentage}%`);
          } else {
            // Mark as failed after retries
            console.warn(`DocumentRelevanceService: No result returned for relationship ${relationship.id}, marking as failed`);
            await documentRelationships.markAsFailed(relationship.id);
            console.log(`DocumentRelevanceService: Failed calculation for relationship ${relationship.id} after retries`);
          }

        } catch (error) {
          console.error(`DocumentRelevanceService: Error processing relationship ${relationship.id}:`, error);
          console.error('DocumentRelevanceService: Error stack:', error instanceof Error ? error.stack : 'No stack');
          
          // Mark as failed
          await documentRelationships.markAsFailed(relationship.id).catch(err => {
            console.error('DocumentRelevanceService: Failed to mark as failed:', err);
          });
        } finally {
          this.processingQueue.delete(relationship.id);
        }

        // Add delay to avoid overwhelming the AI service
        await new Promise(resolve => setTimeout(resolve, 2000));
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
      // Get the relationship by ID directly
      const { data: relationship, error: getError } = await documentRelationships.get(relationshipId);
      if (getError || !relationship) {
        throw new Error('Relationship not found');
      }

      // Mark as processing
      await documentRelationships.markAsProcessing(relationshipId);

      // Calculate relevance
      const result = await this.calculateRelevance(relationship.source_document_id, relationship.related_document_id);

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
