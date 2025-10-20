import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { bookId, type = 'all', days = 7 } = req.query

    let stats: any = {}

    // Get book-specific stats
    if (bookId && typeof bookId === 'string') {
      const { data: bookStats, error: bookError } = await supabase.rpc('get_pomodoro_stats_by_book', {
        book_uuid: bookId
      })

      if (bookError) {
        console.error('Error getting book stats:', bookError)
      } else {
        stats.bookStats = bookStats?.[0] || null
      }
    }

    // Get daily stats
    if (type === 'all' || type === 'daily') {
      const daysBack = parseInt(days as string) || 7
      const { data: dailyStats, error: dailyError } = await supabase.rpc('get_daily_pomodoro_stats', {
        user_uuid: user.id,
        days_back: daysBack
      })

      if (dailyError) {
        console.error('Error getting daily stats:', dailyError)
      } else {
        stats.dailyStats = dailyStats || []
      }
    }

    // Get time-of-day patterns
    if (type === 'all' || type === 'patterns') {
      const daysBack = parseInt(days as string) || 30
      const { data: patterns, error: patternsError } = await supabase.rpc('get_time_of_day_patterns', {
        user_uuid: user.id,
        days_back: daysBack
      })

      if (patternsError) {
        console.error('Error getting time patterns:', patternsError)
      } else {
        stats.timePatterns = patterns || []
      }
    }

    // Get weekly summary
    if (type === 'all' || type === 'weekly') {
      const { data: weeklyStats, error: weeklyError } = await supabase.rpc('get_weekly_pomodoro_summary', {
        user_uuid: user.id
      })

      if (weeklyError) {
        console.error('Error getting weekly stats:', weeklyError)
      } else {
        stats.weeklyStats = weeklyStats || []
      }
    }

    // Get active session if any
    const { data: activeSession } = await supabase.rpc('get_active_pomodoro_session', {
      user_uuid: user.id
    })

    stats.activeSession = activeSession?.[0] || null

    return res.status(200).json({
      success: true,
      stats
    })

  } catch (error: any) {
    console.error('Error in pomodoro/stats:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}

