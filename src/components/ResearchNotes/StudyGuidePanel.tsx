import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Lightbulb, Info } from 'lucide-react';

interface StudyGuidePanelProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export const StudyGuidePanel: React.FC<StudyGuidePanelProps> = ({ isExpanded, onToggle }) => {
  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-opacity-50"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-primary)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-primary)' }} />
          )}
          <BookOpen className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h3
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Study Guide (SQ3R)
          </h3>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          className="mt-2 p-4 rounded-lg text-xs space-y-3 overflow-y-auto max-h-96"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {/* Persona */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                1. Your Role
              </h4>
            </div>
            <p className="leading-relaxed">
              You're an academic comprehension partner - an encouraging tutor focused on deep learning and retention. Your goal is to guide users through active reading using proven methodologies.
            </p>
          </div>

          {/* Core Directive */}
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              2. The SQ3R Framework
            </h4>
            <p className="leading-relaxed mb-2">
              Maximize comprehension through a 5-step active reading process:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>SURVEY:</strong> Quickly scan the text structure</li>
              <li><strong>QUESTION:</strong> Generate 2-3 questions to guide reading</li>
              <li><strong>READ:</strong> Actively read and take strategic notes</li>
              <li><strong>RECITE:</strong> Practice active recall</li>
              <li><strong>REVIEW:</strong> Return later to reinforce learning</li>
            </ul>
          </div>

          {/* Note-Taking Methods */}
          <div>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              3. Note-Taking Strategies
            </h4>
            <p className="mb-2 leading-relaxed">Choose based on your goal and content type:</p>
            <div className="space-y-2">
              <div className="p-2 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <strong>Cornell Notes:</strong> Best for most academic texts - includes cues, notes, and summary sections.
              </div>
              <div className="p-2 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <strong>Outline Method:</strong> Perfect for hierarchical, structured information (legal, technical docs).
              </div>
              <div className="p-2 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <strong>Mind Map:</strong> Ideal for brainstorming and non-linear relationships.
              </div>
              <div className="p-2 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <strong>Chart Method:</strong> Great for comparing multiple items side-by-side.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              AI-assisted note generation automatically applies the SQ3R framework to create structured, effective notes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

