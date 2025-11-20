/**
 * Vision Usage Service
 * 
 * Track and monitor Gemini Vision API usage, costs, and rate limits
 */

import { supabase } from '../../lib/supabase';
import { logger } from './logger';

export interface VisionUsageStats {
  pagesUsedThisMonth: number
  monthlyLimit: number
  remainingPages: number
  creditsUsed: number
  estimatedCost: number
  lastResetDate: Date
  nextResetDate: Date
}

export interface VisionUsageRecord {
  id: string
  userId: string
  documentId: string
  pageNumbers: number[]
  creditsUsed: number
  tokensUsed: number
  estimatedCost: number
  createdAt: Date
}

/**
 * Get current vision usage statistics for user
 */
export async function getVisionUsageStats(userId: string): Promise<VisionUsageStats | null> {
  const context = {
    component: 'VisionUsageService',
    action: 'getVisionUsageStats',
    userId
  }

  try {
    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tier, vision_pages_monthly, vision_last_reset')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      logger.error('Failed to get user profile', context, error)
      return null
    }

    const tier = profile.tier || 'free'
    const pagesUsedThisMonth = profile.vision_pages_monthly || 0
    const lastResetDate = new Date(profile.vision_last_reset)

    // Determine monthly limit based on tier
    const limits: Record<string, number> = {
      free: 100, // 100 pages/month for free tier
      custom: -1 // unlimited for custom tier
    }
    const monthlyLimit = limits[tier] || 100

    // Calculate next reset date (1 month from last reset)
    const nextResetDate = new Date(lastResetDate)
    nextResetDate.setMonth(nextResetDate.getMonth() + 1)

    // Calculate remaining pages
    const remainingPages = monthlyLimit === -1 
      ? -1 // unlimited
      : Math.max(0, monthlyLimit - pagesUsedThisMonth)

    // Get total credits used for vision this month
    const { data: usageRecords } = await supabase
      .from('usage_records')
      .select('credits_used, metadata')
      .eq('user_id', userId)
      .eq('feature', 'vision_extraction')
      .gte('created_at', lastResetDate.toISOString())

    const creditsUsed = usageRecords?.reduce(
      (sum, record) => sum + (record.credits_used || 0),
      0
    ) || 0

    const estimatedCost = usageRecords?.reduce(
      (sum, record) => sum + (record.metadata?.estimatedCost || 0),
      0
    ) || 0

    return {
      pagesUsedThisMonth,
      monthlyLimit,
      remainingPages,
      creditsUsed,
      estimatedCost,
      lastResetDate,
      nextResetDate
    }

  } catch (error) {
    logger.error('Failed to get vision usage stats', context, error as Error)
    return null
  }
}

/**
 * Get vision usage history for user
 */
export async function getVisionUsageHistory(
  userId: string,
  limit: number = 50
): Promise<VisionUsageRecord[]> {
  const context = {
    component: 'VisionUsageService',
    action: 'getVisionUsageHistory',
    userId
  }

  try {
    const { data: records, error } = await supabase
      .from('usage_records')
      .select('id, user_id, feature, credits_used, metadata, created_at')
      .eq('user_id', userId)
      .eq('feature', 'vision_extraction')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Failed to get usage history', context, error)
      return []
    }

    return records?.map(record => ({
      id: record.id,
      userId: record.user_id,
      documentId: record.metadata?.documentId || '',
      pageNumbers: record.metadata?.pageNumbers || [],
      creditsUsed: record.credits_used || 0,
      tokensUsed: record.metadata?.tokensUsed || 0,
      estimatedCost: record.metadata?.estimatedCost || 0,
      createdAt: new Date(record.created_at)
    })) || []

  } catch (error) {
    logger.error('Failed to get usage history', context, error as Error)
    return []
  }
}

/**
 * Check if user can perform vision extraction
 */
export async function canPerformVisionExtraction(
  userId: string,
  pageCount: number
): Promise<{ allowed: boolean; reason?: string; stats?: VisionUsageStats }> {
  const context = {
    component: 'VisionUsageService',
    action: 'canPerformVisionExtraction',
    userId,
    pageCount
  }

  try {
    const stats = await getVisionUsageStats(userId)
    
    if (!stats) {
      return {
        allowed: false,
        reason: 'Unable to retrieve usage statistics'
      }
    }

    // Check if user has reached monthly limit
    if (stats.monthlyLimit !== -1) {
      if (stats.pagesUsedThisMonth + pageCount > stats.monthlyLimit) {
        return {
          allowed: false,
          reason: `Monthly limit exceeded. You have ${stats.remainingPages} pages remaining this month.`,
          stats
        }
      }
    }

    // Get user credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits')
      .eq('id', userId)
      .single()

    if (!profile) {
      return {
        allowed: false,
        reason: 'User profile not found'
      }
    }

    // Check credits (custom tier doesn't need credits)
    if (profile.tier !== 'custom') {
      const creditsNeeded = pageCount * 0.1
      if (profile.credits < creditsNeeded) {
        return {
          allowed: false,
          reason: `Insufficient credits. Need ${creditsNeeded}, have ${profile.credits}.`,
          stats
        }
      }
    }

    return {
      allowed: true,
      stats
    }

  } catch (error) {
    logger.error('Failed to check vision extraction eligibility', context, error as Error)
    return {
      allowed: false,
      reason: 'Error checking eligibility'
    }
  }
}

/**
 * Log vision extraction usage
 */
export async function logVisionUsage(
  userId: string,
  documentId: string,
  pageNumbers: number[],
  tokensUsed: number,
  creditsUsed: number,
  estimatedCost: number
): Promise<boolean> {
  const context = {
    component: 'VisionUsageService',
    action: 'logVisionUsage',
    userId,
    documentId
  }

  try {
    const { error } = await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        feature: 'vision_extraction',
        credits_used: creditsUsed,
        metadata: {
          documentId,
          pageNumbers,
          tokensUsed,
          estimatedCost,
          timestamp: new Date().toISOString()
        }
      })

    if (error) {
      logger.error('Failed to log vision usage', context, error)
      return false
    }

    return true

  } catch (error) {
    logger.error('Failed to log vision usage', context, error as Error)
    return false
  }
}

/**
 * Get aggregated vision usage statistics (admin/analytics)
 */
export async function getAggregatedVisionStats(startDate?: Date, endDate?: Date) {
  const context = {
    component: 'VisionUsageService',
    action: 'getAggregatedVisionStats'
  }

  try {
    let query = supabase
      .from('usage_records')
      .select('user_id, credits_used, metadata, created_at')
      .eq('feature', 'vision_extraction')

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    const { data: records, error } = await query

    if (error) {
      logger.error('Failed to get aggregated stats', context, error)
      return null
    }

    // Calculate aggregates
    const totalRequests = records?.length || 0
    const totalPages = records?.reduce(
      (sum, r) => sum + (r.metadata?.pageNumbers?.length || 0),
      0
    ) || 0
    const totalTokens = records?.reduce(
      (sum, r) => sum + (r.metadata?.tokensUsed || 0),
      0
    ) || 0
    const totalCost = records?.reduce(
      (sum, r) => sum + (r.metadata?.estimatedCost || 0),
      0
    ) || 0
    const totalCredits = records?.reduce(
      (sum, r) => sum + (r.credits_used || 0),
      0
    ) || 0

    const uniqueUsers = new Set(records?.map(r => r.user_id)).size

    return {
      totalRequests,
      totalPages,
      totalTokens,
      totalCost,
      totalCredits,
      uniqueUsers,
      avgPagesPerRequest: totalRequests > 0 ? totalPages / totalRequests : 0,
      avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0
    }

  } catch (error) {
    logger.error('Failed to get aggregated stats', context, error as Error)
    return null
  }
}

/**
 * Check if monthly reset is needed and perform it
 */
export async function checkAndResetMonthlyCounters(): Promise<number> {
  const context = {
    component: 'VisionUsageService',
    action: 'checkAndResetMonthlyCounters'
  }

  try {
    // Call the database function to reset counters
    const { error } = await supabase.rpc('reset_monthly_vision_counters')

    if (error) {
      logger.error('Failed to reset monthly counters', context, error)
      return 0
    }

    // Get count of profiles that were reset
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('vision_pages_monthly', 0)
      .gte('vision_last_reset', new Date(Date.now() - 1000).toISOString())

    logger.info('Monthly vision counters reset', context, {
      profilesReset: count || 0
    })

    return count || 0

  } catch (error) {
    logger.error('Failed to reset monthly counters', context, error as Error)
    return 0
  }
}

