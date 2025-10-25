// Client-side OCR utilities (safe to import in browser)

// OCR tier limits configuration
export const OCR_LIMITS = {
  free: { monthlyOCR: 5, creditsPerOCR: 1, maxPages: 20 },
  pro: { monthlyOCR: 100, creditsPerOCR: 1, maxPages: 50 },
  premium: { monthlyOCR: 500, creditsPerOCR: 1, maxPages: 100 },
  enterprise: { monthlyOCR: Infinity, creditsPerOCR: 0, maxPages: Infinity },
};

/**
 * Calculate OCR credit cost based on page count (client-safe)
 */
export function calculateOCRCredits(pageCount: number, tier: string = 'free'): number {
  if (tier === 'enterprise') return 0;
  
  // Credit calculation based on page ranges
  if (pageCount <= 20) return 1;
  if (pageCount <= 50) return 2;
  if (pageCount <= 100) return 3;
  return Math.ceil(pageCount / 50); // 1 credit per 50 pages
}

/**
 * Check if user can perform OCR based on tier limits (client-safe)
 */
export function canPerformOCR(
  currentCount: number, 
  tier: string = 'free',
  pageCount: number
): { allowed: boolean; reason?: string } {
  const limits = OCR_LIMITS[tier as keyof typeof OCR_LIMITS] || OCR_LIMITS.free;
  
  // Check monthly limit
  if (currentCount >= limits.monthlyOCR) {
    return { 
      allowed: false, 
      reason: `Monthly OCR limit reached (${limits.monthlyOCR}). Upgrade or wait until next month.` 
    };
  }
  
  // Check page limit
  if (pageCount > limits.maxPages) {
    return { 
      allowed: false, 
      reason: `Document exceeds page limit (${limits.maxPages} pages for ${tier} tier).` 
    };
  }
  
  return { allowed: true };
}

/**
 * Estimate OCR cost for a document (client-safe)
 */
export function estimateOCRCost(pageCount: number, tier: string = 'free'): {
  credits: number;
  estimatedTokens: number;
  estimatedCostUSD: number;
} {
  const credits = calculateOCRCredits(pageCount, tier);
  const estimatedTokens = pageCount * 2000; // ~2000 tokens per page
  
  // GPT-5 Nano pricing: $0.05/1M input, $0.40/1M output
  const inputCost = (estimatedTokens / 1_000_000) * 0.05;
  const outputCost = (estimatedTokens / 1_000_000) * 0.40;
  const estimatedCostUSD = inputCost + outputCost;

  return {
    credits,
    estimatedTokens,
    estimatedCostUSD,
  };
}

