import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Save, Trash2, FileText, Cloud, Edit2, Check, 
  Search, Filter, Download, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Plus, Bookmark
} from 'lucide-react';
import { storageService, Note } from '../services/storageService';
import { googleIntegrationService } from '../services/googleIntegrationService';
import { simpleGoogleAuth } from '../services/simpleGoogleAuth';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bookName: string;
  bookId: string;
  currentPage: number;
  selectedText?: string;
}

export function NotesPanel({ 
  isOpen, 
  onClose, 
  bookName, 
  bookId, 
  currentPage, 
  selectedText 
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'current'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (editingNoteId) {
          setEditingNoteId(null);
          setEditContent('');
        } else {
          onClose();
        }
      }
      
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingNoteId, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen, bookId, currentPage, filter]);

  // Pre-fill with selected text if available
  useEffect(() => {
    if (selectedText && isOpen) {
      setNewNoteContent(selectedText);
    }
  }, [selectedText, isOpen]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    if (newNoteContent.trim() && hasUnsavedChanges) {
      const timeout = setTimeout(() => {
        handleCreateNote();
      }, 2000); // Auto-save after 2 seconds of inactivity
      setAutoSaveTimeout(timeout);
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [newNoteContent, hasUnsavedChanges]);

  const loadNotes = () => {
    const allNotes = storageService.getAllNotes();
    let bookNotes = allNotes.filter(note => note.bookId === bookId);
    
    if (filter === 'current') {
      bookNotes = bookNotes.filter(note => note.pageNumber === currentPage);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      bookNotes = bookNotes.filter(note => 
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.selectedText && note.selectedText.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setNotes(bookNotes);
  };

  // Filter notes based on search query
  const filteredNotes = notes.filter(note => {
    if (!searchQuery.trim()) return true;
    return note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (note.selectedText && note.selectedText.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const handleContentChange = (content: string) => {
    setNewNoteContent(content);
    setHasUnsavedChanges(true);
  };

  const exportNotes = () => {
    const notesText = notes.map(note => 
      `Page ${note.pageNumber} - ${new Date(note.createdAt).toLocaleDateString()}\n${note.content}\n${note.selectedText ? `Selected: "${note.selectedText}"` : ''}\n---\n`
    ).join('\n');
    
    const blob = new Blob([notesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookName}-notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsSaving(true);
    try {
      const note: Note = {
        id: crypto.randomUUID(),
        bookId,
        bookName,
        pageNumber: currentPage,
        content: newNoteContent,
        selectedText: selectedText || undefined,
        createdAt: new Date(),
      };

      // Save locally
      storageService.saveNote(note);

      // Save to Google Docs if user is signed in
      if (simpleGoogleAuth.isSignedIn()) {
        try {
          console.log('Creating Google Doc for note...');
          const docResult = await googleIntegrationService.createNoteDocument(
            bookName,
            currentPage,
            newNoteContent
          );
          console.log('Note saved to Google Docs:', docResult.url);
          
          // Update note with Google Doc ID
          note.googleDocId = docResult.docId;
          note.googleDocUrl = docResult.url;
          storageService.saveNote(note);
        } catch (error) {
          console.error('Failed to save to Google Docs:', error);
          // Still save locally even if Google Docs fails
        }
      }

      setNewNoteContent('');
      setHasUnsavedChanges(false);
      loadNotes();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (note: Note) => {
    if (!editContent.trim()) return;

    setIsSaving(true);
    try {
      const updatedNote = {
        ...note,
        content: editContent,
        lastModified: new Date(),
      };

      // Save locally
      storageService.saveNote(updatedNote);

      // Update Google Doc if it exists
      if (note.googleDocId && simpleGoogleAuth.isSignedIn()) {
        try {
          await googleIntegrationService.updateNoteDocument(
            note.googleDocId,
            editContent,
            note.pageNumber
          );
          console.log('Note updated in Google Docs');
        } catch (error) {
          console.error('Failed to update Google Doc:', error);
        }
      } else if (simpleGoogleAuth.isSignedIn()) {
        // Create new Google Doc if it doesn't exist
        try {
          const docResult = await googleIntegrationService.createNoteDocument(
            note.bookName,
            note.pageNumber,
            editContent
          );
          updatedNote.googleDocId = docResult.docId;
          updatedNote.googleDocUrl = docResult.url;
          storageService.saveNote(updatedNote);
        } catch (error) {
          console.error('Failed to create Google Doc:', error);
        }
      }

      setEditingNoteId(null);
      setEditContent('');
      loadNotes();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!confirm('Delete this note?')) return;

    // Delete from Google Docs if it exists
    if (note.googleDocId && simpleGoogleAuth.isSignedIn()) {
      try {
        await googleIntegrationService.deleteNoteDocument(note.googleDocId);
        console.log('Note deleted from Google Docs');
      } catch (error) {
        console.error('Failed to delete from Google Docs:', error);
      }
    }

    // Delete locally
    storageService.deleteNote(note.id);
    loadNotes();
  };

  if (!isOpen) return null;

  const panelWidth = isExpanded ? 'w-[600px]' : 'w-96';
  const panelHeight = isMinimized ? 'h-16' : 'h-full';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-40 transition-opacity duration-200"
        onClick={onClose}
      />
      
      {/* Notes Panel */}
      <div 
        ref={panelRef}
        className={`fixed right-0 top-0 ${panelWidth} ${panelHeight} bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
            {hasUnsavedChanges && (
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes" />
            )}
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={isMinimized ? "Restore" : "Minimize"}
            >
              {isMinimized ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        {!isMinimized && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              />
            </div>
            
            {/* Filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm">
                <button
                  onClick={() => setFilter('current')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    filter === 'current'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Page {currentPage}
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  All Pages
                </button>
              </div>
              
              {/* Export Button */}
              {notes.length > 0 && (
                <button
                  onClick={exportNotes}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Export Notes"
                >
                  <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* New Note Form */}
        {!isMinimized && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Note (Page {currentPage})
                </label>
                <div className="flex items-center space-x-2">
                  {simpleGoogleAuth.isSignedIn() && (
                    <div title="Synced with Google Docs">
                      <Cloud className="w-4 h-4 text-green-600" />
                    </div>
                  )}
                  {hasUnsavedChanges && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">Auto-saving...</span>
                  )}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={newNoteContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write your note here... (Ctrl+N to focus)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none dark:bg-gray-800 dark:text-white"
                rows={4}
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteContent.trim() || isSaving}
                  className="flex-1 btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
                </button>
                {newNoteContent.trim() && (
                  <button
                    onClick={() => {
                      setNewNoteContent('');
                      setHasUnsavedChanges(false);
                    }}
                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes List */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredNotes.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>
                  {searchQuery.trim() 
                    ? 'No notes match your search' 
                    : 'No notes yet'
                  }
                </p>
                <p className="text-sm mt-1">
                  {searchQuery.trim() 
                    ? 'Try a different search term'
                    : filter === 'current' 
                      ? 'Create a note for this page' 
                      : 'Create notes as you read'
                  }
                </p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 hover:shadow-md transition-shadow"
                >
                  {editingNoteId === note.id ? (
                    // Edit Mode
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 resize-none dark:bg-gray-700 dark:text-white"
                        rows={4}
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSaveEdit(note)}
                          disabled={isSaving}
                          className="flex-1 btn-primary text-sm py-1 flex items-center justify-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditContent('');
                          }}
                          className="flex-1 btn-ghost text-sm py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      {note.selectedText && (
                        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400 rounded">
                          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                            "{note.selectedText}"
                          </p>
                        </div>
                      )}
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>Page {note.pageNumber}</span>
                          <span>•</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          {note.googleDocUrl && (
                            <>
                              <span>•</span>
                              <a
                                href={note.googleDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                              >
                                <Cloud className="w-3 h-3" />
                                <span>View in Docs</span>
                              </a>
                            </>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditNote(note)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          >
                            <Edit2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

