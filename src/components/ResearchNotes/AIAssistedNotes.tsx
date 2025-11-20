import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { notesService } from '../../services/notesService';
import { Tooltip } from '../Tooltip';

const noteTypes = [
  { value: 'cornell', label: 'Cornell Notes' },
  { value: 'outline', label: 'Outline' },
  { value: 'mindmap', label: 'Mind Map' },
  { value: 'chart', label: 'Chart' },
  { value: 'boxing', label: 'Boxed Concepts' },
] as const;

interface AIAssistedNotesProps {
  onNotesGenerated: () => void;
}

export const AIAssistedNotes: React.FC<AIAssistedNotesProps> = ({ onNotesGenerated }) => {
  const { user, currentDocument, studyMode, setStudyMode } = useAppStore();
  const [selectedNoteType, setSelectedNoteType] = useState<'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing'>('cornell');
  const [userGoal, setUserGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState('');

  const handleGenerate = async () => {
    if (!currentDocument || !user) {
      console.error('Cannot generate notes: missing document or user');
      return;
    }

    setIsGenerating(true);
    setGeneratedNotes('');

    try {
      // Enable study mode
      setStudyMode(true);

      const { data, error } = await notesService.generateAINote(
        currentDocument,
        selectedNoteType,
        userGoal || 'General study and comprehension',
        user.id,
        (user.tier || 'free') as 'free' | 'custom'
      );

      if (error) {
        console.error('Error generating notes:', error);
        setGeneratedNotes('Failed to generate notes. Please try again.');
      } else if (data) {
        setGeneratedNotes(data);
      }
    } catch (error) {
      console.error('Exception generating notes:', error);
      setGeneratedNotes('An error occurred while generating notes.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!currentDocument || !user || !generatedNotes) {
      return;
    }

    try {
      const { data, error } = await notesService.createNote(
        user.id,
        currentDocument.id,
        1, // Default to page 1, can be made dynamic
        generatedNotes,
        selectedNoteType,
        undefined, // metadata
        true, // is_ai_generated
      );

      if (error) {
        console.error('Error saving notes:', error);
      } else {
        console.log('Notes saved successfully');
        setGeneratedNotes('');
        onNotesGenerated();
      }
    } catch (error) {
      console.error('Exception saving notes:', error);
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
        AI-Assisted Notes
      </h3>
      
      <div className="space-y-3">
        {/* Note Type Selector */}
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
            Note Type
          </label>
          <select
            value={selectedNoteType}
            onChange={(e) => setSelectedNoteType(e.target.value as any)}
            className="w-full p-2 text-sm rounded border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {noteTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* User Goal Input */}
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
            Your Goal (optional)
          </label>
          <input
            type="text"
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            placeholder="e.g., Studying for exam, writing essay..."
            className="w-full p-2 text-sm rounded border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Generate Button */}
        <Tooltip content="Generate notes using AI with SQ3R framework" position="left">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 p-2 rounded transition-colors disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Notes</span>
              </>
            )}
          </button>
        </Tooltip>

        {/* Generated Notes Preview */}
        {generatedNotes && (
          <div
            className="mt-3 p-3 rounded-lg border overflow-auto max-h-48"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <div className="text-xs mb-2 font-medium">Preview:</div>
            <div className="text-xs whitespace-pre-wrap">{generatedNotes.substring(0, 500)}...</div>
            <button
              onClick={handleSaveNotes}
              className="mt-2 text-xs px-3 py-1 rounded transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              Save to Notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

