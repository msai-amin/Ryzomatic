import React, { useState } from 'react';
import { FileText, ListOrdered, Network, Table, Box, FileEdit, X, ChevronLeft, ChevronRight } from 'lucide-react';

const templates = [
  {
    type: 'cornell' as const,
    name: 'Cornell Notes',
    icon: FileText,
    description: 'Cue column + Notes area + Summary',
    whenToUse: [
      'Academic reading and textbooks',
      'Lecture notes',
      'Study materials',
      'Content that needs active recall',
    ],
    structure: `┌───────────────┬───────────────┐
│ Cue Column    │ Notes Area    │
│               │               │
│ Questions,    │ Detailed      │
│ Keywords      │ Information   │
└───────────────┴───────────────┘
         Summary Section`,
    example: `CUE: "What is photosynthesis?"
NOTES: Process where plants convert light energy into chemical energy (glucose). Occurs in chloroplasts.
SUMMARY: Photosynthesis: CO2 + H2O → glucose using sunlight in chloroplasts.`,
    tips: [
      'Keep cues short (questions or keywords)',
      'Take detailed notes in the center section',
      'Write summary after reviewing the material',
      'Use cues for active recall practice',
    ],
  },
  {
    type: 'outline' as const,
    name: 'Outline',
    icon: ListOrdered,
    description: 'Hierarchical structure',
    whenToUse: [
      'Structured documents',
      'Legal or technical content',
      'Chapters with clear hierarchy',
      'Content with multiple levels',
    ],
    structure: `I. Main Topic
   A. Subtopic 1
      1. Detail
      2. Detail
   B. Subtopic 2
II. Another Topic`,
    example: `I. Introduction to AI
   A. Definition
      1. Machine learning
      2. Neural networks
   B. History
      1. 1950s: Dartmouth Conference
      2. 2010s: Deep learning boom
II. Applications`,
    tips: [
      'Use consistent numbering (I, A, 1, a, i)',
      'Keep equal levels at the same depth',
      'Main topics should be parallel in importance',
      'Use indentation for visual hierarchy',
    ],
  },
  {
    type: 'mindmap' as const,
    name: 'Mind Map',
    icon: Network,
    description: 'Central topic with branches',
    whenToUse: [
      'Brainstorming sessions',
      'Concept relationships',
      'Visual learning',
      'Breaking down complex topics',
    ],
    structure: `       Central Topic
         │
    ┌────┼────┐
    ▼    ▼    ▼
Branch Branch Branch
  │      │      │
  ▼      ▼      ▼
Sub-   Sub-   Sub-`,
    example: `      Artificial Intelligence
         │
    ┌────┼────┐
    ▼    ▼    ▼
Machine  Deep  NLP
Learning Learning
  │      │      │
  ▼      ▼      ▼
Super-  Neural Natural
vised  NetworksLanguage`,
    tips: [
      'Start with a clear central topic',
      'Use 3-5 main branches maximum',
      'Keep branch labels short',
      'Use colors and images for visual memory',
      'Connect related concepts with arrows',
    ],
  },
  {
    type: 'chart' as const,
    name: 'Chart',
    icon: Table,
    description: 'Comparison table',
    whenToUse: [
      'Comparing multiple items',
      'Analyzing different options',
      'Finding patterns in data',
      'Decision-making',
    ],
    structure: `│ Feature │ Item A │ Item B │
├──────────┼─────────┼─────────┤
│ Feature1 │   ✓    │    ✗   │
│ Feature2 │   ✗    │    ✓   │`,
    example: `│         │Electric│ Hybrid │ Gas │
├─────────┼─────────┼─────────┤
│ Cost    │  High   │Medium   │ Low  │
│ Emissions│  Zero   │   Low   │ High │
│ Range   │ 300 mi  │ 500 mi  │400 mi│`,
    tips: [
      'Identify comparison criteria first',
      'Use checkmarks (✓) or X (✗) for binary data',
      'Keep the table simple and scannable',
      'Use clear headers for rows and columns',
    ],
  },
  {
    type: 'boxing' as const,
    name: 'Boxed Concepts',
    icon: Box,
    description: 'Grouped concepts in boxes',
    whenToUse: [
      'Distinct topics or themes',
      'Separating different concepts',
      'Visual organization',
      'Quick reference',
    ],
    structure: `┌─ Concept 1 ─────┐  ┌─ Concept 2 ─────┐
│ • Point 1    │  │ • Point 1    │
│ • Point 2    │  │ • Point 2    │
│ • Point 3    │  │ • Point 3    │
└──────────────┘  └──────────────┘`,
    example: `┌─ Study Methods ─────┐
│ • Active recall       │
│ • Spaced repetition   │
│ • Interleaving        │
└───────────────────────┘

┌─ Memory Techniques ────┐
│ • Mnemonics           │
│ • Visualization       │
│ • Chunking            │
└───────────────────────┘`,
    tips: [
      'Group related concepts together',
      'Keep each box focused on one main idea',
      'Use bullet points within each box',
      'Limit to 3-4 boxes per page',
    ],
  },
  {
    type: 'freeform' as const,
    name: 'Blank Text Note',
    icon: FileEdit,
    description: 'Simple freeform text',
    whenToUse: [
      'Quick notes',
      'Personal annotations',
      'Creative writing',
      'Flexible content',
    ],
    structure: `Just start writing...
     
     
     
     
Your notes here`,
    example: `Meeting Notes - AI Research Team
Date: 2024-01-15

Discussed new language models...
Quick thoughts...
Action items:

- Review papers
- Set up testing environment`,
    tips: [
      'No structure restrictions',
      'Perfect for brainstorming',
      'Write as you think',
      'Add formatting as needed',
    ],
  },
];

interface NoteTemplateHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoteTemplateHelpModal: React.FC<NoteTemplateHelpModalProps> = ({ isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen) return null;

  const currentTemplate = templates[currentIndex];
  const Icon = currentTemplate.icon;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? templates.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === templates.length - 1 ? 0 : prev + 1));
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center space-x-4">
            <Icon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h2 className="text-xl font-semibold">{currentTemplate.name}</h2>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {currentIndex + 1} of {templates.length}
            </span>
          </div>
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
          {/* Description */}
          <div className="mb-6">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {currentTemplate.description}
            </p>
          </div>

          {/* When to Use */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">When to Use</h3>
            <ul className="space-y-2">
              {currentTemplate.whenToUse.map((useCase, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{useCase}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Structure */}
          <div className="mb-6 p-4 rounded-lg bg-gray-50 border">
            <h3 className="text-lg font-semibold mb-3">Structure</h3>
            <pre className="text-xs font-mono whitespace-pre" style={{ color: 'var(--color-text-secondary)' }}>
              {currentTemplate.structure}
            </pre>
          </div>

          {/* Example */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Example</h3>
            <div 
              className="p-4 rounded-lg border-2"
              style={{ 
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {currentTemplate.example}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Tips for Best Results</h3>
            <ul className="space-y-2">
              {currentTemplate.tips.map((tip, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">💡</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer with Navigation */}
        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={goToPrevious}
            className="flex items-center space-x-2 px-4 py-2 rounded-md transition-colors"
            style={{ 
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex space-x-2">
            {templates.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'w-6' : ''
                }`}
                style={{
                  backgroundColor: index === currentIndex ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            className="flex items-center space-x-2 px-4 py-2 rounded-md transition-colors"
            style={{ 
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
            }}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

