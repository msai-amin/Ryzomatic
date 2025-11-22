import { supabase } from '../../lib/supabase'

export interface ReadingSession {
  id: string
  user_id: string
  book_id: string | null
  session_type: 'reading' | 'reviewing' | 'research' | 'study'
  start_time: string
  end_time: string | null
  duration_seconds: number | null
  pages_read: number[]
  highlights_created: number
  notes_created: number
  previous_session_id: string | null
  next_document_id: string | null
  created_at: string
}

export interface DocumentNavigation {
  id: string
  user_id: string
  from_document_id: string | null
  to_document_id: string
  navigation_type: 'related_document_click' | 'note_reference' | 'highlight_reference' | 'search_result' | 'manual_open'
  trigger_highlight_id: string | null
  trigger_note_id: string | null
  trigger_concept_id: string | null
  navigation_time: string
  time_spent_seconds: number | null
}

export interface HighlightNoteConnection {
  id: string
  user_id: string
  highlight_id: string
  note_id: string
  connection_type: 'expanded' | 'questioned' | 'summarized' | 'related'
  created_at: string
}

export interface CognitiveConcept {
  id: string
  user_id: string
  concept_text: string
  concept_embedding: number[] | null
  first_seen_in_document_id: string | null
  first_seen_in_highlight_id: string | null
  first_seen_in_note_id: string | null
  first_seen_at: string
  frequency: number
  importance_score: number
  created_at: string
  updated_at: string
}

export interface ConceptOccurrence {
  id: string
  user_id: string
  concept_id: string
  occurrence_type: 'highlight' | 'note' | 'document'
  occurrence_id: string
  context_text: string | null
  page_number: number | null
  created_at: string
}

export interface CognitivePath {
  id: string
  user_id: string
  path_items: Array<{
    type: 'document' | 'note' | 'highlight'
    id: string
    order: number
  }>
  path_name: string | null
  path_type: 'reading_flow' | 'research_trail' | 'concept_exploration' | 'study_session'
  started_at: string
  completed_at: string | null
  total_items: number
  total_documents: number
  total_notes: number
  total_highlights: number
  created_at: string
  updated_at: string
}

export interface CognitivePathGraphNode {
  node_id: string
  node_type: 'document' | 'note' | 'highlight' | 'concept'
  node_content: string
  edge_type: string
  edge_strength: number
  connection_reason: string | null
  created_at: string
}

export interface ReadingFlowItem {
  from_document_id: string | null
  from_document_title: string | null
  to_document_id: string
  to_document_title: string
  navigation_type: string
  navigation_time: string
  time_spent_seconds: number | null
}

export interface ConceptConnection {
  occurrence_type: string
  occurrence_id: string
  context_text: string | null
  page_number: number | null
  document_title: string | null
  created_at: string
}

class CognitivePathService {
  /**
   * Start a reading session
   */
  async startReadingSession(
    userId: string,
    bookId: string | null,
    sessionType: ReadingSession['session_type'] = 'reading',
    previousSessionId?: string | null
  ): Promise<ReadingSession | null> {
    try {
      const { data, error } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: userId,
          book_id: bookId,
          session_type: sessionType,
          start_time: new Date().toISOString(),
          previous_session_id: previousSessionId || null
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to start reading session:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error starting reading session:', error)
      return null
    }
  }

  /**
   * End a reading session
   */
  async endReadingSession(
    sessionId: string,
    highlightsCreated: number = 0,
    notesCreated: number = 0,
    pagesRead: number[] = [],
    nextDocumentId?: string | null
  ): Promise<boolean> {
    try {
      const endTime = new Date().toISOString()
      
      // Get start time to calculate duration
      const { data: session } = await supabase
        .from('reading_sessions')
        .select('start_time')
        .eq('id', sessionId)
        .single()

      const durationSeconds = session?.start_time
        ? Math.floor((new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 1000)
        : null

      const { error } = await supabase
        .from('reading_sessions')
        .update({
          end_time: endTime,
          duration_seconds: durationSeconds,
          highlights_created: highlightsCreated,
          notes_created: notesCreated,
          pages_read: pagesRead,
          next_document_id: nextDocumentId || null
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Failed to end reading session:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error ending reading session:', error)
      return false
    }
  }

  /**
   * Log document navigation
   */
  async logDocumentNavigation(
    userId: string,
    toDocumentId: string,
    navigationType: DocumentNavigation['navigation_type'] = 'manual_open',
    fromDocumentId?: string | null,
    triggerHighlightId?: string | null,
    triggerNoteId?: string | null,
    triggerConceptId?: string | null,
    timeSpentSeconds?: number | null
  ): Promise<DocumentNavigation | null> {
    try {
      const { data, error } = await supabase
        .from('document_navigation_log')
        .insert({
          user_id: userId,
          from_document_id: fromDocumentId || null,
          to_document_id: toDocumentId,
          navigation_type: navigationType,
          trigger_highlight_id: triggerHighlightId || null,
          trigger_note_id: triggerNoteId || null,
          trigger_concept_id: triggerConceptId || null,
          navigation_time: new Date().toISOString(),
          time_spent_seconds: timeSpentSeconds || null
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to log document navigation:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error logging document navigation:', error)
      return null
    }
  }

  /**
   * Create highlight-to-note connection
   */
  async connectHighlightToNote(
    userId: string,
    highlightId: string,
    noteId: string,
    connectionType: HighlightNoteConnection['connection_type'] = 'expanded'
  ): Promise<HighlightNoteConnection | null> {
    try {
      // Create connection
      const { data, error } = await supabase
        .from('highlight_note_connections')
        .insert({
          user_id: userId,
          highlight_id: highlightId,
          note_id: noteId,
          connection_type: connectionType
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create highlight-note connection:', error)
        return null
      }

      // Update highlight
      await supabase
        .from('user_highlights')
        .update({
          has_note: true,
          linked_note_id: noteId
        })
        .eq('id', highlightId)

      // Update note
      await supabase
        .from('user_notes')
        .update({
          source_highlight_id: highlightId,
          created_from_highlight: true
        })
        .eq('id', noteId)

      return data
    } catch (error) {
      console.error('Error creating highlight-note connection:', error)
      return null
    }
  }

  /**
   * Get or create cognitive concept
   */
  async getOrCreateConcept(
    userId: string,
    conceptText: string,
    embedding?: number[] | null,
    firstSeenInDocumentId?: string | null,
    firstSeenInHighlightId?: string | null,
    firstSeenInNoteId?: string | null
  ): Promise<CognitiveConcept | null> {
    try {
      // Try to get existing concept
      const { data: existing } = await supabase
        .from('cognitive_concepts')
        .select('*')
        .eq('user_id', userId)
        .eq('concept_text', conceptText)
        .single()

      if (existing) {
        // Update frequency
        await supabase
          .from('cognitive_concepts')
          .update({
            frequency: existing.frequency + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        return { ...existing, frequency: existing.frequency + 1 }
      }

      // Create new concept
      // Note: pgvector requires embedding as array literal or using supabase's vector type
      const { data, error } = await supabase
        .from('cognitive_concepts')
        .insert({
          user_id: userId,
          concept_text: conceptText,
          concept_embedding: embedding ? `[${embedding.join(',')}]` as any : null,
          first_seen_in_document_id: firstSeenInDocumentId || null,
          first_seen_in_highlight_id: firstSeenInHighlightId || null,
          first_seen_in_note_id: firstSeenInNoteId || null,
          first_seen_at: new Date().toISOString(),
          frequency: 1
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create concept:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error getting/creating concept:', error)
      return null
    }
  }

  /**
   * Create concept occurrence
   */
  async createConceptOccurrence(
    userId: string,
    conceptId: string,
    occurrenceType: ConceptOccurrence['occurrence_type'],
    occurrenceId: string,
    contextText?: string | null,
    pageNumber?: number | null
  ): Promise<ConceptOccurrence | null> {
    try {
      const { data, error } = await supabase
        .from('concept_occurrences')
        .insert({
          user_id: userId,
          concept_id: conceptId,
          occurrence_type: occurrenceType,
          occurrence_id: occurrenceId,
          context_text: contextText || null,
          page_number: pageNumber || null
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create concept occurrence:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating concept occurrence:', error)
      return null
    }
  }

  /**
   * Get cognitive path graph for a document
   */
  async getCognitivePathGraph(
    bookId: string,
    userId: string,
    includeTypes: Array<'document' | 'note' | 'highlight' | 'concept'> = ['document', 'note', 'highlight', 'concept']
  ): Promise<CognitivePathGraphNode[]> {
    try {
      const { data, error } = await supabase.rpc('get_cognitive_path_graph', {
        book_uuid: bookId,
        user_uuid: userId,
        include_types: includeTypes
      })

      if (error) {
        console.error('Failed to get cognitive path graph:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting cognitive path graph:', error)
      return []
    }
  }

  /**
   * Get reading flow
   */
  async getReadingFlow(
    userId: string,
    limit: number = 50
  ): Promise<ReadingFlowItem[]> {
    try {
      const { data, error } = await supabase.rpc('get_reading_flow', {
        user_uuid: userId,
        limit_count: limit
      })

      if (error) {
        console.error('Failed to get reading flow:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting reading flow:', error)
      return []
    }
  }

  /**
   * Get concept connections
   */
  async getConceptConnections(
    conceptId: string,
    userId: string
  ): Promise<ConceptConnection[]> {
    try {
      const { data, error } = await supabase.rpc('get_concept_connections', {
        concept_uuid: conceptId,
        user_uuid: userId
      })

      if (error) {
        console.error('Failed to get concept connections:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting concept connections:', error)
      return []
    }
  }

  /**
   * Create or update cognitive path
   */
  async createCognitivePath(
    userId: string,
    pathItems: CognitivePath['path_items'],
    pathType: CognitivePath['path_type'] = 'reading_flow',
    pathName?: string | null
  ): Promise<CognitivePath | null> {
    try {
      const totalDocuments = pathItems.filter(item => item.type === 'document').length
      const totalNotes = pathItems.filter(item => item.type === 'note').length
      const totalHighlights = pathItems.filter(item => item.type === 'highlight').length

      const { data, error } = await supabase
        .from('cognitive_paths')
        .insert({
          user_id: userId,
          path_items: pathItems,
          path_type: pathType,
          path_name: pathName || null,
          started_at: new Date().toISOString(),
          total_items: pathItems.length,
          total_documents: totalDocuments,
          total_notes: totalNotes,
          total_highlights: totalHighlights
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create cognitive path:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error creating cognitive path:', error)
      return null
    }
  }

  /**
   * Complete a cognitive path
   */
  async completeCognitivePath(pathId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cognitive_paths')
        .update({
          completed_at: new Date().toISOString()
        })
        .eq('id', pathId)

      if (error) {
        console.error('Failed to complete cognitive path:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error completing cognitive path:', error)
      return false
    }
  }

  /**
   * Get user's cognitive concepts
   */
  async getUserConcepts(
    userId: string,
    limit: number = 50,
    orderBy: 'frequency' | 'importance' | 'created_at' = 'frequency'
  ): Promise<CognitiveConcept[]> {
    try {
      let query = supabase
        .from('cognitive_concepts')
        .select('*')
        .eq('user_id', userId)
        .limit(limit)

      switch (orderBy) {
        case 'frequency':
          query = query.order('frequency', { ascending: false })
          break
        case 'importance':
          query = query.order('importance_score', { ascending: false })
          break
        case 'created_at':
          query = query.order('created_at', { ascending: false })
          break
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to get user concepts:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting user concepts:', error)
      return []
    }
  }

  /**
   * Get recent reading sessions
   */
  async getRecentReadingSessions(
    userId: string,
    limit: number = 20
  ): Promise<ReadingSession[]> {
    try {
      const { data, error } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to get reading sessions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error getting reading sessions:', error)
      return []
    }
  }
}

export const cognitivePathService = new CognitivePathService()

