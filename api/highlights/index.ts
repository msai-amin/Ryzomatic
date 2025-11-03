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

  try {
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

    if (req.method === 'GET') {
      // List highlights
      const { bookId } = req.query

      if (!bookId) {
        return res.status(400).json({ error: 'Book ID is required' })
      }

      // Verify book ownership - check if book exists first, then check ownership
      const { data: bookExists, error: existsError } = await supabase
        .from('user_books')
        .select('id, user_id')
        .eq('id', bookId)
        .single()

      if (existsError || !bookExists) {
        console.error('Book lookup failed when fetching highlights:', {
          bookId,
          userId: user.id,
          error: existsError,
          errorCode: existsError?.code,
          errorMessage: existsError?.message
        })
        return res.status(404).json({ 
          error: 'Book not found',
          details: existsError?.message || 'Book does not exist in database'
        })
      }

      // Check if book belongs to user
      if (bookExists.user_id !== user.id) {
        console.error('Book ownership mismatch when fetching highlights:', {
          bookId,
          bookUserId: bookExists.user_id,
          requestUserId: user.id
        })
        return res.status(403).json({ 
          error: 'Access denied',
          details: 'Book belongs to a different user'
        })
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

      console.log('🔍 Highlight API received request:', {
        bookId,
        userId: user.id,
        userEmail: user.email,
        pageNumber,
        hasBookId: !!bookId,
        bookIdType: typeof bookId,
        bookIdLength: bookId?.length
      })

      // Validate required fields
      if (!bookId || !pageNumber || !highlightedText || !colorId || !colorHex || !positionData) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['bookId', 'pageNumber', 'highlightedText', 'colorId', 'colorHex', 'positionData']
        })
      }

      // Verify book ownership - check if book exists first, then check ownership
      console.log('🔍 Looking up book in database:', { bookId, userId: user.id })
      const { data: bookExists, error: existsError } = await supabase
        .from('user_books')
        .select('id, user_id')
        .eq('id', bookId)
        .single()
      
      console.log('🔍 Book lookup result:', {
        bookId,
        found: !!bookExists,
        error: existsError,
        errorCode: existsError?.code,
        errorMessage: existsError?.message,
        bookUserId: bookExists?.user_id,
        requestUserId: user.id
      })

      if (existsError || !bookExists) {
        console.error('Book lookup failed when creating highlight:', {
          bookId,
          userId: user.id,
          error: existsError,
          errorCode: existsError?.code,
          errorMessage: existsError?.message,
          bookExists: !!bookExists
        })
        return res.status(404).json({ 
          error: 'Book not found',
          details: existsError?.message || 'Book does not exist in database'
        })
      }

      // Check if book belongs to user
      if (bookExists.user_id !== user.id) {
        console.error('Book ownership mismatch when creating highlight:', {
          bookId,
          bookUserId: bookExists.user_id,
          requestUserId: user.id
        })
        return res.status(403).json({ 
          error: 'Access denied',
          details: 'Book belongs to a different user'
        })
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
