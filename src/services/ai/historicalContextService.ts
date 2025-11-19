/**
 * Historical Context Service
 * Provides historical and cultural context for texts using Wikipedia API and Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../../lib/supabase';

// Initialize Gemini
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export interface HistoricalEvent {
  id: string;
  date: string;
  year: number;
  title: string;
  description: string;
  category: 'personal' | 'political' | 'cultural' | 'intellectual' | 'publication';
  importance: number; // 1-10
  source?: string;
}

export interface Source {
  title: string;
  url: string;
  type: 'wikipedia' | 'academic' | 'primary' | 'secondary';
}

export interface HistoricalContext {
  author: string;
  period: string;
  workTitle?: string;
  publicationYear?: number;
  events: HistoricalEvent[];
  culturalContext: string;
  intellectualMovement: string;
  relatedFigures: string[];
  sources: Source[];
  summary: string;
  timelineData: TimelineData;
}

export interface TimelineData {
  events: HistoricalEvent[];
  ranges: TimeRange[];
  highlights: string[];
}

export interface TimeRange {
  start: number;
  end: number;
  label: string;
  color: string;
}

/**
 * Generate comprehensive historical context
 */
export const generateHistoricalContext = async (
  authorName: string,
  workTitle?: string,
  publicationYear?: number
): Promise<HistoricalContext> => {
  try {
    // 1. Check cache first
    const cached = await getCachedContext(authorName, workTitle);
    if (cached) {
      console.log('✅ Using cached historical context');
      return cached;
    }

    // 2. Fetch Wikipedia data
    const wikiData = await fetchWikipediaData(authorName);

    // 3. Enrich with Gemini analysis
    const enrichedContext = await enrichContextWithGemini(
      authorName,
      workTitle,
      publicationYear,
      wikiData
    );

    // 4. Generate timeline data
    const timelineData = createTimelineData(enrichedContext.events);

    const fullContext: HistoricalContext = {
      ...enrichedContext,
      timelineData
    };

    // 5. Cache the result
    await cacheContext(fullContext);

    return fullContext;
  } catch (error) {
    console.error('Error generating historical context:', error);
    throw error;
  }
};

/**
 * Fetch data from Wikipedia API
 */
async function fetchWikipediaData(query: string): Promise<any> {
  try {
    const encodedQuery = encodeURIComponent(query);
    
    // Get summary
    const summaryResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`
    );
    
    if (!summaryResponse.ok) {
      throw new Error('Wikipedia API request failed');
    }

    const summaryData = await summaryResponse.json();

    // Get full page data for more details
    const pageResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|info&exintro=1&titles=${encodedQuery}`
    );

    const pageData = await pageResponse.json();

    return {
      summary: summaryData,
      page: pageData
    };
  } catch (error) {
    console.error('Error fetching Wikipedia data:', error);
    return null;
  }
}

/**
 * Enrich context using Gemini
 */
async function enrichContextWithGemini(
  authorName: string,
  workTitle: string | undefined,
  publicationYear: number | undefined,
  wikiData: any
): Promise<Omit<HistoricalContext, 'timelineData'>> {
  if (!genAI) {
    // Return basic context without AI enrichment
    return createBasicContext(authorName, workTitle, publicationYear, wikiData);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Provide historical and cultural context for the following:

Author: ${authorName}
${workTitle ? `Work: ${workTitle}` : ''}
${publicationYear ? `Year: ${publicationYear}` : ''}

${wikiData ? `Wikipedia Summary: ${wikiData.summary?.extract || ''}` : ''}

Please provide a detailed analysis including:
1. Historical period and key events (with specific dates)
2. Cultural and intellectual movements of the time
3. Related authors, philosophers, or thinkers
4. Important historical events that influenced the work (with dates)
5. Broader cultural context

Format your response as JSON:
{
  "period": "Time period description",
  "events": [
    {
      "date": "YYYY-MM-DD",
      "year": YYYY,
      "title": "Event title",
      "description": "Event description",
      "category": "political|cultural|intellectual|personal|publication",
      "importance": 8
    }
  ],
  "culturalContext": "Detailed cultural context",
  "intellectualMovement": "Main intellectual movement",
  "relatedFigures": ["Figure 1", "Figure 2"],
  "summary": "Brief summary of historical context"
}

Respond ONLY with the JSON, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const contextData = JSON.parse(jsonMatch[0]);
      
      return {
        author: authorName,
        workTitle,
        publicationYear,
        period: contextData.period || 'Unknown period',
        events: (contextData.events || []).map((evt: any, index: number) => ({
          id: `evt_${Date.now()}_${index}`,
          date: evt.date || `${evt.year || publicationYear || 1900}-01-01`,
          year: evt.year || publicationYear || 1900,
          title: evt.title || 'Historical Event',
          description: evt.description || '',
          category: evt.category || 'cultural',
          importance: evt.importance || 5,
          source: 'gemini'
        })),
        culturalContext: contextData.culturalContext || '',
        intellectualMovement: contextData.intellectualMovement || '',
        relatedFigures: contextData.relatedFigures || [],
        sources: createSources(authorName, wikiData),
        summary: contextData.summary || ''
      };
    }

    return createBasicContext(authorName, workTitle, publicationYear, wikiData);
  } catch (error) {
    console.error('Error enriching context with Gemini:', error);
    return createBasicContext(authorName, workTitle, publicationYear, wikiData);
  }
}

/**
 * Create basic context without AI enrichment
 */
function createBasicContext(
  authorName: string,
  workTitle: string | undefined,
  publicationYear: number | undefined,
  wikiData: any
): Omit<HistoricalContext, 'timelineData'> {
  const events: HistoricalEvent[] = [];
  
  if (publicationYear) {
    events.push({
      id: `evt_pub_${Date.now()}`,
      date: `${publicationYear}-01-01`,
      year: publicationYear,
      title: workTitle ? `Publication of ${workTitle}` : 'Work Published',
      description: `${authorName} published ${workTitle || 'this work'}`,
      category: 'publication',
      importance: 10,
      source: 'user'
    });
  }

  return {
    author: authorName,
    workTitle,
    publicationYear,
    period: publicationYear ? `${Math.floor(publicationYear / 100) * 100}s` : 'Unknown',
    events,
    culturalContext: wikiData?.summary?.extract || 'Context not available',
    intellectualMovement: 'To be determined',
    relatedFigures: [],
    sources: createSources(authorName, wikiData),
    summary: `Historical context for ${authorName}${workTitle ? ` - ${workTitle}` : ''}`
  };
}

/**
 * Create sources list
 */
function createSources(authorName: string, wikiData: any): Source[] {
  const sources: Source[] = [];

  if (wikiData?.summary?.content_urls?.desktop?.page) {
    sources.push({
      title: `Wikipedia: ${authorName}`,
      url: wikiData.summary.content_urls.desktop.page,
      type: 'wikipedia'
    });
  }

  return sources;
}

/**
 * Create timeline data structure
 */
function createTimelineData(events: HistoricalEvent[]): TimelineData {
  if (events.length === 0) {
    return {
      events: [],
      ranges: [],
      highlights: []
    };
  }

  // Sort events by year
  const sortedEvents = [...events].sort((a, b) => a.year - b.year);

  // Create time ranges
  const minYear = sortedEvents[0].year;
  const maxYear = sortedEvents[sortedEvents.length - 1].year;
  const span = maxYear - minYear;

  const ranges: TimeRange[] = [];
  
  // Create decade ranges
  const startDecade = Math.floor(minYear / 10) * 10;
  const endDecade = Math.ceil(maxYear / 10) * 10;
  
  for (let decade = startDecade; decade < endDecade; decade += 10) {
    ranges.push({
      start: decade,
      end: decade + 10,
      label: `${decade}s`,
      color: getColorForDecade(decade)
    });
  }

  // Create highlights from most important events
  const highlights = sortedEvents
    .filter(evt => evt.importance >= 8)
    .slice(0, 5)
    .map(evt => evt.title);

  return {
    events: sortedEvents,
    ranges,
    highlights
  };
}

/**
 * Get color for decade (for visualization)
 */
function getColorForDecade(decade: number): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#06b6d4', '#6366f1', '#f97316'
  ];
  return colors[(Math.floor(decade / 10)) % colors.length];
}

/**
 * Cache context in Supabase
 */
async function cacheContext(context: HistoricalContext): Promise<void> {
  try {
    const { error } = await supabase
      .from('historical_contexts')
      .upsert({
        author: context.author,
        work_title: context.workTitle,
        period: context.period,
        publication_year: context.publicationYear,
        events: JSON.stringify(context.events),
        cultural_context: context.culturalContext,
        intellectual_movement: context.intellectualMovement,
        related_figures: context.relatedFigures,
        sources: JSON.stringify(context.sources),
        summary: context.summary,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'author,work_title'
      });

    if (error) {
      console.error('Error caching context:', error);
    }
  } catch (error) {
    console.error('Error in cacheContext:', error);
  }
}

/**
 * Get cached context from Supabase
 */
async function getCachedContext(
  authorName: string,
  workTitle?: string
): Promise<HistoricalContext | null> {
  try {
    let query = supabase
      .from('historical_contexts')
      .select('*')
      .eq('author', authorName);

    if (workTitle) {
      query = query.eq('work_title', workTitle);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    const events = typeof data.events === 'string' 
      ? JSON.parse(data.events) 
      : data.events || [];
    
    const sources = typeof data.sources === 'string'
      ? JSON.parse(data.sources)
      : data.sources || [];

    const context: Omit<HistoricalContext, 'timelineData'> = {
      author: data.author,
      workTitle: data.work_title,
      period: data.period,
      publicationYear: data.publication_year,
      events,
      culturalContext: data.cultural_context || '',
      intellectualMovement: data.intellectual_movement || '',
      relatedFigures: data.related_figures || [],
      sources,
      summary: data.summary || ''
    };

    return {
      ...context,
      timelineData: createTimelineData(events)
    };
  } catch (error) {
    console.error('Error getting cached context:', error);
    return null;
  }
}

/**
 * Search for related historical figures
 */
export const searchRelatedFigures = async (
  authorName: string,
  period: string
): Promise<string[]> => {
  // This could be enhanced with a proper search API
  // For now, return placeholder
  return [];
};

