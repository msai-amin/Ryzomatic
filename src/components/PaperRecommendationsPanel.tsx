import React, { useState, useEffect } from 'react';
import { 
  Book, 
  ExternalLink, 
  Loader, 
  Sparkles, 
  Calendar, 
  Quote, 
  CheckCircle, 
  XCircle,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { logger } from '../services/logger';
import { authService } from '../services/supabaseAuthService';

interface PaperRecommendation {
  id: string;
  openalex_id: string;
  title: string;
  authors: Array<{ display_name: string; id?: string; orcid?: string }>;
  abstract?: string;
  publication_year?: number;
  cited_by_count: number;
  open_access_url?: string;
  doi?: string;
  venue?: string;
  topics?: Array<{ display_name: string; id: string; score: number }>;
  recommendation_type: string;
  recommendation_score: number;
  recommendation_reason?: string;
  user_feedback?: 'relevant' | 'not_relevant' | 'saved';
  saved_to_library?: boolean;
}

interface PaperRecommendationsPanelProps {
  sourceDocumentId?: string;
  openAlexId?: string;
  onPaperSelect?: (paper: PaperRecommendation) => void;
}

export const PaperRecommendationsPanel: React.FC<PaperRecommendationsPanelProps> = ({
  sourceDocumentId,
  openAlexId,
  onPaperSelect,
}) => {
  const { currentDocument, user } = useAppStore();
  const [recommendations, setRecommendations] = useState<PaperRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendationType, setRecommendationType] = useState<'related_works' | 'cited_by'>('related_works');
  const [filters, setFilters] = useState({
    minYear: undefined as number | undefined,
    minCitations: undefined as number | undefined,
    openAccessOnly: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [updatingFeedback, setUpdatingFeedback] = useState<Set<string>>(new Set());

  const docId = sourceDocumentId || currentDocument?.id;
  const docOpenAlexId = openAlexId;

  // Load cached recommendations from localStorage on mount or when document/type changes
  useEffect(() => {
    if (docId) {
      const cacheKey = `paper_recommendations_${docId}_${recommendationType}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Check if cache is still valid (24 hours)
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          if (cacheAge < maxAge && parsed.recommendations) {
            setRecommendations(parsed.recommendations);
            setError(null);
            logger.info('Loaded cached paper recommendations', { docId, count: parsed.recommendations.length });
          } else {
            // Cache expired, remove it
            localStorage.removeItem(cacheKey);
            setRecommendations([]);
          }
        } else {
          // No cache found, clear recommendations
          setRecommendations([]);
        }
      } catch (err) {
        logger.error('Error loading cached recommendations', { docId }, err as Error);
        setRecommendations([]);
      }
    } else {
      // No document, clear recommendations
      setRecommendations([]);
    }
  }, [docId, recommendationType]);

  // Note: Recommendations are no longer automatically loaded on document change
  // Users must click the "Get Recommendations" button to trigger loading

  const loadRecommendations = async () => {
    if (!docId && !docOpenAlexId) return;

    setLoading(true);
    setError(null);

    try {
      const session = await authService.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const email = user?.email; // For polite pool

      const response = await fetch('/api/recommendations?action=get-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sourceDocumentId: docId,
          openAlexId: docOpenAlexId,
          type: recommendationType,
          limit: 20,
          email,
        }),
      });

      // Check if response has content before parsing
      const responseText = await response.text();
      
      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || 'Failed to load recommendations');
        } catch (parseError) {
          throw new Error(responseText || `Failed to load recommendations (${response.status})`);
        }
      }

      // Parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Failed to parse JSON response', { docId, responseText: responseText.substring(0, 200) }, parseError as Error);
        throw new Error('Invalid response from server');
      }
      let recs = data.recommendations || [];

      // Apply filters
      if (filters.minYear) {
        recs = recs.filter((r: PaperRecommendation) => (r.publication_year || 0) >= filters.minYear!);
      }
      if (filters.minCitations) {
        recs = recs.filter((r: PaperRecommendation) => r.cited_by_count >= filters.minCitations!);
      }
      if (filters.openAccessOnly) {
        recs = recs.filter((r: PaperRecommendation) => !!r.open_access_url);
      }

      setRecommendations(recs);
      
      // Cache recommendations in localStorage
      if (docId && recs.length > 0) {
        const cacheKey = `paper_recommendations_${docId}_${recommendationType}`;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            recommendations: recs,
            timestamp: Date.now(),
            recommendationType,
          }));
        } catch (err) {
          logger.warn('Failed to cache recommendations', { docId }, err as Error);
        }
      }
      
      // Show info message if using content-based search
      if (data.recommendationMethod === 'content_based' && recs.length > 0) {
        logger.info('Using content-based recommendations', { docId, count: recs.length });
      }
    } catch (err: any) {
      logger.error('Error loading paper recommendations', { docId }, err);
      
      // Provide helpful error messages
      let errorMessage = err.message || 'Failed to load recommendations';
      if (err.message?.includes('404') || err.message?.includes('Not Found')) {
        errorMessage = 'API endpoint not found. Make sure you are running with "vercel dev" for local development, or the endpoint is deployed in production.';
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection and ensure the API server is running.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (paperId: string, feedback: 'relevant' | 'not_relevant' | 'saved') => {
    setUpdatingFeedback(prev => new Set(prev).add(paperId));

    try {
      const session = await authService.getSession();
      if (!session) return;

      const response = await fetch('/api/recommendations?action=update-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recommendationId: paperId,
          feedback,
          savedToLibrary: feedback === 'saved',
        }),
      });

      if (response.ok) {
        // Update local state
        setRecommendations(prev => {
          const updated = prev.map(r =>
            r.id === paperId
              ? { ...r, user_feedback: feedback, saved_to_library: feedback === 'saved' }
              : r
          );
          
          // Update cache with new feedback
          if (docId) {
            const cacheKey = `paper_recommendations_${docId}_${recommendationType}`;
            try {
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                localStorage.setItem(cacheKey, JSON.stringify({
                  ...parsed,
                  recommendations: updated,
                }));
              }
            } catch (err) {
              logger.warn('Failed to update cached recommendations', { docId }, err as Error);
            }
          }
          
          return updated;
        });
      }
    } catch (err) {
      logger.error('Error updating feedback', { paperId }, err as Error);
    } finally {
      setUpdatingFeedback(prev => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    }
  };

  const formatAuthors = (authors: PaperRecommendation['authors']): string => {
    if (!authors || authors.length === 0) return 'Unknown Author';
    if (authors.length === 1) return authors[0].display_name;
    if (authors.length <= 3) return authors.map(a => a.display_name).join(', ');
    return `${authors.slice(0, 2).map(a => a.display_name).join(', ')}, et al.`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 50) return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  };

  if (!docId && !docOpenAlexId) {
    return (
      <div className="text-center py-6">
        <Book className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Open a document to see paper recommendations
        </p>
      </div>
    );
  }

  // Show initial state if no recommendations have been loaded yet
  const hasLoadedRecommendations = recommendations.length > 0 || error !== null || loading;

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Paper Recommendations
          </h3>
        </div>
        {hasLoadedRecommendations && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Filter recommendations"
            >
              <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            <button
              onClick={loadRecommendations}
              disabled={loading}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh recommendations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          </div>
        )}
      </div>

      {/* Initial state - prompt user to get recommendations */}
      {!hasLoadedRecommendations && (
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Get AI-powered paper recommendations based on this document
          </p>
          <button
            onClick={loadRecommendations}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center mx-auto"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Get Recommendations
              </>
            )}
          </button>
        </div>
      )}

      {/* Recommendation type selector - only show after recommendations are loaded */}
      {hasLoadedRecommendations && (
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setRecommendationType('related_works');
              // Clear current recommendations when switching type
              setRecommendations([]);
              loadRecommendations();
            }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              recommendationType === 'related_works'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Related Works
          </button>
          <button
            onClick={() => {
              setRecommendationType('cited_by');
              // Clear current recommendations when switching type
              setRecommendations([]);
              loadRecommendations();
            }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              recommendationType === 'cited_by'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cited By
          </button>
        </div>
      )}

      {/* Filters - only show after recommendations are loaded */}
      {hasLoadedRecommendations && showFilters && (
        <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label htmlFor="paper-recommendations-min-year" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Min Year:
              </label>
              <input
                id="paper-recommendations-min-year"
                name="minYear"
                type="number"
                value={filters.minYear || ''}
                onChange={(e) => setFilters({ ...filters, minYear: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g. 2020"
                className="px-2 py-1 text-xs border rounded w-20"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="paper-recommendations-min-citations" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Min Citations:
              </label>
              <input
                id="paper-recommendations-min-citations"
                name="minCitations"
                type="number"
                value={filters.minCitations || ''}
                onChange={(e) => setFilters({ ...filters, minCitations: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g. 10"
                className="px-2 py-1 text-xs border rounded w-20"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
            <label htmlFor="paper-recommendations-open-access" className="flex items-center space-x-2">
              <input
                id="paper-recommendations-open-access"
                name="openAccessOnly"
                type="checkbox"
                checked={filters.openAccessOnly}
                onChange={(e) => setFilters({ ...filters, openAccessOnly: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Open Access Only
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Loading recommendations...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Recommendations list */}
      {hasLoadedRecommendations && !loading && !error && recommendations.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            No recommendations found. Try a different recommendation type.
          </p>
          <button
            onClick={loadRecommendations}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((paper) => (
            <div
              key={paper.id}
              className="p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer"
              style={{
                borderColor: paper.user_feedback === 'relevant' ? 'var(--color-success)' : 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
              onClick={() => onPaperSelect?.(paper)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-semibold leading-tight flex-1" style={{ color: 'var(--color-text-primary)' }}>
                  {paper.title}
                </h4>
                {paper.open_access_url && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full shrink-0">
                    OA
                  </span>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center space-x-4 text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {paper.publication_year && (
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {paper.publication_year}
                  </div>
                )}
                <div className="flex items-center">
                  <Quote className="w-3 h-3 mr-1" />
                  {paper.cited_by_count} Citations
                </div>
                {paper.venue && (
                  <div className="flex items-center truncate max-w-[150px]">
                    <Book className="w-3 h-3 mr-1" />
                    {paper.venue}
                  </div>
                )}
                <div className="flex items-center">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getScoreColor(paper.recommendation_score) }}
                  />
                  <span className="ml-1">{Math.round(paper.recommendation_score)}%</span>
                </div>
              </div>

              {/* Authors */}
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {formatAuthors(paper.authors)}
              </p>

              {/* Abstract preview */}
              {paper.abstract && (
                <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  {paper.abstract}
                </p>
              )}

              {/* Recommendation reason */}
              {paper.recommendation_reason && (
                <p className="text-xs mb-3 italic" style={{ color: 'var(--color-text-tertiary)' }}>
                  {paper.recommendation_reason}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                {paper.open_access_url && (
                  <a
                    href={paper.open_access_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Read
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback(paper.id, paper.user_feedback === 'relevant' ? 'not_relevant' : 'relevant');
                  }}
                  disabled={updatingFeedback.has(paper.id)}
                  className={`flex items-center px-2 py-1 text-xs rounded transition-colors ${
                    paper.user_feedback === 'relevant'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {paper.user_feedback === 'relevant' ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  {paper.user_feedback === 'relevant' ? 'Relevant' : 'Mark Relevant'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
