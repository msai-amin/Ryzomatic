import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
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
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    if (req.method === 'GET') {
      // List highlights
      const { bookId } = req.query

      if (!bookId) {
        return res.status(400).json({ error: 'Book ID is required' })
      }

      // Verify book ownership
      const { data: book, error: bookError } = await supabase
        .from('user_books')
        .select('id')
        .eq('id', bookId)
        .eq('user_id', user.id)
        .single()

      if (bookError || !book) {
        return res.status(403).json({ error: 'Book not found or access denied' })
      }

      const { data: highlights, error } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching highlights:', error)
        return res.status(500).json({ error: 'Failed to fetch highlights' })
      }

      return res.status(200).json({ success: true, highlights: highlights || [] })
    }

    if (req.method === 'POST') {
      // Create highlight
      const {
        bookId,
        pageNumber,
        highlightedText,
        colorId,
        colorHex,
        positionData,
        textStartOffset,
        textEndOffset,
        textContextBefore,
        textContextAfter
      } = req.body

      // Validate required fields
      if (!bookId || !pageNumber || !highlightedText || !colorId || !colorHex || !positionData) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['bookId', 'pageNumber', 'highlightedText', 'colorId', 'colorHex', 'positionData']
        })
      }

      // Verify book ownership
      const { data: book, error: bookError } = await supabase
        .from('user_books')
        .select('id')
        .eq('id', bookId)
        .eq('user_id', user.id)
        .single()

      if (bookError || !book) {
        return res.status(403).json({ error: 'Book not found or access denied' })
      }

      const { data: highlight, error } = await supabase
        .from('user_highlights')
        .insert({
          user_id: user.id,
          book_id: bookId,
          page_number: pageNumber,
          highlighted_text: highlightedText,
          color_id: colorId,
          color_hex: colorHex,
          position_data: positionData,
          text_start_offset: textStartOffset,
          text_end_offset: textEndOffset,
          text_context_before: textContextBefore,
          text_context_after: textContextAfter
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating highlight:', error)
        return res.status(500).json({ error: 'Failed to create highlight', details: error.message })
      }

      return res.status(200).json({ success: true, highlight })
    }

    if (req.method === 'PUT') {
      // Update highlight
      const { id, colorId, colorHex, positionData, textStartOffset, textEndOffset, isOrphaned, orphanedReason } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Highlight ID is required' })
      }

      const updateData: any = {}
      if (colorId !== undefined) updateData.color_id = colorId
      if (colorHex !== undefined) updateData.color_hex = colorHex
      if (positionData !== undefined) updateData.position_data = positionData
      if (textStartOffset !== undefined) updateData.text_start_offset = textStartOffset
      if (textEndOffset !== undefined) updateData.text_end_offset = textEndOffset
      if (isOrphaned !== undefined) updateData.is_orphaned = isOrphaned
      if (orphanedReason !== undefined) updateData.orphaned_reason = orphanedReason

      const { data: highlight, error } = await supabase
        .from('user_highlights')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating highlight:', error)
        return res.status(500).json({ error: 'Failed to update highlight' })
      }

      return res.status(200).json({ success: true, highlight })
    }

    if (req.method === 'DELETE') {
      // Delete highlight
      const { id } = req.query

      if (!id) {
        return res.status(400).json({ error: 'Highlight ID is required' })
      }

      const { error } = await supabase
        .from('user_highlights')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting highlight:', error)
        return res.status(500).json({ error: 'Failed to delete highlight' })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (error: any) {
    console.error('Error in highlights endpoint:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
