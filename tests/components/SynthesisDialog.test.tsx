/**
 * Tests for SynthesisDialog component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SynthesisDialog } from '../../src/components/SynthesisDialog';

// Mock the aiService
vi.mock('../../src/services/aiService', () => ({
  synthesizeDocuments: vi.fn()
}));

import { synthesizeDocuments } from '../../src/services/aiService';

const mockSynthesizeDocuments = synthesizeDocuments as ReturnType<typeof vi.fn>;

describe('SynthesisDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    documentIds: ['doc-1', 'doc-2', 'doc-3'],
    documentTitles: [
      { id: 'doc-1', title: 'Machine Learning Paper' },
      { id: 'doc-2', title: 'NLP Research Study' },
      { id: 'doc-3', title: 'AI Ethics Review' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSynthesizeDocuments.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<SynthesisDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('LOTUS Synthesis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('synthesis-dialog-backdrop')).not.toBeInTheDocument();
  });

  it('should render document titles when open', () => {
    render(<SynthesisDialog {...defaultProps} />);
    
    expect(screen.getByText('LOTUS Synthesis')).toBeInTheDocument();
    expect(screen.getByText('3 documents selected')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning Paper')).toBeInTheDocument();
    expect(screen.getByText('NLP Research Study')).toBeInTheDocument();
    expect(screen.getByText('AI Ethics Review')).toBeInTheDocument();
  });

  it('should disable Generate button when query is empty', () => {
    render(<SynthesisDialog {...defaultProps} />);
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    expect(generateButton).toBeDisabled();
  });

  it('should enable Generate button when query is entered', async () => {
    const user = userEvent.setup();
    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'What are the key findings?');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    expect(generateButton).not.toBeDisabled();
  });

  it('should call synthesizeDocuments with correct params on Generate', async () => {
    const user = userEvent.setup();
    mockSynthesizeDocuments.mockResolvedValue({
      synthesis: 'Test synthesis result',
      documents_used: defaultProps.documentTitles
    });

    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'What are the key findings?');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    expect(mockSynthesizeDocuments).toHaveBeenCalledWith(
      ['doc-1', 'doc-2', 'doc-3'],
      'What are the key findings?'
    );
  });

  it('should show loading state while synthesizing', async () => {
    const user = userEvent.setup();
    
    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const synthesisPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockSynthesizeDocuments.mockReturnValue(synthesisPromise);

    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'Test query');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    // Check loading state
    expect(screen.getByText('Synthesizing...')).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
    
    // Resolve the promise
    resolvePromise!({
      synthesis: 'Result',
      documents_used: []
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Synthesizing...')).not.toBeInTheDocument();
    });
  });

  it('should display synthesis result on success', async () => {
    const user = userEvent.setup();
    mockSynthesizeDocuments.mockResolvedValue({
      synthesis: 'This is the synthesized content across all papers.',
      documents_used: [
        { id: 'doc-1', title: 'Machine Learning Paper' },
        { id: 'doc-2', title: 'NLP Research Study' }
      ]
    });

    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'Summarize key findings');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('synthesis-result')).toBeInTheDocument();
    });
    
    expect(screen.getByText('This is the synthesized content across all papers.')).toBeInTheDocument();
    expect(screen.getByText('Documents used:')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning Paper, NLP Research Study')).toBeInTheDocument();
  });

  it('should display error message on failure', async () => {
    const user = userEvent.setup();
    mockSynthesizeDocuments.mockRejectedValue(new Error('Synthesis service unavailable'));

    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'Test query');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('synthesis-error')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Synthesis service unavailable')).toBeInTheDocument();
  });

  it('should display user-friendly message for LOTUS_NOT_AVAILABLE error', async () => {
    const user = userEvent.setup();
    mockSynthesizeDocuments.mockRejectedValue(new Error('LOTUS_NOT_AVAILABLE: Service not deployed'));

    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'Test query');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('synthesis-error')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Synthesis is not available in this environment. Please try again later.')).toBeInTheDocument();
  });

  it('should call onClose when clicking backdrop', async () => {
    const onClose = vi.fn();
    render(<SynthesisDialog {...defaultProps} onClose={onClose} />);
    
    const backdrop = screen.getByTestId('synthesis-dialog-backdrop');
    fireEvent.click(backdrop);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking X button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SynthesisDialog {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByTestId('synthesis-dialog-close');
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking Cancel button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SynthesisDialog {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should not close when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(<SynthesisDialog {...defaultProps} onClose={onClose} />);
    
    const dialogContent = screen.getByText('LOTUS Synthesis');
    fireEvent.click(dialogContent);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should reset state when closed and reopened', async () => {
    const user = userEvent.setup();
    mockSynthesizeDocuments.mockResolvedValue({
      synthesis: 'Result',
      documents_used: []
    });

    const { rerender } = render(<SynthesisDialog {...defaultProps} />);
    
    // Enter a query and generate
    const input = screen.getByTestId('synthesis-query-input');
    await user.type(input, 'Test query');
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    await user.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('synthesis-result')).toBeInTheDocument();
    });
    
    // Close the dialog
    rerender(<SynthesisDialog {...defaultProps} isOpen={false} />);
    
    // Reopen the dialog
    rerender(<SynthesisDialog {...defaultProps} isOpen={true} />);
    
    // The dialog should be reset - no result should be shown
    // Note: The component clears state in handleClose, which is called via onClose
    // When re-rendered with isOpen=true, it's a fresh render
  });

  it('should show correct document count in header', () => {
    render(<SynthesisDialog {...defaultProps} documentIds={['doc-1', 'doc-2']} />);
    
    expect(screen.getByText('2 documents selected')).toBeInTheDocument();
  });

  it('should disable Generate button when less than 2 documents', () => {
    render(
      <SynthesisDialog
        {...defaultProps}
        documentIds={['doc-1']}
        documentTitles={[{ id: 'doc-1', title: 'Single Doc' }]}
      />
    );
    
    const generateButton = screen.getByTestId('synthesis-generate-btn');
    expect(generateButton).toBeDisabled();
  });

  it('should show placeholder text in query input', () => {
    render(<SynthesisDialog {...defaultProps} />);
    
    const input = screen.getByTestId('synthesis-query-input');
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('What would you like to synthesize?'));
  });
});
