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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, sessionData } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    if (!sessionData) {
      return res.status(400).json({ error: 'Session data is required' })
    }

    // Check for new achievements
    const { data: achievements, error: achievementsError } = await supabase.rpc('check_pomodoro_achievements', {
      p_user_id: userId,
      p_session_data: sessionData
    })

    if (achievementsError) {
      console.error('Error checking achievements:', achievementsError)
      return res.status(500).json({ error: 'Failed to check achievements' })
    }

    // If there are new achievements, insert them
    const newAchievements = achievements?.filter((a: any) => a.unlocked) || []
    
    if (newAchievements.length > 0) {
      const achievementInserts = newAchievements.map((achievement: any) => ({
        user_id: userId,
        achievement_type: achievement.achievement_type,
        metadata: achievement.metadata
      }))

      const { error: insertError } = await supabase
        .from('pomodoro_achievements')
        .insert(achievementInserts)

      if (insertError) {
        console.error('Error inserting achievements:', insertError)
        return res.status(500).json({ error: 'Failed to save achievements' })
      }
    }

    // Update streak tracking
    const { error: streakError } = await supabase.rpc('update_pomodoro_streak', {
      p_user_id: userId,
      p_session_date: new Date().toISOString().split('T')[0]
    })

    if (streakError) {
      console.error('Error updating streak:', streakError)
      // Don't fail the request for streak errors
    }

    return res.status(200).json({
      success: true,
      newAchievements: newAchievements.map((a: any) => ({
        achievement_type: a.achievement_type,
        metadata: a.metadata
      })),
      count: newAchievements.length
    })

  } catch (error: any) {
    console.error('Error in check-achievements:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}
