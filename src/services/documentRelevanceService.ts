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
      const analysisPrompt = `You are an expert academic document analyzer. Your task is to extract structured information from research documents, papers, books, and notes.

DOCUMENT CONTENT (first 3000 characters):
${content.substring(0, 3000)}

ANALYSIS REQUIREMENTS:
1. Summary: Write 2-3 concise sentences capturing the main argument, methodology, or purpose
2. Keywords: Extract 5-10 specific technical terms, concepts, or key phrases (not generic words)
3. Topics: Identify 3-5 specific subject areas or disciplines (e.g., "machine learning", "causal inference", "neuroscience")
4. Themes: Identify 2-3 overarching themes or research questions (e.g., "interpretability vs performance tradeoff", "real-world applications")

IMPORTANT:
- Focus on academic/technical content
- Be specific, not generic
- Use terminology from the document
- Output ONLY valid JSON, no additional text

OUTPUT FORMAT (strict JSON):
{
  "summary": "Concise 2-3 sentence summary here",
  "keywords": ["specific_term_1", "specific_term_2", "specific_term_3", ...],
  "topics": ["specific_topic_1", "specific_topic_2", ...],
  "mainThemes": ["overarching_theme_1", "overarching_theme_2", ...]
}`;

      const response = await sendMessageToAI(analysisPrompt, content.substring(0, 3000));
      
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
      const prompt = `You are an expert at identifying relationships between academic documents. Analyze how two documents relate to each other based on the provided summaries and content excerpts.

SOURCE DOCUMENT:
- Summary: ${source.summary}
- Topics: ${source.topics.join(', ')}
- Themes: ${source.mainThemes.join(', ')}
- Keywords: ${source.keywords.slice(0, 5).join(', ')}
- Content excerpt: ${sourceContent.substring(0, 500)}

RELATED DOCUMENT:
- Summary: ${related.summary}
- Topics: ${related.topics.join(', ')}
- Themes: ${related.mainThemes.join(', ')}
- Keywords: ${related.keywords.slice(0, 5).join(', ')}
- Content excerpt: ${relatedContent.substring(0, 500)}

COMPUTED SIMILARITY: ${similarity}%

TASK: Generate a precise 1-2 sentence description explaining their relationship based on the provided information.

RELATIONSHIP TYPES TO CONSIDER:
- Complementary: Documents cover different aspects of the same topic
- Sequential: One builds upon or extends the other
- Comparative: Documents present alternative approaches or perspectives
- Applied: One applies concepts from the other to specific cases
- Foundational: One provides background/prerequisites for the other
- Contradictory: Documents present conflicting views or findings

REQUIREMENTS:
- Be specific: mention actual topics, concepts, or themes they share
- Indicate the type of relationship
- Explain why a reader might want to read both
- Keep it concise (1-2 sentences maximum)
- Do NOT say "Please upload documents" or similar fallback messages

EXAMPLE OUTPUT:
"Both documents explore causal reasoning in AI systems, with the source focusing on theoretical frameworks while the related document presents practical applications in robotics. Reading both provides a complete picture from theory to implementation."

YOUR DESCRIPTION:`;

      console.log('DocumentRelevanceService: Generating AI description with prompt length:', prompt.length);
      const response = await sendMessageToAI(prompt);
      const trimmedResponse = response.trim();
      
      console.log('DocumentRelevanceService: AI description generated:', trimmedResponse.substring(0, 100));
      
      // Filter out the fallback message
      if (trimmedResponse.includes('Please upload') || trimmedResponse.includes('would like me to analyze')) {
        console.warn('DocumentRelevanceService: AI returned fallback message, using default description');
        return `Documents share ${similarity}% similarity based on content analysis. Both documents cover related topics and themes.`;
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
