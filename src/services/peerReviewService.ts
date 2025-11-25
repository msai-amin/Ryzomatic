import { supabase } from '../../lib/supabase'
import { logger } from './logger'

export interface PeerReview {
  id: string
  user_id: string
  book_id: string
  review_content: string
  citations: string[]
  font_family: string
  font_size: number
  theme: 'light' | 'dark'
  status: 'draft' | 'submitted' | 'archived'
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export class PeerReviewService {
  /**
   * Load review for a specific document
   */
  async loadReview(bookId: string, userId: string): Promise<PeerReview | null> {
    try {
      const { data, error } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No review found - this is OK
          logger.info('No existing review found', { bookId, userId })
          return null
        }
        throw error
      }

      logger.info('Review loaded successfully', { bookId, userId, reviewId: data?.id })
      return data as PeerReview
    } catch (error) {
      logger.error('Failed to load review', { bookId, userId }, error as Error)
      return null
    }
  }

  /**
   * Save or update review
   */
  async saveReview(
    bookId: string,
    userId: string,
    reviewData: {
      review_content: string
      citations: string[]
      font_family: string
      font_size: number
      theme: 'light' | 'dark'
      status?: 'draft' | 'submitted' | 'archived'
    }
  ): Promise<PeerReview | null> {
    try {
      const { data: existing } = await supabase
        .from('peer_reviews')
        .select('id')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .single()

      const reviewPayload = {
        book_id: bookId,
        user_id: userId,
        review_content: reviewData.review_content,
        citations: reviewData.citations,
        font_family: reviewData.font_family,
        font_size: reviewData.font_size,
        theme: reviewData.theme,
        status: reviewData.status || 'draft',
        submitted_at: reviewData.status === 'submitted' ? new Date().toISOString() : null,
      }

      let result
      if (existing) {
        // Update existing review
        const { data, error } = await supabase
          .from('peer_reviews')
          .update(reviewPayload)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        result = data
        logger.info('Review updated successfully', { bookId, userId, reviewId: existing.id })
      } else {
        // Create new review
        const { data, error } = await supabase
          .from('peer_reviews')
          .insert(reviewPayload)
          .select()
          .single()

        if (error) throw error
        result = data
        logger.info('Review created successfully', { bookId, userId, reviewId: data.id })
      }

      return result as PeerReview
    } catch (error) {
      logger.error('Failed to save review', { bookId, userId }, error as Error)
      throw error
    }
  }

  /**
   * Submit review (mark as submitted)
   */
  async submitReview(bookId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('peer_reviews')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('book_id', bookId)
        .eq('user_id', userId)

      if (error) throw error

      logger.info('Review submitted successfully', { bookId, userId })
      return true
    } catch (error) {
      logger.error('Failed to submit review', { bookId, userId }, error as Error)
      return false
    }
  }

  /**
   * Delete review
   */
  async deleteReview(bookId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('peer_reviews')
        .delete()
        .eq('book_id', bookId)
        .eq('user_id', userId)

      if (error) throw error

      logger.info('Review deleted successfully', { bookId, userId })
      return true
    } catch (error) {
      logger.error('Failed to delete review', { bookId, userId }, error as Error)
      return false
    }
  }

  /**
   * Load reviews for multiple books
   */
  async loadReviewsForBooks(bookIds: string[], userId: string): Promise<Map<string, PeerReview>> {
    try {
      if (bookIds.length === 0) {
        return new Map()
      }

      const { data, error } = await supabase
        .from('peer_reviews')
        .select('*')
        .eq('user_id', userId)
        .in('book_id', bookIds)

      if (error) {
        logger.error('Failed to load reviews for books', { bookIds, userId }, error)
        return new Map()
      }

      const reviewsMap = new Map<string, PeerReview>()
      if (data) {
        data.forEach((review) => {
          reviewsMap.set(review.book_id, review as PeerReview)
        })
      }

      logger.info('Reviews loaded for books', { bookIds, userId, count: reviewsMap.size })
      return reviewsMap
    } catch (error) {
      logger.error('Failed to load reviews for books', { bookIds, userId }, error as Error)
      return new Map()
    }
  }
}

export const peerReviewService = new PeerReviewService()

