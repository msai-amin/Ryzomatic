import React, { useState, useEffect } from 'react'
import { FileText, Clock, BookOpen, Tag, Timer, ChevronLeft, ChevronRight, Flame, Trophy, BarChart3, Target, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '../src/store/appStore'
import { Tooltip } from '../src/components/Tooltip'
import { pomodoroService } from '../src/services/pomodoroService'
import { pomodoroGamificationService, StreakInfo, Achievement } from '../src/services/pomodoroGamificationService'
import { AchievementPanel } from '../src/components/AchievementPanel'
import { PomodoroDashboard } from '../src/components/PomodoroDashboard'
import { RelatedDocumentsPanel } from '../src/components/RelatedDocumentsPanel'
import { AddRelatedDocumentModal } from '../src/components/AddRelatedDocumentModal'
import { DocumentPreviewModal } from '../src/components/DocumentPreviewModal'
import { useTheme } from './ThemeProvider'
import { userBooks, documentRelationships, DocumentRelationshipWithDetails } from '../lib/supabase'

interface ThemedSidebarProps {
  isOpen: boolean
  onToggle: () => void
  refreshTrigger?: number
}

interface DocumentWithProgress {
  id: string
  name: string
  progress: number
  readingTime: string
  isActive: boolean
  type: 'text' | 'pdf'
  uploadedAt: string
  totalPages?: number
  currentPage?: number
}

export const ThemedSidebar: React.FC<ThemedSidebarProps> = ({ isOpen, onToggle, refreshTrigger }) => {
  const { currentDocument, user, showPomodoroDashboard, setShowPomodoroDashboard, documents: appDocuments, setCurrentDocument, relatedDocuments, setRelatedDocuments, relatedDocumentsRefreshTrigger, refreshRelatedDocuments } = useAppStore()
  const [pomodoroStats, setPomodoroStats] = useState<{ [key: string]: { timeMinutes: number, sessions: number } }>({})
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(false)
  const [userDocuments, setUserDocuments] = useState<DocumentWithProgress[]>([])
  
  // Related Documents state
  const [relatedDocsLoading, setRelatedDocsLoading] = useState(false)
  const [showAddRelatedModal, setShowAddRelatedModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState<DocumentRelationshipWithDetails | null>(null)
  
  // Collapsible sections state
  const [sectionsExpanded, setSectionsExpanded] = useState({
    library: true,
    related: true,
    stats: true,
    activity: true
  })

  // Load user documents from database
  useEffect(() => {
    console.log('ThemedSidebar: useEffect triggered with dependencies:', { user: !!user, currentDocumentId: currentDocument?.id, refreshTrigger })
    
    const loadUserDocuments = async () => {
      if (!user) {
        console.log('ThemedSidebar: No user, skipping document load')
        return
      }
      
      console.log('ThemedSidebar: Loading documents for user:', user.id, 'refreshTrigger:', refreshTrigger)
      
      try {
        // Test the API call first
        console.log('ThemedSidebar: Testing userBooks.list API call...')
        const { data: dbDocuments, error } = await userBooks.list(user.id)
        console.log('ThemedSidebar: API call completed. Data:', dbDocuments, 'Error:', error)
        
        if (error) {
          console.error('ThemedSidebar: Error loading documents:', error)
          return
        }
        
        console.log('ThemedSidebar: Loaded documents from database:', dbDocuments?.length || 0, 'documents')
        
        if (dbDocuments) {
          const documentsWithProgress: DocumentWithProgress[] = dbDocuments.map(doc => {
            // Calculate reading progress based on last_read_page and total_pages
            let progress = 0
            if (doc.total_pages && doc.last_read_page) {
              progress = Math.round((doc.last_read_page / doc.total_pages) * 100)
            } else if (doc.reading_progress) {
              progress = Math.round(doc.reading_progress)
            }
            
            // Calculate estimated reading time (simplified calculation)
            const readingTimeMinutes = Math.max(1, Math.round(progress * 0.5)) // Rough estimate
            const readingTime = readingTimeMinutes < 60 
              ? `${readingTimeMinutes} min` 
              : `${Math.round(readingTimeMinutes / 60)} hours`
            
            return {
              id: doc.id,
              name: doc.title || doc.file_name || 'Untitled Document',
              progress,
              readingTime,
              isActive: currentDocument?.id === doc.id,
              type: doc.file_type === 'pdf' ? 'pdf' : 'text',
              uploadedAt: doc.created_at,
              totalPages: doc.total_pages,
              currentPage: doc.last_read_page
            }
          })
          
          console.log('ThemedSidebar: Setting userDocuments:', documentsWithProgress.length, 'documents')
          setUserDocuments(documentsWithProgress)
        } else {
          console.log('ThemedSidebar: No documents found in database')
          setUserDocuments([])
        }
      } catch (error) {
        console.error('ThemedSidebar: Error loading user documents:', error)
      }
    }
    
    loadUserDocuments()
  }, [user, currentDocument?.id, refreshTrigger])

  // Load Pomodoro stats for real documents
  useEffect(() => {
    const loadStats = async () => {
      if (!user || userDocuments.length === 0) return
      
      const stats: { [key: string]: { timeMinutes: number, sessions: number } } = {}
      
      for (const doc of userDocuments) {
        const bookStats = await pomodoroService.getBookStats(doc.id)
        if (bookStats) {
          stats[doc.id] = {
            timeMinutes: Math.round(bookStats.total_time_minutes),
            sessions: bookStats.total_sessions
          }
        }
      }
      
      setPomodoroStats(stats)
    }
    
    loadStats()
  }, [user, userDocuments])

  // Load streak and achievements data
  useEffect(() => {
    const loadGamificationData = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        const [streakData, achievementsData] = await Promise.all([
          pomodoroGamificationService.getUserStreak(user.id),
          pomodoroGamificationService.getUserAchievements(user.id)
        ])
        
        setStreak(streakData)
        setAchievements(achievementsData)
      } catch (error) {
        console.error('Error loading gamification data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadGamificationData()
  }, [user])

  // Load related documents when current document changes
  useEffect(() => {
    const loadRelatedDocuments = async () => {
      if (!currentDocument || !user) {
        setRelatedDocuments([])
        return
      }

      try {
        setRelatedDocsLoading(true)
        const { data: relatedDocs, error } = await documentRelationships.getWithDetails(currentDocument.id)
        
        if (error) {
          console.error('Error loading related documents:', error)
          return
        }

        setRelatedDocuments(relatedDocs || [])
      } catch (error) {
        console.error('Error loading related documents:', error)
      } finally {
        setRelatedDocsLoading(false)
      }
    }

    loadRelatedDocuments()
  }, [currentDocument?.id, user, relatedDocumentsRefreshTrigger, setRelatedDocuments])

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleDocumentClick = async (doc: DocumentWithProgress) => {
    try {
      // Find the document in appDocuments or load it from database
      let documentToLoad = appDocuments.find(d => d.id === doc.id)
      
      if (!documentToLoad) {
        // Load document from database if not in app store
        const { data: dbDoc, error } = await userBooks.get(doc.id)
        if (error || !dbDoc) {
          console.error('Error loading document:', error)
          return
        }
        
        // Convert database document to app store format
        documentToLoad = {
          id: dbDoc.id,
          name: dbDoc.title || dbDoc.file_name || 'Untitled Document',
          content: dbDoc.text_content || '',
          type: dbDoc.file_type === 'pdf' ? 'pdf' : 'text',
          uploadedAt: new Date(dbDoc.created_at),
          totalPages: dbDoc.total_pages,
          pageTexts: [], // Will be loaded separately when needed
          highlights: [],
          highlightsLoaded: false
        }
      }
      
      setCurrentDocument(documentToLoad)
    } catch (error) {
      console.error('Error opening document:', error)
    }
  }

  // Related Documents handlers
  const handleAddRelatedDocument = () => {
    if (!currentDocument) return
    setShowAddRelatedModal(true)
  }

  const handlePreviewDocument = (relationship: DocumentRelationshipWithDetails) => {
    setSelectedRelationship(relationship)
    setShowPreviewModal(true)
  }

  const handleDeleteRelationship = async (relationshipId: string) => {
    try {
      const { error } = await documentRelationships.delete(relationshipId)
      if (error) {
        console.error('Error deleting relationship:', error)
        return
      }
      
      // Refresh related documents
      refreshRelatedDocuments()
    } catch (error) {
      console.error('Error deleting relationship:', error)
    }
  }

  const handleRelationshipCreated = () => {
    refreshRelatedDocuments()
  }

  return (
    <>
      {/* Toggle Button (visible when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-20 left-4 z-50 p-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            border: '1px solid var(--color-primary)',
          }}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <aside 
        className="overflow-y-auto transition-transform duration-300 ease-in-out sticky top-0"
        style={{
          width: 'var(--sidebar-width)',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, rgba(17, 24, 39, 0.98) 100%)',
          borderRight: '1px solid var(--color-border)',
          height: '100vh',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          marginLeft: isOpen ? '0' : 'calc(-1 * var(--sidebar-width))',
          zIndex: 40,
        }}
      >
        <div className="p-4">
          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onToggle}
              className="p-2 rounded-lg transition-all duration-300 hover:scale-110 shadow-md hover:shadow-lg"
              style={{
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Document Library Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Document Library
              </h2>
              <button
                onClick={() => toggleSection('library')}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {sectionsExpanded.library ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            
            {sectionsExpanded.library && (
              <div className="space-y-3">
                {userDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--color-text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      No documents yet. Upload your first document to get started!
                    </p>
                  </div>
                ) : (
                  userDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-lg border transition-colors cursor-pointer"
                style={{
                  backgroundColor: doc.isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
                  borderColor: doc.isActive ? 'var(--color-primary)' : 'var(--color-border)',
                }}
                onClick={() => handleDocumentClick(doc)}
                onMouseEnter={(e) => {
                  if (!doc.isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!doc.isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Tooltip content={doc.isActive ? "Currently Active" : "Click to Open"} position="right">
                      <FileText className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    </Tooltip>
                    <h3 
                      className={`text-sm ${doc.isActive ? 'font-semibold' : 'font-medium'}`}
                      style={{ 
                        color: doc.isActive ? '#000000' : 'var(--color-text-primary)' 
                      }}
                    >
                      {doc.name}
                    </h3>
                  </div>
                  {doc.isActive && (
                    <div 
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-text-inverse)',
                      }}
                    >
                      Active
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Tooltip content="Reading Progress" position="right">
                      <Clock className="w-3 h-3" style={{ color: doc.isActive ? '#4b5563' : 'var(--color-text-tertiary)' }} />
                    </Tooltip>
                    <span style={{ color: doc.isActive ? '#374151' : 'var(--color-text-secondary)' }}>
                      {doc.progress}% complete
                    </span>
                  </div>
                  <Tooltip content="Estimated Reading Time" position="left">
                    <span style={{ color: doc.isActive ? '#4b5563' : 'var(--color-text-tertiary)' }}>
                      {doc.readingTime} reading
                    </span>
                  </Tooltip>
                </div>
                
                {/* Pomodoro Time Display */}
                {pomodoroStats[doc.id] && pomodoroStats[doc.id].timeMinutes > 0 && (
                  <div className="flex items-center space-x-2 text-xs mt-2">
                    <Tooltip content="Time Spent (Pomodoro)" position="right">
                      <Timer className="w-3 h-3" style={{ color: '#ef4444' }} />
                    </Tooltip>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {pomodoroStats[doc.id].timeMinutes} min
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      ({pomodoroStats[doc.id].sessions} sessions)
                    </span>
                  </div>
                )}
                
                {/* Progress Bar */}
                <div 
                  className="w-full rounded-full h-1.5 mt-2"
                  style={{ backgroundColor: 'var(--color-border-light)' }}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${doc.progress}%`,
                      backgroundColor: doc.isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    }}
                  />
                </div>
              </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Related Documents Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Related Documents
              </h3>
              <button
                onClick={() => toggleSection('related')}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {sectionsExpanded.related ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {sectionsExpanded.related && (
              <>
                {currentDocument ? (
                  <RelatedDocumentsPanel
                    relatedDocuments={relatedDocuments}
                    isLoading={relatedDocsLoading}
                    onAddRelatedDocument={handleAddRelatedDocument}
                    onPreviewDocument={handlePreviewDocument}
                    onDeleteRelationship={handleDeleteRelationship}
                  />
                ) : (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Open a document to see related documents
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Productivity Stats Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Productivity Stats
              </h3>
              <button
                onClick={() => toggleSection('stats')}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {sectionsExpanded.stats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {sectionsExpanded.stats && (
              <div className="space-y-4" data-tour="sidebar-stats">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Analytics</span>
                  </div>
                  <button
                    onClick={() => setShowPomodoroDashboard(true)}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    title="View Analytics Dashboard"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
          
          {/* Streak Display */}
          {streak && (
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: streak.current_streak > 0 ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${streak.current_streak > 0 ? '#fecaca' : 'var(--color-border)'}`,
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <Flame className="w-4 h-4" style={{ color: streak.current_streak > 0 ? '#ef4444' : '#6b7280' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Current Streak
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold" style={{ color: streak.current_streak > 0 ? '#ef4444' : '#6b7280' }}>
                  {streak.current_streak}
                </div>
                <div className="text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>
                  <div>Best: {streak.longest_streak}</div>
                  <div>Week: {streak.weekly_progress}/{streak.weekly_goal}</div>
                </div>
              </div>
            </div>
          )}

          {/* Achievement Summary */}
          {achievements.length > 0 && (
            <div 
              className="p-3 rounded-lg"
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <Trophy className="w-4 h-4" style={{ color: '#0ea5e9' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Achievements
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold" style={{ color: '#0ea5e9' }}>
                  {achievements.length}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {achievements.length === 9 ? 'All unlocked! 🎉' : `${achievements.length}/9 unlocked`}
                </div>
              </div>
            </div>
          )}

          {/* Basic Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div 
              className="p-3 rounded-lg text-center"
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                {userDocuments.length}
              </div>
              <div 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Documents
              </div>
            </div>
            
            <div 
              className="p-3 rounded-lg text-center"
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-secondary)' }}
              >
                47
              </div>
              <div 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Annotations
              </div>
            </div>
          </div>
              </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Recent Activity
              </h3>
              <button
                onClick={() => toggleSection('activity')}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {sectionsExpanded.activity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {sectionsExpanded.activity && (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-yellow)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Added annotation to Research Paper
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  2 hours ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-blue)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Created new note in Literature Review
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  4 hours ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-highlight-green)' }}
              />
              <div className="flex-1">
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Completed Methodology Notes
                </p>
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  1 day ago
                </p>
              </div>
            </div>
              </div>
            )}
          </div>

          {/* Achievements Panel */}
          {user && (
            <div className="mt-6">
              <AchievementPanel userId={user.id} />
            </div>
          )}
        </div>
      </aside>

      {/* Pomodoro Dashboard Modal */}
      {user && (
        <PomodoroDashboard 
          isOpen={showPomodoroDashboard}
          onClose={() => setShowPomodoroDashboard(false)}
        />
      )}

      {/* Related Documents Modals */}
      {currentDocument && (
        <>
          <AddRelatedDocumentModal
            isOpen={showAddRelatedModal}
            onClose={() => setShowAddRelatedModal(false)}
            sourceDocumentId={currentDocument.id}
            onRelationshipCreated={handleRelationshipCreated}
          />
          
          {selectedRelationship && (
            <DocumentPreviewModal
              isOpen={showPreviewModal}
              onClose={() => {
                setShowPreviewModal(false)
                setSelectedRelationship(null)
              }}
              relationship={selectedRelationship}
              onEditRelationship={(relationshipId) => {
                // TODO: Implement edit relationship functionality
                console.log('Edit relationship:', relationshipId)
              }}
              onDeleteRelationship={handleDeleteRelationship}
            />
          )}
        </>
      )}
    </>
  )
}
