/**
 * Mock PDF.js for testing
 */

import { vi } from 'vitest';

export const mockPDFjs = {
  getDocument: vi.fn().mockResolvedValue({
    promise: Promise.resolve({
      numPages: 10,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Test content', fontName: 'Arial' },
            { str: ' on page 1', fontName: 'Arial' },
          ],
        }),
        render: vi.fn().mockResolvedValue({}),
        getViewport: vi.fn().mockReturnValue({ width: 800, height: 1200 }),
      }),
    }),
  }),
  GlobalWorkerOptions: {
    workerSrc: '/pdf.worker.min.js',
  },
};

// Mock pdfjs-dist module
vi.mock('pdfjs-dist', () => mockPDFjs);

