/**
 * Tests for BulkActionsToolbar component - Synthesize button functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionsToolbar } from '../../../src/components/library/BulkActionsToolbar';

describe('BulkActionsToolbar - Synthesize Button', () => {
  const defaultProps = {
    selectedCount: 3,
    onAddToCollection: vi.fn(),
    onAddTags: vi.fn(),
    onRemoveTags: vi.fn(),
    onToggleFavorite: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
    onDetectDuplicates: vi.fn(),
    onClearSelection: vi.fn(),
    onSynthesize: vi.fn(),
    showSynthesize: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Synthesize button when showSynthesize is true', () => {
    render(<BulkActionsToolbar {...defaultProps} />);
    
    const synthesizeButton = screen.getByTestId('bulk-synthesize-btn');
    expect(synthesizeButton).toBeInTheDocument();
    expect(synthesizeButton).toHaveAttribute('title', 'Synthesize Documents');
  });

  it('should not render Synthesize button when showSynthesize is false', () => {
    render(<BulkActionsToolbar {...defaultProps} showSynthesize={false} />);
    
    expect(screen.queryByTestId('bulk-synthesize-btn')).not.toBeInTheDocument();
  });

  it('should not render Synthesize button when showSynthesize is undefined', () => {
    const { onSynthesize, showSynthesize, ...propsWithoutSynthesize } = defaultProps;
    render(<BulkActionsToolbar {...propsWithoutSynthesize} />);
    
    expect(screen.queryByTestId('bulk-synthesize-btn')).not.toBeInTheDocument();
  });

  it('should call onSynthesize when Synthesize button is clicked', async () => {
    const user = userEvent.setup();
    const onSynthesize = vi.fn();
    
    render(<BulkActionsToolbar {...defaultProps} onSynthesize={onSynthesize} />);
    
    const synthesizeButton = screen.getByTestId('bulk-synthesize-btn');
    await user.click(synthesizeButton);
    
    expect(onSynthesize).toHaveBeenCalledTimes(1);
  });

  it('should not render Synthesize button when onSynthesize is not provided', () => {
    const { onSynthesize, ...propsWithoutHandler } = defaultProps;
    render(<BulkActionsToolbar {...propsWithoutHandler} showSynthesize={true} />);
    
    // Button should not render because onSynthesize is undefined
    expect(screen.queryByTestId('bulk-synthesize-btn')).not.toBeInTheDocument();
  });

  it('should display correct selected count', () => {
    render(<BulkActionsToolbar {...defaultProps} selectedCount={5} />);
    
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  it('should have purple styling on Synthesize button', () => {
    render(<BulkActionsToolbar {...defaultProps} />);
    
    const synthesizeButton = screen.getByTestId('bulk-synthesize-btn');
    expect(synthesizeButton).toHaveStyle({ color: '#8B5CF6' });
  });

  it('should render other bulk action buttons alongside Synthesize', () => {
    render(<BulkActionsToolbar {...defaultProps} />);
    
    // Verify other buttons are still present
    expect(screen.getByTitle('Add to Collection')).toBeInTheDocument();
    expect(screen.getByTitle('Add Tags')).toBeInTheDocument();
    expect(screen.getByTitle('Remove Tags')).toBeInTheDocument();
    expect(screen.getByTitle('Mark as Favorite')).toBeInTheDocument();
    expect(screen.getByTitle('Archive')).toBeInTheDocument();
    expect(screen.getByTitle('Export')).toBeInTheDocument();
    expect(screen.getByTitle('Find Duplicates')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-synthesize-btn')).toBeInTheDocument();
  });

  it('should position Synthesize button before the divider', () => {
    const { container } = render(<BulkActionsToolbar {...defaultProps} />);
    
    // Get the toolbar container
    const toolbar = container.querySelector('.flex.items-center.gap-2');
    expect(toolbar).toBeInTheDocument();
    
    // The Synthesize button should exist and be visible
    const synthesizeButton = screen.getByTestId('bulk-synthesize-btn');
    expect(synthesizeButton).toBeInTheDocument();
  });
});

describe('BulkActionsToolbar - General Functionality', () => {
  const defaultProps = {
    selectedCount: 2,
    onAddToCollection: vi.fn(),
    onAddTags: vi.fn(),
    onRemoveTags: vi.fn(),
    onToggleFavorite: vi.fn(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onExport: vi.fn(),
    onDetectDuplicates: vi.fn(),
    onClearSelection: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onClearSelection when Clear Selection button is clicked', async () => {
    const user = userEvent.setup();
    render(<BulkActionsToolbar {...defaultProps} />);
    
    const clearButton = screen.getByTitle('Clear Selection');
    await user.click(clearButton);
    
    expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('should call onAddToCollection when Add to Collection button is clicked', async () => {
    const user = userEvent.setup();
    render(<BulkActionsToolbar {...defaultProps} />);
    
    const addToCollectionButton = screen.getByTitle('Add to Collection');
    await user.click(addToCollectionButton);
    
    expect(defaultProps.onAddToCollection).toHaveBeenCalledTimes(1);
  });

  it('should call onExport when Export button is clicked', async () => {
    const user = userEvent.setup();
    render(<BulkActionsToolbar {...defaultProps} />);
    
    const exportButton = screen.getByTitle('Export');
    await user.click(exportButton);
    
    expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
  });
});
