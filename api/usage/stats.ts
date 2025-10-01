import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tier limits
const TIER_LIMITS = {
  free: {
    aiQueries: 100,
    documents: 10,
    creditsPerMonth: 100,
  },
  pro: {
    aiQueries: 1000,
    documents: 100,
    creditsPerMonth: 1000,
  },
  premium: {
    aiQueries: 5000,
    documents: 1000,
    creditsPerMonth: 5000,
  },
  enterprise: {
    aiQueries: Infinity,
    documents: Infinity,
    creditsPerMonth: Infinity,
  },
};

/**
 * Get user usage statistics
 * GET /api/usage/stats
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, credits, created_at')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get current month start
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get usage records for current month
    const { data: usageRecords } = await supabase
      .from('usage_records')
      .select('action_type, credits_used, created_at, metadata')
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    // Calculate usage stats
    const aiQueries = usageRecords?.filter(r => r.action_type === 'ai_query').length || 0;
    const documentsUploaded = usageRecords?.filter(r => r.action_type === 'document_upload').length || 0;
    const totalCreditsUsed = usageRecords?.reduce((sum, r) => sum + r.credits_used, 0) || 0;

    // Get total document count
    const { count: totalDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get total conversation count
    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get tier limits
    const limits = TIER_LIMITS[profile.tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;

    // Calculate usage percentages
    const usagePercentages = {
      aiQueries: limits.aiQueries === Infinity ? 0 : (aiQueries / limits.aiQueries) * 100,
      documents: limits.documents === Infinity ? 0 : ((totalDocuments || 0) / limits.documents) * 100,
      credits: limits.creditsPerMonth === Infinity ? 0 : (totalCreditsUsed / limits.creditsPerMonth) * 100,
    };

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: recentActivity } = await supabase
      .from('usage_records')
      .select('action_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Group activity by day
    const activityByDay: Record<string, { queries: number; uploads: number }> = {};
    recentActivity?.forEach(record => {
      const day = new Date(record.created_at).toISOString().split('T')[0];
      if (!activityByDay[day]) {
        activityByDay[day] = { queries: 0, uploads: 0 };
      }
      if (record.action_type === 'ai_query') {
        activityByDay[day].queries++;
      } else if (record.action_type === 'document_upload') {
        activityByDay[day].uploads++;
      }
    });

    return res.status(200).json({
      profile: {
        tier: profile.tier,
        credits: profile.credits,
        memberSince: profile.created_at,
      },
      usage: {
        month: {
          aiQueries,
          documentsUploaded,
          creditsUsed: totalCreditsUsed,
        },
        total: {
          documents: totalDocuments || 0,
          conversations: totalConversations || 0,
        },
      },
      limits,
      usagePercentages,
      recentActivity: activityByDay,
      warnings: {
        nearQueryLimit: usagePercentages.aiQueries > 80,
        nearDocumentLimit: usagePercentages.documents > 80,
        lowCredits: profile.credits < 10,
      },
    });

  } catch (error: any) {
    console.error('Usage stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

