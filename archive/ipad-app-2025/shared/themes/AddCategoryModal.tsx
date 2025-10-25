import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { AnnotationColor } from './ThemeProvider';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newColor: Omit<AnnotationColor, 'id'>) => void;
  existingColors: AnnotationColor[];
}

// Suggested colors that users might want to use
const suggestedColors = [
  '#FF69B4', // Hot Pink
  '#9370DB', // Medium Purple
  '#FF8C00', // Dark Orange
  '#20B2AA', // Light Sea Green
  '#DC143C', // Crimson
  '#4169E1', // Royal Blue
  '#32CD32', // Lime Green
  '#FF1493', // Deep Pink
  '#00CED1', // Dark Turquoise
  '#FFD700', // Gold
];

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingColors,
}) => {
  const [colorValue, setColorValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Find a color that's not already in use
      const usedColors = existingColors.map((c) => c.color.toUpperCase());
      const availableColor = suggestedColors.find(
        (c) => !usedColors.includes(c.toUpperCase())
      );
      setColorValue(availableColor || suggestedColors[0]);
      setNameValue('');
      setError('');
    }
  }, [isOpen, existingColors]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!nameValue.trim()) {
      setError('Category name cannot be empty');
      return;
    }

    // Check if name already exists
    const nameExists = existingColors.some(
      (c) => c.name.toLowerCase() === nameValue.trim().toLowerCase()
    );
    if (nameExists) {
      setError('A category with this name already exists');
      return;
    }

    // Calculate bgOpacity from the color
    const rgb = hexToRgb(colorValue);
    const bgOpacity = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` : 'rgba(0, 0, 0, 0.1)';

    // Generate a value slug from the name
    const value = nameValue.trim().toLowerCase().replace(/\s+/g, '-');

    onAdd({
      color: colorValue,
      name: nameValue.trim(),
      value,
      bgOpacity,
    });
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="rounded-lg shadow-xl max-w-md w-full"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Add New Category
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-opacity-10 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Color Picker */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={colorValue}
                onChange={(e) => setColorValue(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-2"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
            {/* Color suggestions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {suggestedColors.map((suggestedColor) => (
                <button
                  key={suggestedColor}
                  onClick={() => setColorValue(suggestedColor)}
                  className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: suggestedColor,
                    borderColor:
                      colorValue.toUpperCase() === suggestedColor.toUpperCase()
                        ? 'var(--color-primary)'
                        : 'var(--color-border)',
                  }}
                  title={suggestedColor}
                />
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Category Name
            </label>
            <input
              type="text"
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: error ? 'var(--color-error)' : 'var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              placeholder="e.g., Important Quotes, References, etc."
            />
            {error && (
              <p className="mt-1 text-sm" style={{ color: 'var(--color-error)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Preview */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Preview
            </label>
            <div
              className="flex items-center space-x-3 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--color-background-secondary)' }}
            >
              <div
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: colorValue,
                  border: '2px solid var(--color-border)',
                }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {nameValue || 'Category Name'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end space-x-2 p-6 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg transition-colors text-sm"
            style={{
              backgroundColor: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

