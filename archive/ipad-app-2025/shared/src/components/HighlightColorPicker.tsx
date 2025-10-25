import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../themes/ThemeProvider';

interface HighlightColorPickerProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onColorSelect: (colorId: string, colorHex: string) => void;
  onCancel: () => void;
}

export const HighlightColorPicker: React.FC<HighlightColorPickerProps> = ({
  isOpen,
  position,
  onColorSelect,
  onCancel,
}) => {
  const { annotationColors } = useTheme();
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onCancel]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!isOpen || !pickerRef.current) return;

    const picker = pickerRef.current;
    const rect = picker.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Adjust horizontal position
    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }
    if (adjustedX < 10) {
      adjustedX = 10;
    }

    // Adjust vertical position
    if (rect.bottom > viewportHeight) {
      adjustedY = position.y - rect.height - 20; // Show above selection
    }
    if (adjustedY < 10) {
      adjustedY = 10;
    }

    picker.style.left = `${adjustedX}px`;
    picker.style.top = `${adjustedY}px`;
  }, [isOpen, position]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="fixed z-40 shadow-lg rounded-lg p-3"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Choose Color
        </span>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-opacity-10"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Color Grid */}
      <div className="grid grid-cols-3 gap-2 min-w-[200px]">
        {annotationColors.map((colorItem) => (
          <button
            key={colorItem.id}
            onClick={() => onColorSelect(colorItem.id, colorItem.color)}
            className="flex flex-col items-center p-2 rounded-lg transition-all hover:scale-105"
            style={{
              backgroundColor: colorItem.bgOpacity,
              border: `2px solid ${colorItem.color}`,
            }}
            title={colorItem.name}
          >
            <div
              className="w-8 h-8 rounded-full mb-1"
              style={{ backgroundColor: colorItem.color }}
            />
            <span
              className="text-xs truncate max-w-full"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {colorItem.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

