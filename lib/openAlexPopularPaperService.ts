import { createClient } from '@supabase/supabase-js';

// Lazy-load Supabase client to prevent errors when imported on client side
const getSupabaseClient = () => {
  if (typeof window !== 'undefined') {
    return null; // Client-side, don't create server-side client
  }
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl.trim() === '' || supabaseKey.trim() === '') {
    return null;
  }
  
  try {
    return createClient(supabaseUrl.trim(), supabaseKey.trim());
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
};

const supabase = getSupabaseClient();

const OPENALEX_BASE_URL = 'https://api.openalex.org';

export interface OpenAlexPaper {
  id: string;
  title: string;
  authorships?: Array<{
    author: {
      display_name: string;
      id: string;
      orcid?: string;
    };
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  cited_by_count: number;
  recent_cited_by_count?: number; // Citations in last 2 years
  open_access?: {
    is_oa: boolean;
    oa_url?: string;
  };
  doi?: string;
  primary_location?: {
    source?: {
      display_name: string;
    };
  };
  topics?: Array<{
    display_name: string;
    id: string;
    score: number;
  }>;
  related_works?: string[];
}

export interface PopularPaperResult {
  papers: OpenAlexPaper[];
  totalFetched: number;
  cursor?: string;
  hasMore: boolean;
}

export class OpenAlexPopularPaperService {
  private readonly MAX_PER_PAGE = 200; // OpenAlex max per page
  private readonly RATE_LIMIT_DELAY = 100; // ms between requests

  /**
   * Fetch most cited papers globally from OpenAlex
   * @param limit - Maximum number of papers to fetch
   * @param minCitations - Minimum citation count threshold
   * @param email - Email for polite pool (optional, but recommended)
   */
  async fetchMostCitedPapers(
    limit: number = 10000,
    minCitations: number = 100,
    email?: string
  ): Promise<OpenAlexPaper[]> {
    const allPapers: OpenAlexPaper[] = [];
    let cursor: string | undefined = '*';
    let page = 1;
    const maxPages = Math.ceil(limit / this.MAX_PER_PAGE);

    console.log(`Fetching most cited papers (min ${minCitations} citations, target: ${limit})...`);

    while (page <= maxPages && allPapers.length < limit) {
      try {
        let url = `${OPENALEX_BASE_URL}/works?` +
          `filter=cited_by_count:>${minCitations}` +
          `&sort=cited_by_count:desc` +
          `&per-page=${Math.min(this.MAX_PER_PAGE, limit - allPapers.length)}` +
          `&cursor=${cursor}`;

        if (email) {
          url += `&mailto=${encodeURIComponent(email)}`;
        }

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`OpenAlex API error (page ${page}): ${response.status} - ${errorText.substring(0, 200)}`);
          break;
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          break;
        }

        allPapers.push(...this.normalizePapers(results));
        cursor = data.meta?.next_cursor;

        console.log(`Fetched ${allPapers.length}/${limit} papers (page ${page})`);

        if (!cursor || results.length < this.MAX_PER_PAGE) {
          break;
        }

        // Rate limiting
        if (page < maxPages) {
          await this.delay(this.RATE_LIMIT_DELAY);
        }

        page++;
      } catch (error) {
        console.error(`Error fetching most cited papers (page ${page}):`, error);
        break;
      }
    }

    return allPapers.slice(0, limit);
  }

  /**
   * Fetch trending papers (recent papers with high citations)
   * @param limit - Maximum number of papers to fetch
   * @param years - Number of recent years to consider
   * @param minCitations - Minimum citation count threshold
   * @param email - Email for polite pool
   */
  async fetchTrendingPapers(
    limit: number = 5000,
    years: number = 5,
    minCitations: number = 50,
    email?: string
  ): Promise<OpenAlexPaper[]> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;

    const allPapers: OpenAlexPaper[] = [];
    let cursor: string | undefined = '*';
    let page = 1;
    const maxPages = Math.ceil(limit / this.MAX_PER_PAGE);

    console.log(`Fetching trending papers (${startYear}-${currentYear}, min ${minCitations} citations, target: ${limit})...`);

    while (page <= maxPages && allPapers.length < limit) {
      try {
        let url = `${OPENALEX_BASE_URL}/works?` +
          `filter=publication_year:${startYear}-${currentYear},cited_by_count:>${minCitations}` +
          `&sort=cited_by_count:desc` +
          `&per-page=${Math.min(this.MAX_PER_PAGE, limit - allPapers.length)}` +
          `&cursor=${cursor}`;

        if (email) {
          url += `&mailto=${encodeURIComponent(email)}`;
        }

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`OpenAlex API error (page ${page}): ${response.status} - ${errorText.substring(0, 200)}`);
          break;
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          break;
        }

        // Calculate recent citations (citations in last 2 years)
        const papersWithRecentCitations = await Promise.all(
          results.map(async (paper: any) => {
            const recentCitations = await this.getRecentCitations(paper.id, email);
            return {
              ...paper,
              recent_cited_by_count: recentCitations,
            };
          })
        );

        allPapers.push(...this.normalizePapers(papersWithRecentCitations));
        cursor = data.meta?.next_cursor;

        console.log(`Fetched ${allPapers.length}/${limit} trending papers (page ${page})`);

        if (!cursor || results.length < this.MAX_PER_PAGE) {
          break;
        }

        // Rate limiting
        if (page < maxPages) {
          await this.delay(this.RATE_LIMIT_DELAY);
        }

        page++;
      } catch (error) {
        console.error(`Error fetching trending papers (page ${page}):`, error);
        break;
      }
    }

    return allPapers.slice(0, limit);
  }

  /**
   * Fetch popular papers by topic
   * @param topicId - OpenAlex topic ID
   * @param limit - Maximum number of papers to fetch
   * @param minCitations - Minimum citation count
   * @param email - Email for polite pool
   */
  async fetchPapersByTopic(
    topicId: string,
    limit: number = 2000,
    minCitations: number = 100,
    email?: string
  ): Promise<OpenAlexPaper[]> {
    const allPapers: OpenAlexPaper[] = [];
    let cursor: string | undefined = '*';
    let page = 1;
    const maxPages = Math.ceil(limit / this.MAX_PER_PAGE);

    console.log(`Fetching papers for topic ${topicId} (min ${minCitations} citations, target: ${limit})...`);

    while (page <= maxPages && allPapers.length < limit) {
      try {
        let url = `${OPENALEX_BASE_URL}/works?` +
          `filter=topics.id:${topicId},cited_by_count:>${minCitations}` +
          `&sort=cited_by_count:desc` +
          `&per-page=${Math.min(this.MAX_PER_PAGE, limit - allPapers.length)}` +
          `&cursor=${cursor}`;

        if (email) {
          url += `&mailto=${encodeURIComponent(email)}`;
        }

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`OpenAlex API error (page ${page}): ${response.status} - ${errorText.substring(0, 200)}`);
          break;
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          break;
        }

        allPapers.push(...this.normalizePapers(results));
        cursor = data.meta?.next_cursor;

        console.log(`Fetched ${allPapers.length}/${limit} papers for topic (page ${page})`);

        if (!cursor || results.length < this.MAX_PER_PAGE) {
          break;
        }

        // Rate limiting
        if (page < maxPages) {
          await this.delay(this.RATE_LIMIT_DELAY);
        }

        page++;
      } catch (error) {
        console.error(`Error fetching papers by topic (page ${page}):`, error);
        break;
      }
    }

    return allPapers.slice(0, limit);
  }

  /**
   * Get recent citations for a paper (citations in last 2 years)
   * This is a helper to calculate trending score
   */
  private async getRecentCitations(workId: string, email?: string): Promise<number> {
    try {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const year = twoYearsAgo.getFullYear();

      let url = `${OPENALEX_BASE_URL}/works/${workId}/cited_by?` +
        `filter=publication_year:>${year}` +
        `&per-page=1`;

      if (email) {
        url += `&mailto=${encodeURIComponent(email)}`;
      }

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.meta?.count || 0;
    } catch (error) {
      console.warn(`Error getting recent citations for ${workId}:`, error);
      return 0;
    }
  }

  /**
   * Normalize OpenAlex paper data to our format
   */
  private normalizePapers(papers: any[]): OpenAlexPaper[] {
    return papers.map((paper) => ({
      id: paper.id,
      title: paper.title || 'Untitled',
      authorships: paper.authorships || [],
      abstract_inverted_index: paper.abstract_inverted_index,
      publication_year: paper.publication_year,
      cited_by_count: paper.cited_by_count || 0,
      recent_cited_by_count: paper.recent_cited_by_count,
      open_access: paper.open_access,
      doi: paper.doi,
      primary_location: paper.primary_location,
      topics: paper.topics || [],
      related_works: paper.related_works || [],
    }));
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch a single paper by OpenAlex ID
   */
  async fetchPaperById(openalexId: string, email?: string): Promise<OpenAlexPaper | null> {
    try {
      // Normalize ID (handle both full URL and ID)
      let workId = openalexId;
      if (openalexId.startsWith('https://')) {
        workId = openalexId.split('/').pop() || openalexId;
      }

      let url = `${OPENALEX_BASE_URL}/works/${workId}`;
      if (email) {
        url += `?mailto=${encodeURIComponent(email)}`;
      }

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const normalized = this.normalizePapers([data]);
      return normalized[0] || null;
    } catch (error) {
      console.error(`Error fetching paper ${openalexId}:`, error);
      return null;
    }
  }

  /**
   * Reconstruct abstract from inverted index
   */
  reconstructAbstract(invertedIndex?: Record<string, number[]>): string | null {
    if (!invertedIndex) return null;

    const words: string[] = [];
    Object.keys(invertedIndex).forEach((word) => {
      invertedIndex[word].forEach((position) => {
        words[position] = word;
      });
    });

    return words.filter((w) => w).join(' ');
  }
}

export const openAlexPopularPaperService = new OpenAlexPopularPaperService();

