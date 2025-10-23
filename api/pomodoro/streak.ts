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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method === 'GET') {
    try {
      const { userId } = req.query

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      // Get user's streak info
      const { data: streak, error: streakError } = await supabase.rpc('get_user_streak', {
        p_user_id: userId
      })

      if (streakError) {
        console.error('Error getting streak:', streakError)
        return res.status(500).json({ error: 'Failed to get streak info' })
      }

      const streakInfo = streak?.[0] || {
        current_streak: 0,
        longest_streak: 0,
        last_session_date: null,
        weekly_goal: 15,
        weekly_progress: 0,
        week_start_date: null
      }

      return res.status(200).json({
        success: true,
        streak: streakInfo
      })

    } catch (error: any) {
      console.error('Error in streak GET:', error)
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      })
    }
  }

  if (req.method === 'POST') {
    try {
      const { userId, sessionDate } = req.body

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' })
      }

      // Update streak tracking
      const { error: streakError } = await supabase.rpc('update_pomodoro_streak', {
        p_user_id: userId,
        p_session_date: sessionDate || new Date().toISOString().split('T')[0]
      })

      if (streakError) {
        console.error('Error updating streak:', streakError)
        return res.status(500).json({ error: 'Failed to update streak' })
      }

      // Get updated streak info
      const { data: streak, error: getStreakError } = await supabase.rpc('get_user_streak', {
        p_user_id: userId
      })

      if (getStreakError) {
        console.error('Error getting updated streak:', getStreakError)
        return res.status(500).json({ error: 'Failed to get updated streak' })
      }

      return res.status(200).json({
        success: true,
        streak: streak?.[0] || {
          current_streak: 0,
          longest_streak: 0,
          last_session_date: null,
          weekly_goal: 15,
          weekly_progress: 0,
          week_start_date: null
        }
      })

    } catch (error: any) {
      console.error('Error in streak POST:', error)
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
