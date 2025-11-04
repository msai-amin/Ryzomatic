import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number | null;
  resetAt: Date | null;
  limit: number | null;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

// Rate limit configuration per endpoint
export const RATE_LIMITS: Record<string, number> = {
  chat: 100,           // 100 requests/hour for chat
  memory: 200,         // 200 requests/hour for memory/AI features
  embedding: 50,       // 50 requests/hour for embedding generation
  upload: 20,          // 20 requests/hour for file uploads
};

/**
 * Check rate limit for a user and endpoint
 * @param userId - User ID to check
 * @param endpoint - Endpoint name (e.g., 'chat', 'upload', 'embedding', 'memory')
 * @param limitOverride - Optional override for the default limit
 * @returns Rate limit result with allowed status, remaining requests, and reset time
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limitOverride?: number
): Promise<RateLimitResult> {
  try {
    // Get the limit for this endpoint (or use override)
    const limit = limitOverride || RATE_LIMITS[endpoint] || 1000;
    
    // Call the database function to check rate limit
    const { data, error } = await supabase.rpc('check_rate_limit', {
      user_uuid: userId,
      endpoint_name: endpoint,
      limit_per_hour: limit,
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: null,
        resetAt: null,
        limit: limit,
      };
    }

    if (!data || data.length === 0) {
      // No data returned, allow the request
      return {
        allowed: true,
        remaining: null,
        resetAt: null,
        limit: limit,
      };
    }

    const result = data[0];
    return {
      allowed: result.allowed || false,
      remaining: result.remaining !== null ? result.remaining : null,
      resetAt: result.reset_at ? new Date(result.reset_at) : null,
      limit: limit,
    };
  } catch (error) {
    console.error('Rate limit check exception:', error);
    // On exception, allow the request (fail open)
    return {
      allowed: true,
      remaining: null,
      resetAt: null,
      limit: limitOverride || RATE_LIMITS[endpoint] || 1000,
    };
  }
}

/**
 * Generate rate limit headers for HTTP response
 * @param result - Rate limit result from checkRateLimit
 * @returns Headers object with rate limit information
 */
export function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': result.limit?.toString() || '0',
    'X-RateLimit-Remaining': result.remaining?.toString() || '0',
    'X-RateLimit-Reset': result.resetAt ? Math.floor(result.resetAt.getTime() / 1000).toString() : '0',
  };
}
