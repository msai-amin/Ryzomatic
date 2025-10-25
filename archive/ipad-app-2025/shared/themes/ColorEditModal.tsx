import React, { useState, useEffect } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';
import { AnnotationColor } from './ThemeProvider';

interface ColorEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  color: AnnotationColor;
  onSave: (id: string, updatedColor: Partial<AnnotationColor>) => void;
  onDelete?: (id: string) => void;
  onReset?: (id: string) => void;
  isDefault: boolean;
}

export const ColorEditModal: React.FC<ColorEditModalProps> = ({
  isOpen,
  onClose,
  color,
  onSave,
  onDelete,
  onReset,
  isDefault,
}) => {
  const [colorValue, setColorValue] = useState(color.color);
  const [nameValue, setNameValue] = useState(color.name);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setColorValue(color.color);
      setNameValue(color.name);
      setError('');
    }
  }, [isOpen, color]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!nameValue.trim()) {
      setError('Category name cannot be empty');
      return;
    }

    // Calculate bgOpacity from the color
    const rgb = hexToRgb(colorValue);
    const bgOpacity = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` : color.bgOpacity;

    onSave(color.id, {
      color: colorValue,
      name: nameValue.trim(),
      bgOpacity,
    });
    onClose();
  };

  const handleReset = () => {
    if (onReset) {
      onReset(color.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(`Are you sure you want to delete "${color.name}"?`)) {
      onDelete(color.id);
      onClose();
    }
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
            Edit Category
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
              placeholder="Enter category name"
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
          className="flex items-center justify-between p-6 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex space-x-2">
            {isDefault && onReset && (
              <button
                onClick={handleReset}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm"
                style={{
                  backgroundColor: 'var(--color-warning)',
                  color: 'white',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            {!isDefault && onDelete && (
              <button
                onClick={handleDelete}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm"
                style={{
                  backgroundColor: 'var(--color-error)',
                  color: 'white',
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
          <div className="flex space-x-2">
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
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg transition-colors text-sm"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
              }}
            >
              Save
            </button>
          </div>
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

