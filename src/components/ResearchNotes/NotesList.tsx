import React, { useState, useEffect } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { notesService, NoteWithMetadata } from '../../services/notesService';
import { NoteEditorModal } from './NoteEditorModal';

interface NotesListProps {
  onNoteSelected: (note: NoteWithMetadata) => void;
  refreshTrigger?: number;
}

export const NotesList: React.FC<NotesListProps> = ({ onNoteSelected, refreshTrigger }) => {
  const { user, currentDocument } = useAppStore();
  const [notes, setNotes] = useState<NoteWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<NoteWithMetadata | null>(null);

  useEffect(() => {
    loadNotes();
  }, [currentDocument?.id, refreshTrigger]);

  const loadNotes = async () => {
    if (!currentDocument || !user) {
      return;
    }

    setIsLoading(true);
    const { data, error } = await notesService.getNotesForBook(user.id, currentDocument.id);

    if (error) {
      console.error('Error loading notes:', error);
    } else if (data) {
      setNotes(data);
    }

    setIsLoading(false);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    const { error } = await notesService.deleteNote(noteId);
    if (error) {
      console.error('Error deleting note:', error);
    } else {
      await loadNotes();
    }
  };

  const handleViewNote = (note: NoteWithMetadata) => {
    setEditingNote(note);
  };

  const handleEditorClose = () => {
    setEditingNote(null);
  };

  const handleEditorSave = async () => {
    await loadNotes();
  };

  const handleEditorDelete = async () => {
    await loadNotes();
  };

  if (isLoading) {
    return (
      <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="text-xs">Loading notes...</div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          No notes yet. Create your first note!
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="p-3 rounded-lg border transition-colors hover:shadow-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {(note.note_metadata as any)?.title ? (
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    {(note.note_metadata as any).title}
                  </div>
                ) : null}
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {note.note_type ? note.note_type.charAt(0).toUpperCase() + note.note_type.slice(1) : 'Note'} - Page {note.page_number}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewNote(note)}
                  className="p-1 rounded transition-colors hover:bg-opacity-50"
                  style={{ color: 'var(--color-primary)' }}
                  title="Edit note"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1 rounded transition-colors hover:bg-opacity-50"
                  style={{ color: '#ef4444' }}
                  title="Delete note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
              {note.content}
            </div>
          </div>
        ))}
      </div>

      {/* Note Editor Modal */}
      <NoteEditorModal
        isOpen={!!editingNote}
        onClose={handleEditorClose}
        note={editingNote}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />
    </>
  );
};

