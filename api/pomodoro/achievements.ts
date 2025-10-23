import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Get user's achievements
    const { data: achievements, error: achievementsError } = await supabase.rpc('get_user_achievements', {
      p_user_id: userId
    })

    if (achievementsError) {
      console.error('Error getting achievements:', achievementsError)
      return res.status(500).json({ error: 'Failed to get achievements' })
    }

    // Get achievement progress
    const { data: progress, error: progressError } = await supabase.rpc('get_achievement_progress', {
      p_user_id: userId
    })

    if (progressError) {
      console.error('Error getting achievement progress:', progressError)
      return res.status(500).json({ error: 'Failed to get achievement progress' })
    }

    return res.status(200).json({
      success: true,
      achievements: achievements || [],
      progress: progress || [],
      totalAchievements: achievements?.length || 0
    })

  } catch (error: any) {
    console.error('Error in achievements:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}
