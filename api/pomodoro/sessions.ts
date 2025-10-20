import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
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

    const { action, bookId, mode, sessionId, durationSeconds, completed = true } = req.body

    if (!action || !['start', 'stop'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be start or stop' })
    }

    // Handle START action
    if (action === 'start') {
      if (!bookId || !mode) {
        return res.status(400).json({ error: 'Missing required fields: bookId, mode' })
      }

      if (!['work', 'shortBreak', 'longBreak'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be work, shortBreak, or longBreak' })
      }

      // Check if user has an active session already
      const { data: activeSession } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .single()

      // If there's an active session, auto-complete it first
      if (activeSession) {
        const duration = Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000)
        await supabase
          .from('pomodoro_sessions')
          .update({
            ended_at: new Date().toISOString(),
            duration_seconds: duration,
            completed: false // Mark as incomplete since it was auto-stopped
          })
          .eq('id', activeSession.id)
      }

      // Create new session
      const { data: session, error: sessionError } = await supabase
        .from('pomodoro_sessions')
        .insert({
          user_id: user.id,
          book_id: bookId,
          mode,
          started_at: new Date().toISOString(),
          completed: false
        })
        .select()
        .single()

      if (sessionError) {
        console.error('Error creating pomodoro session:', sessionError)
        return res.status(500).json({ error: 'Failed to start session', details: sessionError.message })
      }

      return res.status(200).json({
        success: true,
        session: {
          id: session.id,
          bookId: session.book_id,
          mode: session.mode,
          startedAt: session.started_at
        }
      })
    }

    // Handle STOP action
    if (action === 'stop') {
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing required field: sessionId' })
      }

      // Get the session to verify ownership
      const { data: session, error: getError } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (getError || !session) {
        return res.status(404).json({ error: 'Session not found' })
      }

      if (session.ended_at) {
        return res.status(400).json({ error: 'Session already ended' })
      }

      // Calculate duration if not provided
      const endedAt = new Date()
      const calculatedDuration = durationSeconds || 
        Math.floor((endedAt.getTime() - new Date(session.started_at).getTime()) / 1000)

      // Update session
      const { data: updatedSession, error: updateError } = await supabase
        .from('pomodoro_sessions')
        .update({
          ended_at: endedAt.toISOString(),
          duration_seconds: calculatedDuration,
          completed
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating pomodoro session:', updateError)
        return res.status(500).json({ error: 'Failed to stop session', details: updateError.message })
      }

      // Get updated book stats
      const { data: bookStats } = await supabase.rpc('get_pomodoro_stats_by_book', {
        book_uuid: session.book_id
      })

      return res.status(200).json({
        success: true,
        session: {
          id: updatedSession.id,
          bookId: updatedSession.book_id,
          mode: updatedSession.mode,
          startedAt: updatedSession.started_at,
          endedAt: updatedSession.ended_at,
          durationSeconds: updatedSession.duration_seconds,
          completed: updatedSession.completed
        },
        bookStats: bookStats?.[0] || null
      })
    }

  } catch (error: any) {
    console.error('Error in pomodoro handler:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}