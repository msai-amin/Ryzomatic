import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Combined Pomodoro API
 * Supports: sessions, stats, gamification
 * 
 * Routes:
 * - POST /api/pomodoro?s=session - Create/update session
 * - GET /api/pomodoro?s=stats&userId=... - Get stats
 * - POST /api/pomodoro?s=gamification - Update gamification
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const section = req.query.s as string;

  if (!section || !['session', 'stats', 'gamification'].includes(section)) {
    return res.status(400).json({ error: 'Invalid section. Must be: session, stats, or gamification' });
  }

  try {
    if (section === 'session') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed for session' });
      }
      return await handleSession(req, res);
    } else if (section === 'stats') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed for stats' });
      }
      return await handleStats(req, res);
    } else if (section === 'gamification') {
      // Gamification supports both GET and POST
      if (req.method === 'GET') {
        return await handleGamificationGet(req, res);
      } else if (req.method === 'POST') {
        return await handleGamificationPost(req, res);
      } else {
        return res.status(405).json({ error: 'Method not allowed for gamification' });
      }
    }
  } catch (error: any) {
    console.error('Pomodoro API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

async function handleSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { sessionType, duration, startTime, endTime } = req.body;

  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({
      user_id: user.id,
      session_type: sessionType,
      duration_minutes: duration,
      start_time: startTime,
      end_time: endTime,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, session: data });
}

async function handleStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, stats: data });
}

async function handleGamificationGet(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Use Promise.all to fetch data in parallel
    const [achievementsResult, streakResult] = await Promise.all([
      supabase.rpc('get_user_achievements', { p_user_id: user.id }),
      supabase.rpc('get_user_streak', { p_user_id: user.id })
    ]);

    const { data: achievements, error: achError } = achievementsResult;
    const { data: streak, error: streakError } = streakResult;

    if (achError) console.error('Error fetching achievements:', achError);
    if (streakError) console.error('Error fetching streak:', streakError);

    return res.status(200).json({
      success: true,
      achievements: achievements || [],
      streak: streak?.[0] || {
        current_streak: 0,
        longest_streak: 0,
        last_session_date: null,
        weekly_goal: 15,
        weekly_progress: 0,
        week_start_date: null,
      },
    });
  } catch (error: any) {
    console.error('Gamification GET error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGamificationPost(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { achievementType, pointsEarned, checkAchievements, updateStreak, bookId, mode, completed } = req.body;

  try {
    // Handle different gamification actions
    if (checkAchievements) {
      // Call the database function to check for new achievements
      const { data: newAchievements, error } = await supabase
        .rpc('check_pomodoro_achievements', {
          p_user_id: user.id,
          p_session_data: { bookId, mode, completed }
        });

      if (error) {
        console.error('Error checking achievements:', error);
        return res.status(500).json({ error: error.message });
      }

      // Insert any newly unlocked achievements
      if (newAchievements && newAchievements.length > 0) {
        const achievementsToInsert = newAchievements.map((ach: any) => ({
          user_id: user.id,
          achievement_type: ach.achievement_type,
          metadata: ach.metadata
        }));

        const { error: insertError } = await supabase
          .from('pomodoro_achievements')
          .insert(achievementsToInsert);

        if (insertError) {
          console.error('Error inserting achievements:', insertError);
        }
      }

      return res.status(200).json({
        success: true,
        newAchievements: newAchievements || [],
      });
    }

    if (updateStreak) {
      const { error } = await supabase
        .rpc('update_pomodoro_streak', { p_user_id: user.id });

      if (error) {
        console.error('Error updating streak:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
      });
    }

    // Update user profile with gamification data (legacy/fallback)
    if (achievementType || pointsEarned !== undefined) {
      // We don't use this path anymore but keeping for backward compatibility if needed
      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Gamification POST error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

