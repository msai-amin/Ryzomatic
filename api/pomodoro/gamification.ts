import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Get auth token from header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.substring(7)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    console.error('Auth error:', authError)
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    if (req.method === 'GET') {
      // Get user's achievements and streak info
      const { data: achievements, error: achievementsError } = await supabase
        .from('pomodoro_achievements')
        .select('*')
        .eq('user_id', user.id)

      if (achievementsError) {
        console.error('Error getting achievements:', achievementsError)
        return res.status(500).json({ error: 'Failed to get achievements' })
      }

      const { data: streak, error: streakError } = await supabase
        .from('pomodoro_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (streakError && streakError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error getting streak:', streakError)
        return res.status(500).json({ error: 'Failed to get streak info' })
      }

      const streakInfo = streak || {
        current_streak: 0,
        longest_streak: 0,
        last_session_date: null,
        weekly_goal: 15,
        weekly_progress: 0,
        week_start_date: null
      }

      return res.status(200).json({ 
        success: true, 
        achievements: achievements || [],
        streak: streakInfo
      })
    }

    if (req.method === 'POST') {
      const { action, bookId, mode, completed } = req.body

      if (action === 'check-achievements') {
        // For now, return empty array - achievements will be implemented later
        return res.status(200).json({ 
          success: true, 
          newAchievements: []
        })
      }

      if (action === 'update-streak') {
        // Update streak tracking
        const today = new Date().toISOString().split('T')[0]
        
        const { data: existingStreak, error: getError } = await supabase
          .from('pomodoro_streaks')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (getError && getError.code !== 'PGRST116') {
          console.error('Error getting streak:', getError)
          return res.status(500).json({ error: 'Failed to get streak' })
        }

        let streakData
        if (existingStreak) {
          // Update existing streak
          const lastSession = existingStreak.last_session_date
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]

          let newCurrentStreak = existingStreak.current_streak
          if (!lastSession || lastSession === yesterdayStr) {
            newCurrentStreak += 1
          } else if (lastSession !== today) {
            newCurrentStreak = 1 // Reset streak
          }

          const { data: updatedStreak, error: updateError } = await supabase
            .from('pomodoro_streaks')
            .update({
              current_streak: newCurrentStreak,
              longest_streak: Math.max(existingStreak.longest_streak, newCurrentStreak),
              last_session_date: today,
              weekly_progress: existingStreak.weekly_progress + 1,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .select()
            .single()

          if (updateError) {
            console.error('Error updating streak:', updateError)
            return res.status(500).json({ error: 'Failed to update streak' })
          }

          streakData = updatedStreak
        } else {
          // Create new streak
          const { data: newStreak, error: createError } = await supabase
            .from('pomodoro_streaks')
            .insert({
              user_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_session_date: today,
              weekly_goal: 15,
              weekly_progress: 1,
              week_start_date: today,
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) {
            console.error('Error creating streak:', createError)
            return res.status(500).json({ error: 'Failed to create streak' })
          }

          streakData = newStreak
        }

        return res.status(200).json({ 
          success: true, 
          streak: streakData
        })
      }

      return res.status(400).json({ error: 'Invalid action' })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error: any) {
    console.error('Error in gamification endpoint:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
