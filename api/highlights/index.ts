import { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../lib/supabase'
import { verifyAuth } from '../../src/utils/auth'

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

  const user = await verifyAuth(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      // List highlights
      const { bookId } = req.query

      if (!bookId) {
        return res.status(400).json({ error: 'Book ID is required' })
      }

      const { data: highlights, error } = await supabase
        .from('highlights')
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
      const { bookId, text, startOffset, endOffset, color, note } = req.body

      if (!bookId || !text || startOffset === undefined || endOffset === undefined) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      const { data: highlight, error } = await supabase
        .from('highlights')
        .insert({
          user_id: user.id,
          book_id: bookId,
          text,
          start_offset: startOffset,
          end_offset: endOffset,
          color: color || 'yellow',
          note: note || null
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating highlight:', error)
        return res.status(500).json({ error: 'Failed to create highlight' })
      }

      return res.status(201).json({ success: true, highlight })
    }

    if (req.method === 'PUT') {
      // Update highlight
      const { id, text, color, note } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Highlight ID is required' })
      }

      const updateData: any = {}
      if (text !== undefined) updateData.text = text
      if (color !== undefined) updateData.color = color
      if (note !== undefined) updateData.note = note

      const { data: highlight, error } = await supabase
        .from('highlights')
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
        .from('highlights')
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
