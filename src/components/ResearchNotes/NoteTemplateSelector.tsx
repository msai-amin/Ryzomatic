import React from 'react';
import { FileText, ListOrdered, Network, Table, Box } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Tooltip } from '../Tooltip';

const templates = [
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

interface NoteTemplateSelectorProps {
  onSelectTemplate: (type: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => void;
}

export const NoteTemplateSelector: React.FC<NoteTemplateSelectorProps> = ({ onSelectTemplate }) => {
  const { noteTemplateType, setNoteTemplateType } = useAppStore();

  const handleSelect = (type: 'cornell' | 'outline' | 'mindmap' | 'chart' | 'boxing') => {
    setNoteTemplateType(type);
    onSelectTemplate(type);
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
        Create Note
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => {
          const Icon = template.icon;
          const isSelected = noteTemplateType === template.type;
          
          return (
            <Tooltip key={template.type} content={template.description} position="left">
              <button
                onClick={() => handleSelect(template.type)}
                className={`p-3 rounded-lg border transition-all ${
                  isSelected ? 'shadow-md' : 'hover:shadow-sm'
                }`}
                style={{
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  borderColor: isSelected ? '#3b82f6' : 'var(--color-border)',
                  color: isSelected ? '#3b82f6' : 'var(--color-text-primary)',
                }}
              >
                <Icon className="w-6 h-6 mx-auto mb-1" />
                <div className="text-xs font-medium">{template.name}</div>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

