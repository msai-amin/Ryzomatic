import { sendMessageToAI } from './aiService';
import { userBooks, documentRelationships } from '../../lib/supabase';
import { supabaseStorageService } from './supabaseStorageService';

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

      // Get both documents from database
      const [sourceDocDb, relatedDocDb] = await Promise.all([
        userBooks.get(sourceDocId),
        userBooks.get(relatedDocId)
      ]);

      if (!sourceDocDb.data || !relatedDocDb.data) {
        throw new Error('One or both documents not found');
      }

      // Get full documents with pageTexts from storage service
      const [sourceDoc, relatedDoc] = await Promise.all([
        supabaseStorageService.getBook(sourceDocId),
        supabaseStorageService.getBook(relatedDocId)
      ]);

      if (!sourceDoc || !relatedDoc) {
        throw new Error('Failed to load documents with content');
      }

      console.log('DocumentRelevanceService: Loaded documents with content:', {
        sourceId: sourceDoc.id,
        sourceHasPageTexts: sourceDoc.pageTexts?.length || 0,
        relatedId: relatedDoc.id,
        relatedHasPageTexts: relatedDoc.pageTexts?.length || 0
      });

      // Analyze both documents (pass full document objects, not .data)
      const [sourceAnalysis, relatedAnalysis] = await Promise.all([
        this.analyzeDocument(sourceDoc),
        this.analyzeDocument(relatedDoc)
      ]);

      // Calculate similarity
      const similarity = this.calculateSimilarity(sourceAnalysis, relatedAnalysis);
      
      // Extract content for relationship description
      const sourceContent = this.extractDocumentContent(sourceDoc);
      const relatedContent = this.extractDocumentContent(relatedDoc);
      
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
   * Note: pageTexts are NOT in the database, they need to be extracted from the PDF
   */
  private extractDocumentContent(document: any): string {
    try {
      // Try to get pageTexts from document (if already loaded in memory)
      if (document.pageTexts && Array.isArray(document.pageTexts) && document.pageTexts.length > 0) {
        // Use the first few pages of text
        return document.pageTexts.slice(0, 3).join(' ');
      }
      
      // Fallback: try page_texts (database field name)
      if (document.page_texts && Array.isArray(document.page_texts) && document.page_texts.length > 0) {
        return document.page_texts.slice(0, 3).join(' ');
      }
      
      // For text files, use the content directly
      if (document.file_type === 'text' && document.text_content) {
        return document.text_content;
      }
      
      console.warn('DocumentRelevanceService: No extractable content found for document:', {
        id: document.id,
        file_type: document.file_type,
        hasPageTexts: !!document.pageTexts,
        hasPageTextsDb: !!document.page_texts,
        hasTextContent: !!document.text_content
      });
      
      return '';
    } catch (error) {
      console.error('DocumentRelevanceService: Error extracting content:', error);
      return '';
    }
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
      const prompt = `You are a specialized AI assistant with expert/PhD-level proficiency in state-of-the-art scientific and academic literature analysis. Your task is to perform a deep, multi-faceted comparison of two provided documents (Document A and Document B) and generate a concise analysis explaining their relationship.

Document A (Source)
- Summary: ${source.summary}
- Topics: ${source.topics.join(', ') || 'N/A'}
- Keywords: ${source.keywords.slice(0, 10).join(', ') || 'N/A'}
- Content sample (1500 chars):
${sourceContent.substring(0, 1500) || '[No additional content available]'}

Document B (Related)
- Summary: ${related.summary}
- Topics: ${related.topics.join(', ') || 'N/A'}
- Keywords: ${related.keywords.slice(0, 10).join(', ') || 'N/A'}
- Content sample (1500 chars):
${relatedContent.substring(0, 1500) || '[No additional content available]'}

Heuristic similarity estimate (0-100): ${similarity}

Follow these steps explicitly:
1. Semantic Core Analysis – compare hypotheses, claims, conclusions.
2. Structural & Modality Analysis – compare organisation, discourse flow, multimodal elements (figures, tables, equations, etc.) even if deductions must be inferred from text clues.
3. Scholarly Context Analysis – compare cited works, overlapping references, and scholarly positioning (use any cues present; otherwise infer cautiously).
4. Relationship Synthesis – classify the relationship using exactly ONE category from:
   Identical, Revision / Version, Extension / Follow-up, Refutation / Counter-Argument, Methodological Application, Shared Topic, Related (Tangential), Unrelated.

OUTPUT REQUIREMENTS:
Return a single valid JSON object with this schema (no markdown, no commentary):
{
  "relationship_score_percent": <float 0.0-100.0>,
  "relationship_type": "<one category from the list above>",
  "key_semantic_overlap": ["item1", "item2", "item3"],
  "key_structural_differences": ["item1", "item2", "item3"],
  "explanation": "<one concise paragraph summarising steps 1-4 and justifying the score and category>"
}

Important rules:
- Provide strictly valid JSON (double-quoted keys/strings, no trailing commas).
- Do not add commentary before or after the JSON.
- If evidence is missing for a step, infer cautiously and note the limitation in the explanation.`;

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
        // Provide structured fallback based on heuristic similarity
        const relationshipType = (() => {
          if (similarity >= 90) return 'Identical';
          if (similarity >= 80) return 'Revision / Version';
          if (similarity >= 60) return 'Shared Topic';
          if (similarity >= 40) return 'Related (Tangential)';
          return 'Unrelated';
        })();

        const commonTopics = this.findCommonTopics(source.topics, related.topics);
        const commonKeywords = this.findCommonKeywords(source.keywords, related.keywords);
        const semanticOverlap = (commonTopics.length ? commonTopics : commonKeywords).slice(0, 5);
        const overlapSummary = semanticOverlap.length ? semanticOverlap.join(', ') : 'no significant overlap detected';

        const structuralDifferences: string[] = [
          'Detailed structural comparison unavailable from heuristic data; review section headings manually.',
          'Multimodal artifacts (figures/tables/equations) were not parsed; cross-check originals.',
          'Bibliographic overlap could not be inferred; inspect reference lists for confirmation.'
        ];

        const explanation = `Heuristic content analysis estimates a ${similarity}% relationship score, suggesting the documents are classified as "${relationshipType}". Shared surface-level topics (${overlapSummary}) imply some thematic overlap, but a manual review of structure, multimodal evidence, and citation networks is recommended to confirm this assessment.`;

        const fallbackAnalysis = {
          relationship_score_percent: similarity,
          relationship_type: relationshipType,
          key_semantic_overlap: semanticOverlap.length ? semanticOverlap : ['No significant overlap detected'],
          key_structural_differences: structuralDifferences,
          explanation,
          rawAnalysis: {
            sourceKeywords: source.keywords,
            relatedKeywords: related.keywords,
            commonKeywords,
            sourceTopics: source.topics,
            relatedTopics: related.topics,
            commonTopics
          }
        };
        return JSON.stringify(fallbackAnalysis);
      }
      
      // Try to parse JSON from response
      try {
        let jsonText = trimmedResponse;
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonText);
        
        // Enrich with raw analysis data
        const enrichedAnalysis = {
          ...parsed,
          rawAnalysis: {
            sourceKeywords: source.keywords,
            relatedKeywords: related.keywords,
            commonKeywords: this.findCommonKeywords(source.keywords, related.keywords),
            sourceTopics: source.topics,
            relatedTopics: related.topics,
            commonTopics: this.findCommonTopics(source.topics, related.topics)
          }
        };
        
        return JSON.stringify(enrichedAnalysis);
      } catch (parseError) {
        console.error('DocumentRelevanceService: Failed to parse AI response as JSON:', parseError);
        // Return plain text as fallback
        return trimmedResponse;
      }
    } catch (error) {
      console.error('DocumentRelevanceService: Error generating AI description:', error);
      const relationshipType = similarity >= 50 ? 'Shared Topic' : similarity >= 30 ? 'Related (Tangential)' : 'Unrelated';
      const commonTopics = this.findCommonTopics(source.topics, related.topics);
      const commonKeywords = this.findCommonKeywords(source.keywords, related.keywords);
      const semanticOverlap = (commonTopics.length ? commonTopics : commonKeywords).slice(0, 5);
      const fallback = {
        relationship_score_percent: similarity,
        relationship_type: relationshipType,
        key_semantic_overlap: semanticOverlap.length ? semanticOverlap : ['No significant overlap detected'],
        key_structural_differences: [
          'Automated comparison unavailable; verify structural differences manually.',
          'Multimodal evidence (tables/figures/equations) not evaluated due to parsing limits.'
        ],
        explanation: `Automated analysis encountered an error; heuristic similarity is ${similarity}%, suggesting the documents are "${relationshipType}". Manual review of content, structure, and citations is recommended.`,
        rawAnalysis: {
          sourceKeywords: source.keywords,
          relatedKeywords: related.keywords,
          commonKeywords,
          sourceTopics: source.topics,
          relatedTopics: related.topics,
          commonTopics
        }
      };
      return JSON.stringify(fallback);
    }
  }

  /**
   * Find common topics between two document analyses
   */
  private findCommonTopics(topics1: string[], topics2: string[]): string[] {
    const lowerTopics1 = topics1.map(t => t.toLowerCase());
    const lowerTopics2 = topics2.map(t => t.toLowerCase());
    
    return topics1.filter(topic => 
      lowerTopics2.includes(topic.toLowerCase())
    );
  }

  /**
   * Find common keywords between two document analyses
   */
  private findCommonKeywords(keywords1: string[], keywords2: string[]): string[] {
    const lowerKeywords1 = keywords1.map(k => k.toLowerCase());
    const lowerKeywords2 = keywords2.map(k => k.toLowerCase());
    
    return keywords1.filter(keyword => 
      lowerKeywords2.includes(keyword.toLowerCase())
    );
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
