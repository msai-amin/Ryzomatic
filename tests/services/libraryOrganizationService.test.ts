import { describe, it, expect, beforeEach, vi } from 'vitest';

const { rpcMock, supabaseFromMock, createErrorMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  createErrorMock: vi.fn((message: string) => new Error(message))
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: supabaseFromMock
  },
  userBooks: {},
  userNotes: {},
  userAudio: {}
}));

vi.mock('../../src/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../src/services/errorHandler', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/errorHandler')>(
    '../../src/services/errorHandler'
  );
  return {
    ...actual,
    errorHandler: {
      ...actual.errorHandler,
      createError: createErrorMock
    }
  };
});

import { libraryOrganizationService } from '../../src/services/libraryOrganizationService';

describe('libraryOrganizationService (sidebar integrations)', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createErrorMock.mockClear();
    libraryOrganizationService.setCurrentUser('user-123');
  });

  describe('reorderCollections', () => {
    it('calls Supabase RPC with user context', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        libraryOrganizationService.reorderCollections('parent-1', ['col-1', 'col-2'])
      ).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith('reorder_user_collections', {
        user_uuid: 'user-123',
        parent_uuid: 'parent-1',
        ordered_ids: ['col-1', 'col-2']
      });
    });

    it('wraps Supabase errors via error handler', async () => {
      const failure = { message: 'something went wrong' };
      rpcMock.mockResolvedValueOnce({ data: null, error: failure as any });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.reorderCollections('parent-1', ['col-1'])
      ).rejects.toThrow('Failed to reorder collections: something went wrong');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to reorder collections: something went wrong',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'reorderCollections',
          parentId: 'parent-1',
          orderedIds: ['col-1'],
          error: 'something went wrong'
        })
      );
    });
  });

  describe('bulkAddToCollection', () => {
    it('delegates to transactional Supabase RPC', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        libraryOrganizationService.bulkAddToCollection(['book-1', 'book-2'], 'collection-1')
      ).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith('bulk_assign_books_to_collection', {
        user_uuid: 'user-123',
        collection_uuid: 'collection-1',
        book_ids: ['book-1', 'book-2']
      });
    });

    it('raises formatted error when Supabase rejects request', async () => {
      const failure = { message: 'duplicate key value violates unique constraint' };
      rpcMock.mockResolvedValueOnce({ data: null, error: failure as any });
      createErrorMock.mockImplementationOnce((message: string) => new Error(message));

      await expect(
        libraryOrganizationService.bulkAddToCollection(['book-5'], 'collection-9')
      ).rejects.toThrow('Failed to bulk add books to collection: duplicate key value violates unique constraint');

      expect(createErrorMock).toHaveBeenCalledWith(
        'Failed to bulk add books to collection: duplicate key value violates unique constraint',
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          context: 'bulkAddToCollection',
          bookIds: ['book-5'],
          collectionId: 'collection-9',
          error: 'duplicate key value violates unique constraint'
        })
      );
    });
  });
});

