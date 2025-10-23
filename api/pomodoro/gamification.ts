import { VercelRequest, VercelResponse } from '@vercel/node'
import { pomodoroGamificationService } from '../../src/services/pomodoroGamificationService'
import { verifyAuth } from '../../src/utils/auth'

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

  const user = await verifyAuth(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      // Get user's achievements and streak info
      const [achievements, streak] = await Promise.all([
        pomodoroGamificationService.getUserAchievements(user.id),
        pomodoroGamificationService.getUserStreak(user.id)
      ])

      return res.status(200).json({ 
        success: true, 
        achievements,
        streak
      })
    }

    if (req.method === 'POST') {
      const { action, bookId, mode, completed } = req.body

      if (action === 'check-achievements') {
        // Check for new achievements after session completion
        if (!mode || typeof completed === 'undefined') {
          return res.status(400).json({ error: 'Missing required fields: mode, completed' })
        }

        const newAchievements = await pomodoroGamificationService.checkAchievements(user.id, { bookId, mode, completed })
        
        // Update streak if it's a completed work session
        if (completed && mode === 'work') {
          await pomodoroGamificationService.updateStreak(user.id)
        }

        return res.status(200).json({ 
          success: true, 
          newAchievements 
        })
      }

      if (action === 'update-streak') {
        // Manually update streak
        const streakInfo = await pomodoroGamificationService.updateStreak(user.id)
        return res.status(200).json({ 
          success: true, 
          streak: streakInfo 
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
