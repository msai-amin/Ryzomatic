/**
 * Framework Mapper Service
 * Identifies and maps theoretical frameworks in academic texts
 * Uses Gemini for extraction, Supabase for storage, and Pinecone for similarity search
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../../lib/supabase';

// Initialize Gemini
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export interface TheoreticalFramework {
  id: string;
  name: string;
  author: string;
  year?: number;
  description: string;
  keyTerms: string[];
  relatedFrameworks: string[];
  applications: string[];
  confidence: number;
  sources?: string[];
}

export interface FrameworkRelationship {
  source: string; // framework id
  target: string; // framework id
  type: 'influences' | 'critiques' | 'extends' | 'applies' | 'related';
  strength: number; // 0-1
  description?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  value: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  value: number;
  title?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface FrameworkMapping {
  frameworks: TheoreticalFramework[];
  relationships: FrameworkRelationship[];
  suggestions: string[];
  visualizationData: GraphData;
  metadata: {
    processingTime: number;
    totalFrameworks: number;
    totalRelationships: number;
  };
}

/**
 * Analyze text and extract theoretical frameworks
 */
export const analyzeFrameworks = async (
  documentText: string,
  documentId?: string
): Promise<FrameworkMapping> => {
  const startTime = Date.now();

  try {
    // 1. Extract frameworks using Gemini
    const frameworks = await extractFrameworksWithGemini(documentText);

    // 2. Store in Supabase (if documentId provided)
    if (documentId && frameworks.length > 0) {
      await storeFrameworksInSupabase(documentId, frameworks);
    }

    // 3. Find relationships between frameworks
    const relationships = await identifyFrameworkRelationships(frameworks);

    // 4. Get suggestions for related frameworks
    const suggestions = await generateFrameworkSuggestions(frameworks);

    // 5. Create visualization data
    const visualizationData = createVisualizationData(frameworks, relationships);

    const processingTime = Date.now() - startTime;

    return {
      frameworks,
      relationships,
      suggestions,
      visualizationData,
      metadata: {
        processingTime,
        totalFrameworks: frameworks.length,
        totalRelationships: relationships.length
      }
    };
  } catch (error) {
    console.error('Error analyzing frameworks:', error);
    throw error;
  }
};

/**
 * Extract frameworks using Gemini
 */
async function extractFrameworksWithGemini(text: string): Promise<TheoreticalFramework[]> {
  if (!genAI) {
    console.warn('Gemini not configured, returning empty frameworks');
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze the following academic text and identify all theoretical frameworks, methodologies, and conceptual approaches mentioned or implied.

For each framework, provide:
1. Name of the framework
2. Author/originator (if mentioned)
3. Brief description (2-3 sentences)
4. Key terms and concepts (3-5 terms)
5. How it's applied in this text
6. Related frameworks (if any)

Format your response as a JSON array with this structure:
[
  {
    "name": "Framework Name",
    "author": "Author Name",
    "year": 1990,
    "description": "Description here",
    "keyTerms": ["term1", "term2", "term3"],
    "applications": ["application1", "application2"],
    "relatedFrameworks": ["related1", "related2"],
    "confidence": 0.9
  }
]

Text to analyze:
${text.substring(0, 8000)}

Respond ONLY with the JSON array, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const frameworksData = JSON.parse(jsonMatch[0]);
      return frameworksData.map((fw: any, index: number) => ({
        id: `fw_${Date.now()}_${index}`,
        name: fw.name || 'Unknown Framework',
        author: fw.author || 'Unknown',
        year: fw.year,
        description: fw.description || '',
        keyTerms: fw.keyTerms || [],
        relatedFrameworks: fw.relatedFrameworks || [],
        applications: fw.applications || [],
        confidence: fw.confidence || 0.7,
        sources: []
      }));
    }

    return [];
  } catch (error) {
    console.error('Error extracting frameworks with Gemini:', error);
    return [];
  }
}

/**
 * Store frameworks in Supabase
 */
async function storeFrameworksInSupabase(
  documentId: string,
  frameworks: TheoreticalFramework[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('theoretical_frameworks')
      .upsert(
        frameworks.map(fw => ({
          id: fw.id,
          document_id: documentId,
          name: fw.name,
          author: fw.author,
          year: fw.year,
          description: fw.description,
          key_terms: fw.keyTerms,
          related_frameworks: fw.relatedFrameworks,
          applications: fw.applications,
          confidence: fw.confidence
        })),
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Error storing frameworks in Supabase:', error);
    }
  } catch (error) {
    console.error('Error in storeFrameworksInSupabase:', error);
  }
}

/**
 * Identify relationships between frameworks
 */
async function identifyFrameworkRelationships(
  frameworks: TheoreticalFramework[]
): Promise<FrameworkRelationship[]> {
  const relationships: FrameworkRelationship[] = [];

  // Identify relationships based on mentions and connections
  for (let i = 0; i < frameworks.length; i++) {
    const source = frameworks[i];
    
    for (let j = 0; j < frameworks.length; j++) {
      if (i === j) continue;
      
      const target = frameworks[j];
      
      // Check if frameworks are related
      if (source.relatedFrameworks.includes(target.name)) {
        relationships.push({
          source: source.id,
          target: target.id,
          type: 'related',
          strength: 0.8,
          description: `${source.name} is related to ${target.name}`
        });
      }
      
      // Check for shared key terms
      const sharedTerms = source.keyTerms.filter(term => 
        target.keyTerms.includes(term)
      );
      
      if (sharedTerms.length > 0) {
        relationships.push({
          source: source.id,
          target: target.id,
          type: 'related',
          strength: Math.min(sharedTerms.length / 5, 1),
          description: `Shares concepts: ${sharedTerms.join(', ')}`
        });
      }
    }
  }

  return relationships;
}

/**
 * Generate suggestions for related frameworks
 */
async function generateFrameworkSuggestions(
  frameworks: TheoreticalFramework[]
): Promise<string[]> {
  const suggestions: string[] = [];

  // Add suggestions based on identified frameworks
  if (frameworks.length > 0) {
    suggestions.push(
      'Consider exploring interdisciplinary connections',
      'Look for historical development of these frameworks',
      'Examine critiques and alternative approaches'
    );
  }

  // Add specific suggestions based on framework types
  frameworks.forEach(fw => {
    if (fw.keyTerms.some(term => term.toLowerCase().includes('feminist'))) {
      suggestions.push('Explore intersectional feminist frameworks');
    }
    if (fw.keyTerms.some(term => term.toLowerCase().includes('post'))) {
      suggestions.push('Consider postmodern and poststructural critiques');
    }
  });

  return [...new Set(suggestions)]; // Remove duplicates
}

/**
 * Create visualization data for D3.js or vis.js
 */
function createVisualizationData(
  frameworks: TheoreticalFramework[],
  relationships: FrameworkRelationship[]
): GraphData {
  const nodes: GraphNode[] = frameworks.map(fw => ({
    id: fw.id,
    label: fw.name,
    group: fw.author,
    value: fw.confidence * 10
  }));

  const edges: GraphEdge[] = relationships.map(rel => ({
    from: rel.source,
    to: rel.target,
    value: rel.strength * 5,
    title: rel.description
  }));

  return { nodes, edges };
}

/**
 * Get cached frameworks from Supabase
 */
export const getCachedFrameworks = async (documentId: string): Promise<TheoreticalFramework[]> => {
  try {
    const { data, error } = await supabase
      .from('theoretical_frameworks')
      .select('*')
      .eq('document_id', documentId);

    if (error) {
      console.error('Error fetching cached frameworks:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      author: row.author,
      year: row.year,
      description: row.description,
      keyTerms: row.key_terms || [],
      relatedFrameworks: row.related_frameworks || [],
      applications: row.applications || [],
      confidence: row.confidence || 0.7
    }));
  } catch (error) {
    console.error('Error in getCachedFrameworks:', error);
    return [];
  }
};

