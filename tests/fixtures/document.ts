/**
 * Document fixtures for testing
 */

export const mockBook = {
  id: 'test-book-id-123',
  user_id: 'test-user-id-123',
  title: 'Test Document',
  file_name: 'test-document.pdf',
  file_type: 'application/pdf',
  file_size: 1024000, // 1MB
  s3_key: 'books/test-user-id-123/test-book-id-123.pdf',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockBooks = [
  mockBook,
  {
    ...mockBook,
    id: 'test-book-id-456',
    title: 'Another Document',
    file_name: 'another-document.pdf',
  },
  {
    ...mockBook,
    id: 'test-book-id-789',
    title: 'Third Document',
    file_name: 'third-document.txt',
    file_type: 'text/plain',
  },
];

export const mockPDFTextContent = {
  items: [
    { str: 'This is test content from a PDF document.' },
    { str: 'It contains multiple sentences.' },
    { str: 'And paragraphs with various information.' },
  ],
};

export const mockPDFPage = {
  getTextContent: () => Promise.resolve(mockPDFTextContent),
  render: () => Promise.resolve({}),
  getViewport: () => ({ width: 800, height: 1200 }),
};

export const mockPDFDocument = {
  numPages: 5,
  getPage: () => Promise.resolve(mockPDFPage),
};

