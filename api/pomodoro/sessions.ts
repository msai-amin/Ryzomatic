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

    const { bookId, limit = 50, mode } = req.query

    // Build query
    let query = supabase
      .from('pomodoro_sessions')
      .select(`
        *,
        user_books (
          title,
          file_name
        )
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(parseInt(limit as string))

    // Filter by book if provided
    if (bookId && typeof bookId === 'string') {
      query = query.eq('book_id', bookId)
    }

    // Filter by mode if provided
    if (mode && typeof mode === 'string') {
      query = query.eq('mode', mode)
    }

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return res.status(500).json({ error: 'Failed to fetch sessions', details: sessionsError.message })
    }

    return res.status(200).json({
      success: true,
      sessions: sessions || [],
      count: sessions?.length || 0
    })

  } catch (error: any) {
    console.error('Error in pomodoro/sessions:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}

