import React, { useState } from 'react';
import { FileText, ListOrdered, Network, Table, Box, FileEdit, X, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { Tooltip } from './Tooltip';

const templates = [
  {
    type: 'freeform' as const,
    name: 'Blank Text Note',
    icon: FileEdit,
    description: 'Simple freeform text note. Start writing immediately.',
  },
  {
    type: 'cornell' as const,
    name: 'Cornell Notes',
    icon: FileText,
    description: 'Cue column + Notes area + Summary. Best for most academic texts.',
  },
  {
    type: 'outline' as const,
    name: 'Outline',
    icon: ListOrdered,
    description: 'Hierarchical structure (I, A, 1, a). Great for structured documents.',
  },
  {
    type: 'mindmap' as const,
    name: 'Mind Map',
    icon: Network,
    description: 'Central topic with branches. Perfect for brainstorming.',
  },
  {
    type: 'chart' as const,
    name: 'Chart',
    icon: Table,
    description: 'Comparison table. Ideal for comparing multiple items.',
  },
  {
    type: 'boxing' as const,
    name: 'Boxed Concepts',
    icon: Box,
    description: 'Grouped concepts in boxes. Best for distinct topics.',
  },
];

interface NoteTemplateSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoteTemplateSettings: React.FC<NoteTemplateSettingsProps> = ({ isOpen, onClose }) => {
  const { noteTemplateType, setNoteTemplateType } = useAppStore();
  const [defaultTemplate, setDefaultTemplate] = useState<'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing' | null>(
    noteTemplateType || null
  );
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  const handleSelectTemplate = (type: 'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => {
    setNoteTemplateType(type);
  };

  const handleSetAsDefault = (type: 'freeform' | 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => {
    setDefaultTemplate(type);
    setNoteTemplateType(type);
    localStorage.setItem('defaultNoteTemplate', type);
  };

  const handlePreview = (type: string) => {
    setPreviewTemplate(previewTemplate === type ? null : type);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-xl font-semibold">Note Templates</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Template Grid */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Select a template for your next note
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {templates.map((template) => {
                const Icon = template.icon;
                const isSelected = noteTemplateType === template.type;
                const isDefault = defaultTemplate === template.type;
                
                return (
                  <div
                    key={template.type}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected ? 'shadow-md' : 'hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface)',
                      borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
                    }}
                    onClick={() => handleSelectTemplate(template.type)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-6 h-6" style={{ color: isSelected ? '#3b82f6' : 'var(--color-text-primary)' }} />
                      {isDefault && (
                        <Check className="w-4 h-4" style={{ color: '#3b82f6' }} />
                      )}
                    </div>
                    <div className="text-sm font-medium mb-1" style={{ color: isSelected ? '#3b82f6' : 'var(--color-text-primary)' }}>
                      {template.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {template.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Selection */}
          {noteTemplateType && (
            <div 
              className="mb-6 p-4 rounded-lg"
              style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium mb-1">
                    Currently Selected: {templates.find(t => t.type === noteTemplateType)?.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {templates.find(t => t.type === noteTemplateType)?.description}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSetAsDefault(noteTemplateType)}
                    className="px-4 py-2 text-xs rounded-md transition-colors"
                    style={{
                      backgroundColor: defaultTemplate === noteTemplateType ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                      color: defaultTemplate === noteTemplateType ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                    }}
                  >
                    {defaultTemplate === noteTemplateType ? 'Default' : 'Set as Default'}
                  </button>
                  <button
                    onClick={() => handlePreview(noteTemplateType)}
                    className="px-4 py-2 text-xs rounded-md transition-colors"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                    }}
                  >
                    Preview Example
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewTemplate && (
            <div 
              className="mt-4 p-4 rounded-lg border-2"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
            >
              <h4 className="text-sm font-medium mb-3">Example Preview</h4>
              <div className="text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                {getPreviewExample(previewTemplate)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function getPreviewExample(type: string): string {
  const examples: Record<string, string> = {
    freeform: 'Just start typing your notes here...\n\nYou can add any content you want.',
    cornell: 'CUE COLUMN          │  NOTES AREA\n' +
             '├────────────────────┼─────────────────────\n' +
             'What is X?          │  X is defined as...\n' +
             '                    │  Key points:\n' +
             '                    │  • Point 1\n' +
             '                    │  • Point 2\n' +
             '                    │\n' +
             'SUMMARY:\n' +
             'Brief summary of main concepts.',
    outline: 'I. Main Topic\n' +
             '   A. Subtopic 1\n' +
             '      1. Detail a\n' +
             '      2. Detail b\n' +
             '   B. Subtopic 2\n' +
             '      1. Detail a\n' +
             'II. Second Main Topic',
    mindmap: '      CENTRAL TOPIC\n' +
             '          │\n' +
             '     ┌────┴────┐\n' +
             '     ▼         ▼\n' +
             'Branch 1   Branch 2\n' +
             '     │         │\n' +
             '     ▼         ▼\n' +
             ' Detail 1   Detail 2',
    chart: '  │ Item A │ Item B │ Item C │\n' +
           '─┼─────────┼─────────┼─────────┤\n' +
           'Feature 1 │   ✓    │    ✓    │    ✗   │\n' +
           'Feature 2 │   ✗    │    ✓    │    ✓   │',
    boxing: '┌─ Concept 1 ───────┐\n' +
            '│  • Key point 1    │\n' +
            '│  • Key point 2    │\n' +
            '└───────────────────┘\n\n' +
            '┌─ Concept 2 ───────┐\n' +
            '│  • Key point 1    │\n' +
            '│  • Key point 2    │\n' +
            '└───────────────────┘',
  };
  
  return examples[type] || 'No preview available';
}

