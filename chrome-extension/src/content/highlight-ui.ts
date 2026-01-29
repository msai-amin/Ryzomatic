/**
 * Ryzomatic Chrome Extension - Highlight UI Module
 * Injected separately for web_accessible_resources
 */

import { HIGHLIGHT_COLORS } from '../shared/types';

export { HIGHLIGHT_COLORS };

// This module can be used for additional highlight-related functionality
// that needs to be loaded as a web accessible resource

export function applyHighlight(element: HTMLElement, colorHex: string): void {
  element.style.backgroundColor = colorHex;
  element.style.borderRadius = '2px';
  element.classList.add('ryzomatic-highlight');
}

export function removeHighlight(element: HTMLElement): void {
  element.style.backgroundColor = '';
  element.style.borderRadius = '';
  element.classList.remove('ryzomatic-highlight');
}

export function getHighlightColor(colorId: string): string {
  const color = HIGHLIGHT_COLORS.find((c) => c.id === colorId);
  return color?.hex || HIGHLIGHT_COLORS[0].hex;
}

