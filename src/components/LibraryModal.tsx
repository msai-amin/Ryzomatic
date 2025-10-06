import { useState, useEffect } from 'react';
import { X, Book, FileText, Music, Trash2, Download, Upload, HardDrive, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { storageService, SavedBook, Note, SavedAudio } from '../services/storageService';
import { useAppStore } from '../store/appStore';
// import { googleAuthService } from '../services/googleAuthService';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LibraryModal({ isOpen, onClose }: LibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'books' | 'notes' | 'audio'>('books');
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audio, setAudio] = useState<SavedAudio[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, max: 0, percentage: 0 });
  const [isGoogleDriveEnabled, setIsGoogleDriveEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ lastSync: Date | null; isEnabled: boolean }>({ lastSync: null, isEnabled: false });
  const { /* setCurrentDocument, */ addDocument } = useAppStore();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setBooks(storageService.getAllBooks());
    setNotes(storageService.getAllNotes());
    setAudio(await storageService.getAllAudio());
    setStorageInfo(storageService.getStorageInfo());
    
    // Check Google Drive status
    const isEnabled = await storageService.isGoogleDriveEnabled();
    setIsGoogleDriveEnabled(isEnabled);
    
    const status = await storageService.getSyncStatus();
    setSyncStatus(status);
  };

  const handleOpenBook = (book: SavedBook) => {
    const doc = {
      id: book.id,
      name: book.title,
      content: typeof book.fileData === 'string' ? book.fileData : '',
      type: book.type,
      uploadedAt: book.savedAt,
      pdfData: book.type === 'pdf' ? book.fileData as ArrayBuffer : undefined,
      totalPages: book.totalPages,
      pageTexts: book.pageTexts, // Include pageTexts for TTS functionality
    };
    addDocument(doc);
    onClose();
  };

  const handleDeleteBook = (id: string) => {
    if (confirm('Are you sure you want to delete this book and all its notes?')) {
      storageService.deleteBook(id);
      loadData();
    }
  };

  const handleDeleteNote = (id: string) => {
    if (confirm('Delete this note?')) {
      storageService.deleteNote(id);
      loadData();
    }
  };

  const handleDeleteAudio = async (id: string) => {
    if (confirm('Delete this audio file?')) {
      await storageService.deleteAudio(id);
      loadData();
    }
  };

  const handleExportData = () => {
    const data = storageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-reader-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result as string;
          storageService.importData(data);
          loadData();
          alert('Data imported successfully!');
        } catch (error) {
          alert('Failed to import data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePlayAudio = (audio: SavedAudio) => {
    const url = URL.createObjectURL(audio.audioBlob);
    const audioElement = new Audio(url);
    audioElement.play();
  };

  const handleDownloadAudio = (audio: SavedAudio) => {
    const url = URL.createObjectURL(audio.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${audio.title}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncToGoogleDrive = async () => {
    if (!isGoogleDriveEnabled) {
      alert('Please sign in to Google first');
      return;
    }

    setIsSyncing(true);
    try {
      await storageService.syncToGoogleDrive();
      await storageService.setLastSyncTime();
      await loadData(); // Refresh data
      alert('Successfully synced to Google Drive!');
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromGoogleDrive = async () => {
    if (!isGoogleDriveEnabled) {
      alert('Please sign in to Google first');
      return;
    }

    setIsSyncing(true);
    try {
      await storageService.syncFromGoogleDrive();
      await storageService.setLastSyncTime();
      await loadData(); // Refresh data
      alert('Successfully synced from Google Drive!');
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">📚 My Library</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6">
            <button
              onClick={() => setActiveTab('books')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'books'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Book className="w-4 h-4" />
                <span>Books ({books.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'notes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Notes ({notes.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'audio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>Audio ({audio.length})</span>
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {activeTab === 'books' && (
              <div className="space-y-3">
                {books.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No saved books yet</p>
                ) : (
                  books.map(book => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => handleOpenBook(book)}>
                        <h3 className="font-medium text-gray-900">{book.title}</h3>
                        <p className="text-sm text-gray-500">
                          {book.type.toUpperCase()} • {book.totalPages ? `${book.totalPages} pages` : 'Text file'}
                          {book.lastReadPage && ` • Last read: Page ${book.lastReadPage}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          Saved {new Date(book.savedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBook(book.id);
                        }}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-3">
                {notes.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No notes yet</p>
                ) : (
                  notes.map(note => (
                    <div
                      key={note.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {note.selectedText && (
                            <p className="text-sm text-gray-500 italic mb-2">
                              "{note.selectedText}"
                            </p>
                          )}
                          <p className="text-gray-900">{note.content}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {note.pageNumber && `Page ${note.pageNumber} • `}
                            {new Date(note.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-3">
                {audio.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No audio files yet</p>
                ) : (
                  audio.map(item => (
                    <div
                      key={item.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{item.title}</h3>
                          <p className="text-sm text-gray-500">
                            Pages {item.pageRange.start}-{item.pageRange.end} • {item.voiceName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handlePlayAudio(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Music className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadAudio(item)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAudio(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {/* Storage Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">
                  Storage: {(storageInfo.used / 1024 / 1024).toFixed(2)} MB / {(storageInfo.max / 1024 / 1024).toFixed(0)} MB
                </span>
              </div>
              <div className="text-sm text-gray-600">{storageInfo.percentage}% used</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
              ></div>
            </div>

            {/* Google Drive Sync */}
            {isGoogleDriveEnabled && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Cloud className="w-4 h-4" />
                    <span className="font-medium">Google Drive Sync Enabled</span>
                  </div>
                  {syncStatus.lastSync && (
                    <span className="text-xs text-green-600">
                      Last sync: {syncStatus.lastSync.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncToGoogleDrive}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-700 bg-green-100 border border-green-300 rounded hover:bg-green-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    Upload to Drive
                  </button>
                  <button
                    onClick={handleSyncFromGoogleDrive}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-blue-700 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    Download from Drive
                  </button>
                </div>
              </div>
            )}

            {!isGoogleDriveEnabled && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <CloudOff className="w-4 h-4" />
                  <span>Google Drive sync not enabled</span>
                </div>
                <p className="text-xs text-gray-500">
                  Sign in to Google to sync your books, notes, and audio files across devices
                </p>
              </div>
            )}

            {/* Export/Import */}
            <div className="flex gap-2">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export Data
              </button>
              <label className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                Import Data
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
